import type { ReactNode } from 'react'

export type SearchScope = 'all' | 'posts' | 'skills' | 'life' | 'music'

/*
 * combobox ↔ listbox 的 DOM 契约：输入框用 aria-controls 指向列表容器，
 * 键盘高亮项用 aria-activedescendant 指向选项 id（焦点始终留在输入框里）。
 */
export const SEARCH_LISTBOX_ID = 'search-results-list'
export const searchOptionId = (index: number) => `search-option-${index}`

// 搜索只返回内容：索引命中的条目（post）与本页小节大纲（outline）。
// 原先还有 'category'（分类直达）与 'action'（系统动作）两种导航型结果，已随纯内容检索移除。
export type SearchItemKind = 'post' | 'outline'

export interface UnifiedSearchItem {
  id: string
  kind: SearchItemKind
  title: string
  subtitle?: string
  excerpt?: string
  url?: string
  icon?: ReactNode
  badge?: string
  keywords?: string[]
  onSelect: () => void
}

export interface SearchGroup {
  id: string
  label: string
  items: UnifiedSearchItem[]
}
