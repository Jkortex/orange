import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { Tip } from '@/components/primitives/tip'

/*
 * 图标按钮（player-bar / back-to-top / theme-toggle / search-dialog / album-track-list / media-zoom 共用）：
 * - DOM 骨架统一为 span.group > button[aria-label] + Tip，语义与悬停提示一致
 * - 视觉契约收敛于此：圆形、36px 触摸目标（AGENTS.md 图标化标准）、hover 提亮、按下微缩、
 *   禁用态（降透明度 + 不吃指针事件，顺带让 Tip 不再弹出）；调用方只传「变体差异」
 *   （如 back-to-top 的磨砂描边态），尺寸经 size 指定
 * - 提示方位仍由调用方传入（上方/下方/居中等各异）
 *
 * size="sm"（32px）是唯一低于 36px 的档，只准用在输入框内部的附属按钮上：
 * 这类按钮贴着光标、紧邻输入区，32px 是行业惯例（Chrome / Safari 的原生清除钮同样偏小），
 * 撑到 36px 反而会把输入行顶高。行内之外的图标按钮一律用默认的 md。
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
  /** 触摸目标尺寸（md = 36px；sm = 32px，只给输入框内的行内附属按钮） */
  size?: IconButtonSize
  /**
   * 宽度行为：默认与 size 同为正方形；'auto' 只锁高度、宽度随内容撑开（带文字的胶囊）。
   * 后者不再输出固定宽度类——size-* 的 width 与 w-auto 不属同一冲突组，tailwind-merge
   * 不会去重，二者共存时宽度只能靠 Tailwind 输出顺序决胜，故从源头避免共存。
   */
  width?: 'auto'
}

const defaultWrapperClass = 'group relative inline-flex'
const defaultTipClass = 'bottom-full right-0 mb-1.5'

const SIZE_CLASS: Record<IconButtonSize, string> = {
  sm: 'size-8',
  md: 'size-9',
  lg: 'size-10',
}

/** width="auto" 只锁高度，宽度交给内容与内边距 */
const HEIGHT_CLASS: Record<IconButtonSize, string> = {
  sm: 'h-8',
  md: 'h-9',
  lg: 'h-10',
}

const BASE_CLASS =
  'flex items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground active:scale-95 disabled:pointer-events-none disabled:opacity-40'

export function IconButton({
  label,
  wrapperClassName,
  buttonClassName,
  tipClassName,
  size = 'md',
  width,
  children,
  ...rest
}: IconButtonProps) {
  return (
    <span className={wrapperClassName ?? defaultWrapperClass}>
      <button
        type="button"
        aria-label={label}
        data-size={size}
        className={cn(BASE_CLASS, (width === 'auto' ? HEIGHT_CLASS : SIZE_CLASS)[size], buttonClassName)}
        {...rest}
      >
        {children}
      </button>
      <Tip className={tipClassName ?? defaultTipClass}>{label}</Tip>
    </span>
  )
}

/**
 * 纯按钮版的图标按钮外观：给「必须自己就是 <button>」的场景用。
 *
 * 为什么不能直接套 IconButton：Radix 的 asChild（DialogClose / SheetTrigger）用 Slot 把 props
 * 合并到**直接子元素**上，IconButton 的根是 span，props 会挂错元素、按钮拿不到行为。
 * 故这些地方自绘 <button>，但外观必须与 IconButton 同源 —— 否则改一处按压反馈，
 * 另一处会静默留在旧样式上。extra 排在最后，调用方的变体类才能压过默认的 hover 态。
 */
export function iconButtonClass(size: IconButtonSize = 'md', extra?: string) {
  return cn(BASE_CLASS, SIZE_CLASS[size], extra)
}
