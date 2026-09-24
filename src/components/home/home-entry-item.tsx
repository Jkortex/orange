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
    <li className="list-row group flex items-start gap-3">
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
                className="media-frame size-12 shrink-0 object-cover"
              />
            )}
            <span className="min-w-0">
              <span className="type-item block truncate transition-colors group-hover:text-primary">
                {entry.data.title}
              </span>
              <span className="type-meta mt-0.5 block truncate text-muted-foreground">
                {entry.data.artist}
                {entry.data.year !== undefined && ` · ${entry.data.year}`}
              </span>
            </span>
          </Link>
        ) : (
          <>
            <Link
              href={`/${entry.collection}/${entry.slug}`}
              className="type-item block truncate transition-colors group-hover:text-primary"
            >
              {entry.data.title}
            </Link>
            <p className="type-meta mt-0.5 flex items-center gap-1.5 text-muted-foreground">
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
