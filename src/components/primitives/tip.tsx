/*
 * 图标按钮的 hover/focus 文字提示（AGENTS.md 主题规范第 7 条）：
 * - 纯视觉补充，语义由父按钮的 aria-label 兜底，自身 aria-hidden 防读屏重复朗读
 * - 触摸设备上由 globals.css 全局隐藏（any-pointer: coarse），避免 iOS 两段式 tap
 * - 仅在 hover 与键盘 Tab 聚焦（:focus-visible）时展示，避免鼠标点击后提示残留在屏幕上
 * - 基础显隐行为收敛于此，位置类由调用方传入（上方/下方/居中等各异）
 */

const baseClass =
  'type-caption pointer-events-none absolute whitespace-nowrap rounded-md border border-border-subtle bg-surface px-2 py-1 text-foreground opacity-0 shadow-pop transition-opacity group-hover:opacity-100 group-has-[:focus-visible]:opacity-100'

export function Tip({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span data-tip aria-hidden className={className ? `${baseClass} ${className}` : baseClass}>
      {children}
    </span>
  )
}
