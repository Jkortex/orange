// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { HomeHeader } from './home-header'

afterEach(() => {
  cleanup()
})

describe('HomeHeader 正常渲染', () => {
  it('默认渲染默认的徽章、标题与说明', () => {
    render(<HomeHeader />)
    expect(screen.getByRole('heading', { name: '你好，这里是 Orange 🍊' })).toBeTruthy()
    expect(screen.getByText('个人数字空间 · 编程 / 生活 / 音乐')).toBeTruthy()
    expect(
      screen.getByText('记录编程技术、生活随想与音乐专辑的个人数字空间。'),
    ).toBeTruthy()
  })

  it('支持自定义标题、徽章与说明', () => {
    render(
      <HomeHeader
        badge="Custom Badge"
        title="Custom Title"
        description="Custom Description"
      />,
    )
    expect(screen.getByRole('heading', { name: 'Custom Title' })).toBeTruthy()
    expect(screen.getByText('Custom Badge')).toBeTruthy()
    expect(screen.getByText('Custom Description')).toBeTruthy()
  })

  it('传入 null 时不渲染徽章或说明', () => {
    render(<HomeHeader badge={null} description={null} />)
    expect(screen.queryByText('个人数字空间 · 编程 / 生活 / 音乐')).toBeNull()
    expect(
      screen.queryByText('记录编程技术、生活随想与音乐专辑的个人数字空间。'),
    ).toBeNull()
  })
})
