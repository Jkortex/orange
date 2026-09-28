// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { HomeHeader } from './home-header'

afterEach(() => {
  cleanup()
})

describe('HomeHeader 首页简介', () => {
  it('默认只渲染简介，不重复渲染品牌标题', () => {
    render(<HomeHeader />)

    expect(screen.getByText('写代码、拍照、听歌，偶尔记点东西。')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Orange' })).toBeNull()
  })

  it('支持自定义简介', () => {
    render(<HomeHeader description="Custom Description" />)

    expect(screen.getByText('Custom Description')).toBeTruthy()
  })

  it('传入 null 时不渲染简介', () => {
    render(<HomeHeader description={null} />)

    expect(screen.queryByText('写代码、拍照、听歌，偶尔记点东西。')).toBeNull()
  })
})
