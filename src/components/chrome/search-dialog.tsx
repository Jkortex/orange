'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Search, X, Terminal, Tag, Hash, History, Sparkles, BookOpen, Coffee, Music, Wrench, ListTree } from 'lucide-react'
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
 * - 支持综合搜索、> 命令模式、@ 分类/大类模式（含 @toc 虚拟子命令）、# 页内大纲模式
 * - 支持上下文感知作用域与快捷退出（Backspace / 胶囊点击）
 * - 快捷键支持：Mod+K / Mod+P 开关，g c / g a / g s 快速前缀，g h 首页
 */

export type SearchScope = 'all' | 'life' | 'posts' | 'music' | 'skills' | 'toc'

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

type CategoryItem = {
  name: string
  label: string
  slug: string
  desc?: string
  href?: string
  isToc?: boolean
}

const BASE_CATEGORIES: CategoryItem[] = [
  { name: 'life', label: '@生活 随笔', slug: 'life', desc: '日常碎片、即兴随笔与随手拍', href: '/life' },
  { name: 'posts', label: '@文章 全部', slug: 'posts', desc: '所有深度技术文章', href: '/posts' },
  { name: 'music', label: '@音乐 合辑', slug: 'music', desc: '精选音乐专辑与曲目', href: '/music' },
  { name: 'skills', label: '@技能 目录', slug: 'skills', desc: '可交互的 Agent 技能包', href: '/skills' },
  { name: 'tech', label: '技术文章', slug: 'tech', desc: '通用软件与开发技术' },
  { name: 'engineering', label: '软件工程', slug: 'engineering', desc: '架构演进与工程实践' },
  { name: 'principles', label: '工程原则', slug: 'principles', desc: '极简与清晰的设计准则' },
  { name: 'laws', label: '经典定律', slug: 'laws', desc: '计算机经典定律与经验' },
  { name: 'css', label: '样式探索', slug: 'css', desc: '现代 CSS 与动画体系' },
]

const TOC_CATEGORY_ITEM: CategoryItem = {
  name: 'toc',
  label: '@toc 页面大纲',
  slug: 'toc',
  desc: '跳转当前正文的章节目录',
  isToc: true,
}

const tooltipPosition = 'left-1/2 top-full mt-1.5 -translate-x-1/2'

export function SearchDialog() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[] | null>(null) // null = 未搜索
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const [error, setError] = useState<string | null>(null)
  const [symbols, setSymbols] = useState<SymbolItem[]>([])
  const [recentVisits, setRecentVisits] = useState<{ url: string; title: string }[]>([])
  const [activeScope, setActiveScope] = useState<SearchScope>('all')
  const inputRef = useRef<HTMLInputElement>(null)
  const seqRef = useRef(0)
  const player = useOptionalPlayer()

  // 监听自定义事件 orange:open-search，支持页面内按钮以指定 scope 打开
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

  // 检测当前页面是否有长文正文大纲（文章详情页等）
  const [hasOutline, setHasOutline] = useState(false)

  // TanStack Hotkeys 监听快捷序列
  useHotkeySequence(['G', 'C'], () => openWithPrefix('> '))
  useHotkeySequence(['G', 'A'], () => openWithPrefix('@ '))
  useHotkeySequence(['G', 'S'], () => {
    const headings = document.querySelectorAll<HTMLElement>('article h2[id], article h3[id], h2[id], h3[id]')
    if (headings.length > 0) {
      openWithPrefix('@toc')
    } else {
      openWithPrefix('# ')
    }
  })
  useHotkeySequence(['G', 'H'], () => {
    window.location.href = '/'
  })

  // 打开时聚焦输入框并智能推导默认作用域及大纲能力
  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      setSelectedIndex(-1)

      const headings = document.querySelectorAll<HTMLElement>(
        'article h2[id], article h3[id], h2[id], h3[id]',
      )
      setHasOutline(headings.length > 0)

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
    }
  }, [open, pathname])

  // 扫描当前页大纲（支持 # 或 @toc）
  useEffect(() => {
    if (open && (query.trim().startsWith('#') || query.trim() === '@toc' || query.trim().startsWith('@toc '))) {
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
      id: 'nav-life',
      title: '查看生活随笔',
      desc: '浏览日常碎片、随笔与随手拍',
      run: () => {
        window.location.href = '/life'
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
    : trimmed === '@toc' || trimmed.startsWith('@toc ') || trimmed.startsWith('#')
      ? 'symbol'
      : trimmed.startsWith('@')
        ? 'category'
        : 'search'

  // 命令模式过滤
  const commandKeyword = mode === 'command' ? trimmed.slice(1).trim().toLowerCase() : ''
  const filteredCommands = commands.filter(
    (c) => !commandKeyword || c.title.toLowerCase().includes(commandKeyword) || c.desc.toLowerCase().includes(commandKeyword),
  )

  // 分类/大类模式过滤：仅在有正文大纲时允许展示 @toc
  const availableCategories = hasOutline
    ? [TOC_CATEGORY_ITEM, ...BASE_CATEGORIES]
    : BASE_CATEGORIES

  const categoryKeyword = mode === 'category' ? trimmed.slice(1).trim().toLowerCase() : ''
  const filteredCategories = availableCategories.filter(
    (c) => !categoryKeyword || c.name.toLowerCase().includes(categoryKeyword) || c.label.toLowerCase().includes(categoryKeyword),
  )

  // 页面大纲过滤（支持 @toc 和 #）
  const symbolKeyword =
    mode === 'symbol'
      ? trimmed.startsWith('@toc')
        ? trimmed.replace(/^@toc\s*/, '').toLowerCase()
        : trimmed.slice(1).trim().toLowerCase()
      : ''
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

      let mappedResults = items.map((it) => ({
        url: it.url,
        title: it.meta?.title ?? it.url,
        excerpt: it.excerpt ?? '',
      }))

      // 按作用域过滤结果
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // 退格键：如果输入为空且在特定作用域下，退出该作用域切回全站
    if (e.key === 'Backspace' && query === '' && activeScope !== 'all') {
      e.preventDefault()
      setActiveScope('all')
      return
    }

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

    // 分类/大类模式回车跳转或执行
    if (mode === 'category') {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev < filteredCategories.length - 1 ? prev + 1 : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredCategories.length - 1))
      } else if (e.key === 'Enter' && selectedIndex >= 0 && filteredCategories[selectedIndex]) {
        e.preventDefault()
        const selected = filteredCategories[selectedIndex]
        if (selected.isToc) {
          setQuery('@toc')
          return
        }
        setOpen(false)
        if (selected.href) {
          window.location.href = selected.href
        } else {
          window.location.href = `/category/${selected.slug}`
        }
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
                : activeScope === 'skills'
                ? '技能'
                : '大纲'}
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
                : '搜索全站内容，> 命令，@ 分类…'
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
            <span>@ 分类/大类</span>
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
              onClick={() => openWithPrefix('# ')}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <span># 标签</span>
              <kbd className="font-mono text-xs text-muted-foreground/70">g s</kbd>
            </button>
          )}
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
                      href={c.isToc ? '#' : c.href || `/category/${c.slug}`}
                      onClick={(e) => {
                        if (c.isToc) {
                          e.preventDefault()
                          setQuery('@toc')
                        }
                      }}
                      className={`flex w-full items-center justify-between rounded-md p-2.5 text-left text-sm transition-colors ${
                        selectedIndex === i ? 'bg-primary/15 ring-1 ring-primary/30' : 'hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {c.isToc ? (
                          <ListTree className="h-4 w-4 text-primary shrink-0" aria-hidden />
                        ) : c.href ? (
                          <Sparkles className="h-4 w-4 text-primary shrink-0" aria-hidden />
                        ) : (
                          <Tag className="h-4 w-4 text-primary shrink-0" aria-hidden />
                        )}
                        <div>
                          <span className="font-medium text-foreground">{c.label}</span>
                          {c.desc && (
                            <span className="block text-xs text-muted-foreground">{c.desc}</span>
                          )}
                        </div>
                      </div>
                      <span className="font-mono text-xs text-muted-foreground shrink-0">@{c.slug}</span>
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
              {results.map((r, i) => {
                const typeLabel = r.url.startsWith('/life/')
                  ? '生活'
                  : r.url.startsWith('/posts/')
                  ? '文章'
                  : r.url.startsWith('/music/')
                  ? '音乐'
                  : r.url.startsWith('/skills/')
                  ? '技能'
                  : null

                return (
                  <li key={r.url}>
                    <a
                      href={r.url}
                      className={`block rounded-md p-3 transition-colors ${
                        selectedIndex === i ? 'bg-primary/15 ring-1 ring-primary/30' : 'hover:bg-primary/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="block font-medium truncate">{r.title}</span>
                        {typeLabel && (
                          <span className="shrink-0 rounded-full border border-border/60 bg-muted/60 px-2 py-px text-[11px] font-medium text-muted-foreground">
                            {typeLabel}
                          </span>
                        )}
                      </div>
                      <span
                        className="mt-1 block text-sm text-muted-foreground [&>mark]:bg-primary/20 [&>mark]:text-foreground"
                        dangerouslySetInnerHTML={{ __html: r.excerpt }}
                      />
                    </a>
                  </li>
                )
              })}
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
