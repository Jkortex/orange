'use client'

import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { usePlayer } from './player-provider'
import { Tip } from './tip'

/*
 * 回到顶部（docs/specs/ui-ux.md §4.7-4.8）：
 * - 滚动超一屏才出现，不常驻占位；滚回顶部后消失
 * - 有播放队列时上移避让播放条（窄屏下给播放条让位）
 * - 动效尊重减少动态偏好；图标化按钮语义与全站一致（aria-label + hover 提示）
 */

export function BackToTop() {
  const { index } = usePlayer()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  function scrollTop() {
    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <span
      className={`group fixed right-4 z-40 inline-flex ${index === null ? 'bottom-6' : 'bottom-20'}`}
    >
      <button
        type="button"
        aria-label="回到顶部"
        onClick={scrollTop}
        className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-md hover:text-foreground"
      >
        <ArrowUp className="size-4" aria-hidden />
      </button>
      <Tip className="bottom-full right-0 mb-1.5">回到顶部</Tip>
    </span>
  )
}
