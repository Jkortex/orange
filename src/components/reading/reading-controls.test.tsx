// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReadingControls } from '@/components/reading/reading-controls'

describe('ReadingControls 综合阅读控件', () => {
  it('正确渲染阅读选项胶囊，包含字号调节和全屏阅读按钮', () => {
    render(<ReadingControls />)

    const aside = screen.getByRole('complementary', { name: '阅读选项' })
    expect(aside).toBeDefined()
    expect(aside.className).toContain('reading-controls')
    expect(aside.className).toContain('fixed')

    const fontButton = screen.getByRole('button', { name: '调整正文字号' })
    expect(fontButton).toBeDefined()

    const zenButton = screen.getByRole('button', { name: '进入 Zen 全屏阅读' })
    expect(zenButton).toBeDefined()
  })
})
