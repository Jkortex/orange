'use client'

import { useEffect, useState } from 'react'
import { List, X } from 'lucide-react'
import type { TocHeading } from '@/lib/toc'
import { scrollToHeading } from '@/lib/scroll'
import { useOptionalPlayer } from '@/components/player/player-provider'
import { IconButton } from '@/components/primitives/icon-button'

/*
 * 移动端/窄屏目录抽屉与悬浮入口（< xl）：
 * - 与 BackToTop 共享同一垂直基准轴线（right-4 sm:right-6 md:right-8）与组件规范（IconButton size-9）
 * - 页面滚动超过 300px（BackToTop 出现）时，平滑上浮腾出位置，形成视觉协调的双钮操作栈
 * - 播放条出现时自适应同步抬升，严防层叠遮挡
 */

export function MobileTocDrawer({
  headings,
  className = '',
}: {
  headings: TocHeading[]
  className?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const player = useOptionalPlayer()
  const hasPlayer = player !== null && player.index !== null

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 300)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (headings.length === 0) return null

  function handleHeadingClick(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault()
    scrollToHeading(id)
    setIsOpen(false)
  }

  // 计算垂直底距：与 BackToTop 保持 8px（gap-2）紧凑协调间距
  const bottomClass = !hasPlayer
    ? (isScrolled ? 'bottom-[4.25rem]' : 'bottom-6')
    : (isScrolled ? 'bottom-[7.75rem]' : 'bottom-20')

  return (
    <div className={`xl:hidden ${className}`}>
      {/* 悬浮目录触发按钮：统一的尺寸、对齐线、磨砂质感与提示气泡 */}
      <IconButton
        label="文章目录"
        onClick={() => setIsOpen(true)}
        wrapperClassName={`group fixed right-4 sm:right-6 md:right-8 z-40 inline-flex transition-[bottom,transform,opacity] duration-200 ease-out animate-in fade-in-0 zoom-in-90 ${bottomClass}`}
        buttonClassName="border border-border-strong bg-surface/85 backdrop-blur-md hover:border-primary/50 hover:bg-surface hover:text-primary"
        tipClassName="bottom-full right-0 mb-2"
      >
        <List className="size-4" aria-hidden="true" />
      </IconButton>

      {/* 移动端抽屉遮罩与内容区 */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="文章目录抽屉"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-background/60 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in-0"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[75vh] w-full max-w-lg rounded-t-2xl border-t border-border bg-background p-5 shadow-overlay overflow-hidden flex flex-col transition-transform animate-in slide-in-from-bottom duration-200 ease-out will-change-transform"
          >
            {/* 顶栏 */}
            <div className="mb-4 flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <List className="h-4 w-4 text-primary" aria-hidden="true" />
                <h2 className="type-section text-foreground">文章目录</h2>
                <span className="type-caption font-mono text-muted-foreground">({headings.length} 节)</span>
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
                  className={`type-meta block rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground active:bg-primary/10 ${
                    heading.depth === 3 ? 'pl-7 type-caption' : 'font-medium'
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
