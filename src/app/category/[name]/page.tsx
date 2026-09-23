import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCategories, getEntriesByCategory } from '@/lib/content'
import { TypeBadge } from '@/components/primitives/type-badge'
import { formatDate } from '@/lib/format'

type Params = { params: Promise<{ name: string }> }

export function generateStaticParams() {
  return getCategories().map(({ name }) => ({ name }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { name } = await params
  return { title: `分类：${name}` }
}

// 分类聚合页：全类型条目按日期倒序。分类由内容声明、构建时聚合（AGENTS.md 内容分类规范），
// 新增分类 = 内容文件写 category 字段，本页零改动
export default async function CategoryPage({ params }: Params) {
  const { name } = await params
  // 非法 slug（同 schema 正则）或无内容的分类直接 404
  if (!/^[\w-]+$/.test(name)) notFound()
  const entries = getEntriesByCategory(name)
  if (entries.length === 0) notFound()

  return (
    <section className="mx-auto w-full max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">分类：{name}</h1>
      <ol className="divide-y divide-border/40 py-1">
        {entries.map((entry) => (
          <li
            key={`${entry.collection}/${entry.slug}`}
            className="group flex items-center gap-3 px-3 py-2.5 transition-colors duration-150 hover:bg-muted/40 sm:mx-[-0.75rem] sm:rounded-xl sm:border sm:border-transparent sm:hover:border-border/60 sm:hover:bg-card sm:hover:shadow-xs"
          >
            <time
              dateTime={entry.data.date.toISOString()}
              className="w-20 shrink-0 font-mono text-[13px] tabular-nums text-muted-foreground/80"
            >
              {formatDate(entry.data.date)}
            </time>
            <TypeBadge type={entry.collection} />
            <Link
              href={`/${entry.collection}/${entry.slug}`}
              className="min-w-0 flex-1 truncate font-medium tracking-tight transition-colors group-hover:text-primary"
            >
              {entry.data.title}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
