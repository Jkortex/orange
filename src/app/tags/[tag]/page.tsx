import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAllTags, getEntriesByTag, type CollectionType } from '@/lib/content'
import { formatDate } from '@/lib/format'
import { TypeBadge } from '@/components/type-badge'

// 标签聚合：有详情路由的类型（新增带路由类型时在此登记，见 docs/specs/content-model.md §6-7）
const TAGGED_TYPES: CollectionType[] = ['posts', 'music', 'skills']

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
      <ul className="space-y-4">
        {entries.map((entry) => (
          <li key={entry.slug}>
            <Link
              href={`/${entry.collection}/${entry.slug}`}
              className="font-medium hover:text-primary"
            >
              {entry.data.title}
            </Link>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <TypeBadge type={entry.collection} />
              <time dateTime={entry.data.date.toISOString()}>{formatDate(entry.data.date)}</time>
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
