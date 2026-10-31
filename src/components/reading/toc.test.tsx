// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Toc } from '@/components/reading/toc'
import type { TocHeading } from '@/lib/toc'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const headings: TocHeading[] = [
  { depth: 2, text: '结论', id: '结论' },
  { depth: 3, text: '细节', id: '细节' },
  { depth: 2, text: '方法', id: '方法' },
]

describe('Toc 正常渲染', () => {
  it('渲染目录导航，链接指向对应锚点', () => {
    render(<Toc headings={headings} />)

    const nav = screen.getByRole('navigation', { name: '文章目录' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['#结论', '#细节', '#方法'])
    expect(links.map((link) => link.textContent)).toEqual(['结论', '细节', '方法'])
  })

  it('三级标题缩进一级（层级可辨），二级不缩进', () => {
    render(<Toc headings={headings} />)

    const nav = screen.getByRole('navigation', { name: '文章目录' })
    const items = within(nav).getAllByRole('listitem')
    expect(items[0].className).not.toContain('ml-4')
    expect(items[1].className).toContain('ml-4')
    expect(items[2].className).not.toContain('ml-4')
  })
})

describe('Toc 异常渲染', () => {
  it('空目录不渲染', () => {
    const { container } = render(<Toc headings={[]} />)

    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('navigation', { name: '文章目录' })).toBeNull()
  })
})

/*
 * 长目录（如 35 节）滚动契约：滚动必须发生在卡片**内部**，只有列表滚，
 * 头部与卡片圆角/描边固定。若哪天把 overflow 挪回外层容器，头部和边框会跟着滚走——这里钉死。
 */
describe('Toc 长目录内滚契约', () => {
  it('卡片为纵向 flex，头部 shrink-0 固定，列表 flex-1 + min-h-0 + overflow-y-auto 承担滚动', () => {
    render(<Toc headings={headings} />)

    const nav = screen.getByRole('navigation', { name: '文章目录' })
    expect(nav.className).toContain('flex-col')

    const header = nav.firstElementChild as HTMLElement
    expect(header.className).toContain('shrink-0')

    const list = within(nav).getByRole('list')
    expect(list.className).toContain('overflow-y-auto')
    expect(list.className).toContain('flex-1')
    // min-h-0 是让列表能被压缩到内容高度以下、从而触发 overflow 的关键
    expect(list.className).toContain('min-h-0')
  })

  it('高度上限经 className 透传到卡片（由 Toc 自持，外层容器不再滚动）', () => {
    render(<Toc headings={headings} className="max-h-[calc(100vh-1rem)]" />)

    expect(screen.getByRole('navigation', { name: '文章目录' }).className).toContain(
      'max-h-[calc(100vh-1rem)]',
    )
  })

  it('只允许纵向滚动：显式 overflow-x-hidden，避免冒横向滚动条', () => {
    render(<Toc headings={headings} />)

    const list = within(screen.getByRole('navigation', { name: '文章目录' })).getByRole('list')
    expect(list.className).toContain('overflow-y-auto')
    expect(list.className).toContain('overflow-x-hidden')
    // 滚动条与文字之间留出右侧内边距
    expect(list.className).toContain('pr-2')
  })
})

describe('Toc 选中小节并转到 Gemini 解释', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
    vi.stubGlobal('open', vi.fn())
  })

  it('支持复选框选中一个或多个标题，并显示操作面板', () => {
    render(<Toc headings={headings} articleTitle="测试文章" />)

    expect(screen.queryByText(/已选/)).toBeNull()

    const check1 = screen.getByRole('checkbox', { name: '选择章节：结论' })
    const check2 = screen.getByRole('checkbox', { name: '选择章节：方法' })

    // 选中第一个
    fireEvent.click(check1)
    expect(check1.getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText(/已选/)).toBeDefined()
    expect(screen.getByText('1')).toBeDefined()

    // 选中第二个（复数个标题）
    fireEvent.click(check2)
    expect(check2.getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText('2')).toBeDefined()

    // 点击取消选中第一个
    fireEvent.click(check1)
    expect(check1.getAttribute('aria-checked')).toBe('false')
    expect(screen.getByText('1')).toBeDefined()
  })

  it('支持全选与清空选择', () => {
    render(<Toc headings={headings} articleTitle="测试文章" />)

    const check1 = screen.getByRole('checkbox', { name: '选择章节：结论' })
    fireEvent.click(check1)

    // 点击全选
    const selectAllBtn = screen.getByRole('button', { name: '全选' })
    fireEvent.click(selectAllBtn)
    expect(screen.getByText('3')).toBeDefined()

    // 点击清空
    const clearBtn = screen.getByRole('button', { name: '清空' })
    fireEvent.click(clearBtn)
    expect(screen.queryByText(/已选/)).toBeNull()
  })

  it('点击 Gemini 解释按钮，复制 prompt 到剪贴板并打开 Gemini', async () => {
    render(<Toc headings={headings} articleTitle="测试文章" />)

    const check1 = screen.getByRole('checkbox', { name: '选择章节：结论' })
    const check2 = screen.getByRole('checkbox', { name: '选择章节：细节' })
    fireEvent.click(check1)
    fireEvent.click(check2)

    const explainBtn = screen.getByRole('button', { name: '转到 Gemini 解释选中小节' })
    await act(async () => {
      fireEvent.click(explainBtn)
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1)
    const promptArg = (navigator.clipboard.writeText as unknown as { mock: { calls: [string][] } }).mock.calls[0][0]
    expect(promptArg).toContain('测试文章')
    expect(promptArg).toContain('1. 结论')
    expect(promptArg).toContain('2. 细节')

    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('https://gemini.google.com/app?prompt='),
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('支持单节快捷解释按钮一键直达', async () => {
    render(<Toc headings={headings} articleTitle="测试文章" />)

    const singleBtn = screen.getByRole('button', { name: 'Gemini 解释「细节」' })
    await act(async () => {
      fireEvent.click(singleBtn)
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1)
    const promptArg = (navigator.clipboard.writeText as unknown as { mock: { calls: [string][] } }).mock.calls[0][0]
    expect(promptArg).toContain('关于「细节」的内容')
    expect(window.open).toHaveBeenCalledTimes(1)
  })

  it('快捷键 G 触发解释选中小节', async () => {
    render(<Toc headings={headings} articleTitle="测试文章" />)

    const check1 = screen.getByRole('checkbox', { name: '选择章节：方法' })
    fireEvent.click(check1)

    await act(async () => {
      fireEvent.keyDown(document, { key: 'g' })
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1)
    const promptArg = (navigator.clipboard.writeText as unknown as { mock: { calls: [string][] } }).mock.calls[0][0]
    expect(promptArg).toContain('方法')
    expect(window.open).toHaveBeenCalledTimes(1)
  })
})
