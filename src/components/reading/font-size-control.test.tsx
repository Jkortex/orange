// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { FontSizeControl } from '@/components/reading/font-size-control'
import {
  CONTENT_FONT_SIZE_EVENT,
  setContentFontSize,
} from '@/lib/content-font-size'

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.fontSize
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  delete document.documentElement.dataset.fontSize
  vi.restoreAllMocks()
})

function openMenu() {
  const button = screen.getByRole('button', { name: '调整正文字号' })
  fireEvent.pointerDown(button)
  return { button, menu: screen.getByRole('menu') }
}

describe('FontSizeControl 组件渲染与交互', () => {
  it('正确渲染触发按钮与无障碍属性', () => {
    render(<FontSizeControl />)

    const button = screen.getByRole('button', { name: '调整正文字号' })
    expect(button).toBeDefined()
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('点击展开菜单，展示 4 档字号选项', () => {
    render(<FontSizeControl />)

    const { menu } = openMenu()
    expect(menu).toBeDefined()

    const radioItems = screen.getAllByRole('menuitemradio')
    expect(radioItems).toHaveLength(4)

    expect(screen.getByText('紧凑')).toBeDefined()
    expect(screen.getByText('标准')).toBeDefined()
    expect(screen.getByText('中大')).toBeDefined()
    expect(screen.getByText('特大')).toBeDefined()
  })

  it('默认勾选中「标准」档位', () => {
    render(<FontSizeControl />)

    openMenu()

    const standardItem = screen.getByRole('menuitemradio', { name: /标准/ })
    expect(standardItem.getAttribute('aria-checked')).toBe('true')
  })

  it('点击选择「中大」后，更新 DOM 与持久化存储', () => {
    render(<FontSizeControl />)

    openMenu()

    const largeItem = screen.getByRole('menuitemradio', { name: /中大/ })
    fireEvent.click(largeItem)

    expect(document.documentElement.dataset.fontSize).toBe('lg')
    expect(localStorage.getItem('content-font-size')).toBe('lg')
  })

  it('响应外部字号变更事件并同步激活状态', () => {
    render(<FontSizeControl />)

    act(() => {
      setContentFontSize('xl')
    })

    openMenu()

    const xlItem = screen.getByRole('menuitemradio', { name: /特大/ })
    expect(xlItem.getAttribute('aria-checked')).toBe('true')
  })
})
