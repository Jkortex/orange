'use client'

import { useEffect, useState } from 'react'
import type { TocHeading } from '@/lib/toc'
import { scrollToHeading } from '@/lib/scroll'

/*
 * 文内目录：
 * - 纯客户端响应式高亮当前阅读位置（IntersectionObserver）
 * - 桌面端可在右侧 sticky 悬浮，移动端可嵌入在正文前
 * - 激活项胶囊微底色 + 悬浮位移微动效，提升长文导航沉浸感
 *
 * 滚动契约（长目录，如 35 节）：滚动发生在卡片**内部**，只有列表滚动，
 * 卡片头部（「目录 · N 节」）与圆角/描边固定不动。故卡片是 flex 纵向：
 * 头部 shrink-0，列表 min-h-0 + flex-1 + overflow-y-auto；高度上限由调用方经
 * className 传入（如 max-h-[calc(100vh-var(--header-height)-3rem)]）。
 * 调用方不要再在外层容器上加 overflow-y-auto —— 那会让整张卡片（含头部与边框）一起滚走。
 *
 * 列表只允许纵向滚动：overflow-y-auto 会把 overflow-x 一并算成 auto，稍有溢出（如激活项
 * hover 的 translate-x-0.5）就冒出横向滚动条，故显式 overflow-x-hidden。pr-2 把滚动条
 * 从文字旁推开一点，避免贴着标题文字。
 */

export function Toc({ headings, className = '' }: { headings: TocHeading[]; className?: string }) {
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || headings.length === 0) return

    // 监听标题可见性，动态高亮当前小节
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
            break
          }
        }
      },
      { rootMargin: '0px 0px -70% 0px' },
    )

    for (const heading of headings) {
      const el = document.getElementById(heading.id)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [headings])

  if (headings.length === 0) return null

  function handleHeadingClick(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault()
    // 滚动 + hash 同步收敛到 scrollToHeading；高亮态本地维护
    if (scrollToHeading(id)) setActiveId(id)
  }

  return (
    <nav
      aria-label="文章目录"
      className={`surface-card flex flex-col p-3.5 ${className}`}
    >
      <div className="mb-2.5 flex shrink-0 items-center justify-between px-1">
        <p className="type-caption font-semibold uppercase tracking-wider text-muted-foreground">目录</p>
        <span className="type-caption font-mono text-muted-foreground">{headings.length} 节</span>
      </div>
      <ol className="relative min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden pr-2 border-l border-border-subtle pl-2.5">
        {headings.map((heading) => {
          const isActive = activeId === heading.id
          return (
            <li key={heading.id} className={heading.depth === 3 ? 'ml-4' : undefined}>
              <a
                href={`#${heading.id}`}
                onClick={(e) => handleHeadingClick(e, heading.id)}
                className={`group flex items-center rounded-md px-2 py-1.5 type-meta transition-all duration-150 ${
                  isActive
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground hover:translate-x-0.5'
                }`}
              >
                <span className="truncate">{heading.text}</span>
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
