// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { TypeBadge } from '@/components/primitives/type-badge'

afterEach(() => {
  cleanup()
})

describe('TypeBadge 正常渲染', () => {
  it.each([
    ['posts', '文章'],
    ['life', '生活'],
    ['music', '音乐'],
  ])('类型 %s 渲染徽标「%s」', (type, label) => {
    render(<TypeBadge type={type as 'posts'} />)

    expect(screen.getByText(label)).toBeTruthy()
  })
})

describe('TypeBadge 异常渲染', () => {
  it('未知类型回退为「内容」', () => {
    render(<TypeBadge type={'unknown' as 'posts'} />)

    expect(screen.getByText('内容')).toBeTruthy()
  })
})
