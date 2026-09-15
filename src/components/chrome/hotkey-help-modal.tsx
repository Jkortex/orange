'use client'

import { useEffect, useState } from 'react'
import { useHotkey } from '@tanstack/react-hotkeys'
import { Keyboard, X } from 'lucide-react'

export interface ShortcutItem {
  keys: string
  desc: string
  category: '导航' | '命令' | '阅读'
}

export const SHORTCUTS: ShortcutItem[] = [
  { keys: 'Mod+K / Mod+P', desc: '命令面板 — 综合搜索', category: '命令' },
  { keys: 'g c', desc: '命令面板 — 命令模式 (>)', category: '命令' },
  { keys: 'g a', desc: '命令面板 — 分类模式 (@)', category: '命令' },
  { keys: 'g s', desc: '命令面板 — 页面符号 (#)', category: '命令' },
  { keys: 'g h', desc: '回到博客首页', category: '导航' },
  { keys: '[  /  ]', desc: '上一篇 / 下一篇', category: '阅读' },
  { keys: 't', desc: '切换深浅主题', category: '命令' },
  { keys: '?', desc: '显示快捷键帮助', category: '命令' },
  { keys: 'Esc', desc: '关闭弹窗 / 浮层', category: '命令' },
]

export function HotkeyHelpModal() {
  const [isOpen, setIsOpen] = useState(false)

  // 原生监听兼容不同键盘布局与测试模拟的 '?'
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        setIsOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 监听 Esc 键关闭
  useHotkey(
    'Escape',
    () => {
      setIsOpen(false)
    },
    { enabled: isOpen },
  )

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="快捷键指南"
      onClick={() => setIsOpen(false)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl transition-all"
      >
        <div className="mb-5 flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="text-base font-semibold text-foreground">快捷键指南</h2>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="关闭快捷键指南"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
          {SHORTCUTS.map(({ keys, desc }) => (
            <div
              key={keys}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted/60"
            >
              <span className="text-muted-foreground">{desc}</span>
              <kbd className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/70 px-2 py-0.5 font-mono text-xs font-medium text-foreground">
                {keys}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-5 border-t border-border/60 pt-3 text-center text-[13px] text-muted-foreground/70">
          按 <kbd className="rounded border border-border px-1 font-mono text-xs">Esc</kbd> 或点击外部关闭
        </div>
      </div>
    </div>
  )
}
