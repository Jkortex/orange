import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAdjacentEntries, getEntry, type CollectionEntry, type CollectionType } from '@/lib/content'
import { estimateReadingTime, formatDate } from '@/lib/format'
import { MarkdownRenderer } from '@/lib/markdown'
import { extractToc, shouldShowToc } from '@/lib/toc'
import { Toc } from '@/components/toc'
import { BackButton } from '@/components/back-button'
import { ReadingProgress } from '@/components/reading-progress'

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
  // 默认返回路径指向确定路由（无站内来源历史时兜底）：
  // posts 默认回文章列表；life 默认回首页；若有站内来源（如从首页进文章）由 BackButton 动态接管
  const fallback = entry.collection === 'posts' ? { href: '/posts', label: '文章列表' } : { href: '/', label: '首页' }
  // 长文在正文前生成锚点目录（docs/specs/ui-ux.md §2.6）
  const headings = shouldShowToc(entry.body) ? extractToc(entry.body) : []
  // 阅读时长与字数估算
  const { words, minutes } = estimateReadingTime(entry.body)
  // 相邻文章导航
  const adjacent =
    entry.collection === 'posts'
      ? getAdjacentEntries('posts', entry.slug)
      : { prev: null, next: null }

  const hasToc = headings.length > 0

  return (
    <div className="w-full animate-in fade-in-50 duration-300">
      {/* 顶部滚动进度指示条 */}
      <ReadingProgress />

      {/* 顶部元信息：动态返回链接 + 标题与元数据，始终在 max-w-3xl mx-auto 中居中舒适对齐 */}
      <div className="mx-auto w-full max-w-3xl mb-8">
        <BackButton fallbackHref={fallback.href} fallbackLabel={fallback.label} className="mb-6" />
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{entry.data.title}</h1>
          <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
            <time dateTime={entry.data.date.toISOString()} className="font-mono text-xs">
              {formatDate(entry.data.date)}
            </time>
            {words > 0 && (
              <span>· 约 {minutes} 分钟阅读 · {words} 字</span>
            )}
            {entry.data.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 ml-1">
                {entry.data.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/tags/${tag}`}
                    className="inline-flex items-center rounded-md border border-border/60 bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* 窄屏/笔记本下正文前轻量折叠式目录 (< xl) */}
        {hasToc && (
          <details className="mb-6 rounded-xl border border-border/70 bg-card/60 p-4 shadow-xs backdrop-blur-sm xl:hidden">
            <summary className="cursor-pointer text-sm font-medium text-foreground select-none">
              文章目录 ({headings.length})
            </summary>
            <div className="mt-3">
              <Toc headings={headings} />
            </div>
          </details>
        )}
      </div>

      {/* 正文与右侧悬浮目录联动区 */}
      {hasToc ? (
        <div className="mx-auto w-full max-w-7xl">
          <div className="grid grid-cols-1 xl:grid-cols-[14rem_minmax(0,48rem)_14rem] justify-center gap-8">
            {/* 左侧等宽空白列：在 xl 屏幕下占据 14rem，保证中间 48rem 正文物理绝对居中 */}
            <div className="hidden xl:block" aria-hidden="true" />

            {/* 中间正文列：48rem (max-w-3xl)，阅读空间舒展，与上方的 Header 严丝合缝对齐 */}
            <article className="min-w-0 w-full max-w-3xl">
              <MarkdownRenderer>{entry.body}</MarkdownRenderer>

              {(adjacent.prev || adjacent.next) && (
                <nav aria-label="相邻文章" className="mt-14 grid grid-cols-1 gap-4 border-t border-border/80 pt-8 sm:grid-cols-2">
                  {adjacent.prev ? (
                    <Link
                      href={`/posts/${adjacent.prev.slug}`}
                      className="group rounded-xl border border-border/80 bg-card/60 p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
                    >
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="transition-transform duration-200 group-hover:-translate-x-1">←</span>
                        <span>上一篇</span>
                      </span>
                      <span className="mt-1.5 block font-medium group-hover:text-primary transition-colors truncate">
                        {adjacent.prev.title}
                      </span>
                    </Link>
                  ) : (
                    <div />
                  )}
                  {adjacent.next ? (
                    <Link
                      href={`/posts/${adjacent.next.slug}`}
                      className="group rounded-xl border border-border/80 bg-card/60 p-4 text-right shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md sm:col-start-2"
                    >
                      <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                        <span>下一篇</span>
                        <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
                      </span>
                      <span className="mt-1.5 block font-medium group-hover:text-primary transition-colors truncate">
                        {adjacent.next.title}
                      </span>
                    </Link>
                  ) : null}
                </nav>
              )}
            </article>

            {/* 右侧 TOC 列：顶端与正文第一行完美平齐！高度被 grid stretch 自动拉伸，sticky 滚动常驻 */}
            <aside className="hidden xl:block">
              <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
                <Toc headings={headings} />
              </div>
            </aside>
          </div>
        </div>
      ) : (
        <article className="mx-auto w-full max-w-3xl">
          <MarkdownRenderer>{entry.body}</MarkdownRenderer>

          {(adjacent.prev || adjacent.next) && (
            <nav aria-label="相邻文章" className="mt-14 grid grid-cols-1 gap-4 border-t border-border/80 pt-8 sm:grid-cols-2">
              {adjacent.prev ? (
                <Link
                  href={`/posts/${adjacent.prev.slug}`}
                  className="group rounded-xl border border-border/80 bg-card/60 p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
                >
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="transition-transform duration-200 group-hover:-translate-x-1">←</span>
                    <span>上一篇</span>
                  </span>
                  <span className="mt-1.5 block font-medium group-hover:text-primary transition-colors truncate">
                    {adjacent.prev.title}
                  </span>
                </Link>
              ) : (
                <div />
              )}
              {adjacent.next ? (
                <Link
                  href={`/posts/${adjacent.next.slug}`}
                  className="group rounded-xl border border-border/80 bg-card/60 p-4 text-right shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md sm:col-start-2"
                >
                  <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                    <span>下一篇</span>
                    <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
                  </span>
                  <span className="mt-1.5 block font-medium group-hover:text-primary transition-colors truncate">
                    {adjacent.next.title}
                  </span>
                </Link>
              ) : null}
            </nav>
          )}
        </article>
      )}
    </div>
  )
}
