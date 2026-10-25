'use client'

import { ArrowUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePlayerIndex } from '@/components/player/player-provider'
import { IconButton } from '@/components/primitives/icon-button'
import {
  floatingStackOffset,
  FLOATING_STACK_ANCHOR,
  FLOATING_STACK_BUTTON,
  FLOATING_STACK_TIP,
} from '@/lib/floating-stack'

/*
 * 回到顶部：
 * - 普通页面与长文模式：监听 window 滚动。
 * - 分栏工作台模式：滚动发生在栏内 section，因此额外监听这些滚动容器；
 *   点击时优先把已滚动的栏滚回顶部，没有栏滚动时再回页面顶部。
 */

function getSplitPanes(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-split-reader] section')) as HTMLElement[]
}

export function BackToTop() {
  const index = usePlayerIndex()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const threshold = 300
    function update() {
      const paneScrolled = getSplitPanes().some((pane) => pane.scrollTop > threshold)
      setVisible(window.scrollY > threshold || paneScrolled)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    // 捕获阶段：栏内滚动不会冒泡到 window，但能被 document 捕获
    document.addEventListener('scroll', update, { capture: true, passive: true })
    return () => {
      window.removeEventListener('scroll', update)
      document.removeEventListener('scroll', update, { capture: true })
    }
  }, [])

  if (!visible) return null

  function scrollTop() {
    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const panes = getSplitPanes().filter((pane) => pane.scrollTop > 0)
    if (panes.length > 0) {
      panes.forEach((pane) => pane.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }))
    } else {
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
    }
  }

  return (
    <IconButton
      label="回到顶部"
      onClick={scrollTop}
      wrapperClassName={`${FLOATING_STACK_ANCHOR} inline-flex animate-in fade-in-0 zoom-in-90 slide-in-from-bottom-2 ${floatingStackOffset(
        false,
        index !== null,
      )}`}
      buttonClassName={FLOATING_STACK_BUTTON}
      tipClassName={FLOATING_STACK_TIP}
    >
      <ArrowUp className="size-4 transition-transform duration-150 group-hover:-translate-y-0.5" aria-hidden />
    </IconButton>
  )
}