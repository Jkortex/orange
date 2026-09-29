'use client'

import * as React from 'react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { iconButtonClass } from '@/components/primitives/icon-button'

export interface ImageLightboxProps {
  photos: string[]
  initialIndex?: number
  open: boolean
  onOpenChange: (open: boolean) => void
  alt?: string
}

export function ImageLightbox({
  photos,
  initialIndex = 0,
  open,
  onOpenChange,
  alt = '图片预览',
}: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex)

  React.useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex)
    }
  }, [open, initialIndex])

  const total = photos.length
  const currentPhoto = photos[currentIndex] || photos[0]

  const showPrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : total - 1))
  }

  const showNext = () => {
    setCurrentIndex((prev) => (prev < total - 1 ? prev + 1 : 0))
  }

  React.useEffect(() => {
    if (!open || total <= 1) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        showPrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        showNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, total])

  if (!currentPhoto) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl p-2 sm:p-4 bg-background/95 border-border-subtle shadow-overlay flex flex-col items-center justify-center overflow-hidden"
        /*
         * 关掉 DialogContent 自带的关闭钮：它没有内边距、图标只有 16px，
         * 在触屏上基本按不中（本站图标化标准要求 ≥36px）。自绘一颗 36px 圆钮替代，
         * 底衬沿用本组件左右翻页键那套磨砂样式 —— 压在照片上时才看得见。
         */
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">
          {alt}（第 {currentIndex + 1} 张，共 {total} 张）
        </DialogTitle>

        <DialogClose asChild>
          <button
            type="button"
            aria-label="关闭图片预览"
            className={iconButtonClass(
              'md',
              'absolute top-3 right-3 z-10 shrink-0 bg-background/80 shadow-pop backdrop-blur-xs hover:bg-background',
            )}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </DialogClose>

        <div className="relative flex w-full max-h-[80vh] items-center justify-center overflow-hidden py-2 select-none">
          <img
            src={currentPhoto}
            alt={`${alt} - ${currentIndex + 1}/${total}`}
            className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain"
          />

          {total > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  showPrev()
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 text-foreground shadow-pop backdrop-blur-xs transition hover:bg-background hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="上一张图片"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  showNext()
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 text-foreground shadow-pop backdrop-blur-xs transition hover:bg-background hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="下一张图片"
              >
                <ChevronRight className="size-5" />
              </button>
            </>
          )}
        </div>

        {total > 1 && (
          <div className="flex items-center pb-1">
            {photos.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                /*
                 * 圆点本体只有 6px 高，直接当按钮在触屏上基本点不中。
                 * 故按钮只管尺寸与命中（36px 高、左右各 4px 内边距撑开间距），
                 * 视觉完全交给内层 span。
                 */
                className="group/dot flex h-9 items-center px-1"
                aria-label={`切换到第 ${idx + 1} 张图片`}
                aria-current={idx === currentIndex ? 'true' : undefined}
              >
                <span
                  className={`block h-1.5 rounded-full transition-all duration-150 ${
                    idx === currentIndex
                      ? 'w-5 bg-primary'
                      : 'w-1.5 bg-muted-foreground/30 group-hover/dot:bg-muted-foreground/60'
                  }`}
                />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
