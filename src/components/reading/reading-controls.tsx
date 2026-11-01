'use client'

import { FontSizeControl } from '@/components/reading/font-size-control'
import { ZenModeToggle } from '@/components/reading/zen-mode-toggle'

/*
 * 阅读选项浮动胶囊：
 * - 位于右上角（fixed right-4 top-20 z-[60]），在 Zen 模式下通过 .reading-controls 保持常驻；
 * - 收敛「正文字号调节」与「Zen 全屏阅读」两大核心长文阅读偏好设置；
 * - 纯客户端响应式胶囊外观，圆角磨砂质感（表面语义 token + 微边框），对齐 AGENTS.md UI 规范。
 */

export function ReadingControls({ className = '' }: { className?: string } = {}) {
  return (
    <aside
      aria-label="阅读选项"
      className={`reading-controls fixed right-4 top-20 z-[60] flex items-center gap-1 rounded-full border border-border-strong bg-surface/85 p-1 backdrop-blur-md shadow-sm transition-[top,right,transform,opacity] duration-200 ease-out ${className}`}
    >
      <FontSizeControl />
      <span aria-hidden="true" className="h-4 w-px bg-border/60" />
      <ZenModeToggle embedded />
    </aside>
  )
}
