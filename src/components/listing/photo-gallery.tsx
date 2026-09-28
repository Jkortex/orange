'use client'

import { useState } from 'react'
import { ZoomIn } from 'lucide-react'
import { ImageLightbox } from '@/components/listing/image-lightbox'

/*
 * 图片网格 + 灯箱（生活详情正文与生活卡片共用，差异只体现在 variant）：
 * - prose：详情页正文列，整宽单图 + 带悬停提示的 2/3 列网格
 * - card：列表卡片窄列，限宽 + 无提示文案
 * 每张图都是真实 <button>（可 Tab 聚焦、可 Enter 触发）；灯箱的键盘与焦点交给 ImageLightbox。
 */

export type PhotoGalleryVariant = 'prose' | 'card'

export type PhotoGalleryProps = {
  photos: string[]
  alt: string
  variant?: PhotoGalleryVariant
  className?: string
}

/** 两列只在 2 / 4 张时用（其余三列），两个变体一致 */
function gridClassFor(count: number) {
  return count === 2 || count === 4
    ? 'grid grid-cols-2 gap-2 sm:gap-3'
    : 'grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3'
}

export function PhotoGallery({
  photos,
  alt,
  variant = 'prose',
  className = '',
}: PhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  if (photos.length === 0) return null

  const isProse = variant === 'prose'

  return (
    <>
      <div className={`${isProse ? 'my-6 select-none' : 'mt-3.5'} ${className}`}>
        {photos.length === 1 ? (
          <button
            type="button"
            aria-label={`查看大图：${alt}`}
            aria-haspopup="dialog"
            onClick={() => setLightboxIndex(0)}
            className={
              isProse
                ? 'media-frame group relative block w-full cursor-zoom-in border-0 p-0 transition-colors duration-150 hover:border-primary/40'
                : 'media-frame inline-block cursor-zoom-in border-0 p-0'
            }
          >
            <img
              src={photos[0]}
              alt={alt}
              loading="lazy"
              decoding="async"
              className={isProse ? 'max-h-[30rem] w-full object-cover' : 'max-h-80 w-auto max-w-full object-cover'}
            />
            {isProse && (
              <span className="type-caption absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 font-medium text-foreground opacity-0 backdrop-blur-xs transition-opacity duration-200 group-hover:opacity-100">
                <ZoomIn className="size-3.5 text-primary" aria-hidden />
                点击查看大图
              </span>
            )}
          </button>
        ) : (
          <div className={`${gridClassFor(photos.length)} ${isProse ? '' : 'max-w-md'}`}>
            {photos.map((src, index) => (
              <button
                type="button"
                key={`${src}-${index}`}
                aria-label={`查看大图：${alt}（${index + 1}）`}
                aria-haspopup="dialog"
                onClick={() => setLightboxIndex(index)}
                className={
                  isProse
                    ? `media-frame group relative block w-full cursor-zoom-in border-0 p-0 transition-colors duration-150 hover:border-primary/40 ${photos.length === 2 || photos.length === 4 ? 'aspect-4/3' : 'aspect-square'}`
                    : 'media-frame relative block aspect-square w-full cursor-zoom-in border-0 p-0'
                }
              >
                <img
                  src={src}
                  alt={`${alt} - ${index + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
                {isProse && (
                  <span className="absolute bottom-2 right-2 flex size-6 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 backdrop-blur-xs transition-opacity duration-200 group-hover:opacity-100">
                    <ZoomIn className="size-3 text-primary" aria-hidden />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {lightboxIndex !== null && (
        <ImageLightbox
          photos={photos}
          initialIndex={lightboxIndex}
          open
          onOpenChange={(open) => !open && setLightboxIndex(null)}
          alt={alt}
        />
      )}
    </>
  )
}
