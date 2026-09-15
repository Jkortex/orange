'use client'

import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { usePlayer } from '@/components/player/player-provider'
import { IconButton } from '@/components/primitives/icon-button'

/*
 * 回到顶部（docs/specs/ui-ux.md §4.7-4.8）：
 * - 滚动出现（阈值 300px），不常驻占位；滚回顶部后平滑消失
 * - 有播放队列时上移避让播放条（窄屏下给播放条让位）
 * - 动效尊重减少动态偏好；图标化按钮语义与全站一致（aria-label + hover 提示）
 * - 磨砂玻璃拟态 + 微浮动动效，增强视觉层次
 */

export function BackToTop() {
  const { index } = usePlayer()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // 当页面滚动超过 300px 时灵敏出现，避免用户在短文或浅滚动时无法回到顶部
    const onScroll = () => setVisible(window.scrollY > 300)
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
    <IconButton
      label="回到顶部"
      onClick={scrollTop}
      wrapperClassName={`group fixed right-4 sm:right-6 md:right-8 z-40 inline-flex transition-all duration-300 animate-in fade-in-0 zoom-in-90 slide-in-from-bottom-2 ${
        index === null ? 'bottom-6' : 'bottom-20'
      }`}
      buttonClassName="flex size-9 items-center justify-center rounded-full border border-border/80 bg-card/85 text-muted-foreground shadow-md backdrop-blur-md transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:bg-card hover:text-primary hover:shadow-lg active:scale-95"
      tipClassName="bottom-full right-0 mb-2"
    >
      <ArrowUp className="size-4 transition-transform duration-200 group-hover:-translate-y-0.5" aria-hidden />
    </IconButton>
  )
}
