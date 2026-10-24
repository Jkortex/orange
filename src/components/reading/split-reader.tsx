'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { BookOpen, Sparkles, Globe, GripVertical } from 'lucide-react'

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
  const [allEnOpen, setAllEnOpen] = useState(false)
  const [ratio, setRatio] = useState<number>(50) // 左栏宽度百分比 (20 - 80)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const toggleAllEn = () => {
    const nextState = !allEnOpen
    setAllEnOpen(nextState)
    const disclosures = document.querySelectorAll<HTMLDetailsElement>('details.en-disclosure')
    disclosures.forEach((d) => {
      d.open = nextState
    })
  }

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const offset = e.clientX - rect.left
      const newPercent = Math.min(Math.max((offset / rect.width) * 100, 20), 80)
      setRatio(Math.round(newPercent))
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

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
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-muted/20 px-3.5 py-2 text-xs">
              <span className="text-muted-foreground">中英对照伴读模式</span>
              <button
                type="button"
                onClick={toggleAllEn}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-2.5 py-1 font-medium text-foreground hover:border-primary/40 hover:text-primary transition-colors cursor-pointer"
              >
                <Globe className="size-3.5 text-primary" aria-hidden />
                <span>{allEnOpen ? '折叠全篇英文' : '全篇展开英文'}</span>
              </button>
            </div>
            <div className="prose w-full max-w-none text-muted-foreground">{rightNode}</div>
          </div>
        )}
      </div>

      {/* 桌面端视图 (≥ lg)：双栏独立滚动工作台 */}
      <div
        className={`hidden lg:flex lg:flex-col w-full h-[calc(100vh-var(--header-height)-6rem)] min-h-[640px] rounded-2xl border border-border-subtle bg-surface shadow-card overflow-hidden ${
          isDragging ? 'select-none' : ''
        }`}
      >
        {/* 顶部指示条与比例切换 */}
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border-subtle bg-muted/30 px-6">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
            <Sparkles className="size-3.5 text-primary" aria-hidden />
            <span>{leftTitle}</span>
            <span className="font-mono text-[10px] text-muted-foreground">({ratio}%)</span>
          </div>

          {/* 栏目比例快速切换组 */}
          <div className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-surface/80 p-0.5 text-xs shadow-2xs">
            <span className="px-1.5 text-[11px] text-muted-foreground">比例:</span>
            <button
              type="button"
              onClick={() => setRatio(70)}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                ratio >= 65
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="7:3 核心实战主导"
            >
              7 : 3
            </button>
            <button
              type="button"
              onClick={() => setRatio(50)}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                ratio > 40 && ratio < 65
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="5:5 双栏平分对照"
            >
              5 : 5
            </button>
            <button
              type="button"
              onClick={() => setRatio(30)}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                ratio <= 40
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="3:7 原著精读主导"
            >
              3 : 7
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleAllEn}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-2.5 py-1 text-xs font-medium text-foreground hover:border-primary/40 hover:text-primary transition-colors cursor-pointer shadow-2xs"
              title={allEnOpen ? '折叠所有段落的英文对照' : '展开所有段落的英文对照'}
            >
              <Globe className="size-3.5 text-primary" aria-hidden />
              <span>{allEnOpen ? '折叠全篇英文' : '全篇展开英文'}</span>
            </button>
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <BookOpen className="size-3.5" aria-hidden />
              <span>{rightTitle}</span>
              <span className="font-mono text-[10px] text-muted-foreground">({100 - ratio}%)</span>
            </div>
          </div>
        </div>

        {/* 双栏容器：左右均有独立的纵向滚动条，支持中间拖拽拉伸 */}
        <div ref={containerRef} className="flex flex-1 min-h-0 w-full overflow-hidden">
          {/* 左栏：核心精炼（独立滚动） */}
          <section
            aria-label={leftTitle}
            tabIndex={0}
            style={{ width: `${ratio}%` }}
            className="h-full overflow-y-auto px-8 py-6 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30"
          >
            <div className="prose w-full max-w-none">{leftNode}</div>
          </section>

          {/* 可拖拽调整宽度的分割器 */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-valuenow={ratio}
            aria-valuemin={20}
            aria-valuemax={80}
            aria-label="拖拽调整左右栏宽度"
            tabIndex={0}
            onMouseDown={handleMouseDown}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') setRatio((r) => Math.max(r - 5, 20))
              if (e.key === 'ArrowRight') setRatio((r) => Math.min(r + 5, 80))
            }}
            className="group relative flex w-2.5 shrink-0 cursor-col-resize items-center justify-center bg-border-subtle/40 hover:bg-primary/20 active:bg-primary/40 transition-colors select-none"
          >
            <div className="flex h-8 w-1.5 items-center justify-center rounded-full bg-border-subtle group-hover:bg-primary/70 transition-colors">
              <GripVertical className="size-3 text-muted-foreground/60 group-hover:text-primary transition-colors" />
            </div>
          </div>

          {/* 右栏：原著对照（独立滚动） */}
          <section
            aria-label={rightTitle}
            tabIndex={0}
            style={{ width: `${100 - ratio}%` }}
            className="h-full overflow-y-auto px-8 py-6 bg-muted/10 text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30"
          >
            <div className="prose w-full max-w-none">{rightNode}</div>
          </section>
        </div>
      </div>
    </div>
  )
}


