'use client'

import { useEffect, useState } from 'react'
import { useOptionalPlayerIndex } from '@/components/player/player-provider'

/*
 * 右下角浮动控件栈的统一垂直编排（回到顶部 / 移动端目录 / 分类筛选）。
 *
 * 三者共用一条基准轴线（right-4 sm:right-6 md:right-8）与同一组档位。新增常驻浮动按钮时
 * 一律用 useFloatingStackOffset()，不要各自硬编码 bottom-* —— 否则回到顶部出现时
 * 不知道要给谁让位，出现悬空或重叠。回到顶部自身是锚点，取基准格
 * floatingStackOffset(false, …) 而非 useFloatingStackOffset()。
 *
 * 两级让位，自下而上：
 *   1. 播放条（fixed 悬浮层，64px）出现 → 整栈抬一层；
 *   2. 回到顶部出现（滚动 300px）→ 常驻按钮再抬一层给它腾位。
 * 相邻按钮之间固定留 8px（gap-2）。
 */

/** 回到顶部出现的滚动阈值 */
export const BACK_TO_TOP_THRESHOLD = 300

/** 浮动控件栈锚点定位：右下角同一竖轴，z-40，bottom 档位带过渡（各组件按需追加 animate-in / inline-flex / md:hidden） */
export const FLOATING_STACK_ANCHOR =
  'group fixed right-4 sm:right-6 md:right-8 z-40 transition-[bottom,transform,opacity] duration-200 ease-out'

/** 磨砂玻璃按钮外观（描边 + 半透明底 + hover 品牌色），三者共用 */
export const FLOATING_STACK_BUTTON =
  'border border-border-strong bg-surface/85 backdrop-blur-md hover:border-primary/50 hover:bg-surface hover:text-primary'

/** 图标按钮提示气泡定位（按钮上方右对齐） */
export const FLOATING_STACK_TIP = 'bottom-full right-0 mb-2'

/**
 * 档位表。scrolled=false 的两档与 back-to-top 自身的 bottom-6 / bottom-20 严格相等——
 * 因为回到顶部此时不可见，常驻按钮正好占用它的位置；scrolled=true 才上抬让位。
 */
export function floatingStackOffset(scrolled: boolean, playerBar: boolean) {
  if (playerBar) return scrolled ? 'bottom-[7.75rem]' : 'bottom-20'
  return scrolled ? 'bottom-[4.25rem]' : 'bottom-6'
}

/** 滚动是否已超过阈值 */
export function useScrolledPast(threshold: number = BACK_TO_TOP_THRESHOLD) {
  const [passed, setPassed] = useState(false)

  useEffect(() => {
    const onScroll = () => setPassed(window.scrollY > threshold)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])

  return passed
}

/** 常驻浮动按钮的档位：已含播放条与回到顶级的两级让位 */
export function useFloatingStackOffset() {
  const scrolled = useScrolledPast()
  const playerBar = useOptionalPlayerIndex() !== null
  return floatingStackOffset(scrolled, playerBar)
}
