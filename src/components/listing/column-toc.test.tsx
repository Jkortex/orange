// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ColumnToc } from '@/components/listing/column-toc'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const phases = [
  {
    name: '阶段一：基础',
    chapters: [
      { slug: '2026-10-21-ai-ddd-00-guide', title: '导读' },
      { slug: '2026-10-21-ai-ddd-01-why-ai-matters', title: '为何 AI 重要' },
    ],
  },
  {
    name: '阶段二：进阶',
    chapters: [{ slug: '2026-10-21-ai-ddd-02-how-llms-think', title: 'LLM 如何思考' }],
  },
]

describe('ColumnToc 专栏目录抽屉', () => {
  it('点击浮动按钮打开抽屉，列出全部阶段与章节', () => {
    render(<ColumnToc phases={phases} />)

    fireEvent.click(screen.getByRole('button', { name: '打开专栏目录' }))

    expect(screen.getByRole('link', { name: /阶段一/ })).toBeDefined()
    expect(screen.getByRole('link', { name: /阶段二/ })).toBeDefined()
    expect(screen.getByRole('link', { name: '导读' }).getAttribute('href')).toBe(
      '/posts/2026-10-21-ai-ddd-00-guide',
    )
  })

  it('浮动按钮接入右下角浮动栈：与回到顶部同轴，滚动后上抬让位', () => {
    render(<ColumnToc phases={phases} />)
    const trigger = screen.getByRole('button', { name: '打开专栏目录' })

    expect(trigger.className).toContain('right-4 sm:right-6 md:right-8')
    expect(trigger.className).toContain('bottom-6')

    Object.defineProperty(window, 'scrollY', { value: 350, configurable: true, writable: true })
    fireEvent.scroll(window)

    expect(trigger.className).toContain('bottom-[4.25rem]')
  })

  it('点击阶段，平滑滚动到页面对应锚点并关闭抽屉', () => {
    const target = document.createElement('section')
    target.id = 'phase-1'
    target.scrollIntoView = vi.fn()
    document.body.appendChild(target)

    render(<ColumnToc phases={phases} />)
    fireEvent.click(screen.getByRole('button', { name: '打开专栏目录' }))

    fireEvent.click(screen.getByRole('link', { name: /阶段二/ }))

    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
    expect(window.location.hash).toBe('#phase-1')
    expect(screen.queryByRole('link', { name: /阶段二/ })).toBeNull()

    document.body.removeChild(target)
  })
})
