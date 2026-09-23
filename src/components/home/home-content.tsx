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
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <span className="font-mono text-[13px] tabular-nums text-muted-foreground/70">
          {entries.length} {countUnit}
        </span>
      </div>

      {entries.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <ol className="divide-y divide-border/40 py-1">
          {entries.map((entry) => (
            <HomeEntryItem key={`${entry.collection}/${entry.slug}`} entry={entry} />
          ))}
        </ol>
      )}
    </div>
  )
}
