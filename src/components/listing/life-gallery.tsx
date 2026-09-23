'use client'

import * as React from 'react'
import { ZoomIn } from 'lucide-react'
import { ImageLightbox } from '@/components/listing/image-lightbox'

export interface LifeGalleryProps {
  photos: string[]
  title?: string
  className?: string
}

export function LifeGallery({ photos, title = '随手拍', className = '' }: LifeGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null)

  if (!photos || photos.length === 0) return null

  const count = photos.length
  const gridCols = count === 2 || count === 4 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'

  return (
    <div className={`my-6 select-none ${className}`}>
      {count === 1 ? (
        <div
          onClick={() => setLightboxIndex(0)}
          className="group relative cursor-zoom-in overflow-hidden rounded-2xl border border-border/70 bg-muted/20 shadow-xs transition-all duration-200 hover:border-primary/40 hover:shadow-md"
        >
          <img
            src={photos[0]}
            alt={title}
            loading="lazy"
            decoding="async"
            className="w-full max-h-[30rem] object-cover transition-transform duration-300 group-hover:scale-[1.015]"
          />
          <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium text-foreground/80 opacity-0 shadow-md backdrop-blur-xs transition-opacity duration-200 group-hover:opacity-100">
            <ZoomIn className="size-3.5 text-primary" aria-hidden />
            点击查看大图
          </span>
        </div>
      ) : (
        <div className={`grid ${gridCols} gap-3`}>
          {photos.map((src, idx) => (
            <div
              key={idx}
              onClick={() => setLightboxIndex(idx)}
              className="group relative aspect-4/3 cursor-zoom-in overflow-hidden rounded-xl border border-border/70 bg-muted/20 shadow-xs transition-all duration-200 hover:border-primary/40 hover:shadow-md"
            >
              <img
                src={src}
                alt={`${title} - 照片 ${idx + 1}`}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <span className="absolute bottom-2 right-2 flex size-6 items-center justify-center rounded-full bg-background/80 text-foreground/80 opacity-0 shadow-xs backdrop-blur-xs transition-opacity duration-200 group-hover:opacity-100">
                <ZoomIn className="size-3 text-primary" aria-hidden />
              </span>
            </div>
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
          alt={title}
        />
      )}
    </div>
  )
}
