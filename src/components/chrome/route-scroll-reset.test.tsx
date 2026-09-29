// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { RouteScrollReset } from '@/components/chrome/route-scroll-reset'

let mockPathname = '/posts/first-post'

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

/** 用 Date.now 而不是 performance.now 打桩：React 调度器读 performance.now，改它会干扰渲染 */
function freezeClock(start = 1_000) {
  let now = start
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  return {
    advance: (ms: number) => {
      now += ms
    },
  }
}

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

  /*
   * 用户反馈的真实问题：从文章返回列表（浏览器返回键）会被强制拉回顶部，
   * 浏览器本来恢复好的滚动位置被抹掉。后退/前进必须让位。
   */
  it('浏览器后退/前进后的路由变化不强制回顶，交还给浏览器的滚动恢复', () => {
    const clock = freezeClock()
    const { rerender } = render(<RouteScrollReset />)
    expect(window.scrollTo).toHaveBeenCalledTimes(1)

    // 用户按返回键，随即 pathname 变回列表
    clock.advance(100)
    fireEvent.popState(window)
    clock.advance(10)
    mockPathname = '/'
    rerender(<RouteScrollReset />)

    expect(window.scrollTo).toHaveBeenCalledTimes(1)
  })

  it('守卫时间窗过后，前进式导航仍然强制回顶（原「标题被顶栏遮住」的修复不回归）', () => {
    const clock = freezeClock()
    const { rerender } = render(<RouteScrollReset />)

    clock.advance(100)
    fireEvent.popState(window)
    // 用户返回后停留一会儿再点进另一篇
    clock.advance(1_000)
    mockPathname = '/posts/third-post'
    rerender(<RouteScrollReset />)

    expect(window.scrollTo).toHaveBeenCalledTimes(2)
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'instant' })
  })
})
