'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Tip } from './tip'

// 深浅色切换：html.dark 类 + localStorage 持久化，纯客户端实现（AGENTS.md UI 主题规范）
// 图标化按钮：aria-label 兜底语义，hover/focus 显示文字提示（AGENTS.md 图标化标准）
export function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('theme-mode', next ? 'dark' : 'light')
    } catch {
      // localStorage 不可用（如隐私模式）时静默降级，仅本次会话生效
    }
  }

  const label = dark ? '切换到浅色' : '切换到深色'

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        className="p-2.5 text-muted-foreground hover:text-foreground"
      >
        {dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
      </button>
      <Tip className="right-0 top-full mt-1.5">{label}</Tip>
    </span>
  )
}
