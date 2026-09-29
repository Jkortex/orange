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

/*
 * 触发器上的主题名走 CSS（按 html 的 data-theme 属性切换），不走 state。
 * 原因：data-theme 由 head 里的内联脚本在首帧前写好，而 state 要等 effect 才读到，
 * 于是选了 Catppuccin 的人每次加载都会先看到「默认」再跳变。
 * 类名必须字面写在这里 —— Tailwind 只扫描源码里的字面类名，
 * `[[data-theme='${id}']_&]` 这种拼接不会生成任何规则，静默失效。
 */
const THEME_LABEL_CLASS: Record<string, string> = {
  default: "[[data-theme='default']_&]:inline",
  catppuccin: "[[data-theme='catppuccin']_&]:inline",
}

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

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="选择主题"
          className={`type-meta flex items-center gap-1 rounded-full border border-border-subtle bg-surface px-3 py-1.5 font-medium text-muted-foreground transition-colors duration-150 hover:border-primary/30 hover:text-foreground ${className}`}
        >
          {/* 两个主题名都在 DOM 里，由 data-theme 决定显示哪个：首帧就是对的，不经过 state */}
          {THEMES.map(({ id, label }) => (
            <span key={id} data-theme-label={id} className={`hidden ${THEME_LABEL_CLASS[id] ?? ''}`}>
              {label}
            </span>
          ))}
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
