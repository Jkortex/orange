import Link from 'next/link'
import type { RelatedEntry } from '@/lib/content'
import { formatDate } from '@/lib/format'
import { TypeBadge } from '@/components/primitives/type-badge'
import { Sparkles } from 'lucide-react'

export function RelatedEntries({
  entries,
  className = '',
}: {
  entries: RelatedEntry[]
  className?: string
}) {
  if (!entries || entries.length === 0) return null

  return (
    <section aria-label="相关推荐" className={`mt-12 not-prose ${className}`}>
      <div className="type-caption mb-4 flex items-center gap-1.5 font-semibold uppercase tracking-wider text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        <span>相关推荐</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {entries.map((entry) => {
          const href = `/${entry.collection}/${entry.slug}`
          return (
            <Link
              key={`${entry.collection}-${entry.slug}`}
              href={href}
              className="surface-card surface-interactive group flex flex-col justify-between p-3.5"
            >
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <TypeBadge type={entry.collection} />
                  {entry.category && (
                    <span className="type-caption truncate font-mono text-muted-foreground">
                      {entry.category}
                    </span>
                  )}
                </div>
                <h3 className="type-meta line-clamp-2 font-medium text-foreground transition-colors group-hover:text-primary">
                  {entry.title}
                </h3>
              </div>
              <div className="type-caption mt-3 text-muted-foreground">
                {formatDate(entry.date)}
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
