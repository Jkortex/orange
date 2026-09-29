import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCategories, getEntriesByCategory } from '@/lib/content'
import { TypeBadge } from '@/components/primitives/type-badge'
import { PageHeader } from '@/components/listing/page-header'
import { formatDate } from '@/lib/format'

type Params = { params: Promise<{ name: string }> }

export const dynamicParams = false

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
      <PageHeader title={`分类：${name}`} />
      {/* px-2：.list-row 外扩 0.75rem，不补内边距分隔线会贴到屏幕边缘（见 explorer.tsx 同处说明） */}
      <ol className="px-2 md:px-0">
        {entries.map((entry) => (
          <li
            key={`${entry.collection}/${entry.slug}`}
            className="list-row group flex items-center gap-3"
          >
            <time
              dateTime={entry.data.date.toISOString()}
              className="type-meta w-20 shrink-0 font-mono tabular-nums text-muted-foreground"
            >
              {formatDate(entry.data.date)}
            </time>
            <TypeBadge type={entry.collection} />
            <Link
              href={`/${entry.collection}/${entry.slug}`}
              className="type-item min-w-0 flex-1 truncate transition-colors group-hover:text-primary"
            >
              {entry.data.title}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
