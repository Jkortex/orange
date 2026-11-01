// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CONTENT_FONT_SIZE_EVENT,
  DEFAULT_FONT_SIZE,
  FONT_SIZE_OPTIONS,
  getContentFontSize,
  isContentFontSize,
  setContentFontSize,
  type ContentFontSizeEventDetail,
} from '@/lib/content-font-size'

describe('content-font-size module', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.fontSize
  })

  afterEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.fontSize
    vi.restoreAllMocks()
  })

  it('FONT_SIZE_OPTIONS 包含 4 档字号，以 base 为默认', () => {
    expect(DEFAULT_FONT_SIZE).toBe('base')
    expect(FONT_SIZE_OPTIONS.map((o) => o.id)).toEqual(['sm', 'base', 'lg', 'xl'])
    expect(FONT_SIZE_OPTIONS.find((o) => o.id === 'base')?.size).toBe('16px')
  })

  it('isContentFontSize 能正确辨别合法与非法档位', () => {
    expect(isContentFontSize('sm')).toBe(true)
    expect(isContentFontSize('base')).toBe(true)
    expect(isContentFontSize('lg')).toBe(true)
    expect(isContentFontSize('xl')).toBe(true)
    expect(isContentFontSize('2xl')).toBe(false)
    expect(isContentFontSize('')).toBe(false)
    expect(isContentFontSize(null)).toBe(false)
    expect(isContentFontSize(undefined)).toBe(false)
  })

  it('默认状态下 getContentFontSize 返回 base', () => {
    expect(getContentFontSize()).toBe('base')
  })

  it('从 DOM dataset 读取当前字号', () => {
    document.documentElement.dataset.fontSize = 'lg'
    expect(getContentFontSize()).toBe('lg')
  })

  it('DOM dataset 为非法值时回退到 base', () => {
    document.documentElement.dataset.fontSize = 'invalid-size'
    expect(getContentFontSize()).toBe('base')
  })

  it('setContentFontSize 设置 DOM、持久化至 localStorage 并派发事件', () => {
    const listener = vi.fn()
    window.addEventListener(CONTENT_FONT_SIZE_EVENT, listener)

    const result = setContentFontSize('xl')

    expect(result).toBe('xl')
    expect(document.documentElement.dataset.fontSize).toBe('xl')
    expect(localStorage.getItem('content-font-size')).toBe('xl')
    expect(listener).toHaveBeenCalledTimes(1)

    const event = listener.mock.calls[0][0] as CustomEvent<ContentFontSizeEventDetail>
    expect(event.detail.size).toBe('xl')

    window.removeEventListener(CONTENT_FONT_SIZE_EVENT, listener)
  })

  it('localStorage 报错时不崩溃，仍完成 DOM 更新与事件派发', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded')
    })

    const listener = vi.fn()
    window.addEventListener(CONTENT_FONT_SIZE_EVENT, listener)

    const result = setContentFontSize('sm')

    expect(result).toBe('sm')
    expect(document.documentElement.dataset.fontSize).toBe('sm')
    expect(listener).toHaveBeenCalledTimes(1)

    window.removeEventListener(CONTENT_FONT_SIZE_EVENT, listener)
  })
})
