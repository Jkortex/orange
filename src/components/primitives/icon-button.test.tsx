// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { IconButton } from '@/components/primitives/icon-button'

afterEach(() => {
  cleanup()
})

describe('IconButton 正常渲染', () => {
  it('按钮无障碍名与悬停提示一致', () => {
    render(<IconButton label="上一首" buttonClassName="p-2" />)
    const button = screen.getByRole('button', { name: '上一首' })
    const tip = button.parentElement?.querySelector('[data-tip]')
    expect(tip?.textContent).toBe('上一首')
  })

  it('默认提示位于按钮上方（player-bar/back-to-top 惯例）', () => {
    render(<IconButton label="关闭" buttonClassName="p-2" />)
    const tip = screen.getByRole('button', { name: '关闭' }).parentElement?.querySelector('[data-tip]')
    expect(tip?.className).toContain('bottom-full')
  })

  it('点击透传 onClick', () => {
    let clicked = 0
    render(
      <IconButton label="测试" buttonClassName="p-2" onClick={() => (clicked += 1)}>
        <span>icon</span>
      </IconButton>,
    )
    fireEvent.click(screen.getByRole('button', { name: '测试' }))
    expect(clicked).toBe(1)
  })
})

describe('IconButton 尺寸契约', () => {
  it('默认 36px 触摸目标并输出 data-size', () => {
    render(<IconButton label="默认" />)
    const button = screen.getByRole('button', { name: '默认' })
    expect(button.className).toContain('size-9')
    expect(button.getAttribute('data-size')).toBe('md')
  })

  it('size="sm" 收窄到 32px', () => {
    render(<IconButton label="小号" size="sm" />)
    const button = screen.getByRole('button', { name: '小号' })
    expect(button.className).toContain('size-8')
    expect(button.getAttribute('data-size')).toBe('sm')
  })

  it('调用方可覆盖尺寸（tailwind-merge 取后者）', () => {
    render(<IconButton label="覆盖" size="sm" buttonClassName="size-10" />)
    const button = screen.getByRole('button', { name: '覆盖' })
    expect(button.className).toContain('size-10')
    expect(button.className).not.toContain('size-8')
  })
})

describe('IconButton 异常渲染', () => {
  it('无 label 时依然渲染按钮（调用方失误不白屏）', () => {
    render(<IconButton label="" buttonClassName="p-2" />)
    expect(screen.getByRole('button')).toBeTruthy()
  })
})
