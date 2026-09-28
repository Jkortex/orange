import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAllTags, getEntriesByTag, TAGGED_TYPES } from '@/lib/content'
import { formatDate } from '@/lib/format'
import { TypeBadge } from '@/components/primitives/type-badge'
import { PageHeader } from '@/components/listing/page-header'

// 标签聚合类型由内容层统一登记，避免页面、sitemap 与 manifest 各自维护清单。
export const dynamicParams = false

export function generateStaticParams() {
  return getAllTags(TAGGED_TYPES).map((tag) => ({ tag }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>
}): Promise<Metadata> {
  const { tag } = await params
  return { title: `标签：${tag}` }
}

export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params
  const entries = getEntriesByTag(tag, TAGGED_TYPES)
  if (entries.length === 0) notFound()

  return (
    <section className="mx-auto w-full max-w-2xl">
      <PageHeader title={`标签：${tag}`} />
      <ul>
        {entries.map((entry) => (
          <li
            key={entry.slug}
            className="list-row group flex items-start gap-3"
          >
            <span className="pt-0.5">
              <TypeBadge type={entry.collection} />
            </span>
            <div className="min-w-0 flex-1">
              <Link
                href={`/${entry.collection}/${entry.slug}`}
                className="type-item block truncate transition-colors group-hover:text-primary"
              >
                {entry.data.title}
              </Link>
              <p className="type-meta mt-0.5 flex items-center gap-1.5 text-muted-foreground">
                <time dateTime={entry.data.date.toISOString()} className="font-mono tabular-nums">
                  {formatDate(entry.data.date)}
                </time>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
