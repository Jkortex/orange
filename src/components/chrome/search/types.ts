export type SearchScope = 'all' | 'life' | 'posts' | 'music' | 'skills'

export type SearchMode = 'command' | 'category' | 'symbol' | 'search'

export type Result = { url: string; title: string; excerpt: string }

export type CommandItem = {
  id: string
  title: string
  desc: string
  keys?: string
  run: () => void
}

export type SymbolItem = {
  id: string
  title: string
  depth: number
}

export type CategoryItem = {
  name: string
  label: string
  slug: string
  desc?: string
  href?: string
}
