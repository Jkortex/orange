import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getEntry, type CollectionEntry, type CollectionType } from '@/lib/content'
import { formatDate } from '@/lib/format'
import { MarkdownRenderer } from '@/lib/markdown'
import { extractToc, shouldShowToc } from '@/lib/toc'
import { Toc } from '@/components/toc'

/*
 * 集合详情页共用视图（posts/life 结构一致，提炼复用）：
 * 新增内容类型时按 SOP 复用 readEntry / entryMetadata / EntryView
 */

/** 读取单条内容，失败（不存在/非法 slug）转 404 */
export function readEntry<T extends CollectionType>(type: T, slug: string): CollectionEntry<T> {
  try {
    return getEntry(type, slug)
  } catch {
    notFound()
  }
}

/** 详情页元信息；读取失败不阻塞构建，返回占位标题 */
export function entryMetadata(type: CollectionType, slug: string): Metadata {
  try {
    const { data } = getEntry(type, slug)
    return { title: data.title, description: data.description }
  } catch {
    return { title: '内容不存在' }
  }
}

export function EntryView({ entry }: { entry: CollectionEntry<'posts' | 'life'> }) {
  // 返回路径指向确定路由而非浏览器历史（docs/specs/ui-ux.md §2.5）：
  // posts 有集合页；life 暂无独立路由，回首页（SOP 加回路由时同步改为 /life）
  const back = entry.collection === 'posts' ? { href: '/posts', label: '文章列表' } : { href: '/', label: '首页' }
  // 长文在正文前生成锚点目录（docs/specs/ui-ux.md §2.6）
  const headings = shouldShowToc(entry.body) ? extractToc(entry.body) : []

  return (
    <article>
      <Link href={back.href} className="mb-6 inline-block text-sm text-muted-foreground hover:text-primary">
        ← {back.label}
      </Link>
      <header className="mb-8">
        <h1 className="text-3xl font-semibold">{entry.data.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          <time dateTime={entry.data.date.toISOString()}>{formatDate(entry.data.date)}</time>
          {entry.data.tags.map((tag) => (
            <Link key={tag} href={`/tags/${tag}`} className="ml-2 hover:text-primary">
              #{tag}
            </Link>
          ))}
        </p>
      </header>
      {headings.length > 0 && <Toc headings={headings} />}
      <MarkdownRenderer>{entry.body}</MarkdownRenderer>
    </article>
  )
}
