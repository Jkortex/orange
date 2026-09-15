'use client'

import { useEffect, useState } from 'react'

/*
 * 阅读进度条：
 * - 吸顶位于页面最顶部（z-50），向下滚动时平滑展开
 * - rAF 驱动，无多余 re-render，未滚动或在最顶部时不显突兀
 */
export function ReadingProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let frameId: number | null = null

    function updateProgress() {
      const scrollY = window.scrollY || document.documentElement.scrollTop
      const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight
      if (docHeight > 0) {
        const p = Math.min(100, Math.max(0, (scrollY / docHeight) * 100))
        setProgress(p)
      }
    }

    function onScroll() {
      if (frameId === null) {
        frameId = requestAnimationFrame(() => {
          updateProgress()
          frameId = null
        })
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    updateProgress()

    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frameId !== null) cancelAnimationFrame(frameId)
    }
  }, [])

  if (progress <= 0) return null

  return (
    <div
      role="progressbar"
      aria-label="阅读进度"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px] bg-transparent"
    >
      <div
        className="h-full rounded-r-full bg-primary transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
