'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Search, X, Terminal, Tag, Hash } from 'lucide-react'
import { useHotkey, useHotkeySequence } from '@tanstack/react-hotkeys'
import { loadPagefind, type PagefindResultItem } from '@/lib/pagefind'
import { IconButton } from '@/components/primitives/icon-button'
import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tip } from '@/components/primitives/tip'
import { useOptionalPlayer } from '@/components/player/player-provider'
import type { SearchScope, SearchMode as SearchModeType, Result } from './search/types'
import { buildCommands, filterCommands } from './search/commands'
import {
  BASE_CATEGORIES,
  filterCategories,
  scanPageHeadings,
  filterSymbols,
} from './search/categories'
import {
  CommandMode,
  CategoryMode,
  SymbolMode,
  SearchMode,
  jumpToHeading,
} from './search/modes'

export type { SearchScope }

const tooltipPosition = 'left-1/2 top-full mt-1.5 -translate-x-1/2'

export function SearchDialog() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[] | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const [error, setError] = useState<string | null>(null)
  const [symbols, setSymbols] = useState<{ id: string; title: string; depth: number }[]>([])
  const [activeScope, setActiveScope] = useState<SearchScope>('all')
  const [hasOutline, setHasOutline] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const seqRef = useRef(0)
  const player = useOptionalPlayer()

  // ── 命令列表 ──────────────────────────────────────────
  const commands = buildCommands(player)

  // ── 自定义事件监听 ────────────────────────────────────
  useEffect(() => {
    function handleCustomOpen(e: Event) {
      const customEvent = e as CustomEvent<{ scope?: SearchScope; query?: string }>
      setOpen(true)
      if (customEvent.detail?.scope) {
        setActiveScope(customEvent.detail.scope)
      }
      if (customEvent.detail?.query !== undefined) {
        setQuery(customEvent.detail.query)
      }
      setTimeout(() => inputRef.current?.focus(), 0)
    }
    window.addEventListener('orange:open-search', handleCustomOpen)
    return () => window.removeEventListener('orange:open-search', handleCustomOpen)
  }, [])

  // ── 打开面板辅助 ──────────────────────────────────────
  function openWithPrefix(prefix: string) {
    setOpen(true)
    setQuery(prefix)
    setSelectedIndex(-1)
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(prefix.length, prefix.length)
    }, 0)
  }

  // ── Ctrl/Cmd+K 监听 ──────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'p') &&
        (e.metaKey || e.ctrlKey)
      ) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── TanStack Hotkeys ──────────────────────────────────
  useHotkeySequence(['G', 'C'], () => openWithPrefix('> '))
  useHotkeySequence(['G', 'A'], () => openWithPrefix('@ '))
  useHotkeySequence(['G', 'S'], () => openWithPrefix('@toc'))
  useHotkeySequence(['G', 'H'], () => {
    window.location.href = '/'
  })

  // ── 打开时初始化 ──────────────────────────────────────
  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      setSelectedIndex(-1)
      setHasOutline(scanPageHeadings().length > 0)

      // 智能推导默认作用域（仅 'all' 时）
      if (pathname && activeScope === 'all') {
        if (pathname.startsWith('/life')) {
          setActiveScope('life')
        } else if (pathname === '/posts') {
          setActiveScope('posts')
        } else if (pathname === '/music') {
          setActiveScope('music')
        } else if (pathname === '/skills') {
          setActiveScope('skills')
        }
      }
    } else {
      // 关闭时重置作用域，避免跨页面残留
      setActiveScope('all')
    }
  }, [open, pathname])

  // ── 扫描大纲（@toc / # 模式）────────────────────────
  useEffect(() => {
    if (
      open &&
      (query.trim() === '@toc' ||
        query.trim().startsWith('@toc ') ||
        query.trim().startsWith('#'))
    ) {
      setSymbols(scanPageHeadings())
    }
  }, [open, query])

  // ── 模式判定 ──────────────────────────────────────────
  const trimmed = query.trim()
  const mode: SearchModeType = trimmed.startsWith('>')
    ? 'command'
    : trimmed === '@toc' ||
        trimmed.startsWith('@toc ') ||
        trimmed.startsWith('#')
      ? 'symbol'
      : trimmed.startsWith('@')
        ? 'category'
        : 'search'

  // ── 命令过滤 ──────────────────────────────────────────
  const commandKeyword = mode === 'command' ? trimmed.slice(1).trim().toLowerCase() : ''
  const filteredCommands = filterCommands(commands, commandKeyword)

  // ── 分类过滤 ──────────────────────────────────────────
  const categoryKeyword = mode === 'category' ? trimmed.slice(1).trim().toLowerCase() : ''
  const filteredCategories = filterCategories(BASE_CATEGORIES, categoryKeyword)

  // ── 大纲过滤 ──────────────────────────────────────────
  const symbolKeyword =
    mode === 'symbol'
      ? trimmed.startsWith('@toc')
        ? trimmed.replace(/^@toc\s*/, '').toLowerCase()
        : trimmed.slice(1).trim().toLowerCase()
      : ''
  const filteredSymbols = filterSymbols(symbols, symbolKeyword)

  // ── 搜索执行 ──────────────────────────────────────────
  async function handleInput(value: string) {
    setQuery(value)
    setSelectedIndex(-1)
    const seq = ++seqRef.current

    if (
      value.trim().startsWith('>') ||
      value.trim().startsWith('@') ||
      value.trim().startsWith('#')
    ) {
      setResults(null)
      setError(null)
      return
    }

    if (!value.trim()) {
      setResults(null)
      setError(null)
      return
    }

    try {
      const pagefind = await loadPagefind()
      if (seq !== seqRef.current) return
      if (!pagefind) {
        setResults(null)
        setError('搜索索引不可用，请先完成构建。')
        return
      }
      const res = await pagefind.search(value)
      if (seq !== seqRef.current) return
      const items: PagefindResultItem[] = await Promise.all(
        res.results.map((r) => r.data()),
      )
      if (seq !== seqRef.current) return
      setError(null)

      let mappedResults = items.map((it) => ({
        url: it.url,
        title: it.meta?.title ?? it.url,
        excerpt: it.excerpt ?? '',
      }))

      // 按作用域过滤
      if (activeScope === 'life') {
        mappedResults = mappedResults.filter((it) => it.url.startsWith('/life/'))
      } else if (activeScope === 'posts') {
        mappedResults = mappedResults.filter((it) => it.url.startsWith('/posts/'))
      } else if (activeScope === 'music') {
        mappedResults = mappedResults.filter((it) => it.url.startsWith('/music/'))
      } else if (activeScope === 'skills') {
        mappedResults = mappedResults.filter((it) => it.url.startsWith('/skills/'))
      }

      setResults(mappedResults)
    } catch {
      if (seq !== seqRef.current) return
      setResults(null)
      setError('搜索出错，请稍后再试。')
    }
  }

  // ── 键盘导航 ──────────────────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && query === '' && activeScope !== 'all') {
      e.preventDefault()
      setActiveScope('all')
      return
    }

    if (mode === 'command') {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : 0,
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredCommands.length - 1,
        )
      } else if (
        e.key === 'Enter' &&
        selectedIndex >= 0 &&
        filteredCommands[selectedIndex]
      ) {
        e.preventDefault()
        setOpen(false)
        filteredCommands[selectedIndex].run()
      }
      return
    }

    if (mode === 'category') {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < filteredCategories.length - 1 ? prev + 1 : 0,
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredCategories.length - 1,
        )
      } else if (
        e.key === 'Enter' &&
        selectedIndex >= 0 &&
        filteredCategories[selectedIndex]
      ) {
        e.preventDefault()
        const selected = filteredCategories[selectedIndex]
        setOpen(false)
        if (selected.href) {
          window.location.href = selected.href
        } else {
          window.location.href = `/category/${selected.slug}`
        }
      }
      return
    }

    if (mode === 'symbol') {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < filteredSymbols.length - 1 ? prev + 1 : 0,
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredSymbols.length - 1,
        )
      } else if (
        e.key === 'Enter' &&
        selectedIndex >= 0 &&
        filteredSymbols[selectedIndex]
      ) {
        e.preventDefault()
        setOpen(false)
        jumpToHeading(filteredSymbols[selectedIndex].id)
      }
      return
    }

    // 搜索模式
    if (!results || results.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) =>
        prev < results.length - 1 ? prev + 1 : 0,
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : results.length - 1,
      )
    } else if (
      e.key === 'Enter' &&
      selectedIndex >= 0 &&
      results[selectedIndex]
    ) {
      e.preventDefault()
      setOpen(false)
      window.location.href = results[selectedIndex].url
    }
  }

  // ── 模式切换标签 ──────────────────────────────────────
  function ModeTabs() {
    return (
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-4 py-1.5 text-[13px]">
        <button
          type="button"
          onClick={() => openWithPrefix('> ')}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <span>&gt; 命令</span>
          <kbd className="font-mono text-xs text-muted-foreground/70">g c</kbd>
        </button>
        <button
          type="button"
          onClick={() => openWithPrefix('@ ')}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <span>@ 板块导航</span>
          <kbd className="font-mono text-xs text-muted-foreground/70">g a</kbd>
        </button>
        {hasOutline ? (
          <button
            type="button"
            onClick={() => openWithPrefix('@toc')}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <span>@toc 大纲</span>
            <kbd className="font-mono text-xs text-muted-foreground/70">g s</kbd>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => openWithPrefix('@toc')}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <span># 大纲</span>
            <kbd className="font-mono text-xs text-muted-foreground/70">g s</kbd>
          </button>
        )}
      </div>
    )
  }

  const iconBtnClass =
    'group relative inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-all duration-200 hover:bg-muted/70 hover:text-foreground active:scale-95'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          tabIndex={-1}
          aria-label="搜索"
          aria-keyshortcuts="Control+K Meta+K"
          className={iconBtnClass}
        >
          <Search className="size-5" aria-hidden />
          <Tip className={tooltipPosition}>搜索</Tip>
        </button>
      </DialogTrigger>
      <DialogOverlay data-testid="search-backdrop" />
      <DialogContent
        aria-label="站内搜索"
        showCloseButton={false}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          inputRef.current?.focus()
        }}
        className="top-24 max-w-lg translate-y-0 gap-0 overflow-hidden rounded-2xl border-border/70 p-0 shadow-2xl"
      >
        <DialogTitle className="sr-only">站内搜索</DialogTitle>

        {/* 搜索输入区域 */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          {mode === 'command' ? (
            <Terminal className="size-4 shrink-0 text-primary" aria-hidden />
          ) : mode === 'category' ? (
            <Tag className="size-4 shrink-0 text-primary" aria-hidden />
          ) : mode === 'symbol' ? (
            <Hash className="size-4 shrink-0 text-primary" aria-hidden />
          ) : (
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}

          {activeScope !== 'all' && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {activeScope === 'life'
                ? '生活'
                : activeScope === 'posts'
                  ? '文章'
                  : activeScope === 'music'
                    ? '音乐'
                    : '技能'}
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setActiveScope('all')}
                className="text-primary/60 hover:text-primary transition-colors ml-0.5"
                aria-label="清除作用域"
              >
                <X className="size-3" />
              </button>
            </span>
          )}

          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              activeScope === 'life'
                ? '搜索生活记录、地点与随笔…'
                : activeScope === 'posts'
                  ? '搜索技术文章与分类…'
                  : activeScope === 'music'
                    ? '搜索音乐专辑与曲目…'
                    : activeScope === 'skills'
                      ? '搜索技能包与命令…'
                      : hasOutline
                        ? '搜索本文，@toc 章节大纲，> 命令…'
                        : '搜索全站内容，> 命令，@ 板块…'
            }
            aria-label="搜索关键词"
            className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />

          {mode !== 'search' && (
            <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-[13px] font-medium text-primary">
              {mode === 'command'
                ? '命令模式'
                : mode === 'category'
                  ? '分类模式'
                  : '页内大纲'}
            </span>
          )}

          <IconButton
            label="关闭搜索"
            onClick={() => setOpen(false)}
            buttonClassName="relative inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-all duration-200 hover:bg-muted/70 hover:text-foreground active:scale-95"
            tipClassName={tooltipPosition}
          >
            <X className="size-4" aria-hidden />
          </IconButton>
        </div>

        <ModeTabs />

        {/* 结果区域 */}
        <div className="max-h-80 overflow-y-auto p-2">
          {mode === 'command' ? (
            <CommandMode
              commands={filteredCommands}
              selectedIndex={selectedIndex}
              onSelect={(c) => {
                setOpen(false)
                c.run()
              }}
            />
          ) : mode === 'category' ? (
            <CategoryMode
              categories={filteredCategories}
              selectedIndex={selectedIndex}
              hasOutline={hasOutline}
              onSelect={(c) => {
                setOpen(false)
                if (c.href) {
                  window.location.href = c.href
                } else {
                  window.location.href = `/category/${c.slug}`
                }
              }}
            />
          ) : mode === 'symbol' ? (
            <SymbolMode
              symbols={filteredSymbols}
              selectedIndex={selectedIndex}
              onSelect={(s) => {
                setOpen(false)
                jumpToHeading(s.id)
              }}
            />
          ) : (
            <SearchMode
              results={results}
              error={error}
              selectedIndex={selectedIndex}
              onSelect={(r) => {
                setOpen(false)
                window.location.href = r.url
              }}
            />
          )}
        </div>

        {/* 底栏 */}
        <div className="flex items-center justify-between border-t border-border px-3 py-1.5 text-[13px] text-muted-foreground">
          <span>↑↓ 选择 · Enter 打开</span>
          <span>ESC 关闭</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
