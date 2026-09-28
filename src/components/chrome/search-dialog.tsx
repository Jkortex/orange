'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Loader2 } from 'lucide-react'
import { OPEN_SEARCH_EVENT, type OpenSearchEventDetail } from '@/lib/search-events'
import { loadPagefind, type PagefindResultItem } from '@/lib/pagefind'
import type { CollectionType } from '@/lib/content'
import { IconButton } from '@/components/primitives/icon-button'
import { LABELS as TYPE_LABELS } from '@/components/primitives/type-badge'
import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tip } from '@/components/primitives/tip'
import { useOptionalPlayerPlayback } from '@/components/player/player-provider'
import {
  type SearchScope,
  type SearchGroup,
  type UnifiedSearchItem,
  SEARCH_LISTBOX_ID,
  searchOptionId,
  SearchFilterChips,
  SearchEmptyState,
  SearchResultsList,
  getSystemActions,
  filterActions,
  getCategoryItems,
  filterCategories,
  type SearchCategory,
  scanCurrentHeadings,
  getOutlineItems,
  filterOutlines,
} from './search'

const tooltipPosition = 'left-1/2 top-full mt-1.5 -translate-x-1/2'
const RECENT_KEY = 'orange_recent_visits'

/* 范围 → 类型徽标文案（复用 TypeBadge 的唯一映射，避免两处标签漂移） */
const SCOPE_BADGES: Partial<Record<SearchScope, string>> = {
  posts: TYPE_LABELS.posts,
  skills: TYPE_LABELS.skills,
  life: TYPE_LABELS.life,
  music: TYPE_LABELS.music,
}

/* 旧索引（没有 data-pagefind-filter 元数据）时按详情页 URL 前缀兜底 */
const URL_BADGES: ReadonlyArray<readonly [string, string]> = [
  ['/posts/', TYPE_LABELS.posts],
  ['/life/', TYPE_LABELS.life],
  ['/music/', TYPE_LABELS.music],
  ['/skills/', TYPE_LABELS.skills],
]

function badgeFromUrl(url: string): string | undefined {
  return URL_BADGES.find(([prefix]) => url.startsWith(prefix))?.[1]
}

export function SearchDialog({ categories = [] }: { categories?: SearchCategory[] }) {
  const router = useRouter()
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
  const player = useOptionalPlayerPlayback()

  const navigate = useCallback(
    (url: string) => {
      setOpen(false)
      // Pagefind 在站点配置错误时可能返回绝对 URL；外部地址仍交给浏览器处理。
      if (/^https?:\/\//i.test(url)) {
        window.location.assign(url)
        return
      }
      router.push(url)
    },
    [router],
  )

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

  // 页面内的「检索」入口通过一个窄事件接口唤起全局搜索，避免把整页内容做成客户端组件。
  useEffect(() => {
    function onOpenSearch(event: Event) {
      const detail = (event as CustomEvent<OpenSearchEventDetail>).detail
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
      seqRef.current += 1
      setLoading(false)
      setQuery('')
      setPagefindItems(null)
      setSelectedIndex(-1)
      setError(null)
      setActiveScope(detail?.scope ?? 'all')
      setOpen(true)
    }

    window.addEventListener(OPEN_SEARCH_EVENT, onOpenSearch)
    return () => window.removeEventListener(OPEN_SEARCH_EVENT, onOpenSearch)
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
      timerRef.current = null
      setPagefindItems(null)
      setSelectedIndex(-1)
      setError(null)
      setQuery('')
    }
  }, [open])

  // 3. 构建静态候选动作与分类
  const systemActions = useMemo(
    () => getSystemActions({ onClose: () => setOpen(false), navigate, player }),
    [navigate, player],
  )
  const categoryItems = useMemo(
    () => getCategoryItems(categories, () => setOpen(false), navigate),
    [categories, navigate],
  )
  const outlineItems = useMemo(
    () => getOutlineItems(headings, () => setOpen(false)),
    [headings],
  )

  /*
   * 切换范围：过滤条件下推给 Pagefind 索引（不是取回全部命中再前端筛），
   * 已有查询词时按新范围重新检索。
   */
  function handleSelectScope(scope: SearchScope) {
    setActiveScope(scope)
    if (query.trim()) {
      runSearch(query, scope)
    } else {
      setSelectedIndex(-1)
    }
  }

  // 4. 执行 Pagefind 全文检索（轻量防抖优化输入体验）
  function handleInput(value: string) {
    setQuery(value)
    runSearch(value, activeScope)
  }

  function runSearch(value: string, scope: SearchScope) {
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

        // 过滤下推：all 不传第二参数，保持 Pagefind 默认行为
        const res =
          scope === 'all'
            ? await pagefind.search(value)
            : await pagefind.search(value, { filters: { type: [scope] } })
        if (seq !== seqRef.current) return
        const items: PagefindResultItem[] = await Promise.all(res.results.map((r) => r.data()))
        if (seq !== seqRef.current) return
        setError(null)
        setLoading(false)

        const mapped: UnifiedSearchItem[] = items.map((it) => {
          // 类型优先取索引过滤元数据；旧索引退回 URL 前缀；栏目页判定不出类型就不给徽标
          const type = it.filters?.type?.[0]
          const badge = (type && TYPE_LABELS[type as CollectionType]) ?? badgeFromUrl(it.url)

          return {
            id: `pf-${it.url}`,
            kind: 'post',
            title: it.meta?.title ?? it.url,
            excerpt: it.excerpt ?? '',
            url: it.url,
            badge,
            onSelect: () => {
              navigate(it.url)
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

    // 分组 A：Pagefind 文章与内容（索引已按范围过滤，这里按徽标再兜一层，兼容旧索引）
    if (pagefindItems && pagefindItems.length > 0) {
      const scopeBadge = SCOPE_BADGES[activeScope]
      const filtered = scopeBadge
        ? pagefindItems.filter((i) => i.badge === scopeBadge)
        : pagefindItems

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
    // 保留浏览器默认 Tab 顺序，让关闭、筛选和结果都可被键盘访问。
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
    'group relative inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground active:scale-95'

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
      <DialogContent
        aria-label="站内搜索"
        showCloseButton={false}
        overlayProps={{ 'data-testid': 'search-backdrop' }}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          inputRef.current?.focus()
        }}
        className="top-20 max-w-xl translate-y-0 gap-0 overflow-hidden rounded-2xl border-border-subtle p-0 shadow-overlay bg-background"
      >
        <DialogTitle className="sr-only">站内搜索</DialogTitle>

        {/* 顶部输入框 */}
        <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
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
            role="combobox"
            aria-expanded={flatItems.length > 0}
            aria-controls={SEARCH_LISTBOX_ID}
            aria-autocomplete="list"
            aria-activedescendant={
              selectedIndex >= 0 ? searchOptionId(selectedIndex) : undefined
            }
            className="h-8 w-full bg-transparent type-meta outline-none placeholder:text-muted-foreground"
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
            size="sm"
            tipClassName={tooltipPosition}
          >
            <X className="size-4" aria-hidden />
          </IconButton>
        </div>

        {/* 分类过滤胶囊 */}
        <SearchFilterChips activeScope={activeScope} onSelectScope={handleSelectScope} />

        {/* 结果区域 */}
        <div className="max-h-[22rem] overflow-y-auto p-1 scrollbar-thin">
          {error ? (
            <p className="type-meta p-6 text-center text-destructive">{error}</p>
          ) : !query.trim() ? (
            <SearchEmptyState
              recentVisits={recentVisits}
              onClearRecent={handleClearRecent}
              onSelectRecent={(item) => {
                navigate(item.url)
              }}
              suggestedActions={systemActions}
              onSelectAction={(action) => action.onSelect()}
            />
          ) : flatItems.length === 0 ? (
            <div className="type-meta p-8 text-center text-muted-foreground">
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
        <div className="panel-bar type-caption flex items-center justify-between border-t border-border-subtle px-3.5 py-2 text-muted-foreground select-none">
          <div className="flex items-center gap-3">
            <span>↑↓ 导航</span>
            <span>↵ 打开</span>
            <span>Tab 移动焦点</span>
          </div>
          <span>ESC 关闭</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
