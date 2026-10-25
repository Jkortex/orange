'use client'

import { useEffect, useRef, useState } from 'react'
import { Keyboard, X } from 'lucide-react'
import { iconButtonClass } from '@/components/primitives/icon-button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'

export interface ShortcutItem {
  keys: string
  desc: string
}

/*
 * 只列**真实绑定过**、且别处发现不了的键。
 * 这里曾列过 g c / g a / g s（三条「命令面板 — 命令/分类/页面符号模式」），
 * 全站从未绑定过它们，描述里的那个命令面板也根本不存在 —— 帮助页说错话比不说更糟。
 * 搜索弹窗内部的 ↑↓ / ↵ / ⇧←→ / Tab 由弹窗底栏就地提示，不在此重复。
 * 新增条目请同时确认对应的按键处理器真的存在。
 */
export const SHORTCUTS: ShortcutItem[] = [
  { keys: 'Ctrl/⌘ + K  或  /', desc: '打开站内搜索' },
  { keys: '[  /  ]', desc: '上一篇 / 下一篇（仅文章详情）' },
  { keys: '1 / 2 / 3', desc: '分栏文章：仅看精炼 / 双栏 / 仅看原著' },
  { keys: 'w  /  l', desc: '分栏文章：宽屏模式 / 长文模式' },
  { keys: '0', desc: '分栏文章：重置分栏设置' },
  { keys: 't', desc: '切换深浅色' },
  { keys: '?', desc: '显示 / 隐藏本指南' },
  { keys: 'Esc', desc: '关闭弹窗 / 浮层' },
]

/** 页脚入口等外部控件用它唤起指南（组件自身不渲染触发器，靠 ? 键与事件两路进入） */
export const HOTKEY_HELP_EVENT = 'orange:hotkey-help'

export function openHotkeyHelp() {
  window.dispatchEvent(new Event(HOTKEY_HELP_EVENT))
}

/*
 * 浮层本体交给 ui/dialog（Radix）：焦点陷阱、Esc、遮罩点击关闭、滚动锁都由它接管。
 * 此前这里是手写的 fixed 遮罩 + div[role=dialog]，只有 Esc 是自己接的 ——
 * 键盘 Tab 能直接走到浮层背后的顶栏去，读屏也感知不到「模态」。
 * 关闭按钮用 DialogClose + 自绘 36px 圆钮，而不是 DialogContent 自带的那个：
 * 自带的没有内边距、图标 16px，触屏上按不中（AGENTS.md 图标化标准要求 ≥36px）。
 */
export function HotkeyHelpModal() {
  const [isOpen, setIsOpen] = useState(false)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  // 原生监听兼容不同键盘布局与测试模拟的 '?'
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== '?' || e.isComposing) return
      // 输入框 / 可编辑区域里 ? 是正常字符，不能抢
      const target = e.target as HTMLElement | null
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '') ||
        target?.isContentEditable
      ) {
        return
      }
      if (isOpen) {
        setIsOpen(false)
        return
      }
      // 已有别的弹窗（搜索 / 灯箱 / 抽屉）开着时不叠上去
      if (document.querySelector('[role="dialog"]') !== null) return
      // 记下打开前的焦点位置（见下面 onCloseAutoFocus 的说明）
      restoreFocusRef.current = document.activeElement as HTMLElement | null
      setIsOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  // 页脚「快捷键」入口：没有可见触发器时只能靠 ?，触屏用户根本不知道有这份指南
  useEffect(() => {
    function onOpen() {
      if (document.querySelector('[role="dialog"]') !== null) return
      restoreFocusRef.current = document.activeElement as HTMLElement | null
      setIsOpen(true)
    }
    window.addEventListener(HOTKEY_HELP_EVENT, onOpen)
    return () => window.removeEventListener(HOTKEY_HELP_EVENT, onOpen)
  }, [])

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {/* 不写 max-w-md 而写 sm:max-w-md：DialogContent 基类的 max-w-[calc(100%-2rem)]
          负责移动端两侧留白，直接覆盖掉会让小屏上贴边 */}
      <DialogContent
        showCloseButton={false}
        className="bg-surface sm:max-w-md"
        onCloseAutoFocus={(event) => {
          // Radix 对 modal 浮层只做一件事：把焦点还给 DialogTrigger。
          // 本浮层由 '?' 唤起，没有触发器，照默认走焦点就掉到 <body> 上，
          // 键盘用户会丢掉原来的位置。故拦下来，自己还给打开前的元素。
          event.preventDefault()
          restoreFocusRef.current?.focus({ preventScroll: true })
        }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border-subtle pb-3">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary" aria-hidden="true" />
            <DialogTitle className="type-section text-foreground">快捷键指南</DialogTitle>
          </div>
          <DialogClose asChild>
            <button
              type="button"
              aria-label="关闭快捷键指南"
              className={iconButtonClass('md', 'shrink-0')}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </DialogClose>
        </div>

        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
          {SHORTCUTS.map(({ keys, desc }) => (
            <div
              key={keys}
              className="type-meta flex items-center justify-between rounded-lg px-3 py-2 transition-colors duration-150 hover:bg-muted"
            >
              <span className="text-muted-foreground">{desc}</span>
              <kbd className="kbd gap-1 font-medium text-foreground">
                {keys}
              </kbd>
            </div>
          ))}
        </div>

        <div className="type-caption border-t border-border-subtle pt-3 text-center text-muted-foreground">
          按 Esc 或点击外部关闭 · 输入框中单键快捷键不会触发
        </div>
      </DialogContent>
    </Dialog>
  )
}
