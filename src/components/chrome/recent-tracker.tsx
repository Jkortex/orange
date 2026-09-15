'use client'

import { useEffect } from 'react'

export function RecentTracker({ url, title }: { url: string; title: string }) {
  useEffect(() => {
    try {
      const KEY = 'orange_recent_visits'
      const existing: { url: string; title: string }[] = JSON.parse(localStorage.getItem(KEY) || '[]')
      const filtered = existing.filter((item) => item.url !== url)
      filtered.unshift({ url, title })
      localStorage.setItem(KEY, JSON.stringify(filtered.slice(0, 5)))
    } catch {
      // ignore
    }
  }, [url, title])

  return null
}
