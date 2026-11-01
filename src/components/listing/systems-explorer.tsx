'use client'

import Link from 'next/link'
import { formatDateISO } from '@/lib/format'
import { Explorer } from '@/components/listing/explorer'

export type SystemItem = {
  slug: string
  title: string
  date: string
  name: string
  language?: string
  architecture?: string
  category?: string
  description?: string
  tags: string[]
}

const SYSTEM_ROW_CLASS = 'list-row group'

export function SystemsExplorer({ systems }: { systems: SystemItem[] }) {
  return (
    <Explorer<SystemItem>
      items={systems}
      navLabel="系统分类"
      emptyMessage="还没有系统工程内容。"
      unit="项"
      getKey={(sys) => sys.slug}
      rowClassName={SYSTEM_ROW_CLASS}
      renderItem={(sys) => (
        <>
          <Link
            href={`/systems/${sys.slug}`}
            className="type-item line-clamp-2 transition-colors group-hover:text-primary"
          >
            {sys.title}
          </Link>
          <div className="type-meta mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
            <code className="type-caption rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
              {sys.name}
            </code>
            {sys.language && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                {sys.language}
              </span>
            )}
            {sys.architecture && (
              <span className="type-caption text-muted-foreground/90">
                {sys.architecture}
              </span>
            )}
            <span className="hidden sm:inline">
              · <time dateTime={sys.date}>{formatDateISO(sys.date)}</time>
            </span>
          </div>
          {sys.description && (
            <p className="type-body mt-2 line-clamp-2 text-muted-foreground">{sys.description}</p>
          )}
        </>
      )}
    />
  )
}
