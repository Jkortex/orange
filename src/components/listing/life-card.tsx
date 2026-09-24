'use client'

import * as React from 'react'
import Link from 'next/link'
import { MapPin } from 'lucide-react'
import { formatDate } from '@/lib/format'
import { ImageLightbox } from '@/components/listing/image-lightbox'
import type { CollectionEntry } from '@/lib/content'

export interface LifeCardProps {
  entry: CollectionEntry<'life'>
}

export function LifeCard({ entry }: LifeCardProps) {
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null)

  const photos = entry.data.photos ?? []
  const photoCount = photos.length
  const gridCols =
    photoCount === 2 || photoCount === 4 ? 'grid-cols-2' : 'grid-cols-3'

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

      {/* 图片网格 */}
      {photoCount > 0 && (
        <div className="mt-3.5">
          {photoCount === 1 ? (
            <div className="media-frame inline-block">
              <img
                src={photos[0]}
                alt={entry.data.title}
                loading="lazy"
                onClick={() => setLightboxIndex(0)}
                className="max-h-80 w-auto max-w-full cursor-zoom-in object-cover"
              />
            </div>
          ) : (
            <div className={`grid ${gridCols} gap-2 max-w-md`}>
              {photos.map((src, idx) => (
                <div
                  key={idx}
                  onClick={() => setLightboxIndex(idx)}
                  className="media-frame aspect-square cursor-zoom-in"
                >
                  <img
                    src={src}
                    alt={`${entry.data.title} - ${idx + 1}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

      {/* 大图预览灯箱 */}
      {lightboxIndex !== null && (
        <ImageLightbox
          photos={photos}
          initialIndex={lightboxIndex}
          open={lightboxIndex !== null}
          onOpenChange={(open) => !open && setLightboxIndex(null)}
          alt={entry.data.title}
        />
      )}
    </article>
  )
}
