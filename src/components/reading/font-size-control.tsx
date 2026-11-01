'use client'

import { useEffect, useState } from 'react'
import { ALargeSmall } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { iconButtonClass } from '@/components/primitives/icon-button'
import { Tip } from '@/components/primitives/tip'
import {
  CONTENT_FONT_SIZE_EVENT,
  DEFAULT_FONT_SIZE,
  FONT_SIZE_OPTIONS,
  getContentFontSize,
  isContentFontSize,
  setContentFontSize,
  type ContentFontSize,
  type ContentFontSizeEventDetail,
} from '@/lib/content-font-size'

export function FontSizeControl({
  className = '',
  tipClassName = 'right-0 top-full mt-1.5',
}: {
  className?: string
  tipClassName?: string
} = {}) {
  const [open, setOpen] = useState(false)
  const [fontSize, setFontSize] = useState<ContentFontSize>(DEFAULT_FONT_SIZE)

  useEffect(() => {
    setFontSize(getContentFontSize())

    function onFontSizeChange(event: Event) {
      const detail = (event as CustomEvent<ContentFontSizeEventDetail>).detail
      if (detail && isContentFontSize(detail.size)) {
        setFontSize(detail.size)
      }
    }

    window.addEventListener(CONTENT_FONT_SIZE_EVENT, onFontSizeChange)
    return () => window.removeEventListener(CONTENT_FONT_SIZE_EVENT, onFontSizeChange)
  }, [])

  function choose(next: ContentFontSize) {
    setContentFontSize(next)
    setFontSize(next)
    setOpen(false)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <span className="group relative inline-flex">
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="调整正文字号"
            className={iconButtonClass(
              'md',
              `transition-colors duration-150 hover:text-primary ${className}`,
            )}
          >
            <ALargeSmall className="size-4" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <Tip className={tipClassName}>调整正文字号</Tip>
      </span>

      <DropdownMenuContent align="end" aria-label="正文字号" className="w-36 p-1">
        <DropdownMenuLabel className="type-caption text-muted-foreground">
          正文字号
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={fontSize}
          onValueChange={(val) => choose(val as ContentFontSize)}
        >
          {FONT_SIZE_OPTIONS.map((opt) => (
            <DropdownMenuRadioItem
              key={opt.id}
              value={opt.id}
              className="flex cursor-pointer items-center justify-between"
            >
              <span>{opt.label}</span>
              <span className="type-caption font-mono text-muted-foreground">
                {opt.size}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
