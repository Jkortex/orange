// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ThemeToggle } from '@/components/chrome/theme-toggle'

afterEach(() => {
  cleanup()
  document.documentElement.classList.remove('dark')
  document.documentElement.dataset.theme = 'default'
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('ThemeToggle 正常渲染', () => {
  it('浅色模式下显示月亮图标（点击进入深色）', () => {
    render(<ThemeToggle />)

    const button = screen.getByRole('button', { name: '切换到深色' })
    expect(button.querySelector('.lucide-moon')).not.toBeNull()
    expect(button.querySelector('.lucide-sun')).toBeNull()
  })

  it('图标按钮带 hover/focus 文字提示，与 aria-label 一致', () => {
    render(<ThemeToggle />)

    const button = screen.getByRole('button', { name: '切换到深色' })
    const tip = button.closest('.group')?.querySelector('[data-tip]')
    expect(tip).not.toBeNull()
    expect(tip?.textContent).toBe('切换到深色')
    // 默认隐藏，hover 或 focus 时显示（视觉提示，语义已由 aria-label 兜底）
    expect(tip?.className).toContain('opacity-0')
    expect(tip?.className).toContain('group-hover:opacity-100')
    expect(tip?.className).toContain('group-focus-within:opacity-100')
  })

  it('图标按钮具备足够触摸目标（36px，移动端可点中）', () => {
    render(<ThemeToggle />)

    const button = screen.getByRole('button', { name: '切换到深色' })
    // size-9（36px）或 p-2.5 均满足最小触摸目标
    expect(button.className === '' ? '' : button.className).toMatch(/size-9|p-2\.5/)
  })

  it('深色模式下显示太阳图标（点击进入浅色）', () => {
    document.documentElement.classList.add('dark')
    render(<ThemeToggle />)

    const button = screen.getByRole('button', { name: '切换到浅色' })
    expect(button.querySelector('.lucide-sun')).not.toBeNull()
    expect(button.querySelector('.lucide-moon')).toBeNull()
  })

  it('点击在深色与浅色之间切换，并持久化 theme-mode', () => {
    render(<ThemeToggle />)

    fireEvent.click(screen.getByRole('button', { name: '切换到深色' }))

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('theme-mode')).toBe('dark')
    expect(screen.getByRole('button', { name: '切换到浅色' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '切换到浅色' }))

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('theme-mode')).toBe('light')
  })
})

describe('ThemeToggle 异常渲染', () => {
  it('localStorage 不可用时点击不抛错，仅在本次会话生效', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })

    render(<ThemeToggle />)

    expect(() => fireEvent.click(screen.getByRole('button', { name: '切换到深色' }))).not.toThrow()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
