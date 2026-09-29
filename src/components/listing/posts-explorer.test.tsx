// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PostsExplorer, type PostItem } from '@/components/listing/posts-explorer'

afterEach(() => {
  cleanup()
})

const posts: PostItem[] = [
  { slug: '2026-09-01-css-grid', title: 'CSS Grid 指南', date: '2026-09-01T00:00:00.000Z', category: 'css' },
  { slug: '2026-08-20-meta', title: '关于写作', date: '2026-08-20T00:00:00.000Z', category: 'meta' },
  { slug: '2026-07-10-flex', title: 'Flex 布局笔记', date: '2026-07-10T00:00:00.000Z', category: 'css' },
]

describe('PostsExplorer 正常渲染', () => {
  it('侧栏渲染「全部」与各分类（含条数）', () => {
    render(<PostsExplorer posts={posts} />)

    expect(screen.getByRole('button', { name: '全部' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'css 2' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'meta 1' })).toBeTruthy()
  })

  it('默认展示全部文章，按日期倒序排列', () => {
    render(<PostsExplorer posts={posts} />)

    expect(screen.getByRole('heading', { name: '全部' })).toBeTruthy()
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

  it('点击「全部」取消筛选，恢复完整列表', () => {
    render(<PostsExplorer posts={posts} />)
    fireEvent.click(screen.getByRole('button', { name: 'meta 1' }))
    fireEvent.click(screen.getByRole('button', { name: '全部' }))

    expect(screen.getByRole('link', { name: 'CSS Grid 指南' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '关于写作' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Flex 布局笔记' })).toBeTruthy()
  })

  it('激活分类带 aria-pressed=true，其余为 false', () => {
    render(<PostsExplorer posts={posts} />)

    const all = screen.getByRole('button', { name: '全部' })
    const css = screen.getByRole('button', { name: 'css 2' })
    expect(all.getAttribute('aria-pressed')).toBe('true')
    expect(css.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(css)
    expect(css.getAttribute('aria-pressed')).toBe('true')
    expect(all.getAttribute('aria-pressed')).toBe('false')
  })
})

/*
 * 移动端行布局（用户反馈：标题被日期挤成一行）：
 * 日期只在 sm 及以上出现（移动端它独占一整列，标题只剩很窄的空间），
 * 标题改为最多两行截断，而不是单行省略。
 */
describe('PostsExplorer 移动端行布局', () => {
  it('日期列在移动端隐藏，sm 起恢复', () => {
    render(<PostsExplorer posts={posts} />)

    const time = screen.getByText('2026-09-01')
    expect(time.className).toContain('hidden')
    expect(time.className).toContain('sm:block')
  })

  it('标题最多两行（line-clamp-2），不再单行 truncate', () => {
    render(<PostsExplorer posts={posts} />)

    const link = screen.getByRole('link', { name: 'CSS Grid 指南' })
    expect(link.className).toContain('line-clamp-2')
    expect(link.className).not.toContain('truncate')
  })
})

describe('PostsExplorer 异常渲染', () => {
  it('空列表：显示空态提示；无分类可筛，过滤器整条隐藏', () => {
    render(<PostsExplorer posts={[]} />)

    expect(screen.getByText('还没有文章。')).toBeTruthy()
    expect(screen.getByText('共 0 篇')).toBeTruthy()
    // 0 个分类 = 没有选择余地，不给死控件
    expect(screen.queryByRole('navigation', { name: '文章分类' })).toBeNull()
    expect(screen.queryByRole('button', { name: '分类筛选：全部' })).toBeNull()
  })

  it('全部文章无分类：过滤器隐藏，列表照常展示全部', () => {
    const uncategorized: PostItem[] = [
      { slug: '2026-01-01-solo', title: '无分类文章', date: '2026-01-01T00:00:00.000Z' },
    ]
    render(<PostsExplorer posts={uncategorized} />)

    expect(screen.queryByRole('navigation', { name: '文章分类' })).toBeNull()
    expect(screen.queryByRole('button', { name: '分类筛选：全部' })).toBeNull()
    expect(screen.getByRole('link', { name: '无分类文章' })).toBeTruthy()
  })

  it('只有一个分类时同样隐藏过滤器（无选择余地）', () => {
    const single: PostItem[] = [
      { slug: '2026-01-01-a', title: '甲', date: '2026-01-01T00:00:00.000Z', category: 'workflow' },
      { slug: '2026-01-02-b', title: '乙', date: '2026-01-02T00:00:00.000Z', category: 'workflow' },
    ]
    render(<PostsExplorer posts={single} />)

    expect(screen.queryByRole('navigation', { name: '文章分类' })).toBeNull()
    expect(screen.getByRole('link', { name: '甲' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '乙' })).toBeTruthy()
  })
})

describe('PostsExplorer 分批加载与侧栏交互', () => {
  // 生成 25 篇文章
  const manyPosts: PostItem[] = Array.from({ length: 25 }, (_, i) => ({
    slug: `2026-01-${String(i + 1).padStart(2, '0')}-post-${i + 1}`,
    title: `文章第 ${i + 1} 篇`,
    date: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
    category: i < 5 ? 'frontend' : 'backend',
  }))

  it('超过单批上限（15篇）时，初始仅渲染前 15 篇，并显示加载更多按钮', () => {
    render(<PostsExplorer posts={manyPosts} />)

    const links = screen.getAllByRole('link')
    expect(links.length).toBe(15)
    expect(screen.getByRole('button', { name: /加载更多/ })).toBeTruthy()
  })

  it('点击「加载更多」追加渲染后续文章，全部渲染后显示已到底部', () => {
    render(<PostsExplorer posts={manyPosts} />)

    const loadMoreBtn = screen.getByRole('button', { name: /加载更多/ })
    fireEvent.click(loadMoreBtn)

    const links = screen.getAllByRole('link')
    expect(links.length).toBe(25)
    expect(screen.queryByRole('button', { name: /加载更多/ })).toBeNull()
    expect(screen.getByText(/已显示全部 25 篇文章/)).toBeTruthy()
  })

  it('切换分类时重置加载数量并筛选当前分类', () => {
    render(<PostsExplorer posts={manyPosts} />)

    // 切换到 backend（20 篇）
    fireEvent.click(screen.getByRole('button', { name: 'backend 20' }))

    const links = screen.getAllByRole('link')
    expect(links.length).toBe(15)
    expect(screen.getByRole('button', { name: /加载更多/ })).toBeTruthy()

    // 切换到 frontend（5 篇，少于 15 篇）
    fireEvent.click(screen.getByRole('button', { name: 'frontend 5' }))
    expect(screen.getAllByRole('link').length).toBe(5)
    expect(screen.queryByRole('button', { name: /加载更多/ })).toBeNull()
  })
})

