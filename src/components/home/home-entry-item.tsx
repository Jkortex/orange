import Link from 'next/link'
import { TypeBadge } from '@/components/primitives/type-badge'
import { formatDate } from '@/lib/format'
import { isMusic } from '@/lib/content-guards'
import type { CollectionEntry, CollectionType } from '@/lib/content'

export type HomeEntryItemProps = {
  entry: CollectionEntry<CollectionType>
}

export function HomeEntryItem({ entry }: HomeEntryItemProps) {
  return (
    <li className="group flex items-start gap-3 px-3 py-3.5 transition-colors duration-200 hover:bg-muted/40 sm:mx-[-0.75rem] sm:rounded-xl sm:border sm:border-transparent sm:hover:border-border/60 sm:hover:bg-card sm:hover:shadow-xs">
      <span className="pt-0.5">
        <TypeBadge type={entry.collection} />
      </span>
      <div className="min-w-0 flex-1">
        {isMusic(entry) ? (
          <Link href={`/music/${entry.slug}`} className="flex items-center gap-3">
            {entry.data.cover && (
              <img
                src={entry.data.cover}
                alt=""
                loading="lazy"
                decoding="async"
                className="size-12 shrink-0 rounded-lg border border-border/60 object-cover shadow-xs ring-1 ring-black/[0.04] transition-transform duration-200 group-hover:scale-[1.03]"
              />
            )}
            <span className="min-w-0">
              <span className="block truncate font-medium tracking-tight transition-colors group-hover:text-primary">
                {entry.data.title}
              </span>
              <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                {entry.data.artist}
                {entry.data.year !== undefined && ` · ${entry.data.year}`}
              </span>
            </span>
          </Link>
        ) : (
          <>
            <Link
              href={`/${entry.collection}/${entry.slug}`}
              className="block truncate font-medium tracking-tight transition-colors group-hover:text-primary"
            >
              {entry.data.title}
            </Link>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <time dateTime={entry.data.date.toISOString()} className="tabular-nums">
                {formatDate(entry.data.date)}
              </time>
              {entry.data.tags.length > 0 && (
                <span className="truncate"> · {entry.data.tags.join(' / ')}</span>
              )}
            </p>
          </>
        )}
      </div>
    </li>
  )
}
