// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MobileTocDrawer } from '@/components/reading/mobile-toc-drawer'
import type { TocHeading } from '@/lib/toc'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/* Radix 的 DismissableLayer 在 setTimeout(0) 里才挂上 pointerdown 监听
   （避免被「打开浮层那一下点击」立刻关掉），测试要先把它放出来 */
async function flushRadixListeners() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

const mockHeadings: TocHeading[] = [
  { id: 'intro', text: '引言', depth: 2 },
  { id: 'design', text: '系统设计', depth: 2 },
  { id: 'detail', text: '实现细节', depth: 3 },
]

describe('MobileTocDrawer 移动端目录抽屉组件', () => {
  it('当 headings 为空时不渲染任何 DOM', () => {
    const { container } = render(<MobileTocDrawer headings={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('正常渲染移动端目录悬浮触发按钮，水平与 BackToTop 对齐', () => {
    const { container } = render(<MobileTocDrawer headings={mockHeadings} />)
    const trigger = screen.getByRole('button', { name: '文章目录' })
    expect(trigger).toBeDefined()

    // 触发按钮容器共享同一对齐线
    const wrapper = container.querySelector('.group.fixed')
    expect(wrapper?.className).toContain('right-4 sm:right-6 md:right-8')
    expect(wrapper?.className).toContain('bottom-6')
  })

  it('滚动超过 300px 时，触发按钮平滑上浮避让回到顶部按钮', () => {
    const { container } = render(<MobileTocDrawer headings={mockHeadings} />)
    const wrapper = container.querySelector('.group.fixed')

    // 默认未滚动
    expect(wrapper?.className).toContain('bottom-6')

    // 模拟滚动超过 300px
    Object.defineProperty(window, 'scrollY', { value: 350, configurable: true, writable: true })
    fireEvent.scroll(window)

    // 上浮至回到顶部上方
    expect(wrapper?.className).toContain('bottom-[4.25rem]')
  })

  it('点击触发按钮打开抽屉，列出目录条目', () => {
    render(<MobileTocDrawer headings={mockHeadings} />)

    const trigger = screen.getByRole('button', { name: '文章目录' })
    fireEvent.click(trigger)

    expect(screen.getByText('引言')).toBeDefined()
    expect(screen.getByText('系统设计')).toBeDefined()
    expect(screen.getByText('实现细节')).toBeDefined()
  })

  it('点击目录小节，平滑滚动至对应元素，并关闭抽屉', () => {
    const targetEl = document.createElement('div')
    targetEl.id = 'design'
    targetEl.scrollIntoView = vi.fn()
    document.body.appendChild(targetEl)

    render(<MobileTocDrawer headings={mockHeadings} />)

    const trigger = screen.getByRole('button', { name: '文章目录' })
    fireEvent.click(trigger)

    const designLink = screen.getByRole('link', { name: /系统设计/ })
    fireEvent.click(designLink)

    expect(targetEl.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
    expect(window.location.hash).toBe('#design')

    // 抽屉应自动关闭
    expect(screen.queryByRole('link', { name: /系统设计/ })).toBeNull()

    document.body.removeChild(targetEl)
  })
})

/*
 * 抽屉此前是手写的 fixed 遮罩 + div[role=dialog]：只有点遮罩与点条目会关，
 * Esc 不生效，也没有滚动锁；关掉后焦点回不到那颗悬浮按钮上。
 * 改用 ui/sheet（Radix）后这些由它接管。
 */
describe('MobileTocDrawer 抽屉语义（Radix Sheet）', () => {
  it('抽屉是带标题的模态浮层', () => {
    render(<MobileTocDrawer headings={mockHeadings} />)
    fireEvent.click(screen.getByRole('button', { name: '文章目录' }))

    expect(screen.getByRole('dialog', { name: '文章目录' })).toBeDefined()
  })

  it('按 Esc 关闭抽屉', async () => {
    render(<MobileTocDrawer headings={mockHeadings} />)
    fireEvent.click(screen.getByRole('button', { name: '文章目录' }))
    expect(screen.getByRole('dialog', { name: '文章目录' })).toBeDefined()

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '文章目录' })).toBeNull())
  })

  it('点击遮罩关闭抽屉', async () => {
    render(<MobileTocDrawer headings={mockHeadings} />)
    fireEvent.click(screen.getByRole('button', { name: '文章目录' }))

    const overlay = document.querySelector('[data-slot="sheet-overlay"]')
    expect(overlay).not.toBeNull()

    await flushRadixListeners()
    fireEvent.pointerDown(overlay as Element, { pointerType: 'mouse' })
    fireEvent.click(overlay as Element)

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '文章目录' })).toBeNull())
  })

  it('关闭后焦点还给触发按钮', async () => {
    render(<MobileTocDrawer headings={mockHeadings} />)
    const trigger = screen.getByRole('button', { name: '文章目录' })

    fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: '文章目录' })).toBeDefined()

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '文章目录' })).toBeNull())

    // Radix 在 setTimeout(0) 里还原焦点
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('全抽屉只有一颗 ✕，且是可命中的 36px 圆钮（vendor 那颗已关掉）', () => {
    render(<MobileTocDrawer headings={mockHeadings} />)
    fireEvent.click(screen.getByRole('button', { name: '文章目录' }))

    const dialog = screen.getByRole('dialog', { name: '文章目录' })
    // 抽屉里唯一的按钮就是关闭钮（目录条目都是 <a>）
    const buttons = dialog.querySelectorAll('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0].getAttribute('aria-label')).toBe('关闭目录')
    expect(buttons[0].className).toContain('size-9')
  })
})
