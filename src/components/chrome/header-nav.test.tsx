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

    expect(screen.getByRole('link', { name: '文章' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '生活' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '音乐' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '技能' })).toBeTruthy()
  })

  it('访问根路径 / 时，「文章」高亮并带有 aria-current="page"', () => {
    currentPath = '/'
    render(<HeaderNav />)

    const posts = screen.getByRole('link', { name: '文章' })
    const life = screen.getByRole('link', { name: '生活' })

    expect(posts.getAttribute('aria-current')).toBe('page')
    expect(posts.className).toContain('text-primary')
    expect(life.getAttribute('aria-current')).toBeNull()
  })

  it('访问 /posts/[slug] 详情时，「文章」高亮并带有 aria-current="page"', () => {
    currentPath = '/posts/2026-09-13-hello-orange'
    render(<HeaderNav />)

    const posts = screen.getByRole('link', { name: '文章' })
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
 * 顶栏行内导航只服务于 sm 及以上；移动端由 MobileNavDrawer（汉堡菜单 + 侧滑抽屉）承担。
 * 这里守住「行内、不横滑、不压缩」：一旦开始出血或内部横滑，说明移动端又被塞回顶栏了。
 */
describe('HeaderNav 行内布局契约', () => {
  it('是普通行内导航：没有出血、没有内部横向滚动', () => {
    render(<HeaderNav />)

    const nav = screen.getByRole('link', { name: '文章' }).parentElement
    expect(nav?.className).not.toContain('overflow-x-auto')
    expect(nav?.className).not.toContain('-mx-4')
  })

  it('导航项不参与压缩（压缩会把文字挤变形）', () => {
    render(<HeaderNav />)

    for (const name of ['文章', '生活', '音乐', '技能']) {
      expect(screen.getByRole('link', { name }).className).toContain('shrink-0')
    }
  })

  it('触摸目标高度足够（py-2 + 文字行高 ≥ 36px）', () => {
    render(<HeaderNav />)

    expect(screen.getByRole('link', { name: '文章' }).className).toContain('py-2')
  })

  it('有可及名（读屏里叫「栏目导航」）', () => {
    render(<HeaderNav />)

    expect(screen.getByRole('navigation', { name: '栏目导航' })).toBeTruthy()
  })
})
