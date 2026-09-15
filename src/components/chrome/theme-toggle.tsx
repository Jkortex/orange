'use client'

import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { Moon, Sun } from 'lucide-react'
import { Tip } from '@/components/primitives/tip'
import { animateThemeChange } from '@/lib/theme-transition'

// 深浅色切换：html.dark 类 + localStorage 持久化，纯客户端实现（AGENTS.md UI 主题规范）
// 图标化按钮：aria-label 兜底语义，hover/focus 显示文字提示（AGENTS.md 图标化标准）
export function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggle(e?: React.MouseEvent<HTMLButtonElement>) {
    const next = !dark
    // 扩散圆心取按钮中心（右上顶栏处），无事件时回退到视口右上角
    const rect = e?.currentTarget.getBoundingClientRect()
    const origin = rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : undefined
    // 状态更新收进回调并 flushSync：保证 React 在新快照捕获前提交，
    // 否则图标新旧态可能落在快照交接两侧造成闪动
    animateThemeChange(() => {
      flushSync(() => setDark(next))
      document.documentElement.classList.toggle('dark', next)
      try {
        localStorage.setItem('theme-mode', next ? 'dark' : 'light')
      } catch {
        // localStorage 不可用（如隐私模式）时静默降级，仅本次会话生效
      }
    }, origin)
  }

  const label = dark ? '切换到浅色' : '切换到深色'

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-all duration-200 hover:bg-muted/70 hover:text-foreground active:scale-95"
      >
        {/* key 随状态重挂图标，播放一次淡入缩放，表达明暗切换的即时反馈 */}
        <span key={dark ? 'sun' : 'moon'} className="block animate-in fade-in-0 zoom-in-50 duration-200">
          {dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
        </span>
      </button>
      <Tip className="right-0 top-full mt-1.5">{label}</Tip>
    </span>
  )
}
