// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { RouteScrollReset } from './route-scroll-reset'

let mockPathname = '/posts/first-post'

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

describe('RouteScrollReset 路由滚动复位组件', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn())
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    mockPathname = '/posts/first-post'
  })

  it('初始挂载时，强制将视口瞬时复位到顶部 (0, 0)', () => {
    render(<RouteScrollReset />)

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' })
  })

  it('当路由改变时（例如点击下一篇文章），再次触发瞬时到顶复位', () => {
    const { rerender } = render(<RouteScrollReset />)

    expect(window.scrollTo).toHaveBeenCalledTimes(1)

    // 模拟路由切换到下一篇
    mockPathname = '/posts/second-post'
    rerender(<RouteScrollReset />)

    expect(window.scrollTo).toHaveBeenCalledTimes(2)
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'instant' })
  })
})
