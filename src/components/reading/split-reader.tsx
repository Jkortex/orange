'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useHotkey } from '@tanstack/react-hotkeys'
import {
  BookOpen,
  Sparkles,
  Globe,
  GripVertical,
  PanelLeft,
  PanelRight,
  Columns2,
  Maximize2,
  Minimize2,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw,
  ScrollText,
} from 'lucide-react'

export type SplitReaderProps = {
  leftNode: React.ReactNode
  rightNode: React.ReactNode
  leftTitle?: string
  rightTitle?: string
}

export type ViewMode = 'split' | 'left' | 'right'

/** 阅读工作台偏好（比例 / 视图 / 宽屏 / 长文）跨文章、跨会话保留 */
export const SPLIT_READER_PREFS_KEY = 'split-reader-prefs'

const VIEW_MODES: ViewMode[] = ['split', 'left', 'right']

type StoredPrefs = {
  ratio?: unknown
  viewMode?: unknown
  isWide?: unknown
  isFluidHeight?: unknown
}

function readStoredPrefs(): StoredPrefs {
  try {
    const raw = localStorage.getItem(SPLIT_READER_PREFS_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return parsed !== null && typeof parsed === 'object' ? (parsed as StoredPrefs) : {}
  } catch {
    // 隐私模式 / 存储被禁用 / JSON 损坏：一律回退默认值，不影响阅读
    return {}
  }
}

function isRatio(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 10 && value <= 90
}

function isViewMode(value: unknown): value is ViewMode {
  return VIEW_MODES.includes(value as ViewMode)
}

export function SplitReader({
  leftNode,
  rightNode,
  leftTitle = '核心精炼与实战',
  rightTitle = '原著参考对照',
}: SplitReaderProps) {
  const [mobileTab, setMobileTab] = useState<'left' | 'right'>('left')
  const [allEnOpen, setAllEnOpen] = useState(false)
  const [ratio, setRatio] = useState<number>(50) // 左栏宽度百分比 (10 - 90)
  const [isDragging, setIsDragging] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('split') // 双栏 / 仅看精炼 / 仅看原著
  const [isWide, setIsWide] = useState(false) // 宽屏通栏铺满模式
  const [isFluidHeight, setIsFluidHeight] = useState(false) // 自然流动长文高度模式
  // 首帧必须与服务端静态 HTML 一致（默认值），读 localStorage 放到挂载后，避免水合错位
  const [prefsReady, setPrefsReady] = useState(false)
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
    // 分割线上叠着两颗折叠按钮：从按钮上按下时不能开始拖拽，否则点击会顺带选中正文
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleTouchStart = useCallback(() => {
    setIsDragging(true)
  }, [])

  // 挂载后恢复上次的阅读偏好：同一份设置跟着 [ / ] 翻页继续生效
  useEffect(() => {
    const prefs = readStoredPrefs()
    if (isRatio(prefs.ratio)) setRatio(Math.round(prefs.ratio))
    if (isViewMode(prefs.viewMode)) setViewMode(prefs.viewMode)
    if (typeof prefs.isWide === 'boolean') setIsWide(prefs.isWide)
    if (typeof prefs.isFluidHeight === 'boolean') setIsFluidHeight(prefs.isFluidHeight)
    setPrefsReady(true)
  }, [])

  // 写入时机：恢复完成后才写，避免用默认值覆盖已有偏好；
  // 拖拽中不写（每次 mousemove 都落盘太浪费），松手后 isDragging 变化再补一次最终比例
  useEffect(() => {
    if (!prefsReady || isDragging) return
    try {
      localStorage.setItem(
        SPLIT_READER_PREFS_KEY,
        JSON.stringify({ ratio, viewMode, isWide, isFluidHeight }),
      )
    } catch {
      // 存储不可用时仅本次会话生效
    }
  }, [prefsReady, isDragging, ratio, viewMode, isWide, isFluidHeight])

  useEffect(() => {
    if (!isDragging) return

    const updateRatio = (clientX: number) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const offset = clientX - rect.left
      const newPercent = Math.min(Math.max((offset / rect.width) * 100, 10), 90)
      setRatio(Math.round(newPercent))
    }

    const handleMouseMove = (e: MouseEvent) => {
      updateRatio(e.clientX)
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        updateRatio(e.touches[0].clientX)
      }
    }

    const handleEnd = () => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleEnd)
    window.addEventListener('touchmove', handleTouchMove)
    window.addEventListener('touchend', handleEnd)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleEnd)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleEnd)
    }
  }, [isDragging])

  /** 重置全部阅读工作台设置：比例、视图、宽屏、长文，并清掉移动端标签 */
  function resetPrefs() {
    setRatio(50)
    setViewMode('split')
    setIsWide(false)
    setIsFluidHeight(false)
    setMobileTab('left')
  }

  // 浮层开着时（搜索 / 灯箱 / 目录 / 快捷键指南）不抢单键
  function readerShortcut(run: () => void) {
    if (document.querySelector('[role="dialog"]') !== null) return
    run()
  }

  // 分栏文章专属快捷键：数字选视图、w/l 切宽屏与长文、0 重置
  useHotkey('1', () => readerShortcut(() => setViewMode('left')))
  useHotkey('2', () => readerShortcut(() => setViewMode('split')))
  useHotkey('3', () => readerShortcut(() => setViewMode('right')))
  useHotkey('W', () => readerShortcut(() => setIsWide((v) => !v)))
  useHotkey('L', () => readerShortcut(() => setIsFluidHeight((v) => !v)))
  useHotkey('0', () => readerShortcut(resetPrefs))

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

      {/* 桌面端视图 (≥ lg)：多模式阅读工作台 */}
      <div
        className={`hidden lg:flex lg:flex-col w-full rounded-2xl border border-border-subtle bg-surface shadow-card transition-all duration-200 split-reader-container ${
          isWide ? 'split-reader-wide' : ''
        } ${
          isFluidHeight
            ? 'split-reader-flow min-h-[500px]'
            : 'h-[calc(100vh-var(--header-height)-6rem)] min-h-[640px] overflow-hidden'
        } ${isDragging ? 'select-none' : ''}`}
      >
        {/* 顶部指示条与模式/比例控制栏 */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border-subtle bg-muted/30 px-5 gap-3">
          {/* 左侧：左栏状态指示 */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider truncate">
              <Sparkles className="size-3.5 text-primary shrink-0" aria-hidden />
              <span className="truncate">{leftTitle}</span>
              <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                ({viewMode === 'left' ? '100%' : viewMode === 'right' ? '已隐藏' : `${ratio}%`})
              </span>
            </div>
          </div>

          {/* 中间核心控制区：视区模式切换 + 双栏比例组 */}
          <div className="flex items-center gap-2.5">
            {/* 视区模式切换组：仅看精炼 / 双栏对照 / 仅看原著 */}
            <div
              className="inline-flex items-center rounded-lg border border-border-subtle bg-surface/80 p-0.5 text-xs shadow-2xs"
              role="group"
              aria-label="阅读视图模式"
            >
              <button
                type="button"
                onClick={() => setViewMode('left')}
                aria-pressed={viewMode === 'left'}
                aria-keyshortcuts="1"
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  viewMode === 'left'
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <PanelLeft className="size-3.5" aria-hidden />
                <span>仅看精炼</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                aria-pressed={viewMode === 'split'}
                aria-keyshortcuts="2"
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  viewMode === 'split'
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Columns2 className="size-3.5" aria-hidden />
                <span>双栏对照</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('right')}
                aria-pressed={viewMode === 'right'}
                aria-keyshortcuts="3"
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  viewMode === 'right'
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <PanelRight className="size-3.5" aria-hidden />
                <span>仅看原著</span>
              </button>
            </div>

            {/* 双栏模式下激活的宽度比例快捷组 */}
            {viewMode === 'split' && (
              <div className="hidden xl:inline-flex items-center gap-0.5 rounded-lg border border-border-subtle bg-surface/80 p-0.5 text-xs shadow-2xs">
                <span className="px-1 text-[11px] text-muted-foreground">比例:</span>
                {[
                  { value: 80, label: '8 : 2', active: ratio >= 75 },
                  { value: 70, label: '7 : 3', active: ratio >= 65 && ratio < 75 },
                  { value: 50, label: '5 : 5', active: ratio > 40 && ratio < 65 },
                  { value: 30, label: '3 : 7', active: ratio > 25 && ratio <= 40 },
                  { value: 20, label: '2 : 8', active: ratio <= 25 },
                ].map(({ value, label, active }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRatio(value)}
                    aria-pressed={active}
                    className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                      active
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* 全局重置：比例、视图、宽屏、长文一起回到默认（旧的比例复位钮与 5:5 按钮重复，已并入这里） */}
            <button
              type="button"
              onClick={resetPrefs}
              aria-label="重置分栏设置"
              aria-keyshortcuts="0"
              title="重置分栏设置（5:5 · 双栏 · 标准宽度 · 工作台高度）"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-2.5 py-1 text-xs font-medium text-foreground hover:border-primary/40 hover:text-primary transition-colors cursor-pointer shadow-2xs"
            >
              <RotateCcw className="size-3.5 text-muted-foreground" aria-hidden />
              <span className="hidden xl:inline">重置</span>
            </button>
          </div>

          {/* 右侧：宽屏模式、流动高度、英文开关与右栏状态 */}
          <div className="flex items-center gap-2 shrink-0">
            {/* 宽屏铺满切换按钮 */}
            <button
              type="button"
              onClick={() => setIsWide(!isWide)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-2.5 py-1 text-xs font-medium text-foreground hover:border-primary/40 hover:text-primary transition-colors cursor-pointer shadow-2xs"
              title={isWide ? '恢复标准宽度' : '展开宽屏模式'}
              aria-label={isWide ? '恢复标准宽度' : '展开宽屏模式'}
              aria-pressed={isWide}
              aria-keyshortcuts="w"
            >
              {isWide ? (
                <Minimize2 className="size-3.5 text-primary" aria-hidden />
              ) : (
                <Maximize2 className="size-3.5 text-muted-foreground" aria-hidden />
              )}
              <span className="hidden xl:inline">{isWide ? '标准宽度' : '宽屏模式'}</span>
            </button>

            {/* 流动高度 / 工作台高度切换按钮 */}
            <button
              type="button"
              onClick={() => setIsFluidHeight(!isFluidHeight)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-2.5 py-1 text-xs font-medium text-foreground hover:border-primary/40 hover:text-primary transition-colors cursor-pointer shadow-2xs"
              title={isFluidHeight ? '切换为工作台独立滚动' : '长文展开流动（自适应全文高度）'}
              aria-label={isFluidHeight ? '工作台独立滚动' : '长文展开流动'}
              aria-pressed={isFluidHeight}
              aria-keyshortcuts="l"
            >
              <ScrollText
                className={`size-3.5 ${isFluidHeight ? 'text-primary' : 'text-muted-foreground'}`}
                aria-hidden
              />
              <span className="hidden xl:inline">{isFluidHeight ? '工作台模式' : '长文模式'}</span>
            </button>

            {/* 全篇英文展开开关 */}
            <button
              type="button"
              onClick={toggleAllEn}
              aria-pressed={allEnOpen}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-2.5 py-1 text-xs font-medium text-foreground hover:border-primary/40 hover:text-primary transition-colors cursor-pointer shadow-2xs"
              title={allEnOpen ? '折叠所有段落的英文对照' : '展开所有段落的英文对照'}
            >
              <Globe className="size-3.5 text-primary" aria-hidden />
              <span className="hidden xl:inline">{allEnOpen ? '折叠全篇英文' : '全篇展开英文'}</span>
            </button>

            {/* 右栏标题信息 */}
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
              <BookOpen className="size-3.5 shrink-0" aria-hidden />
              <span className="hidden 2xl:inline truncate">{rightTitle}</span>
              <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                ({viewMode === 'right' ? '100%' : viewMode === 'left' ? '已隐藏' : `${100 - ratio}%`})
              </span>
            </div>
          </div>
        </div>

        {/* 视区呈现容器 */}
        <div ref={containerRef} className="relative flex flex-1 min-h-0 w-full overflow-hidden">
          {/* 左栏：核心精炼 */}
          {viewMode !== 'right' && (
            <section
              aria-label={leftTitle}
              tabIndex={0}
              style={{ width: viewMode === 'left' ? '100%' : `${ratio}%` }}
              className={`px-8 py-6 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 ${
                isFluidHeight ? 'overflow-visible h-auto' : 'h-full overflow-y-auto'
              }`}
            >
              <div className={`prose w-full ${viewMode === 'left' ? 'max-w-4xl mx-auto' : 'max-w-none'}`}>
                {leftNode}
              </div>
            </section>
          )}

          {/* 可拖拽调整宽度的分割器（仅在双栏对照模式出现） */}
          {viewMode === 'split' && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-valuenow={ratio}
              aria-valuemin={10}
              aria-valuemax={90}
              aria-label="拖拽调整左右栏宽度"
              tabIndex={0}
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
              onDoubleClick={() => setRatio(50)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') setRatio((r) => Math.max(r - (e.shiftKey ? 1 : 5), 10))
                if (e.key === 'ArrowRight') setRatio((r) => Math.min(r + (e.shiftKey ? 1 : 5), 90))
                if (e.key === 'Home') setRatio(10)
                if (e.key === 'End') setRatio(90)
                if (e.key === ' ' || e.key === 'Enter') setRatio(50)
              }}
              className="group relative flex w-3 shrink-0 cursor-col-resize items-center justify-center bg-border-subtle/50 hover:bg-primary/20 active:bg-primary/40 transition-colors select-none"
            >
              {/* 分割线上快捷微调与折叠手柄 */}
              <div className="flex flex-col items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-0.5 py-2 shadow-2xs group-hover:border-primary/50 group-hover:shadow-sm transition-all">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setViewMode('right')
                  }}
                  title="折叠左栏，仅看原著"
                  aria-label="折叠左栏，仅看原著"
                  className="rounded p-0.5 text-muted-foreground/70 hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                >
                  <ChevronsLeft className="size-2.5" aria-hidden />
                </button>
                <GripVertical className="size-3 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setViewMode('left')
                  }}
                  title="折叠右栏，仅看精炼"
                  aria-label="折叠右栏，仅看精炼"
                  className="rounded p-0.5 text-muted-foreground/70 hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                >
                  <ChevronsRight className="size-2.5" aria-hidden />
                </button>
              </div>

              {/* 拖拽过程中的实时比例浮层 */}
              {isDragging && (
                <div className="pointer-events-none absolute top-4 z-30 rounded-md border border-border-subtle bg-popover px-2 py-1 font-mono text-xs font-semibold text-popover-foreground shadow-md whitespace-nowrap">
                  {ratio}% : {100 - ratio}%
                </div>
              )}
            </div>
          )}

          {/* 右栏：原著对照 */}
          {viewMode !== 'left' && (
            <section
              aria-label={rightTitle}
              tabIndex={0}
              style={{ width: viewMode === 'right' ? '100%' : `${100 - ratio}%` }}
              className={`px-8 py-6 bg-muted/10 text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 ${
                isFluidHeight ? 'overflow-visible h-auto' : 'h-full overflow-y-auto'
              }`}
            >
              <div className={`prose w-full ${viewMode === 'right' ? 'max-w-4xl mx-auto' : 'max-w-none'}`}>
                {rightNode}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
