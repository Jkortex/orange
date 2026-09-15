// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { BackButton } from '@/components/reading/back-button'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('BackButton 动态返回组件', () => {
  it('默认渲染兜底链接与文案', () => {
    render(<BackButton fallbackHref="/posts" fallbackLabel="文章列表" />)

    const link = screen.getByRole('link', { name: /文章列表/ })
    expect(link.getAttribute('href')).toBe('/posts')
  })

  it('当 document.referrer 为首页时，动态更新为「首页」', async () => {
    Object.defineProperty(document, 'referrer', {
      value: 'http://localhost/',
      configurable: true,
    })

    render(<BackButton fallbackHref="/posts" fallbackLabel="文章列表" />)

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /首页/ })
      expect(link.getAttribute('href')).toBe('/')
    })
  })

  it('当来源为本站分类时，动态更新为「分类」', async () => {
    Object.defineProperty(document, 'referrer', {
      value: 'http://localhost/category/meta',
      configurable: true,
    })

    render(<BackButton fallbackHref="/posts" fallbackLabel="文章列表" />)

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /分类/ })
      expect(link.getAttribute('href')).toBe('/category/meta')
    })
  })

  it('即便当前页面存在 hash 锚点后缀，返回按钮依然直接指向来源路径（真正返回而非后退 hash）', async () => {
    window.location.hash = '#代码块'
    Object.defineProperty(document, 'referrer', {
      value: 'http://localhost/',
      configurable: true,
    })

    render(<BackButton fallbackHref="/posts" fallbackLabel="文章列表" />)

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /首页/ })
      expect(link.getAttribute('href')).toBe('/')
    })
  })

  it('当文章页（fallbackHref="/posts"）遇到来源为 /skills 时，不跨类型跳到技能，保持「文章列表」', async () => {
    Object.defineProperty(document, 'referrer', {
      value: 'http://localhost/skills',
      configurable: true,
    })

    render(<BackButton fallbackHref="/posts" fallbackLabel="文章列表" />)

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /文章列表/ })
      expect(link.getAttribute('href')).toBe('/posts')
    })
    expect(screen.queryByRole('link', { name: /技能列表/ })).toBeNull()
  })
})



