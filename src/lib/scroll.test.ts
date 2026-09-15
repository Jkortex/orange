// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { scrollToHeading } from '@/lib/scroll'

beforeEach(() => {
  // jsdom 未实现 scrollIntoView，各用例自备 spy（与 mobile-toc-drawer.test 一致）
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  window.location.hash = ''
})

describe('scrollToHeading 正常渲染', () => {
  it('找到目标：平滑滚动并同步地址栏 hash，返回 true', () => {
    document.body.innerHTML = '<h2 id="一">一</h2>'
    const el = document.getElementById('一')!
    const spy = vi.spyOn(el, 'scrollIntoView').mockImplementation(() => {})

    expect(scrollToHeading('一')).toBe(true)
    expect(spy).toHaveBeenCalledWith({ behavior: 'smooth' })
    expect(window.location.hash).toBe(`#${encodeURIComponent('一')}`)
  })

  it('透传 ScrollIntoViewOptions（如搜索大纲的居中定位）', () => {
    document.body.innerHTML = '<h2 id="a">a</h2>'
    const el = document.getElementById('a')!
    const spy = vi.spyOn(el, 'scrollIntoView').mockImplementation(() => {})

    expect(scrollToHeading('a', { block: 'center' })).toBe(true)
    expect(spy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
  })
})

describe('scrollToHeading 异常渲染', () => {
  it('目标不存在：不抛错、不改 hash，返回 false', () => {
    document.body.innerHTML = ''
    expect(scrollToHeading('missing')).toBe(false)
    expect(window.location.hash).toBe('')
  })
})
