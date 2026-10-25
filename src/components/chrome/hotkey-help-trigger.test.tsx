// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { HotkeyHelpTrigger } from '@/components/chrome/hotkey-help-trigger'
import { HOTKEY_HELP_EVENT } from '@/components/chrome/hotkey-help-modal'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('HotkeyHelpTrigger 页脚快捷键入口', () => {
  it('点击派发打开指南事件（触屏没有 ? 键）', () => {
    const listener = vi.fn()
    window.addEventListener(HOTKEY_HELP_EVENT, listener)

    render(<HotkeyHelpTrigger />)
    fireEvent.click(screen.getByRole('button', { name: '快捷键' }))

    expect(listener).toHaveBeenCalledTimes(1)
    window.removeEventListener(HOTKEY_HELP_EVENT, listener)
  })

  it('暴露 ? 快捷键语义', () => {
    render(<HotkeyHelpTrigger />)
    expect(screen.getByRole('button', { name: '快捷键' }).getAttribute('aria-keyshortcuts')).toBe('?')
  })
})
