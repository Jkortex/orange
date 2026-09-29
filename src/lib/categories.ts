// 分类聚合纯函数：客户端（Explorer）与服务端（content.ts / manifest）共用。
// content.ts 会被 scripts/*.ts 以 node --experimental-strip-types 加载，故用带扩展名的相对导入。
import { compareText } from './format.ts'

export type CategoryItem = { name: string; count: number }

/** 从任意条目集合按分类计数（名称码位排序，与服务端同序，不走 localeCompare）；分类投影由调用方给出 */
export function countByCategory<T>(
  items: T[],
  getCategory: (item: T) => string | undefined,
): CategoryItem[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    const category = getCategory(item)
    if (!category) continue
    counts.set(category, (counts.get(category) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => compareText(a.name, b.name))
}

/** 计数 + 按分类分桶（manifest 预聚合用）；entriesByCategory 保留输入顺序 */
export function groupByCategory<T>(
  items: T[],
  getCategory: (item: T) => string | undefined,
): { categories: CategoryItem[]; entriesByCategory: Record<string, T[]> } {
  const entriesByCategory: Record<string, T[]> = {}
  for (const item of items) {
    const category = getCategory(item)
    if (!category) continue
    if (!entriesByCategory[category]) entriesByCategory[category] = []
    entriesByCategory[category].push(item)
  }
  return { categories: countByCategory(items, getCategory), entriesByCategory }
}
