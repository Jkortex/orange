'use client'

import { ChevronDown } from 'lucide-react'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

/*
 * 分类过滤复用（posts-explorer / skills-explorer 共用，同属 listing 域）：
 * - aggregateCategories：由条目聚合分类与条数（名称排序，与服务端 getCategories 一致）
 * - filterPillClass：分类胶囊 active/默认态
 * - CategoryFilter：移动端与桌面端两套控件
 *   · 移动端：单行下拉（显示当前分类）+ 浮层里可换行的药丸网格。
 *     早先是一整条横滑药丸带，读不出「右边还有」且会占掉整屏宽度；
 *     现在收起只占一行 36px，展开也一次摊开全部分类，不产生横向滚动。
 *   · 桌面端（md 起）：吸顶纵向侧栏，计数右对齐成列。
 * 「最近」是默认虚拟分类，两端都在第一位。
 */

export type CategoryItem = { name: string; count: number }

/** 从条目集合聚合分类与条数（名称排序） */
export function aggregateCategories<T extends { category?: string }>(items: T[]): CategoryItem[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    if (!item.category) continue
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** 分类项样式（active 高亮 / 默认弱化）。
 *  两端共用同一套胶囊配方：移动端浮层里换行排列，桌面端拉满侧栏宽度后
 *  改为行形状圆角，选中态靠可见边框表达（不填充，两侧仅边框有无之分）。 */
export function filterPillClass(active: boolean) {
  return [
    'type-meta flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 transition-colors duration-150 md:w-full md:rounded-lg',
    active
      ? 'border-primary/50 bg-primary/10 font-medium text-primary md:bg-transparent'
      : 'border-transparent text-muted-foreground hover:border-border-subtle hover:bg-muted hover:text-foreground',
  ].join(' ')
}

export type CategoryFilterProps = {
  categories: CategoryItem[]
  /** null = 最近（全部） */
  active: string | null
  onSelect: (name: string | null) => void
  /** 导航无障碍名（文章分类 / 技能分类） */
  navLabel: string
}

export function CategoryFilter({ categories, active, onSelect, navLabel }: CategoryFilterProps) {
  const activeLabel = active ?? '最近'

  return (
    <>
      {/* 移动端：单行下拉。展开层用 Popover 浮在列表上方，不把页面撑长 */}
      <div className="sticky top-[var(--header-height)] z-30 -mx-4 border-b border-border-subtle bg-background/85 px-4 py-2 backdrop-blur-md md:hidden">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`分类筛选：${activeLabel}`}
              className="surface-card type-meta flex h-9 w-full items-center justify-between gap-2 px-3 text-left font-medium text-foreground transition-colors duration-150 hover:border-primary/40"
            >
              <span className="truncate">{activeLabel}</span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                {active !== null && <span className="tabular-nums">{categories.find((c) => c.name === active)?.count ?? 0}</span>}
                <ChevronDown className="size-4" aria-hidden />
              </span>
            </button>
          </PopoverTrigger>

          <PopoverContent
            aria-label={navLabel}
            className="w-[min(22rem,calc(100vw-2rem))]"
          >
            <div data-category-grid className="flex flex-wrap gap-1.5">
              <PopoverClose asChild>
                <button
                  type="button"
                  aria-pressed={active === null}
                  onClick={() => onSelect(null)}
                  className={filterPillClass(active === null)}
                >
                  最近
                </button>
              </PopoverClose>
              {categories.map(({ name, count }) => (
                <PopoverClose asChild key={name}>
                  <button
                    type="button"
                    aria-pressed={active === name}
                    onClick={() => onSelect(name)}
                    className={filterPillClass(active === name)}
                  >
                    {name} <span className="type-caption tabular-nums">{count}</span>
                  </button>
                </PopoverClose>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* 桌面端：吸顶纵向侧栏 */}
      <aside className="sticky top-[calc(var(--header-height)+1rem)] z-30 hidden min-w-0 md:block md:max-h-[calc(100vh-var(--header-height)-2rem)] md:overflow-y-auto md:pr-2">
        <nav aria-label={navLabel}>
          <ul className="space-y-1">
            <li>
              <button
                type="button"
                aria-pressed={active === null}
                onClick={() => onSelect(null)}
                className={filterPillClass(active === null)}
              >
                最近
              </button>
            </li>
            {categories.map(({ name, count }) => (
              <li key={name}>
                <button
                  type="button"
                  aria-pressed={active === name}
                  onClick={() => onSelect(name)}
                  className={filterPillClass(active === name)}
                >
                  {name}{' '}
                  {/* 不写死颜色：随胶囊状态继承（active 时转品牌色），桌面端推到右缘成列 */}
                  <span className="type-caption tabular-nums md:ml-auto">{count}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  )
}
