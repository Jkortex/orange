'use client'

import { Search } from 'lucide-react'
import { OPEN_SEARCH_EVENT } from '@/lib/search-events'

export function OpenSearchButton() {
  function handleOpenSearch() {
    window.dispatchEvent(
      new CustomEvent(OPEN_SEARCH_EVENT, { detail: { scope: 'life' } }),
    )
  }

  return (
    <button
      type="button"
      onClick={handleOpenSearch}
      className="chip chip-interactive gap-1.5 active:scale-95"
      aria-label="搜索生活记录"
    >
      <Search className="size-3" aria-hidden />
      <span>检索动态</span>
      <kbd className="kbd hidden sm:inline-block">⌘K</kbd>
    </button>
  )
}
