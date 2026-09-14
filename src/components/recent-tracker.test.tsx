// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { RecentTracker } from './recent-tracker'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('RecentTracker 最近访问追踪组件', () => {
  it('自动将当前页面信息记录到 localStorage，排在首位且去重', () => {
    localStorage.setItem(
      'orange_recent_visits',
      JSON.stringify([{ url: '/posts/old', title: '旧文章' }]),
    )

    render(<RecentTracker url="/posts/new" title="新文章" />)

    const saved = JSON.parse(localStorage.getItem('orange_recent_visits') || '[]')
    expect(saved).toHaveLength(2)
    expect(saved[0].url).toBe('/posts/new')
    expect(saved[0].title).toBe('新文章')
    expect(saved[1].url).toBe('/posts/old')
  })
})
