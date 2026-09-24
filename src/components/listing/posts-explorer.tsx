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
          <time
            dateTime={post.date}
            className="type-meta w-20 shrink-0 font-mono tabular-nums text-muted-foreground"
          >
            {formatDateISO(post.date)}
          </time>
          <Link
            href={`/posts/${post.slug}`}
            className="min-w-0 flex-1 truncate font-medium tracking-tight transition-colors group-hover:text-primary"
          >
            {post.title}
          </Link>
        </>
      )}
    />
  )
}
