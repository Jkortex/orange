// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { HotkeyHelpModal, SHORTCUTS } from '@/components/chrome/hotkey-help-modal'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/*
 * 帮助页曾长期列着 t 与 g c / g a / g s 四条从未绑定过的键，
 * 后三条描述的还是根本不存在的「命令面板模式」。误导比没有更糟，故固化清单：
 * 下面每一条都能在源码里找到对应的处理器 ——
 *   Ctrl/⌘+K → search-dialog.tsx 的 window keydown
 *   [ ]      → adjacent-nav.tsx 的 useHotkey
 *   ?        → 本文件
 *   Esc      → Radix Dialog（ui/dialog.tsx）
 * 要加新条目，先把键真的绑上，再来改这里。
 */
const IMPLEMENTED_KEYS = ['Ctrl/⌘ + K', '[  /  ]', '?', 'Esc']

describe('快捷键帮助页的条目真实性', () => {
  it('只列真实绑定的键，不再出现 t 与 g 前缀序列', () => {
    expect(SHORTCUTS.map(({ keys }) => keys)).toEqual(IMPLEMENTED_KEYS)
  })

  it('描述里不再出现不存在的「命令面板」', () => {
    for (const { desc } of SHORTCUTS) {
      expect(desc).not.toContain('命令面板')
    }
  })
})

describe('HotkeyHelpModal 快捷键帮助弹窗组件', () => {
  it('默认处于关闭状态，不渲染浮层内容', () => {
    render(<HotkeyHelpModal />)
    expect(screen.queryByRole('dialog', { name: /快捷键指南/ })).toBeNull()
  })

  it('按 ? 键打开快捷键帮助弹窗', () => {
    render(<HotkeyHelpModal />)

    fireEvent.keyDown(document, { key: '?' })
    expect(screen.getByRole('dialog', { name: /快捷键指南/ })).toBeDefined()
    expect(screen.getByText('Ctrl/⌘ + K')).toBeDefined()
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

  it('再次按 ? 可以关掉自己（toggle）', () => {
    render(<HotkeyHelpModal />)

    fireEvent.keyDown(document, { key: '?' })
    expect(screen.getByRole('dialog', { name: /快捷键指南/ })).toBeDefined()

    fireEvent.keyDown(document, { key: '?' })
    expect(screen.queryByRole('dialog', { name: /快捷键指南/ })).toBeNull()
  })
})

describe('HotkeyHelpModal 触发守卫', () => {
  it('输入框里按 ? 不触发（那是正常字符）', () => {
    render(
      <>
        <input aria-label="搜索关键词" />
        <HotkeyHelpModal />
      </>,
    )

    fireEvent.keyDown(screen.getByLabelText('搜索关键词'), { key: '?' })

    expect(screen.queryByRole('dialog', { name: /快捷键指南/ })).toBeNull()
  })

  it('输入法组合中的 ? 不触发', () => {
    render(<HotkeyHelpModal />)

    fireEvent.keyDown(document, { key: '?', isComposing: true })

    expect(screen.queryByRole('dialog', { name: /快捷键指南/ })).toBeNull()
  })

  /*
   * 搜索弹窗开着时按 ? 曾会把帮助页叠在它上面，两层弹窗互相遮罩。
   */
  it('已有别的弹窗打开时不叠加', () => {
    render(
      <>
        <div role="dialog" aria-modal="true" aria-label="站内搜索" />
        <HotkeyHelpModal />
      </>,
    )

    fireEvent.keyDown(document, { key: '?' })

    expect(screen.queryByRole('dialog', { name: /快捷键指南/ })).toBeNull()
  })

  it('其他按键不触发', () => {
    render(<HotkeyHelpModal />)

    fireEvent.keyDown(document, { key: 't' })
    fireEvent.keyDown(document, { key: 'g' })
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: /快捷键指南/ })).toBeNull()
  })
})

/*
 * 浮层此前是手写的 fixed 遮罩 + div[role=dialog]：只有 Esc 是自己接的，
 * 键盘 Tab 能直接走到浮层背后的顶栏去，背景也没对读屏屏蔽。
 * 改用 ui/dialog（Radix）后这些由它接管。
 */
describe('HotkeyHelpModal 浮层语义（Radix Dialog）', () => {
  it('打开后焦点落在浮层内部', () => {
    render(<HotkeyHelpModal />)
    fireEvent.keyDown(document, { key: '?' })

    const dialog = screen.getByRole('dialog', { name: /快捷键指南/ })
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('打开后浮层背后的内容对读屏屏蔽', () => {
    render(
      <>
        <button type="button">页面上的其它按钮</button>
        <HotkeyHelpModal />
      </>,
    )

    expect(screen.getByRole('button', { name: '页面上的其它按钮' })).toBeDefined()

    fireEvent.keyDown(document, { key: '?' })

    // Radix 用 aria-hidden 屏蔽兄弟节点（而不是声明 aria-modal 却留着背景可 Tab）
    expect(screen.queryByRole('button', { name: '页面上的其它按钮' })).toBeNull()
  })

  it('关闭后把焦点还给打开前的元素', async () => {
    render(
      <>
        <button type="button">页面上的其它按钮</button>
        <HotkeyHelpModal />
      </>,
    )

    const outside = screen.getByRole('button', { name: '页面上的其它按钮' })
    outside.focus()

    fireEvent.keyDown(document, { key: '?' })
    expect(screen.getByRole('dialog', { name: /快捷键指南/ })).toBeDefined()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: /快捷键指南/ })).toBeNull()

    // Radix 在 setTimeout(0) 里还原焦点（绕开 React 卸载期聚焦的旧 bug）
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(document.activeElement).toBe(outside)
  })

  it('关闭按钮是可命中的 36px 圆钮，而不是 vendor 那个 16px 的', () => {
    render(<HotkeyHelpModal />)
    fireEvent.keyDown(document, { key: '?' })

    const close = screen.getByRole('button', { name: '关闭快捷键指南' })
    expect(close.className).toContain('size-9')
  })
})
