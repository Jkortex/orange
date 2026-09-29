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

  it('挂载后才插入的滚动区（展开 code-demo / mermaid）同样被补位', async () => {
    render(<A11yScrollable />)

    // 模拟展开后新出现的滚动容器，挂载时并不存在
    const wrapper = document.createElement('div')
    wrapper.className = 'prose'
    const scroller = document.createElement('div')
    scroller.className = 'overflow-x-auto'
    Object.defineProperty(scroller, 'scrollWidth', { value: 600, configurable: true })
    Object.defineProperty(scroller, 'clientWidth', { value: 400, configurable: true })
    wrapper.appendChild(scroller)
    document.body.appendChild(wrapper)

    // MutationObserver 回调是微任务，等一拍
    await Promise.resolve()
    await Promise.resolve()

    expect(scroller.tabIndex).toBe(0)
    expect(scroller.getAttribute('aria-label')).toBe('可横向滚动区域')

    document.body.removeChild(wrapper)
  })

  it('已带 aria-label 的元素只补 tabIndex，不覆盖原有标签', async () => {
    render(<A11yScrollable />)

    const wrapper = document.createElement('div')
    wrapper.className = 'prose'
    const pre = document.createElement('pre')
    pre.setAttribute('aria-label', '代码示例')
    Object.defineProperty(pre, 'scrollWidth', { value: 600, configurable: true })
    Object.defineProperty(pre, 'clientWidth', { value: 400, configurable: true })
    wrapper.appendChild(pre)
    document.body.appendChild(wrapper)

    await Promise.resolve()
    await Promise.resolve()

    expect(pre.tabIndex).toBe(0)
    expect(pre.getAttribute('aria-label')).toBe('代码示例')

    document.body.removeChild(wrapper)
  })

  it('卸载后不再响应 DOM 变化', async () => {
    const { unmount } = render(<A11yScrollable />)
    unmount()

    const wrapper = document.createElement('div')
    wrapper.className = 'prose'
    const pre = document.createElement('pre')
    Object.defineProperty(pre, 'scrollWidth', { value: 600, configurable: true })
    Object.defineProperty(pre, 'clientWidth', { value: 400, configurable: true })
    wrapper.appendChild(pre)
    document.body.appendChild(wrapper)

    await Promise.resolve()
    await Promise.resolve()

    expect(pre.hasAttribute('tabindex')).toBe(false)

    document.body.removeChild(wrapper)
  })
})
