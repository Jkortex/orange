import type { ReactNode } from 'react'

export type SearchScope = 'all' | 'posts' | 'skills' | 'life' | 'music'

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
