export const OPEN_SEARCH_EVENT = 'orange:open-search' as const

export type OpenSearchScope = 'all' | 'posts' | 'skills' | 'life' | 'music'

export type OpenSearchEventDetail = {
  scope?: OpenSearchScope
}
