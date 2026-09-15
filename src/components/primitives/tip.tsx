/*
 * 图标按钮的 hover/focus 文字提示（AGENTS.md 主题规范第 7 条）：
 * - 纯视觉补充，语义由父按钮的 aria-label 兜底，自身 aria-hidden 防读屏重复朗读
 * - 触摸设备上由 globals.css 全局隐藏（any-pointer: coarse），避免 iOS 两段式 tap
 * - 基础显隐行为收敛于此，位置类由调用方传入（上方/下方/居中等各异）
 */

const baseClass =
  'pointer-events-none absolute whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-[13px] text-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100'

export function Tip({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span data-tip aria-hidden className={className ? `${baseClass} ${className}` : baseClass}>
      {children}
    </span>
  )
}
