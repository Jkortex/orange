import type { ReactNode } from 'react'
import { Newspaper } from 'lucide-react'
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
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
            <Newspaper className="size-3.5 text-primary" aria-hidden />
          </span>
          {title}
        </h2>
        <span className="font-mono text-[13px] tabular-nums text-muted-foreground/70">
          {entries.length} {countUnit}
        </span>
      </div>

      {entries.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <ol className="divide-y divide-border/60 border-y border-border/60">
          {entries.map((entry) => (
            <HomeEntryItem key={`${entry.collection}/${entry.slug}`} entry={entry} />
          ))}
        </ol>
      )}
    </div>
  )
}
