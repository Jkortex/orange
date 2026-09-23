'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { animateThemeChange } from '@/lib/theme-transition'

// 主题选择下拉菜单：html data-theme + localStorage 持久化，纯客户端实现（AGENTS.md UI 主题规范）
// 菜单行为（外部点击/Escape/选择后关闭、键盘导航）由 Radix DropdownMenu 接管
const THEMES = [
  { id: 'default', label: '默认' },
  { id: 'catppuccin', label: 'Catppuccin' },
]

export function ThemeSelect({ className = '' }: { className?: string } = {}) {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState('default')

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme ?? 'default')
  }, [])

  function choose(next: string) {
    // 菜单关闭保持在外立即执行，不进快照
    animateThemeChange(() => {
      setTheme(next)
      document.documentElement.dataset.theme = next
      try {
        localStorage.setItem('theme-name', next)
      } catch {
        // localStorage 不可用（如隐私模式）时静默降级，仅本次会话生效
      }
    })
    setOpen(false)
  }

  const current = THEMES.find(({ id }) => id === theme) ?? THEMES[0]

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="选择主题"
          className={`flex items-center gap-1 rounded-full border border-border/70 bg-card/60 px-3 py-1.5 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-colors duration-200 hover:border-primary/30 hover:text-foreground ${className}`}
        >
          {current.label}
          <ChevronDown className="size-3.5" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" aria-label="选择主题" className="w-32">
        <DropdownMenuRadioGroup value={theme} onValueChange={choose}>
          {THEMES.map(({ id, label }) => (
            <DropdownMenuRadioItem key={id} value={id}>
              <span>{label}</span>
              {theme === id && <Check className="size-4 text-primary" aria-hidden />}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
