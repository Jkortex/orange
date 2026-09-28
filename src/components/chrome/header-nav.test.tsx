// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { HeaderNav } from '@/components/chrome/header-nav'

let currentPath = '/'

vi.mock('next/navigation', () => ({
  usePathname: () => currentPath,
}))

afterEach(() => {
  cleanup()
  currentPath = '/'
})

describe('HeaderNav 顶部导航组件', () => {
  it('渲染所有导航链接', () => {
    render(<HeaderNav />)

    expect(screen.getByRole('link', { name: '首页' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '文章' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '生活' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '音乐' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '技能' })).toBeTruthy()
  })

  it('访问根路径 / 时，「首页」高亮并带有 aria-current="page"', () => {
    currentPath = '/'
    render(<HeaderNav />)

    const home = screen.getByRole('link', { name: '首页' })
    const posts = screen.getByRole('link', { name: '文章' })

    expect(home.getAttribute('aria-current')).toBe('page')
    expect(home.className).toContain('text-primary')
    expect(posts.getAttribute('aria-current')).toBeNull()
  })

  it('访问 /posts 或 /posts/[slug] 时，「文章」高亮并带有 aria-current="page"', () => {
    currentPath = '/posts'
    const { rerender } = render(<HeaderNav />)

    let posts = screen.getByRole('link', { name: '文章' })
    expect(posts.getAttribute('aria-current')).toBe('page')
    expect(posts.className).toContain('text-primary')

    currentPath = '/posts/2026-09-13-hello-orange'
    rerender(<HeaderNav />)

    posts = screen.getByRole('link', { name: '文章' })
    expect(posts.getAttribute('aria-current')).toBe('page')
    expect(posts.className).toContain('text-primary')
  })

  it('访问 /skills 或 /skills/[slug] 时，「技能」高亮并带有 aria-current="page"', () => {
    currentPath = '/skills/tdd-basics'
    render(<HeaderNav />)

    const skills = screen.getByRole('link', { name: '技能' })
    expect(skills.getAttribute('aria-current')).toBe('page')
    expect(skills.className).toContain('text-primary')
  })

  it('访问 /life 或 /life/[slug] 时，「生活」高亮并带有 aria-current="page"', () => {
    currentPath = '/life'
    render(<HeaderNav />)

    const life = screen.getByRole('link', { name: '生活' })
    expect(life.getAttribute('aria-current')).toBe('page')
    expect(life.className).toContain('text-primary')
  })
})

/*
 * 移动端顶栏契约（用户反馈：文字挤在一行）：
 * 导航独占一行、整宽出血、内部横滑；sm 起恢复成一行行内排布。
 * 关键是「不换行、不省略、不图标化」，横向滚动只发生在 nav 自己内部。
 */
describe('HeaderNav 移动端横滑布局', () => {
  it('导航条自身是滚动容器，且整宽出血到视口边缘', () => {
    render(<HeaderNav />)

    const nav = screen.getByRole('link', { name: '首页' }).parentElement
    expect(nav?.className).toContain('overflow-x-auto')
    expect(nav?.className, '出血靠负边距 + 等量内边距').toContain('-mx-4')
    expect(nav?.className).toContain('px-4')
    expect(nav?.className, 'sm 起恢复行内排布').toContain('sm:overflow-visible')
    expect(nav?.className).toContain('sm:mx-0')
  })

  it('导航项不参与压缩（压缩会把文字挤变形，交给容器横滑）', () => {
    render(<HeaderNav />)

    for (const name of ['首页', '文章', '生活', '音乐', '技能']) {
      expect(screen.getByRole('link', { name }).className).toContain('shrink-0')
    }
  })

  it('移动端触摸目标高度足够（py-2 + 文字行高 ≥ 36px）', () => {
    render(<HeaderNav />)

    expect(screen.getByRole('link', { name: '文章' }).className).toContain('py-2')
  })
})
