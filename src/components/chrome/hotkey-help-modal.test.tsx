// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { HotkeyHelpModal } from '@/components/chrome/hotkey-help-modal'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('HotkeyHelpModal 快捷键帮助弹窗组件', () => {
  it('默认处于关闭状态，不渲染浮层内容', () => {
    const { container } = render(<HotkeyHelpModal />)
    expect(screen.queryByRole('dialog', { name: /快捷键指南/ })).toBeNull()
  })

  it('按 ? 键打开快捷键帮助弹窗', () => {
    render(<HotkeyHelpModal />)

    fireEvent.keyDown(document, { key: '?' })
    expect(screen.getByRole('dialog', { name: /快捷键指南/ })).toBeDefined()
    expect(screen.getAllByText(/命令面板/).length).toBeGreaterThan(0)
    expect(screen.getByText(/回到.*首页/)).toBeDefined()
    expect(screen.getByText(/上一篇 \/ 下一篇/)).toBeDefined()
  })

  it('在打开状态下按 Esc 或点击关闭按钮可以关闭弹窗', () => {
    render(<HotkeyHelpModal />)

    // 打开
    fireEvent.keyDown(document, { key: '?' })
    expect(screen.getByRole('dialog', { name: /快捷键指南/ })).toBeDefined()

    // 点击关闭按钮
    const closeBtn = screen.getByRole('button', { name: '关闭快捷键指南' })
    fireEvent.click(closeBtn)
    expect(screen.queryByRole('dialog', { name: /快捷键指南/ })).toBeNull()

    // 再次打开并用 Esc 关闭
    fireEvent.keyDown(document, { key: '?' })
    expect(screen.getByRole('dialog', { name: /快捷键指南/ })).toBeDefined()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: /快捷键指南/ })).toBeNull()
  })
})
