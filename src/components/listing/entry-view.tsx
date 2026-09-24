import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MapPin } from 'lucide-react'
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

import { LifeGallery } from '@/components/listing/life-gallery'

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
  const isLife = entry.collection === 'life'
  // 默认返回路径指向确定路由（无站内来源历史时兜底）：
  // posts 默认回文章列表；life 默认回生活列表；若有站内来源（如从首页进文章）由 BackButton 动态接管
  const fallback = isLife
    ? { href: '/life', label: '生活' }
    : { href: '/posts', label: '文章列表' }
  // 长文在正文前生成锚点目录
  const headings = shouldShowToc(entry.body) ? extractToc(entry.body) : []
  // 阅读时长与字数估算
  const { words, minutes } = estimateReadingTime(entry.body)
  // 相邻条目导航（posts 与 life 均支持上一篇/下一篇）
  const adjacent = getAdjacentEntries(entry.collection, entry.slug)

  // 生活随笔随手拍照片
  const photos = 'photos' in entry.data && Array.isArray(entry.data.photos) ? entry.data.photos : undefined
  const contentWidth = isLife ? 'max-w-2xl' : 'max-w-3xl'

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

      {/* 顶部元信息：动态返回链接 + 标题与元数据 */}
      <div className={`mx-auto w-full ${contentWidth} mb-8`}>
        <DetailHeader
          backHref={fallback.href}
          backLabel={fallback.label}
          title={entry.data.title}
          meta={
            <>
              <time dateTime={entry.data.date.toISOString()} className="font-mono tabular-nums">
                {formatDate(entry.data.date)}
              </time>
              {'location' in entry.data && entry.data.location && (
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden="true">·</span>
                  <MapPin className="size-3 shrink-0" aria-hidden="true" />
                  {entry.data.location}
                </span>
              )}
              {'weather' in entry.data && entry.data.weather && (
                <span>· {entry.data.weather}</span>
              )}
              {!isLife && words > 0 && (
                <span>· 约 {minutes} 分钟阅读 · {words} 字</span>
              )}
            </>
          }
          tags={entry.data.tags}
        />
        <div aria-hidden="true" className="mt-6 h-px bg-border-subtle" />

        {/* 窄屏/笔记本下正文前轻量折叠式目录 (< xl) */}
        {hasToc && (
          <details className="surface-card group mb-6 overflow-hidden xl:hidden">
            <summary className="type-meta cursor-pointer list-none px-4 py-3 font-medium text-foreground select-none transition-colors hover:text-primary [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between">
                文章目录 ({headings.length})
                <span aria-hidden="true" className="text-muted-foreground transition-transform duration-150 group-open:rotate-180">▾</span>
              </span>
            </summary>
            <div className="border-t border-border-subtle px-2 pb-2 pt-2">
              <Toc headings={headings} className="border-0 bg-transparent shadow-none" />
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
            <article className="min-w-0 w-full max-w-3xl mx-auto">
              <MarkdownRenderer>{entry.body}</MarkdownRenderer>
              {photos && photos.length > 0 && (
                <LifeGallery photos={photos} title={entry.data.title} />
              )}
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
          </div>

          {/* 移动端目录抽屉（脱离 grid 容器，避免干扰正文网格流） */}
          <MobileTocDrawer headings={headings} />
        </div>
      ) : (
        <article className={`mx-auto w-full ${contentWidth}`}>
          <MarkdownRenderer>{entry.body}</MarkdownRenderer>
          {photos && photos.length > 0 && (
            <LifeGallery photos={photos} title={entry.data.title} />
          )}
          <A11yScrollable />

          <RelatedEntries entries={related} />
          <AdjacentNav collection={entry.collection} prev={adjacent.prev} next={adjacent.next} />
        </article>
      )}
    </div>
  )
}
