// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  THEME_MODE_EVENT,
  setThemeMode,
  toggleThemeMode,
} from '@/lib/theme-mode'

afterEach(() => {
  document.documentElement.classList.remove('dark')
  document.documentElement.style.colorScheme = ''
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('theme mode', () => {
  it('统一更新 DOM、color-scheme、存储并广播变化', () => {
    const listener = vi.fn()
    window.addEventListener(THEME_MODE_EVENT, listener)

    setThemeMode('dark')

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(localStorage.getItem('theme-mode')).toBe('dark')
    expect(listener).toHaveBeenCalledTimes(1)

    window.removeEventListener(THEME_MODE_EVENT, listener)
  })

  it('toggleThemeMode 根据当前状态切换', () => {
    expect(toggleThemeMode()).toBe('dark')
    expect(toggleThemeMode()).toBe('light')
  })

  it('存储不可用时仍完成本次会话切换', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })

    expect(() => setThemeMode('dark')).not.toThrow()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
