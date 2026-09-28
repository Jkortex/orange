import Link from 'next/link'
import { MapPin } from 'lucide-react'
import { formatDate } from '@/lib/format'
import { PhotoGallery } from '@/components/listing/photo-gallery'
import type { CollectionEntry } from '@/lib/content'

export interface LifeCardProps {
  entry: CollectionEntry<'life'>
}

export function LifeCard({ entry }: LifeCardProps) {
  const photos = entry.data.photos ?? []

  return (
    <article className="surface-card surface-interactive group p-5">
      {/* 头部元信息：日期 · 标题 · 地点/天气 */}
      <div className="type-caption flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
        <div className="flex flex-wrap items-center gap-1.5">
          <time dateTime={entry.data.date.toISOString()} className="font-medium text-foreground">
            {formatDate(entry.data.date)}
          </time>
          {entry.data.location && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3 shrink-0" aria-hidden="true" />
                {entry.data.location}
              </span>
            </>
          )}
          {entry.data.weather && (
            <>
              <span>·</span>
              <span>{entry.data.weather}</span>
            </>
          )}
        </div>

        <Link
          href={`/life/${entry.slug}`}
          className="type-caption text-muted-foreground transition-colors hover:text-primary"
          title="查看单条详情"
        >
          详情 →
        </Link>
      </div>

      {/* 标题 */}
      {entry.data.title && (
        <h2 className="type-section mt-2 text-foreground">
          <Link
            href={`/life/${entry.slug}`}
            className="hover:text-primary transition-colors"
          >
            {entry.data.title}
          </Link>
        </h2>
      )}

      {/* 正文文本 */}
      {entry.body && (
        <div className="type-body mt-2.5 whitespace-pre-wrap break-words text-foreground">
          {entry.body}
        </div>
      )}

      {/* 图片交互独立为客户端岛，静态卡片正文无需整体 hydration */}
      {photos.length > 0 && <PhotoGallery photos={photos} alt={entry.data.title} />}

      {/* 标签列表 */}
      {entry.data.tags.length > 0 && (
        <div className="mt-3.5 flex flex-wrap gap-1.5 pt-1">
          {entry.data.tags.map((tag) => (
            <Link
              key={tag}
              href={`/tags/${tag}`}
              className="chip chip-interactive"
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}
    </article>
  )
}
