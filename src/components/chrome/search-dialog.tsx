'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X, Terminal, Tag, Hash, History, Sparkles } from 'lucide-react'
import { useHotkey, useHotkeySequence } from '@tanstack/react-hotkeys'
import { loadPagefind, type PagefindResultItem } from '@/lib/pagefind'
import { animateThemeChange } from '@/lib/theme-transition'
import { scrollToHeading } from '@/lib/scroll'
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

/*
 * 全局命令面板 & 站内搜索（AGENTS.md 界面布局规范）：
 * - 顶栏图标按钮（满足图标化三判据，aria-label + hover/focus 提示）
 * - 支持综合搜索、> 命令模式、@ 分类模式、# 页内大纲模式
 * - 快捷键支持：Mod+K / Mod+P 开关，g c / g a / g s 快速前缀，g h 首页
 */

type Result = { url: string; title: string; excerpt: string }

type CommandItem = {
  id: string
  title: string
  desc: string
  keys?: string
  run: () => void
}

type SymbolItem = {
  id: string
  title: string
  depth: number
}

const KNOWN_CATEGORIES = [
  { name: 'tech', label: '技术文章', slug: 'tech' },
  { name: 'life', label: '生活随笔', slug: 'life' },
  { name: 'engineering', label: '软件工程', slug: 'engineering' },
  { name: 'principles', label: '工程原则', slug: 'principles' },
  { name: 'laws', label: '经典定律', slug: 'laws' },
  { name: 'css', label: '样式探索', slug: 'css' },
]

const tooltipPosition = 'left-1/2 top-full mt-1.5 -translate-x-1/2'

export function SearchDialog() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[] | null>(null) // null = 未搜索
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const [error, setError] = useState<string | null>(null)
  const [symbols, setSymbols] = useState<SymbolItem[]>([])
  const [recentVisits, setRecentVisits] = useState<{ url: string; title: string }[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const seqRef = useRef(0)
  const player = useOptionalPlayer()

  // 读取 localStorage 最近访问记录
  useEffect(() => {
    if (open) {
      try {
        const raw = localStorage.getItem('orange_recent_visits')
        if (raw) setRecentVisits(JSON.parse(raw))
      } catch {
        setRecentVisits([])
      }
    }
  }, [open])

  // 打开面板的辅助函数
  function openWithPrefix(prefix: string) {
    setOpen(true)
    setQuery(prefix)
    setSelectedIndex(-1)
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(prefix.length, prefix.length)
    }, 0)
  }

  // 大纲跳转：居中滚动 + 目标 ring 高亮 2s（两处符号跳转共用）
  function jumpToSymbol(id: string) {
    if (!scrollToHeading(id, { block: 'center' })) return
    const target = document.getElementById(id)
    if (target) {
      target.classList.add('ring-2', 'ring-primary/60', 'rounded', 'transition-all', 'duration-300')
      setTimeout(() => {
        target.classList.remove('ring-2', 'ring-primary/60', 'rounded', 'transition-all', 'duration-300')
      }, 2000)
    }
  }

  // Ctrl/Cmd+K 原生监听（双重保险保持已有测试 100% 兼容）
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'p') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // TanStack Hotkeys 监听快捷序列
  useHotkeySequence(['G', 'C'], () => openWithPrefix('> '))
  useHotkeySequence(['G', 'A'], () => openWithPrefix('@ '))
  useHotkeySequence(['G', 'S'], () => openWithPrefix('# '))
  useHotkeySequence(['G', 'H'], () => {
    window.location.href = '/'
  })

  // 打开时聚焦输入框
  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      setSelectedIndex(-1)
    }
  }, [open])

  // 扫描当前页大纲
  useEffect(() => {
    if (open && query.trim().startsWith('#')) {
      const headings = Array.from(document.querySelectorAll<HTMLElement>('article h2[id], article h3[id], h2[id], h3[id]'))
      setSymbols(
        headings.map((h) => ({
          id: h.id,
          title: h.textContent?.replace(/复制标题链接|已复制链接/, '').trim() ?? h.id,
          depth: h.tagName === 'H2' ? 2 : 3,
        })),
      )
    }
  }, [open, query])

  // 系统命令列表
  const commands: CommandItem[] = [
    {
      id: 'theme-toggle',
      title: '切换深浅主题',
      desc: '在明亮与暗黑风格之间快速切换',
      keys: 't',
      run: () => {
        animateThemeChange(() => {
          // 双参数 toggle 保证可重放（过渡 helper 会预应用一次、盖住后重放一次）
          const isDark = !document.documentElement.classList.contains('dark')
          document.documentElement.classList.toggle('dark', isDark)
          localStorage.setItem('theme-mode', isDark ? 'dark' : 'light')
        })
      },
    },
    {
      id: 'nav-home',
      title: '前往博客首页',
      desc: '返回站点首页综合时间线',
      keys: 'g h',
      run: () => {
        window.location.href = '/'
      },
    },
    {
      id: 'nav-posts',
      title: '查看文章专栏',
      desc: '浏览博客全部分类与深度技术文章',
      run: () => {
        window.location.href = '/posts'
      },
    },
    {
      id: 'nav-music',
      title: '查看音乐合辑',
      desc: '收听精选音乐专辑并随心播放',
      run: () => {
        window.location.href = '/music'
      },
    },
    {
      id: 'nav-skills',
      title: '查看技能目录',
      desc: '探索可交互的开发技能包与工作流',
      run: () => {
        window.location.href = '/skills'
      },
    },
    {
      id: 'clear-music',
      title: '清空播放队列',
      desc: '清除全局音频播放条中的所有曲目',
      run: () => {
        player?.clear()
      },
    },
    {
      id: 'hotkey-help',
      title: '显示快捷键指南',
      desc: '查看全站所有快捷操作速查表',
      keys: '?',
      run: () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }))
      },
    },
  ]

  const trimmed = query.trim()
  const mode: 'command' | 'category' | 'symbol' | 'search' = trimmed.startsWith('>')
    ? 'command'
    : trimmed.startsWith('@')
      ? 'category'
      : trimmed.startsWith('#')
        ? 'symbol'
        : 'search'

  // 命令模式过滤
  const commandKeyword = mode === 'command' ? trimmed.slice(1).trim().toLowerCase() : ''
  const filteredCommands = commands.filter(
    (c) => !commandKeyword || c.title.toLowerCase().includes(commandKeyword) || c.desc.toLowerCase().includes(commandKeyword),
  )

  // 分类模式过滤
  const categoryKeyword = mode === 'category' ? trimmed.slice(1).trim().toLowerCase() : ''
  const filteredCategories = KNOWN_CATEGORIES.filter(
    (c) => !categoryKeyword || c.name.toLowerCase().includes(categoryKeyword) || c.label.toLowerCase().includes(categoryKeyword),
  )

  // 页面大纲过滤
  const symbolKeyword = mode === 'symbol' ? trimmed.slice(1).trim().toLowerCase() : ''
  const filteredSymbols = symbols.filter(
    (s) => !symbolKeyword || s.title.toLowerCase().includes(symbolKeyword),
  )

  async function handleInput(value: string) {
    setQuery(value)
    setSelectedIndex(-1)
    const seq = ++seqRef.current

    if (value.trim().startsWith('>') || value.trim().startsWith('@') || value.trim().startsWith('#')) {
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
      const items: PagefindResultItem[] = await Promise.all(res.results.map((r) => r.data()))
      if (seq !== seqRef.current) return
      setError(null)
      setResults(
        items.map((it) => ({
          url: it.url,
          title: it.meta?.title ?? it.url,
          excerpt: it.excerpt ?? '',
        })),
      )
    } catch {
      if (seq !== seqRef.current) return
      setResults(null)
      setError('搜索出错，请稍后再试。')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // 命令模式回车执行
    if (mode === 'command') {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev < filteredCommands.length - 1 ? prev + 1 : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredCommands.length - 1))
      } else if (e.key === 'Enter' && selectedIndex >= 0 && filteredCommands[selectedIndex]) {
        e.preventDefault()
        setOpen(false)
        filteredCommands[selectedIndex].run()
      }
      return
    }

    // 分类模式回车跳转
    if (mode === 'category') {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev < filteredCategories.length - 1 ? prev + 1 : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredCategories.length - 1))
      } else if (e.key === 'Enter' && selectedIndex >= 0 && filteredCategories[selectedIndex]) {
        e.preventDefault()
        setOpen(false)
        window.location.href = `/category/${filteredCategories[selectedIndex].slug}`
      }
      return
    }

    // 页面大纲模式回车跳转
    if (mode === 'symbol') {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev < filteredSymbols.length - 1 ? prev + 1 : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredSymbols.length - 1))
      } else if (e.key === 'Enter' && selectedIndex >= 0 && filteredSymbols[selectedIndex]) {
        e.preventDefault()
        setOpen(false)
        jumpToSymbol(filteredSymbols[selectedIndex].id)
      }
      return
    }

    // 搜索模式回车打开
    if (!results || results.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
    } else if (e.key === 'Enter' && selectedIndex >= 0 && results[selectedIndex]) {
      e.preventDefault()
      setOpen(false)
      window.location.href = results[selectedIndex].url
    }
  }

  const iconBtnClass =
    'group relative inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-all duration-200 hover:bg-muted/70 hover:text-foreground active:scale-95'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
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

          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索文章，> 命令，@ 分类，# 大纲…"
            aria-label="搜索关键词"
            className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />

          {mode !== 'search' && (
            <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-[13px] font-medium text-primary">
              {mode === 'command' ? '命令模式' : mode === 'category' ? '分类模式' : '页内大纲'}
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

        {/* 模式切换快捷标签条 */}
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
            <span>@ 分类</span>
            <kbd className="font-mono text-xs text-muted-foreground/70">g a</kbd>
          </button>
          <button
            type="button"
            onClick={() => openWithPrefix('# ')}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <span># 大纲</span>
            <kbd className="font-mono text-xs text-muted-foreground/70">g s</kbd>
          </button>
        </div>

        {/* 结果呈现区域 */}
        <div className="max-h-80 overflow-y-auto p-2">
          {/* 命令模式 */}
          {mode === 'command' ? (
            <ul className="space-y-1">
              {filteredCommands.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">未找到匹配的命令。</p>
              ) : (
                filteredCommands.map((c, i) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false)
                        c.run()
                      }}
                      className={`flex w-full items-center justify-between rounded-md p-2.5 text-left text-sm transition-colors ${
                        selectedIndex === i ? 'bg-primary/15 ring-1 ring-primary/30' : 'hover:bg-muted'
                      }`}
                    >
                      <div>
                        <span className="font-medium text-foreground">{c.title}</span>
                        <span className="mt-0.5 block text-[13px] text-muted-foreground">{c.desc}</span>
                      </div>
                      {c.keys && (
                        <kbd className="rounded border border-border bg-muted/70 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                          {c.keys}
                        </kbd>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : mode === 'category' ? (
            /* 分类模式 */
            <ul className="space-y-1">
              {filteredCategories.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">未找到匹配的分类。</p>
              ) : (
                filteredCategories.map((c, i) => (
                  <li key={c.slug}>
                    <a
                      href={`/category/${c.slug}`}
                      className={`flex w-full items-center justify-between rounded-md p-2.5 text-left text-sm transition-colors ${
                        selectedIndex === i ? 'bg-primary/15 ring-1 ring-primary/30' : 'hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-primary" aria-hidden />
                        <span className="font-medium text-foreground">{c.label}</span>
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">@{c.slug}</span>
                    </a>
                  </li>
                ))
              )}
            </ul>
          ) : mode === 'symbol' ? (
            /* 页内大纲模式 */
            <ul className="space-y-1">
              {filteredSymbols.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">当前页面未检测到子章节标题。</p>
              ) : (
                filteredSymbols.map((s, i) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false)
                        jumpToSymbol(s.id)
                      }}
                      className={`flex w-full items-center justify-between rounded-md p-2.5 text-left text-sm transition-colors ${
                        selectedIndex === i ? 'bg-primary/15 ring-1 ring-primary/30' : 'hover:bg-muted'
                      } ${s.depth === 3 ? 'pl-6' : ''}`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-mono text-xs text-primary font-semibold">
                          {s.depth === 2 ? 'H2' : 'H3'}
                        </span>
                        <span className="truncate font-medium text-foreground">{s.title}</span>
                      </div>
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : error ? (
            <p className="p-4 text-sm text-muted-foreground">{error}</p>
          ) : results === null ? (
            <div>
              {recentVisits.length > 0 && (
                <div className="mb-3">
                  <div className="mb-1.5 flex items-center gap-1.5 px-2 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <History className="size-3.5" aria-hidden />
                    <span>最近访问</span>
                  </div>
                  <ul className="space-y-0.5">
                    {recentVisits.slice(0, 4).map((r) => (
                      <li key={r.url}>
                        <a
                          href={r.url}
                          className="flex items-center justify-between rounded-md p-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <span className="truncate">{r.title}</span>
                          <span className="font-mono text-xs text-muted-foreground/60 truncate max-w-[120px]">
                            {r.url}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="p-4 text-sm text-muted-foreground">输入关键词搜索全站内容。</p>
            </div>
          ) : results.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">没有找到相关内容。</p>
          ) : (
            <ul>
              {results.map((r, i) => (
                <li key={r.url}>
                  <a
                    href={r.url}
                    className={`block rounded-md p-3 transition-colors ${
                      selectedIndex === i ? 'bg-primary/15 ring-1 ring-primary/30' : 'hover:bg-primary/10'
                    }`}
                  >
                    <span className="block font-medium">{r.title}</span>
                    <span
                      className="mt-1 block text-sm text-muted-foreground [&>mark]:bg-primary/20 [&>mark]:text-foreground"
                      dangerouslySetInnerHTML={{ __html: r.excerpt }}
                    />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 底栏快捷操作说明 */}
        <div className="flex items-center justify-between border-t border-border px-3 py-1.5 text-[13px] text-muted-foreground">
          <span>↑↓ 选择 · Enter 打开</span>
          <span>ESC 关闭</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
