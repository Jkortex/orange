// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { Toc } from '@/components/reading/toc'
import type { TocHeading } from '@/lib/toc'

afterEach(() => {
  cleanup()
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
