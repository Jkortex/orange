import type { UnifiedSearchItem } from './types'

export interface SearchCategory {
  /** 内容层聚合出的英文分类 slug */
  name: string
  /** 该分类下的条目数，用于搜索结果摘要 */
  count?: number
  /** 可选的显示名/描述；默认由 slug 生成 */
  label?: string
  description?: string
  href?: string
}

function displayLabel(category: SearchCategory): string {
  if (category.label) return category.label
  return category.name
    .split('-')
    .map((part) => (part.length <= 3 ? part.toUpperCase() : part))
    .join(' ')
}

export function getCategoryItems(
  categories: SearchCategory[],
  onClose: () => void,
  navigate: (url: string) => void,
): UnifiedSearchItem[] {
  return categories.map((category) => {
    const url = category.href ?? `/category/${category.name}`
    return {
      id: `cat-${category.name}`,
      kind: 'category',
      title: displayLabel(category),
      subtitle:
        category.description ??
        (category.count === undefined ? '内容分类' : `${category.count} 篇内容`),
      badge: '分类',
      url,
      onSelect: () => {
        onClose()
        navigate(url)
      },
    }
  })
}

export function filterCategories(categories: UnifiedSearchItem[], query: string): UnifiedSearchItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  return categories.filter((c) => {
    const titleMatch = c.title.toLowerCase().includes(q)
    const subMatch = c.subtitle ? c.subtitle.toLowerCase().includes(q) : false
    const idMatch = c.id.toLowerCase().includes(q)
    return titleMatch || subMatch || idMatch
  })
}
