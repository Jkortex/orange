'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { formatDate } from '@/lib/format'

/*
 * 文章探索器（AGENTS.md 界面布局规范）：
 * - 桌面端：左侧 sticky 吸顶分类树（max-h 视口自滚动）+ 右侧条目列表
 * - 移动端：吸顶横向滚动分类条 + 滚动分批渐进加载（Incremental Loading，保护 Ctrl+F 与渲染性能）
 * - 「最近」为默认虚拟分类 = 全部文章按日期倒序；分类为纯过滤器，点击即时切换。
 * - 数据由服务端页面在构建期注入，客户端不发内容请求。
 */

export type PostItem = {
  slug: string
  title: string
  /** ISO 字符串（服务端 Date.toISOString()） */
  date: string
  category?: string
}

const PAGE_SIZE = 15

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
    'flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm transition-colors',
    active
      ? 'bg-primary/10 font-medium text-primary'
      : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground',
  ].join(' ')
}

export function PostsExplorer({ posts }: { posts: PostItem[] }) {
  const [active, setActive] = useState<string | null>(null) // null = 最近
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const categories = aggregateCategories(posts)
  const filtered = active ? posts.filter((post) => post.category === active) : posts
  const displayed = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  const handleCategorySelect = (name: string | null) => {
    setActive(name)
    setVisibleCount(PAGE_SIZE)
    if (typeof window !== 'undefined' && window.scrollY > 200) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // 移动端/滚动到底部哨兵触发自动加载下一批（Incremental Loading）
  useEffect(() => {
    if (!hasMore) return
    const el = sentinelRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filtered.length))
        }
      },
      { rootMargin: '200px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, filtered.length])

  return (
    <div className="grid w-full gap-4 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-10">
      {/* 
        桌面端：sticky top-20 常驻视口，max-h 自持滚动；
        移动端：sticky top-14 横向吸顶分类栏，方便随时切换分类。
      */}
      <aside className="sticky top-14 z-20 -mx-4 px-4 py-2 bg-background/90 backdrop-blur border-b border-border/40 md:static md:z-auto md:mx-0 md:px-0 md:py-0 md:bg-transparent md:border-b-0 md:sticky md:top-20 md:max-h-[calc(100vh-6rem)] md:overflow-y-auto md:pr-2">
        <nav aria-label="文章分类">
          <ul className="flex gap-1.5 overflow-x-auto pb-1 md:flex-col md:items-start md:gap-1 md:overflow-visible md:pb-0 scrollbar-none">
            <li>
              <button
                type="button"
                aria-pressed={active === null}
                onClick={() => handleCategorySelect(null)}
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
                  onClick={() => handleCategorySelect(name)}
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

      <section className="min-w-0">
        {/* 条数在 h2 外：保持标题可及名干净（仅分类名） */}
        <div className="mb-2 flex items-baseline gap-2">
          <h2 className="text-lg font-medium">{active ?? '最近'}</h2>
          <span className="text-sm text-muted-foreground">共 {filtered.length} 篇</span>
        </div>

        {filtered.length === 0 ? (
          <p className="py-8 text-muted-foreground">还没有文章。</p>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {displayed.map((post) => (
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

            {/* 滚动哨兵与分批加载控制区 */}
            {hasMore ? (
              <div className="mt-8 flex flex-col items-center gap-3">
                <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() =>
                    setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filtered.length))
                  }
                  className="rounded-md border border-border bg-background px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  加载更多（已显示 {displayed.length} / {filtered.length}）
                </button>
              </div>
            ) : filtered.length > PAGE_SIZE ? (
              <div className="mt-8 text-center text-xs text-muted-foreground">
                已显示全部 {filtered.length} 篇文章
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  )
}
