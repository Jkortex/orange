'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Loader2 } from 'lucide-react'
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
import {
  type SearchScope,
  type SearchGroup,
  type UnifiedSearchItem,
  SEARCH_LISTBOX_ID,
  searchOptionId,
  SearchFilterChips,
  SearchResultsList,
  scanCurrentHeadings,
  getOutlineItems,
  filterOutlines,
  stepScope,
} from './search'

const tooltipPosition = 'left-1/2 top-full mt-1.5 -translate-x-1/2'

/* 范围 → 类型徽标文案（复用 TypeBadge 的唯一映射，避免两处标签漂移） */
const SCOPE_BADGES: Partial<Record<SearchScope, string>> = {
  posts: TYPE_LABELS.posts,
  skills: TYPE_LABELS.skills,
  life: TYPE_LABELS.life,
  music: TYPE_LABELS.music,
}

export function SearchDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeScope, setActiveScope] = useState<SearchScope>('all')
  const [pagefindItems, setPagefindItems] = useState<UnifiedSearchItem[] | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [headings, setHeadings] = useState<ReturnType<typeof scanCurrentHeadings>>([])

  const inputRef = useRef<HTMLInputElement>(null)
  const seqRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 弹窗是否由触发按钮打开。仅此时关闭后才把焦点还给按钮：快捷键 / 外部事件唤起时
  // 焦点从未落在按钮上，还回去会让图标顶着焦点环与「搜索」提示（:focus-visible 命中），
  // 看起来像没关掉
  const openedViaTriggerRef = useRef(false)

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
        openedViaTriggerRef.current = false
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // 2. 打开弹窗时初始化：重置范围与本文大纲
  useEffect(() => {
    if (open) {
      // 每次打开都回到「全部」：作用域只服务于本次检索，不跨次残留
      // （否则用范围 chips 收窄过一次后，下次 Ctrl+K 会静默地只搜那个范围）
      setActiveScope('all')
      setTimeout(() => inputRef.current?.focus(), 0)
      setHeadings(scanCurrentHeadings())
    } else {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
      setPagefindItems(null)
      setSelectedIndex(-1)
      setError(null)
      setQuery('')
    }
  }, [open])

  // 3. 本文章节大纲（内容检索的一部分）
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
          // 类型只看索引过滤元数据：判定不出（如栏目页）就不给徽标
          const type = it.filters?.type?.[0]

          return {
            id: `pf-${it.url}`,
            kind: 'post',
            title: it.meta?.title ?? it.url,
            excerpt: it.excerpt ?? '',
            url: it.url,
            badge: type ? TYPE_LABELS[type as CollectionType] : undefined,
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

    // 搜索只返回内容：Pagefind 命中的文章/条目 + 本文小节大纲。
    // 原先还有「分类与专栏直达」与「快捷操作」两组（导航与系统动作），
    // 属于导航而非内容检索，已整体移除。
    return list
  }, [query, activeScope, pagefindItems, outlineItems])

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
          onClick={() => {
            openedViaTriggerRef.current = true
          }}
        >
          <Search className="size-5" aria-hidden />
          <Tip className={tooltipPosition}>搜索</Tip>
        </button>
      </DialogTrigger>
      {/* 宽度：移动端沿用 DialogContent 基类的 max-w-[calc(100%-2rem)]（两侧各留 16px，不贴满视口），
          sm 起才放宽到 max-w-xl。不可写死 max-w-xl——tailwind-merge 会顶掉基类留白，移动端就贴边了。
          关闭按钮整颗关掉：它落在输入行右端，与「清空」的 ✕ 并排必被读成两个同义按钮。
          关闭只走 ESC 与点遮罩（底栏已写明 ESC），故这里没有可见的关闭控件 */}
      <DialogContent
        aria-label="站内搜索"
        showCloseButton={false}
        overlayProps={{ 'data-testid': 'search-backdrop' }}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          inputRef.current?.focus()
        }}
        onCloseAutoFocus={(e) => {
          // 仅当弹窗由触发按钮打开时才把焦点还给按钮（无障碍惯例：还给调用方）。
          // 快捷键 / 外部事件唤起时按钮从未获得过焦点，还回去只会留下焦点环与提示
          if (!openedViaTriggerRef.current) e.preventDefault()
        }}
        onKeyDown={(e) => {
          /*
           * Shift+←/→ 切换搜索范围：不要求先把焦点移到胶囊组，输入框里也能用
           * （命令面板惯例）。代价是搜索框内失去 Shift+方向键选词——检索词很短，
           * 且方向键本身仍能移动光标，可接受。
           */
          if (!e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return
          // 输入法组合中的方向键属于候选词导航，不能抢
          if (e.nativeEvent.isComposing) return
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return

          e.preventDefault()
          handleSelectScope(stepScope(activeScope, e.key === 'ArrowRight' ? 1 : -1))
        }}
        className="top-[calc(var(--header-height)+1rem)] sm:max-w-xl translate-y-0 gap-0 overflow-hidden rounded-2xl border-border-subtle p-0 shadow-overlay bg-background"
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
            /* 行内只留这一颗 ✕：搜索框里的 ✕ 按惯例就是「清空」，再放一颗「关闭」必然读成两个同义按钮。
               关闭走 ESC 与点遮罩（弹窗惯例，底栏也写明了 ESC）。原生搜索框自带的那颗取消按钮
               已在 globals.css 关掉，否则输入非空时会多出第三颗 ✕ */
            <IconButton
              label="清空输入"
              onClick={() => handleInput('')}
              size="sm"
              buttonClassName="bg-muted hover:bg-border"
              tipClassName={tooltipPosition}
            >
              <X className="size-3.5" aria-hidden />
            </IconButton>
          )}
        </div>

        {/* 分类过滤胶囊 */}
        <SearchFilterChips activeScope={activeScope} onSelectScope={handleSelectScope} />

        {/* 结果区域 */}
        <div className="max-h-[22rem] overflow-y-auto p-1 scrollbar-thin">
          {error ? (
            <p className="type-meta p-6 text-center text-destructive">{error}</p>
          ) : !query.trim() ? (
            /* 空态刻意留白：搜索只负责检索内容，不塞推荐、不列历史 */
            <p className="type-meta p-8 text-center text-muted-foreground">
              输入关键词，检索全站文章、生活、音乐、技能与本页小节
            </p>
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

        {/* 底栏快捷说明：只给有物理键盘的场景看。触屏上 ↑↓/Tab/ESC 都不存在，
            整行纯属占位，sm 起才显示 */}
        <div className="panel-bar type-caption hidden items-center justify-between border-t border-border-subtle px-3.5 py-2 text-muted-foreground select-none sm:flex">
          <div className="flex items-center gap-3">
            <span>↑↓ 导航</span>
            <span>↵ 打开</span>
            <span>Tab 移动焦点</span>
            <span>⇧←→ 切换范围</span>
          </div>
          <span>ESC 关闭</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
