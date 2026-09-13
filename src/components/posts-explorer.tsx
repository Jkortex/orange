'use client'

import Link from 'next/link'
import { useState } from 'react'
import { formatDate } from '@/lib/format'

/*
 * 文章探索器（AGENTS.md 界面布局规范）：左侧分类列表（无折叠）+ 右侧条目列表。
 * 「最近」为默认虚拟分类 = 全部文章按日期倒序；分类为纯过滤器，点击即时切换。
 * 数据由服务端页面在构建期注入（content 读取红线不破坏），客户端不发内容请求。
 */

export type PostItem = {
  slug: string
  title: string
  /** ISO 字符串（服务端 Date.toISOString()） */
  date: string
  category?: string
}

/** 从文章集合聚合分类与条数（名称排序，与 getCategories 输出一致） */
function aggregateCategories(posts: PostItem[]) {
  const counts = new Map<string, number>()
  for (const post of posts) {
    if (!post.category) continue
    counts.set(post.category, (counts.get(post.category) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function categoryClass(active: boolean) {
  return [
    'flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-sm transition-colors',
    active
      ? 'bg-primary/10 font-medium text-primary'
      : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground',
  ].join(' ')
}

export function PostsExplorer({ posts }: { posts: PostItem[] }) {
  const [active, setActive] = useState<string | null>(null) // null = 最近
  const categories = aggregateCategories(posts)
  const visible = active ? posts.filter((post) => post.category === active) : posts

  return (
    <div className="grid w-full gap-4 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-10">
      <aside>
        <nav aria-label="文章分类">
          <ul className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:items-start md:gap-1 md:overflow-visible md:pb-0">
            <li>
              <button
                type="button"
                aria-pressed={active === null}
                onClick={() => setActive(null)}
                className={categoryClass(active === null)}
              >
                最近
              </button>
            </li>
            {categories.map(({ name, count }) => (
              <li key={name}>
                <button
                  type="button"
                  aria-pressed={active === name}
                  onClick={() => setActive(name)}
                  className={categoryClass(active === name)}
                >
                  {name}{' '}
                  <span className="text-xs text-muted-foreground">{count}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <section>
        {/* 条数在 h2 外：保持标题可及名干净（仅分类名） */}
        <div className="mb-2 flex items-baseline gap-2">
          <h2 className="text-lg font-medium">{active ?? '最近'}</h2>
          <span className="text-sm text-muted-foreground">共 {visible.length} 篇</span>
        </div>
        {visible.length === 0 ? (
          <p className="py-8 text-muted-foreground">还没有文章。</p>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((post) => (
              // 日期在链接外：链接可及名 = 标题（与 archive/category 页条目约定一致）
              <li key={post.slug} className="flex items-baseline gap-3 py-3">
                <time
                  dateTime={post.date}
                  className="w-20 shrink-0 text-sm text-muted-foreground"
                >
                  {formatDate(new Date(post.date))}
                </time>
                <Link
                  href={`/posts/${post.slug}`}
                  className="min-w-0 flex-1 truncate hover:text-primary"
                >
                  {post.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
