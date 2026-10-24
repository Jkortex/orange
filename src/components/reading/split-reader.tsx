'use client'

import { useState } from 'react'
import { BookOpen, Sparkles, Columns2 } from 'lucide-react'

export type SplitReaderProps = {
  leftNode: React.ReactNode
  rightNode: React.ReactNode
  leftTitle?: string
  rightTitle?: string
}

export function SplitReader({
  leftNode,
  rightNode,
  leftTitle = '核心精炼与实战',
  rightTitle = '原著参考对照',
}: SplitReaderProps) {
  const [mobileTab, setMobileTab] = useState<'left' | 'right'>('left')

  return (
    <div className="w-full">
      {/* 移动端切换 Tab (< lg) */}
      <div className="mb-4 flex items-center justify-center lg:hidden">
        <div className="inline-flex rounded-xl border border-border-subtle bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => setMobileTab('left')}
            className={`type-meta inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 font-medium transition-colors ${
              mobileTab === 'left'
                ? 'bg-surface text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="size-3.5 text-primary" aria-hidden />
            <span>{leftTitle}</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('right')}
            className={`type-meta inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 font-medium transition-colors ${
              mobileTab === 'right'
                ? 'bg-surface text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen className="size-3.5 text-muted-foreground" aria-hidden />
            <span>{rightTitle}</span>
          </button>
        </div>
      </div>

      {/* 移动端视图 (< lg)：单栏自适应高度 */}
      <div className="block lg:hidden">
        {mobileTab === 'left' ? (
          <div className="prose w-full max-w-none">{leftNode}</div>
        ) : (
          <div className="prose w-full max-w-none text-muted-foreground">{rightNode}</div>
        )}
      </div>

      {/* 桌面端视图 (≥ lg)：双栏独立滚动工作台 */}
      <div className="hidden lg:flex lg:flex-col w-full h-[calc(100vh-var(--header-height)-6rem)] min-h-[640px] rounded-2xl border border-border-subtle bg-surface shadow-card overflow-hidden">
        {/* 顶部指示条 */}
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border-subtle bg-muted/30 px-6">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
            <Sparkles className="size-3.5 text-primary" aria-hidden />
            <span>{leftTitle}</span>
          </div>

          <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Columns2 className="size-3.5" aria-hidden />
            <span>双栏独立滚动模式</span>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <BookOpen className="size-3.5" aria-hidden />
            <span>{rightTitle}</span>
          </div>
        </div>

        {/* 双栏容器：左右均有独立的纵向滚动条 */}
        <div className="flex flex-1 min-h-0 w-full divide-x divide-border-subtle overflow-hidden">
          {/* 左栏：核心精炼（独立滚动） */}
          <section
            aria-label={leftTitle}
            tabIndex={0}
            className="flex-1 h-full overflow-y-auto px-8 py-6 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30"
          >
            <div className="prose w-full max-w-none">{leftNode}</div>
          </section>

          {/* 右栏：原著对照（独立滚动） */}
          <section
            aria-label={rightTitle}
            tabIndex={0}
            className="flex-1 h-full overflow-y-auto px-8 py-6 bg-muted/10 text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30"
          >
            <div className="prose w-full max-w-none">{rightNode}</div>
          </section>
        </div>
      </div>
    </div>
  )
}
