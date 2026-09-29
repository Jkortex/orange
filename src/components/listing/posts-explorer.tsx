'use client'

import Link from 'next/link'
import { formatDateISO } from '@/lib/format'
import { Explorer } from '@/components/listing/explorer'

/*
 * 文章探索器：Explorer 薄封装，只定行结构（日期 + 标题）与分页（15 篇/批）；
 * 过滤、侧栏、空态、分批逻辑收敛在 Explorer，行级差异经 slot 注入
 */

export type PostItem = {
  slug: string
  title: string
  /** ISO 字符串（服务端 Date.toISOString()） */
  date: string
  category?: string
}

const PAGE_SIZE = 15

/*
 * 行结构：标题在左（占据左边缘，主扫描目标），日期作为尾部元信息右对齐（sm 起出现）；
 * 移动端只留标题（日期独占一列会把标题挤成一条窄带）。标题最多两行截断而不是单行省略。
 * 日期不设固定宽度：曾用 w-20，等宽 10 字符在 16px 下约 96px，会在连字符处折断换行。
 */
const POST_ROW_CLASS = 'list-row group flex items-center gap-3'

export function PostsExplorer({ posts }: { posts: PostItem[] }) {
  return (
    <Explorer<PostItem>
      items={posts}
      navLabel="文章分类"
      emptyMessage="还没有文章。"
      unit="篇"
      getKey={(post) => post.slug}
      rowClassName={POST_ROW_CLASS}
      pageSize={PAGE_SIZE}
      allShownText={(total) => `已显示全部 ${total} 篇文章`}
      renderItem={(post) => (
        <>
          <Link
            href={`/posts/${post.slug}`}
            className="type-item line-clamp-2 min-w-0 flex-1 transition-colors group-hover:text-primary"
          >
            {post.title}
          </Link>
          <time
            dateTime={post.date}
            className="hidden shrink-0 whitespace-nowrap font-mono tabular-nums text-muted-foreground sm:block"
          >
            {formatDateISO(post.date)}
          </time>
        </>
      )}
    />
  )
}
