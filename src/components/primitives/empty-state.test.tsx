// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { EmptyState } from '@/components/primitives/empty-state'

afterEach(() => {
  cleanup()
})

describe('EmptyState 正常渲染', () => {
  it('渲染调用方传入的文案', () => {
    render(<EmptyState message="还没有内容。" />)
    expect(screen.getByText('还没有内容。')).toBeTruthy()
  })

  it('虚线卡片样式（装饰收敛于此一处）', () => {
    render(<EmptyState message="空" />)
    expect(screen.getByText('空').className).toContain('border-dashed')
  })
})
