// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AdjacentNav } from './adjacent-nav'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const mockPrev = {
  title: '上一篇文章',
  slug: '2026-09-01-prev',
}

const mockNext = {
  title: '下一篇文章',
  slug: '2026-09-03-next',
}

describe('AdjacentNav 相邻条目快捷翻页组件', () => {
  it('当 prev 与 next 均无时，不渲染任何 DOM', () => {
    const { container } = render(<AdjacentNav collection="posts" prev={null} next={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('正常渲染上一篇与下一篇卡片', () => {
    render(<AdjacentNav collection="posts" prev={mockPrev} next={mockNext} />)

    const prevLink = screen.getByRole('link', { name: /上一篇/ })
    expect(prevLink.getAttribute('href')).toBe('/posts/2026-09-01-prev')
    expect(screen.getByText('上一篇文章')).toBeDefined()

    const nextLink = screen.getByRole('link', { name: /下一篇/ })
    expect(nextLink.getAttribute('href')).toBe('/posts/2026-09-03-next')
    expect(screen.getByText('下一篇文章')).toBeDefined()
  })

  it('按键 [ 触发上一篇链接跳转，按键 ] 触发下一篇链接跳转', () => {
    render(<AdjacentNav collection="posts" prev={mockPrev} next={mockNext} />)

    const prevLink = screen.getByRole('link', { name: /上一篇/ })
    const nextLink = screen.getByRole('link', { name: /下一篇/ })

    const clickPrev = vi.spyOn(prevLink, 'click')
    const clickNext = vi.spyOn(nextLink, 'click')

    fireEvent.keyDown(document, { key: '[' })
    expect(clickPrev).toHaveBeenCalled()

    fireEvent.keyDown(document, { key: ']' })
    expect(clickNext).toHaveBeenCalled()
  })
})
