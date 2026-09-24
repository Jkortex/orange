'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { IconButton } from '@/components/primitives/icon-button'
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
    // VT startViewTransition(update) 在 update() 返回后同步捕获快照，
    // 无需 flushSync 强制同步提交，React 批量更新减少主线程阻塞
    animateThemeChange(() => {
      setDark(next)
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
    <IconButton
      label={label}
      onClick={toggle}
      tipClassName="right-0 top-full mt-1.5"
    >
      {/* key 随状态重挂图标，播放一次淡入缩放，表达明暗切换的即时反馈；
          duration-100：图标在 VT 圆形扩散前 26% 完成，节奏紧凑 */}
      <span key={dark ? 'sun' : 'moon'} className="block animate-in fade-in-0 zoom-in-50 duration-100">
        {dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
      </span>
    </IconButton>
  )
}
