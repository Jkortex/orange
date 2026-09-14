// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { RelatedEntries } from './related-entries'
import type { RelatedEntry } from '@/lib/content'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const mockRelated: RelatedEntry[] = [
  {
    collection: 'posts',
    slug: '2026-09-03-nextjs',
    title: 'Next.js 全栈实践',
    category: 'tech',
    date: new Date('2026-09-03'),
    tags: ['react', 'nextjs'],
    score: 2,
  },
  {
    collection: 'skills',
    slug: '2026-09-14-tdd',
    title: 'TDD 测试驱动开发',
    category: 'engineering',
    date: new Date('2026-09-14'),
    tags: ['test'],
    score: 1,
  },
]

describe('RelatedEntries 相关文章推荐组件', () => {
  it('当 entries 为空时不渲染任何 DOM', () => {
    const { container } = render(<RelatedEntries entries={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('正常渲染相关文章列表与链接', () => {
    render(<RelatedEntries entries={mockRelated} />)

    expect(screen.getByText('相关推荐')).toBeDefined()

    const link1 = screen.getByRole('link', { name: /Next\.js 全栈实践/ })
    expect(link1.getAttribute('href')).toBe('/posts/2026-09-03-nextjs')

    const link2 = screen.getByRole('link', { name: /TDD 测试驱动开发/ })
    expect(link2.getAttribute('href')).toBe('/skills/2026-09-14-tdd')
  })
})
