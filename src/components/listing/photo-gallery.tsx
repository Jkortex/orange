'use client'

import { useState } from 'react'
import { ImageLightbox } from '@/components/listing/image-lightbox'

export type PhotoGalleryProps = {
  photos: string[]
  alt: string
}

export function PhotoGallery({ photos, alt }: PhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  if (photos.length === 0) return null

  const gridCols = photos.length === 2 || photos.length === 4 ? 'grid-cols-2' : 'grid-cols-3'

  return (
    <>
      <div className="mt-3.5">
        {photos.length === 1 ? (
          <button
            type="button"
            aria-label={`查看大图：${alt}`}
            aria-haspopup="dialog"
            onClick={() => setLightboxIndex(0)}
            className="media-frame inline-block cursor-zoom-in border-0 p-0"
          >
            <img
              src={photos[0]}
              alt={alt}
              loading="lazy"
              decoding="async"
              className="max-h-80 w-auto max-w-full object-cover"
            />
          </button>
        ) : (
          <div className={`grid ${gridCols} max-w-md gap-2`}>
            {photos.map((src, index) => (
              <button
                type="button"
                key={`${src}-${index}`}
                aria-label={`查看大图：${alt}（${index + 1}）`}
                aria-haspopup="dialog"
                onClick={() => setLightboxIndex(index)}
                className="media-frame aspect-square w-full cursor-zoom-in border-0 p-0"
              >
                <img
                  src={src}
                  alt={`${alt} - ${index + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
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
