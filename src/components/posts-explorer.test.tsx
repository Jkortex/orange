// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PostsExplorer, type PostItem } from './posts-explorer'

afterEach(() => {
  cleanup()
})

const posts: PostItem[] = [
  { slug: '2026-09-01-css-grid', title: 'CSS Grid 指南', date: '2026-09-01T00:00:00.000Z', category: 'css' },
  { slug: '2026-08-20-meta', title: '关于写作', date: '2026-08-20T00:00:00.000Z', category: 'meta' },
  { slug: '2026-07-10-flex', title: 'Flex 布局笔记', date: '2026-07-10T00:00:00.000Z', category: 'css' },
]

describe('PostsExplorer 正常渲染', () => {
  it('侧栏渲染「最近」与全部分类（含条数）', () => {
    render(<PostsExplorer posts={posts} />)

    expect(screen.getByRole('button', { name: '最近' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'css 2' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'meta 1' })).toBeTruthy()
  })

  it('默认展示全部文章（最近），按日期倒序排列', () => {
    render(<PostsExplorer posts={posts} />)

    expect(screen.getByRole('heading', { name: '最近' })).toBeTruthy()
    const links = screen.getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual([
      'CSS Grid 指南',
      '关于写作',
      'Flex 布局笔记',
    ])
  })

  it('条目链接指向文章详情页，日期为 YYYY-MM-DD', () => {
    render(<PostsExplorer posts={posts} />)

    const link = screen.getByRole('link', { name: 'CSS Grid 指南' }) as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/posts/2026-09-01-css-grid')
    expect(screen.getByText('2026-09-01')).toBeTruthy()
  })

  it('点击分类过滤列表，标题与条数联动', () => {
    render(<PostsExplorer posts={posts} />)

    fireEvent.click(screen.getByRole('button', { name: 'css 2' }))

    expect(screen.getByRole('heading', { name: 'css' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'CSS Grid 指南' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Flex 布局笔记' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: '关于写作' })).toBeNull()
  })

  it('点击「最近」恢复全部文章', () => {
    render(<PostsExplorer posts={posts} />)
    fireEvent.click(screen.getByRole('button', { name: 'meta 1' }))
    fireEvent.click(screen.getByRole('button', { name: '最近' }))

    expect(screen.getByRole('link', { name: 'CSS Grid 指南' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '关于写作' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Flex 布局笔记' })).toBeTruthy()
  })

  it('激活分类带 aria-pressed=true，其余为 false', () => {
    render(<PostsExplorer posts={posts} />)

    const recent = screen.getByRole('button', { name: '最近' })
    const css = screen.getByRole('button', { name: 'css 2' })
    expect(recent.getAttribute('aria-pressed')).toBe('true')
    expect(css.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(css)
    expect(css.getAttribute('aria-pressed')).toBe('true')
    expect(recent.getAttribute('aria-pressed')).toBe('false')
  })
})

describe('PostsExplorer 异常渲染', () => {
  it('空列表：显示空态提示，侧栏仅「最近」', () => {
    render(<PostsExplorer posts={[]} />)

    expect(screen.getByText('还没有文章。')).toBeTruthy()
    expect(screen.getByRole('button', { name: '最近' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'css' })).toBeNull()
    expect(screen.getByText('共 0 篇')).toBeTruthy()
  })

  it('全部文章无分类：侧栏仅「最近」，最近下展示全部', () => {
    const uncategorized: PostItem[] = [
      { slug: '2026-01-01-solo', title: '无分类文章', date: '2026-01-01T00:00:00.000Z' },
    ]
    render(<PostsExplorer posts={uncategorized} />)

    expect(screen.getByRole('button', { name: '最近' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /css|meta/ })).toBeNull()
    expect(screen.getByRole('link', { name: '无分类文章' })).toBeTruthy()
  })
})
