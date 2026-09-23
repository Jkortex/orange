// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { HomeHeader } from './home-header'

afterEach(() => {
  cleanup()
})

describe('HomeHeader 正常渲染', () => {
  it('默认渲染标题与说明，不渲染装饰徽章', () => {
    render(<HomeHeader />)
    expect(screen.getByRole('heading', { name: 'Orange' })).toBeTruthy()
    expect(screen.getByText('写代码、拍照、听歌，偶尔记点东西。')).toBeTruthy()
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
    expect(screen.getByRole('heading', { name: 'Orange' })).toBeTruthy()
    expect(screen.queryByText('写代码、拍照、听歌，偶尔记点东西。')).toBeNull()
  })
})

describe('HomeHeader 动态信号', () => {
  const signals = [
    { label: '最近', href: '/posts/hello', text: '你好世界' },
    { label: '在听', href: '/music/evening-wind', text: '晚风 · 某人' },
  ]

  it('渲染信号标签并链接到对应详情', () => {
    render(<HomeHeader signals={signals} />)
    expect(screen.getByText('最近')).toBeTruthy()
    expect(screen.getByText('在听')).toBeTruthy()
    expect(screen.getByRole('link', { name: '你好世界' }).getAttribute('href')).toBe('/posts/hello')
    expect(screen.getByRole('link', { name: '晚风 · 某人' }).getAttribute('href')).toBe(
      '/music/evening-wind',
    )
  })

  it('无信号时不渲染信号行', () => {
    render(<HomeHeader />)
    expect(screen.queryByText('最近')).toBeNull()
    expect(screen.queryByText('在听')).toBeNull()
  })
})
