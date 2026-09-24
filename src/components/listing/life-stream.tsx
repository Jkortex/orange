'use client'

import * as React from 'react'
import { Search } from 'lucide-react'
import { LifeCard } from '@/components/listing/life-card'
import { EmptyState } from '@/components/primitives/empty-state'
import type { CollectionEntry } from '@/lib/content'

export interface LifeStreamProps {
  entries: CollectionEntry<'life'>[]
}

export function LifeStream({ entries }: LifeStreamProps) {
  const handleOpenSearch = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('orange:open-search', { detail: { scope: 'life' } }),
      )
    }
  }

  if (entries.length === 0) {
    return <EmptyState message="暂无生活记录" />
  }

  return (
    <div className="space-y-4">
      {/* 顶部极简信息与唤起按钮：保持页面纯净阅读感，无大表单打扰 */}
      <div className="type-caption flex items-center justify-between px-1 pb-1 text-muted-foreground">
        <span>共 {entries.length} 条生活记录 · 按时间倒序</span>

        <button
          type="button"
          onClick={handleOpenSearch}
          className="type-caption inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-muted/40 px-2.5 py-1 text-muted-foreground transition hover:border-border-strong hover:bg-muted hover:text-foreground active:scale-95"
          aria-label="搜索生活记录"
        >
          <Search className="size-3" />
          <span>检索动态</span>
          <kbd className="type-caption hidden rounded border border-border-subtle bg-background/80 px-1 font-mono text-muted-foreground sm:inline-block">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* 纯粹沉浸的生活流列表 */}
      <div className="space-y-4">
        {entries.map((entry) => (
          <LifeCard key={entry.slug} entry={entry} />
        ))}
      </div>
    </div>
  )
}
