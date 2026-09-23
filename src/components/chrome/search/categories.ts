import type { CategoryItem, SymbolItem } from './types'

export const BASE_CATEGORIES: CategoryItem[] = [
  { name: 'life', label: '生活随笔', slug: 'life', desc: '日常碎片、即兴随笔与随手拍', href: '/life' },
  { name: 'posts', label: '技术文章', slug: 'posts', desc: '所有深度技术文章', href: '/posts' },
  { name: 'music', label: '音乐合辑', slug: 'music', desc: '精选音乐专辑与曲目', href: '/music' },
  { name: 'skills', label: '技能目录', slug: 'skills', desc: '可交互的 Agent 技能包', href: '/skills' },
]

export function filterCategories(
  categories: CategoryItem[],
  keyword: string,
): CategoryItem[] {
  if (!keyword) return categories
  const lower = keyword.toLowerCase()
  return categories.filter(
    (c) =>
      c.name.toLowerCase().includes(lower) ||
      c.label.toLowerCase().includes(lower),
  )
}

/** 扫描当前页面的 H2/H3 标题 */
export function scanPageHeadings(): SymbolItem[] {
  if (typeof document === 'undefined') return []
  const headings = document.querySelectorAll<HTMLElement>(
    'article h2[id], article h3[id], h2[id], h3[id]',
  )
  return Array.from(headings).map((h) => ({
    id: h.id,
    title:
      h.textContent?.replace(/复制标题链接|已复制链接/, '').trim() ?? h.id,
    depth: h.tagName === 'H2' ? 2 : 3,
  }))
}

export function filterSymbols(symbols: SymbolItem[], keyword: string): SymbolItem[] {
  if (!keyword) return symbols
  const lower = keyword.toLowerCase()
  return symbols.filter((s) => s.title.toLowerCase().includes(lower))
}
