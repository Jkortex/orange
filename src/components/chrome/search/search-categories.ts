import type { UnifiedSearchItem } from './types'

export interface CategoryDef {
  slug: string
  label: string
  desc: string
  href?: string
}

export const SITE_CATEGORIES: CategoryDef[] = [
  { slug: 'cheerful', label: '开怀', desc: '轻松幽默与生活趣事' },
  { slug: 'css', label: 'CSS', desc: '样式设计、布局与现代 CSS 特性' },
  { slug: 'database', label: '数据库', desc: 'PostgreSQL、MySQL 与数据建模' },
  { slug: 'engineering', label: '工程', desc: '架构设计、CI/CD 与代码规范' },
  { slug: 'meta', label: '博客元信息', desc: '关于本站的设计理念与技术演进' },
  { slug: 'methodology', label: '方法论', desc: '思维模型、经验与工程法则' },
  { slug: 'product', label: '产品', desc: '产品思考、交互设计与用户体验' },
  { slug: 'typescript', label: 'TypeScript', desc: '类型系统、前端工程与实战' },
]

export function getCategoryItems(onClose: () => void): UnifiedSearchItem[] {
  return SITE_CATEGORIES.map((cat) => ({
    id: `cat-${cat.slug}`,
    kind: 'category',
    title: cat.label,
    subtitle: cat.desc,
    badge: '分类',
    url: cat.href || `/category/${cat.slug}`,
    onSelect: () => {
      onClose()
      window.location.href = cat.href || `/category/${cat.slug}`
    },
  }))
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
