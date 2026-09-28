import type { ReactNode } from 'react'

export type SearchScope = 'all' | 'posts' | 'skills' | 'life' | 'music'

/*
 * combobox ↔ listbox 的 DOM 契约：输入框用 aria-controls 指向列表容器，
 * 键盘高亮项用 aria-activedescendant 指向选项 id（焦点始终留在输入框里）。
 */
export const SEARCH_LISTBOX_ID = 'search-results-list'
export const searchOptionId = (index: number) => `search-option-${index}`

export type SearchItemKind = 'post' | 'outline' | 'category' | 'action'

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
