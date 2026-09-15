import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAdjacentEntries, getEntry, getRelatedEntries, type CollectionEntry, type CollectionType } from '@/lib/content'
import { estimateReadingTime, formatDate } from '@/lib/format'
import { MarkdownRenderer } from '@/lib/markdown'
import { extractToc, shouldShowToc } from '@/lib/toc'
import { Toc } from '@/components/reading/toc'
import { MobileTocDrawer } from '@/components/reading/mobile-toc-drawer'
import { A11yScrollable } from '@/components/primitives/a11y-scrollable'
import { ReadingProgress } from '@/components/reading/reading-progress'
import { AdjacentNav } from '@/components/reading/adjacent-nav'
import { RelatedEntries } from '@/components/reading/related-entries'
import { RecentTracker } from '@/components/chrome/recent-tracker'
import { DetailHeader } from '@/components/listing/detail-header'

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
  // 相关文章推荐
  const related = getRelatedEntries(
    {
      type: entry.collection,
      slug: entry.slug,
      tags: entry.data.tags,
      category: entry.data.category,
    },
    3,
  )

  return (
    <div className="w-full animate-in fade-in-50 duration-300">
      {/* 顶部滚动进度指示条 */}
      <ReadingProgress />

      {/* 记录当前页面到最近访问列表 */}
      <RecentTracker url={`/${entry.collection}/${entry.slug}`} title={entry.data.title} />

      {/* 顶部元信息：动态返回链接 + 标题与元数据，始终在 max-w-3xl mx-auto 中居中舒适对齐 */}
      <div className="mx-auto w-full max-w-3xl mb-8">
        <DetailHeader
          backHref={fallback.href}
          backLabel={fallback.label}
          title={entry.data.title}
          meta={
            <>
              <time dateTime={entry.data.date.toISOString()} className="font-mono text-[13px] tabular-nums">
                {formatDate(entry.data.date)}
              </time>
              {words > 0 && (
                <span className="text-sm">· 约 {minutes} 分钟阅读 · {words} 字</span>
              )}
            </>
          }
          tags={entry.data.tags}
        />
        <div aria-hidden="true" className="mt-6 h-px bg-gradient-to-r from-border via-border/40 to-transparent" />

        {/* 窄屏/笔记本下正文前轻量折叠式目录 (< xl) */}
        {hasToc && (
          <details className="group mb-6 overflow-hidden rounded-xl border border-border/70 bg-card/60 shadow-xs backdrop-blur-sm transition-shadow hover:shadow-sm">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground select-none transition-colors hover:text-primary [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between">
                文章目录 ({headings.length})
                <span aria-hidden="true" className="text-muted-foreground transition-transform duration-200 group-open:rotate-180">▾</span>
              </span>
            </summary>
            <div className="border-t border-border/50 px-2 pb-2 pt-2">
              <Toc headings={headings} className="border-0 bg-transparent shadow-none backdrop-blur-none" />
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
              <A11yScrollable />

              <RelatedEntries entries={related} />
              <AdjacentNav collection={entry.collection} prev={adjacent.prev} next={adjacent.next} />
            </article>

            {/* 右侧 TOC 列：顶端与正文第一行完美平齐！高度被 grid stretch 自动拉伸，sticky 滚动常驻 */}
            <aside className="hidden xl:block">
              <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
                <Toc headings={headings} />
              </div>
            </aside>

            {/* 移动端目录抽屉 */}
            <MobileTocDrawer headings={headings} />
          </div>
        </div>
      ) : (
        <article className="mx-auto w-full max-w-3xl">
          <MarkdownRenderer>{entry.body}</MarkdownRenderer>
          <A11yScrollable />

          <RelatedEntries entries={related} />
          <AdjacentNav collection={entry.collection} prev={adjacent.prev} next={adjacent.next} />
        </article>
      )}
    </div>
  )
}
