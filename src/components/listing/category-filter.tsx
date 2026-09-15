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

/** 分类胶囊样式（active 高亮 / 默认弱化；正文 15px + 计数 13px，保证窄屏可读） */
export function filterPillClass(active: boolean) {
  return [
    'flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[15px] transition-all duration-200',
    active
      ? 'border-primary/30 bg-primary/10 font-medium text-primary shadow-xs'
      : 'border-transparent text-muted-foreground hover:border-border/60 hover:bg-muted/60 hover:text-foreground',
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
  return (
    <aside className="sticky top-14 z-20 -mx-4 border-b border-border/40 bg-background/85 px-4 py-2.5 backdrop-blur-md md:static md:z-auto md:mx-0 md:border-b-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none md:sticky md:top-20 md:max-h-[calc(100vh-6rem)] md:overflow-y-auto md:pr-2">
      <nav aria-label={navLabel}>
        <ul className="flex gap-1.5 overflow-x-auto pb-0.5 md:flex-col md:items-start md:gap-1 md:overflow-visible md:pb-0 scrollbar-none">
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
                <span className="text-[13px] text-muted-foreground">{count}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
