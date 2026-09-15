import type { ButtonHTMLAttributes } from 'react'
import { Tip } from '@/components/primitives/tip'

/*
 * 图标按钮（player-bar / back-to-top / theme-toggle / search-dialog / album-track-list 共用）：
 * - DOM 骨架统一为 span.group > button[aria-label] + Tip，语义与悬停提示一致；
 *   触摸目标与提示方位由调用方传入（各处已按 36px / 上下方位验收，见各自测试）
 */

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** 无障碍名，同时作为悬停提示文案 */
  label: string
  /** 外层定位类（默认行内；back-to-top 传入 fixed 定位，须自带 group） */
  wrapperClassName?: string
  /** 按钮视觉类（触摸目标尺寸由调用方保证） */
  buttonClassName?: string
  /** 提示方位类（默认按钮上方右对齐） */
  tipClassName?: string
}

const defaultWrapperClass = 'group relative inline-flex'
const defaultTipClass = 'bottom-full right-0 mb-1.5'

export function IconButton({
  label,
  wrapperClassName,
  buttonClassName = '',
  tipClassName,
  children,
  ...rest
}: IconButtonProps) {
  return (
    <span className={wrapperClassName ?? defaultWrapperClass}>
      <button type="button" aria-label={label} className={buttonClassName} {...rest}>
        {children}
      </button>
      <Tip className={tipClassName ?? defaultTipClass}>{label}</Tip>
    </span>
  )
}
