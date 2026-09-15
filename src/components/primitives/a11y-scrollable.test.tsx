// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { A11yScrollable } from '@/components/primitives/a11y-scrollable'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('A11yScrollable 键盘可访问性组件', () => {
  it('对溢出的 pre/table 自动注入 tabIndex=0 与 aria-label', () => {
    const container = document.createElement('div')
    container.className = 'prose'
    const pre = document.createElement('pre')
    Object.defineProperty(pre, 'scrollWidth', { value: 600, configurable: true })
    Object.defineProperty(pre, 'clientWidth', { value: 400, configurable: true })
    container.appendChild(pre)
    document.body.appendChild(container)

    render(<A11yScrollable />)

    expect(pre.tabIndex).toBe(0)
    expect(pre.getAttribute('aria-label')).toBe('可横向滚动区域')

    document.body.removeChild(container)
  })

  it('未溢出的元素不注入 tabIndex', () => {
    const container = document.createElement('div')
    container.className = 'prose'
    const pre = document.createElement('pre')
    Object.defineProperty(pre, 'scrollWidth', { value: 300, configurable: true })
    Object.defineProperty(pre, 'clientWidth', { value: 400, configurable: true })
    container.appendChild(pre)
    document.body.appendChild(container)

    render(<A11yScrollable />)

    expect(pre.hasAttribute('tabindex')).toBe(false)

    document.body.removeChild(container)
  })
})
