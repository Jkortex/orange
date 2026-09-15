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
