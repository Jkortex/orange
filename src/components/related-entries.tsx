import Link from 'next/link'
import type { RelatedEntry } from '@/lib/content'
import { formatDate } from '@/lib/format'
import { TypeBadge } from '@/components/type-badge'
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
      <div className="mb-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
              className="group flex flex-col justify-between rounded-xl border border-border/70 bg-card/50 p-3.5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-card hover:shadow-xs"
            >
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <TypeBadge type={entry.collection} />
                  {entry.category && (
                    <span className="font-mono text-[11px] text-muted-foreground/80 truncate">
                      {entry.category}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-medium text-foreground line-clamp-2 transition-colors group-hover:text-primary">
                  {entry.title}
                </h3>
              </div>
              <div className="mt-3 text-[11px] text-muted-foreground/70">
                {formatDate(entry.date)}
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
