// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { HeaderNav } from './header-nav'

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
})
