'use client'

import { ArrowUp } from 'lucide-react'
import { usePlayerIndex } from '@/components/player/player-provider'
import { IconButton } from '@/components/primitives/icon-button'
import { floatingStackOffset, useScrolledPast } from '@/lib/floating-stack'

/*
 * 回到顶部：
 * - 滚动出现（阈值 = floating-stack 的 BACK_TO_TOP_THRESHOLD），不常驻占位；滚回顶部后平滑消失
 * - 档位取浮动栈的基准格 floatingStackOffset(false, …)：它是整条浮动栈的锚点，
 *   未滚动时常驻按钮正落在它的档位上；有播放队列时整栈（含它自己）抬一层避让播放条
 * - 动效尊重减少动态偏好；图标化按钮语义与全站一致（aria-label + hover 提示）
 * - 磨砂玻璃按钮，层次靠边框与背景，不靠阴影与浮动
 */

export function BackToTop() {
  const index = usePlayerIndex()
  const visible = useScrolledPast()

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
      wrapperClassName={`group fixed right-4 sm:right-6 md:right-8 z-40 inline-flex transition-[bottom,transform,opacity] duration-200 ease-out animate-in fade-in-0 zoom-in-90 slide-in-from-bottom-2 ${floatingStackOffset(
        false,
        index !== null,
      )}`}
      buttonClassName="border border-border-strong bg-surface/85 backdrop-blur-md hover:border-primary/50 hover:bg-surface hover:text-primary"
      tipClassName="bottom-full right-0 mb-2"
    >
      <ArrowUp className="size-4 transition-transform duration-150 group-hover:-translate-y-0.5" aria-hidden />
    </IconButton>
  )
}
