'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
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
import {
  type SearchScope,
  type SearchGroup,
  type UnifiedSearchItem,
  SCOPE_CHIPS,
  SearchFilterChips,
  SearchEmptyState,
  SearchResultsList,
  getSystemActions,
  filterActions,
  getCategoryItems,
  filterCategories,
  scanCurrentHeadings,
  getOutlineItems,
  filterOutlines,
} from './search'

const tooltipPosition = 'left-1/2 top-full mt-1.5 -translate-x-1/2'
const RECENT_KEY = 'orange_recent_visits'

export function SearchDialog() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeScope, setActiveScope] = useState<SearchScope>('all')
  const [pagefindItems, setPagefindItems] = useState<UnifiedSearchItem[] | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recentVisits, setRecentVisits] = useState<Array<{ url: string; title: string }>>([])
  const [headings, setHeadings] = useState<ReturnType<typeof scanCurrentHeadings>>([])

  const inputRef = useRef<HTMLInputElement>(null)
  const seqRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const player = useOptionalPlayer()

  // 1. 快捷键 Ctrl/Cmd+K 唤起
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'p') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // 2. 打开弹窗时初始化：扫描大纲、读取最近访问
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
      setHeadings(scanCurrentHeadings())
      try {
        const stored = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
        setRecentVisits(stored)
      } catch {
        setRecentVisits([])
      }
    } else {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [open])

  // 3. 构建静态候选动作与分类
  const systemActions = useMemo(
    () => getSystemActions({ onClose: () => setOpen(false), player }),
    [player],
  )
  const categoryItems = useMemo(
    () => getCategoryItems(() => setOpen(false)),
    [],
  )
  const outlineItems = useMemo(
    () => getOutlineItems(headings, () => setOpen(false)),
    [headings],
  )

  // 4. 执行 Pagefind 全文检索（轻量防抖优化输入体验）
  function handleInput(value: string) {
    setQuery(value)
    setSelectedIndex(-1)
    const seq = ++seqRef.current

    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    if (!value.trim()) {
      setPagefindItems(null)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    timerRef.current = setTimeout(async () => {
      try {
        const pagefind = await loadPagefind()
        if (seq !== seqRef.current) return
        if (!pagefind) {
          setPagefindItems(null)
          setError('搜索索引不可用，请先完成构建。')
          setLoading(false)
          return
        }

        const res = await pagefind.search(value)
        if (seq !== seqRef.current) return
        const items: PagefindResultItem[] = await Promise.all(res.results.map((r) => r.data()))
        if (seq !== seqRef.current) return
        setError(null)
        setLoading(false)

        const mapped: UnifiedSearchItem[] = items.map((it) => {
          let badge = '文章'
          if (it.url.startsWith('/life/')) badge = '生活'
          else if (it.url.startsWith('/music/')) badge = '音乐'
          else if (it.url.startsWith('/skills/')) badge = '技能'

          return {
            id: `pf-${it.url}`,
            kind: 'post',
            title: it.meta?.title ?? it.url,
            excerpt: it.excerpt ?? '',
            url: it.url,
            badge,
            onSelect: () => {
              setOpen(false)
              window.location.href = it.url
            },
          }
        })

        setPagefindItems(mapped)
      } catch {
        if (seq !== seqRef.current) return
        setPagefindItems(null)
        setError('搜索出错，请稍后再试。')
        setLoading(false)
      }
    }, 60)
  }

  // 5. 聚合分组结果（按当前 activeScope 过滤）
  const groups: SearchGroup[] = useMemo(() => {
    const q = query.trim()
    if (!q) return []

    const list: SearchGroup[] = []

    // 分组 A：Pagefind 文章与内容
    if (pagefindItems && pagefindItems.length > 0) {
      let filtered = pagefindItems
      if (activeScope === 'posts') {
        filtered = filtered.filter((i) => i.url?.startsWith('/posts/'))
      } else if (activeScope === 'skills') {
        filtered = filtered.filter((i) => i.url?.startsWith('/skills/'))
      } else if (activeScope === 'life') {
        filtered = filtered.filter((i) => i.url?.startsWith('/life/'))
      } else if (activeScope === 'music') {
        filtered = filtered.filter((i) => i.url?.startsWith('/music/'))
      }

      if (filtered.length > 0) {
        list.push({
          id: 'group-posts',
          label: '文章与内容',
          items: filtered,
        })
      }
    }

    // 分组 B：本文章节大纲（全部作用域或文章作用域下且在有大纲的页面）
    if ((activeScope === 'all' || activeScope === 'posts') && outlineItems.length > 0) {
      const filteredOutline = filterOutlines(outlineItems, q)
      if (filteredOutline.length > 0) {
        list.push({
          id: 'group-outlines',
          label: '本文小节大纲',
          items: filteredOutline,
        })
      }
    }

    // 分组 C：分类与栏目直达
    if (activeScope === 'all' || activeScope === 'posts') {
      const filteredCat = filterCategories(categoryItems, q)
      if (filteredCat.length > 0) {
        list.push({
          id: 'group-categories',
          label: '分类与专栏',
          items: filteredCat,
        })
      }
    }

    // 分组 D：快捷系统动作
    if (activeScope === 'all') {
      const filteredAct = filterActions(systemActions, q)
      if (filteredAct.length > 0) {
        list.push({
          id: 'group-actions',
          label: '快捷操作',
          items: filteredAct,
        })
      }
    }

    return list
  }, [query, activeScope, pagefindItems, outlineItems, categoryItems, systemActions])

  // 6. 扁平化所有展示项，供键盘上下导航
  const flatItems = useMemo(() => {
    return groups.flatMap((g) => g.items)
  }, [groups])

  // 7. 键盘导航处理
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // 按 Tab 键在作用域胶囊之间轮换
    if (e.key === 'Tab') {
      e.preventDefault()
      const scopeIds: SearchScope[] = SCOPE_CHIPS.map((c) => c.id)
      const currentIndex = scopeIds.indexOf(activeScope)
      const nextIndex = e.shiftKey
        ? (currentIndex - 1 + scopeIds.length) % scopeIds.length
        : (currentIndex + 1) % scopeIds.length
      setActiveScope(scopeIds[nextIndex])
      setSelectedIndex(-1)
      return
    }

    if (flatItems.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < flatItems.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : flatItems.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && flatItems[selectedIndex]) {
        flatItems[selectedIndex].onSelect()
      } else if (flatItems.length > 0) {
        // 默认按回车打开第一条
        flatItems[0].onSelect()
      }
    }
  }

  // 8. 清空最近访问
  function handleClearRecent() {
    localStorage.removeItem(RECENT_KEY)
    setRecentVisits([])
  }

  const iconBtnClass =
    'group relative inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted/70 hover:text-foreground active:scale-95'

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
      <DialogContent
        aria-label="站内搜索"
        showCloseButton={false}
        overlayProps={{ 'data-testid': 'search-backdrop' }}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          inputRef.current?.focus()
        }}
        className="top-20 max-w-xl translate-y-0 gap-0 overflow-hidden rounded-2xl border-border/70 p-0 shadow-2xl bg-background"
      >
        <DialogTitle className="sr-only">站内搜索</DialogTitle>

        {/* 顶部输入框 */}
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          {loading ? (
            <Loader2 className="size-4 shrink-0 text-primary animate-spin" aria-hidden />
          ) : (
            <Search className="size-4 shrink-0 text-primary" aria-hidden />
          )}

          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索全站文章、生活、音乐与章节大纲..."
            aria-label="搜索关键词"
            className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
          />

          {query && (
            <button
              type="button"
              onClick={() => handleInput('')}
              className="text-muted-foreground hover:text-foreground p-1 transition-colors"
              aria-label="清空输入"
            >
              <X className="size-3.5" />
            </button>
          )}

          <IconButton
            label="关闭搜索"
            onClick={() => setOpen(false)}
            buttonClassName="relative inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-all duration-200 hover:bg-muted/70 hover:text-foreground active:scale-95"
            tipClassName={tooltipPosition}
          >
            <X className="size-4" aria-hidden />
          </IconButton>
        </div>

        {/* 分类过滤胶囊 */}
        <SearchFilterChips activeScope={activeScope} onSelectScope={setActiveScope} />

        {/* 结果区域 */}
        <div className="max-h-[22rem] overflow-y-auto p-1 scrollbar-thin">
          {error ? (
            <p className="p-6 text-center text-sm text-destructive">{error}</p>
          ) : !query.trim() ? (
            <SearchEmptyState
              recentVisits={recentVisits}
              onClearRecent={handleClearRecent}
              onSelectRecent={(item) => {
                setOpen(false)
                window.location.href = item.url
              }}
              suggestedActions={systemActions}
              onSelectAction={(action) => action.onSelect()}
            />
          ) : flatItems.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              未找到与 &quot;<span className="text-foreground font-medium">{query}</span>&quot; 相关的结果
            </div>
          ) : (
            <SearchResultsList
              groups={groups}
              selectedIndex={selectedIndex}
              onSelect={(item) => item.onSelect()}
            />
          )}
        </div>

        {/* 底栏快捷说明 */}
        <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-3.5 py-2 text-xs text-muted-foreground select-none">
          <div className="flex items-center gap-3">
            <span>↑↓ 导航</span>
            <span>↵ 打开</span>
            <span>Tab 切换分类</span>
          </div>
          <span>ESC 关闭</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
