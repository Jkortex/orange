'use client'

import { useEffect, useState } from 'react'
import type { TocHeading } from '@/lib/toc'
import { scrollToHeading } from '@/lib/scroll'

/*
 * 文内目录：
 * - 纯客户端响应式高亮当前阅读位置（IntersectionObserver）
 * - 桌面端可在右侧 sticky 悬浮，移动端可嵌入在正文前
 * - 激活项胶囊微底色 + 悬浮位移微动效，提升长文导航沉浸感
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
      className={`rounded-xl border border-border/70 bg-card/60 p-3.5 backdrop-blur-sm ${className}`}
    >
      <div className="mb-2.5 flex items-center justify-between px-1">
        <p className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">目录</p>
        <span className="font-mono text-xs text-muted-foreground/70">{headings.length} 节</span>
      </div>
      <ol className="relative space-y-1 border-l border-border/50 pl-2.5 text-sm">
        {headings.map((heading) => {
          const isActive = activeId === heading.id
          return (
            <li key={heading.id} className={heading.depth === 3 ? 'ml-4' : undefined}>
              <a
                href={`#${heading.id}`}
                onClick={(e) => handleHeadingClick(e, heading.id)}
                className={`group flex items-center rounded-md px-2 py-1.5 text-[13px] transition-all duration-200 ${
                  isActive
                    ? 'bg-primary/12 font-medium text-primary shadow-2xs'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:translate-x-0.5'
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
