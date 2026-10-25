'use client'

import { openHotkeyHelp } from '@/components/chrome/hotkey-help-modal'

/*
 * 页脚「快捷键」入口：指南本身由 ? 唤起，触屏用户没有键盘、也不知道这个键，
 * 没有可见入口等于不存在。这里只负责派发事件，弹窗仍由 HotkeyHelpModal 统一持有，
 * 避免把 open 状态提到根布局。
 */
export function HotkeyHelpTrigger() {
  return (
    <button
      type="button"
      onClick={openHotkeyHelp}
      aria-keyshortcuts="?"
      className="transition-colors hover:text-foreground"
    >
      快捷键
    </button>
  )
}
