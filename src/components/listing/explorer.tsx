'use client'

import { useEffect, useRef, useState } from 'react'
import { aggregateCategories, CategoryFilter } from '@/components/listing/category-filter'
import { EmptyState } from '@/components/primitives/empty-state'

/*
 * 通用过滤列表（posts-explorer / skills-explorer 共用，同属 listing 域）：
 * - 外侧布局统一：吸顶分类侧栏 + 标题计数 + 列表；行级结构差异经 renderItem slot 注入
 * - pageSize 缺省 = 全量展示；传入则启用分批渐进加载（哨兵自动追加 + 兜底按钮）
 */

export type ExplorerProps<T extends { category?: string }> = {
  items: T[]
  /** 侧栏无障碍名（文章分类 / 技能分类） */
  navLabel: string
  /** 空态文案（各域保留自有措辞） */
  emptyMessage: string
  /** 条数单位（篇 / 项） */
  unit: string
  getKey: (item: T) => string
  /** 行容器样式（文章行 / 技能行 hover 卡片各异） */
  rowClassName: string
  /** 行内容 slot（不含外层 li） */
  renderItem: (item: T) => React.ReactNode
  pageSize?: number
  /** 到底文案，默认「已显示全部 N + 单位」 */
  allShownText?: (total: number) => string
}

export function Explorer<T extends { category?: string }>({
  items,
  navLabel,
  emptyMessage,
  unit,
  getKey,
  rowClassName,
  renderItem,
  pageSize,
  allShownText = (total) => `已显示全部 ${total} ${unit}`,
}: ExplorerProps<T>) {
  const [active, setActive] = useState<string | null>(null) // null = 最近
  const [visibleCount, setVisibleCount] = useState(pageSize ?? items.length)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const categories = aggregateCategories(items)
  const filtered = active ? items.filter((item) => item.category === active) : items
  const displayed = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  const handleSelect = (name: string | null) => {
    setActive(name)
    setVisibleCount(pageSize ?? items.length)
    if (typeof window !== 'undefined' && window.scrollY > 200) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // 滚动到底部哨兵触发自动加载下一批（仅分页模式；Incremental Loading）
  useEffect(() => {
    if (!hasMore || pageSize === undefined) return
    const el = sentinelRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + pageSize, filtered.length))
        }
      },
      { rootMargin: '200px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, filtered.length, pageSize])

  return (
    <div className="grid w-full gap-4 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-10">
      <CategoryFilter
        categories={categories}
        active={active}
        onSelect={handleSelect}
        navLabel={navLabel}
      />

      <section className="min-w-0">
        {/* 条数在 h2 外：保持标题可及名干净（仅分类名） */}
        <div className="mb-3 flex items-baseline gap-2">
          <h2 className="type-section">{active ?? '最近'}</h2>
          <span className="type-meta font-mono tabular-nums text-muted-foreground">
            共 {filtered.length} {unit}
          </span>
        </div>

        {filtered.length === 0 ? (
          <EmptyState message={emptyMessage} />
        ) : (
          <>
            {/* key 随分类重挂列表，播放一次淡入，表达过滤切换的即时反馈 */}
            <ul
              key={active ?? 'recent'}
              className="animate-in fade-in-50 duration-200"
            >
              {displayed.map((item) => (
                <li key={getKey(item)} className={rowClassName}>
                  {renderItem(item)}
                </li>
              ))}
            </ul>

            {/* 滚动哨兵与分批加载控制区（仅分页模式） */}
            {pageSize !== undefined &&
              (hasMore ? (
                <div className="mt-8 flex flex-col items-center gap-3">
                  <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => Math.min(prev + pageSize, filtered.length))}
                    className="type-meta rounded-full border border-border-subtle bg-surface px-5 py-2 text-foreground transition-colors duration-150 hover:border-border-strong hover:text-primary"
                  >
                    加载更多（已显示 {displayed.length} / {filtered.length}）
                  </button>
                </div>
              ) : filtered.length > pageSize ? (
                <div className="type-meta mt-8 flex items-center justify-center gap-3 text-muted-foreground">
                  <span aria-hidden="true" className="h-px w-8 bg-border-subtle" />
                  {allShownText(filtered.length)}
                  <span aria-hidden="true" className="h-px w-8 bg-border-subtle" />
                </div>
              ) : null)}
          </>
        )}
      </section>
    </div>
  )
}
