'use client'

import { useState } from 'react'
import { List, X } from 'lucide-react'
import type { TocHeading } from '@/lib/toc'

export function MobileTocDrawer({
  headings,
  className = '',
}: {
  headings: TocHeading[]
  className?: string
}) {
  const [isOpen, setIsOpen] = useState(false)

  if (headings.length === 0) return null

  function handleHeadingClick(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault()
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        window.history.replaceState(null, '', `#${encodeURIComponent(id)}`)
      }
    }
    setIsOpen(false)
  }

  return (
    <div className={`xl:hidden ${className}`}>
      {/* 移动端悬浮目录触发按钮 */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="文章目录"
        className="fixed right-4 bottom-20 z-40 flex h-11 w-11 min-h-[36px] min-w-[36px] items-center justify-center rounded-full border border-border/80 bg-background/85 text-muted-foreground shadow-lg backdrop-blur-md transition-all duration-200 hover:border-primary/60 hover:text-foreground hover:scale-105 active:scale-95"
      >
        <List className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* 移动端抽屉遮罩与内容区 */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="文章目录抽屉"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-background/60 backdrop-blur-sm transition-opacity"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[75vh] w-full max-w-lg rounded-t-2xl border-t border-border bg-background p-5 shadow-2xl overflow-hidden flex flex-col transition-transform animate-in slide-in-from-bottom duration-200"
          >
            {/* 顶栏 */}
            <div className="mb-4 flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <List className="h-4 w-4 text-primary" aria-hidden="true" />
                <h2 className="text-base font-semibold text-foreground">文章目录</h2>
                <span className="font-mono text-xs text-muted-foreground">({headings.length} 节)</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="关闭目录"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* 目录列表 */}
            <nav className="overflow-y-auto pr-1 py-1 space-y-1">
              {headings.map((heading) => (
                <a
                  key={heading.id}
                  href={`#${heading.id}`}
                  onClick={(e) => handleHeadingClick(e, heading.id)}
                  className={`block rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:bg-primary/10 ${
                    heading.depth === 3 ? 'pl-7 text-xs' : 'font-medium'
                  }`}
                >
                  {heading.text}
                </a>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  )
}
