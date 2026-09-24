import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { Tip } from '@/components/primitives/tip'

/*
 * 图标按钮（player-bar / back-to-top / theme-toggle / search-dialog / album-track-list / mobile-toc-drawer 共用）：
 * - DOM 骨架统一为 span.group > button[aria-label] + Tip，语义与悬停提示一致
 * - 视觉契约收敛于此：圆形、36px 触摸目标（AGENTS.md 图标化标准）、hover 提亮、按下微缩；
 *   调用方只传「变体差异」（如 back-to-top 的磨砂描边态），尺寸经 size 指定
 * - 提示方位仍由调用方传入（上方/下方/居中等各异）
 */

export type IconButtonSize = 'sm' | 'md' | 'lg'

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** 无障碍名，同时作为悬停提示文案 */
  label: string
  /** 外层定位类（默认行内；back-to-top 传入 fixed 定位，须自带 group） */
  wrapperClassName?: string
  /** 变体差异类（尺寸请用 size，勿再手写 p-* / size-*） */
  buttonClassName?: string
  /** 提示方位类（默认按钮上方右对齐） */
  tipClassName?: string
  /** 触摸目标尺寸（md = 36px） */
  size?: IconButtonSize
}

const defaultWrapperClass = 'group relative inline-flex'
const defaultTipClass = 'bottom-full right-0 mb-1.5'

const SIZE_CLASS: Record<IconButtonSize, string> = {
  sm: 'size-8',
  md: 'size-9',
  lg: 'size-10',
}

const BASE_CLASS =
  'flex items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted/70 hover:text-foreground active:scale-95'

export function IconButton({
  label,
  wrapperClassName,
  buttonClassName,
  tipClassName,
  size = 'md',
  children,
  ...rest
}: IconButtonProps) {
  return (
    <span className={wrapperClassName ?? defaultWrapperClass}>
      <button
        type="button"
        aria-label={label}
        data-size={size}
        className={cn(BASE_CLASS, SIZE_CLASS[size], buttonClassName)}
        {...rest}
      >
        {children}
      </button>
      <Tip className={tipClassName ?? defaultTipClass}>{label}</Tip>
    </span>
  )
}
