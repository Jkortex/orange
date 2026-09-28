'use client'

/*
 * 分类过滤复用（posts-explorer / skills-explorer 共用，同属 listing 域）：
 * - aggregateCategories：由条目聚合分类与条数（名称排序，与服务端 getCategories 一致）
 * - filterPillClass：分类胶囊 active/默认态
 * - CategorySidebar：吸顶分类栏（移动端横向 / 桌面端纵向 sticky），「最近」为默认虚拟分类
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
 *  移动端是横滑小胶囊（shrink-0，宽度交给滚动容器，不参与压缩）；
 *  桌面端拉满侧栏宽度后改为行形状圆角，选中态靠可见边框表达（不填充，两侧仅边框有无之分）。 */
export function filterPillClass(active: boolean) {
  return [
    'type-meta flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 transition-colors duration-150 md:w-full md:rounded-lg',
    active
      ? 'border-primary/50 bg-primary/10 font-medium text-primary md:bg-transparent'
      : 'border-transparent text-muted-foreground hover:border-border-subtle hover:bg-muted hover:text-foreground',
  ].join(' ')
}

export type CategorySidebarProps = {
  categories: CategoryItem[]
  /** null = 最近（全部） */
  active: string | null
  onSelect: (name: string | null) => void
  /** 导航无障碍名（文章分类 / 技能分类） */
  navLabel: string
}

export function CategorySidebar({ categories, active, onSelect, navLabel }: CategorySidebarProps) {
  /*
   * 移动端：aside 整宽出血（-mx-4）只负责吸顶底色，横向滚动由 ul 自己承担
   * （px-4 让首个胶囊与正文左缘对齐，宽度 = 视口宽，滚动只发生在容器内部）；
   * aside 带 min-w-0：网格项默认 min-width:auto，否则长分类名会反过来把列撑宽。
   * 吸顶位置读 --header-height，顶栏高度随断点变化时不必回来改这里。
   */
  return (
    <aside className="sticky top-[var(--header-height)] z-30 -mx-4 min-w-0 border-b border-border-subtle bg-background/85 backdrop-blur-md md:static md:z-auto md:mx-0 md:border-b-0 md:bg-transparent md:backdrop-blur-none md:sticky md:top-[calc(var(--header-height)+1rem)] md:max-h-[calc(100vh-var(--header-height)-2rem)] md:overflow-y-auto md:pr-2">
      <nav aria-label={navLabel}>
        <ul className="flex gap-1.5 overflow-x-auto px-4 pb-2.5 overscroll-x-contain scrollbar-none md:mx-0 md:flex-col md:items-stretch md:gap-1 md:overflow-visible md:px-0 md:pb-0">
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
  )
}
