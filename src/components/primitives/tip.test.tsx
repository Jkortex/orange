// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Tip } from '@/components/primitives/tip'

afterEach(() => {
  cleanup()
})

describe('Tip 正常渲染', () => {
  it('渲染提示文案，语义由父按钮 aria-label 兜底（自身 aria-hidden 防重复朗读）', () => {
    render(
      <span className="group relative inline-flex">
        <button type="button" aria-label="上一首">
          按键
        </button>
        <Tip className="bottom-full right-0 mb-1.5">上一首</Tip>
      </span>,
    )

    const tip = document.querySelector('[data-tip]')
    expect(tip?.textContent).toBe('上一首')
    expect(tip?.getAttribute('aria-hidden')).toBe('true')
  })

  it('位置类透传，基础显隐行为保留', () => {
    render(
      <span className="group relative inline-flex">
        <Tip className="left-1/2 top-full mt-1.5 -translate-x-1/2">搜索</Tip>
      </span>,
    )

    const tip = document.querySelector('[data-tip]')
    expect(tip?.className).toContain('-translate-x-1/2')
    expect(tip?.className).toContain('opacity-0')
    expect(tip?.className).toContain('group-hover:opacity-100')
    expect(tip?.className).toContain('group-focus-within:opacity-100')
  })
})

describe('Tip 异常渲染', () => {
  it('无位置类时仍渲染基础样式，不抛错', () => {
    render(
      <span className="group relative inline-flex">
        <Tip>{''}</Tip>
      </span>,
    )

    expect(document.querySelector('[data-tip]')).not.toBeNull()
    expect(screen.getByText('', { selector: '[data-tip]' })).toBeTruthy()
  })
})
