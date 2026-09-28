import type { ReactNode } from 'react'
import type { CollectionEntry, CollectionType } from '@/lib/content'
import { EmptyState } from '@/components/primitives/empty-state'
import { HomeEntryItem } from './home-entry-item'

export type HomeContentProps = {
  entries: CollectionEntry<CollectionType>[]
  title?: ReactNode
  countUnit?: string
  emptyMessage?: string
}

export function HomeContent({
  entries,
  title = '最近更新',
  countUnit = '篇',
  emptyMessage = '还没有内容。',
}: HomeContentProps) {
  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <h1 className="type-section">{title}</h1>
        <span className="type-meta font-mono tabular-nums text-muted-foreground">
          {entries.length} {countUnit}
        </span>
      </div>

      {entries.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <ol>
          {entries.map((entry) => (
            <HomeEntryItem key={`${entry.collection}/${entry.slug}`} entry={entry} />
          ))}
        </ol>
      )}
    </div>
  )
}
