import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAllTags, getEntriesByTag, type CollectionType } from '@/lib/content'
import { formatDate } from '@/lib/format'
import { TypeBadge } from '@/components/primitives/type-badge'

// 标签聚合：有详情路由的类型（新增带路由类型时在此登记，见 docs/specs/content-model.md §6-7）
const TAGGED_TYPES: CollectionType[] = ['posts', 'music', 'skills', 'life']

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
      <h1 className="mb-6 text-2xl font-semibold">标签：{tag}</h1>
      <ul className="divide-y divide-border/40 py-1">
        {entries.map((entry) => (
          <li
            key={entry.slug}
            className="group flex items-start gap-3 px-3 py-3 transition-colors duration-150 hover:bg-muted/40 sm:mx-[-0.75rem] sm:rounded-xl sm:border sm:border-transparent sm:hover:border-border/60 sm:hover:bg-card"
          >
            <span className="pt-0.5">
              <TypeBadge type={entry.collection} />
            </span>
            <div className="min-w-0 flex-1">
              <Link
                href={`/${entry.collection}/${entry.slug}`}
                className="block truncate font-medium tracking-tight transition-colors group-hover:text-primary"
              >
                {entry.data.title}
              </Link>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <time dateTime={entry.data.date.toISOString()} className="tabular-nums font-mono text-[13px]">
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
