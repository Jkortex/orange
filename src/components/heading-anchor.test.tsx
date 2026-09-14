// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HeadingWithAnchor } from './heading-anchor'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('HeadingWithAnchor 标题锚点组件', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('正常渲染标题内容与复制链接按钮', () => {
    render(
      <HeadingWithAnchor as="h2" id="intro">
        导言部分
      </HeadingWithAnchor>,
    )

    const heading = screen.getByRole('heading', { level: 2, name: /导言部分/ })
    expect(heading).toBeDefined()
    expect(heading.id).toBe('intro')

    const copyBtn = screen.getByRole('button', { name: '复制标题链接' })
    expect(copyBtn).toBeDefined()
  })

  it('若未提供 id，则不渲染复制按钮', () => {
    render(
      <HeadingWithAnchor as="h3">
        无锚点小节
      </HeadingWithAnchor>,
    )

    expect(screen.queryByRole('button', { name: '复制标题链接' }))?.toBeNull()
  })

  it('点击复制按钮，向剪贴板写入带 hash 的完整 URL，并给予成功反馈', async () => {
    render(
      <HeadingWithAnchor as="h2" id="chapter-1">
        第一章
      </HeadingWithAnchor>,
    )

    const copyBtn = screen.getByRole('button', { name: '复制标题链接' })
    fireEvent.click(copyBtn)

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('#chapter-1'),
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '已复制链接' })).toBeDefined()
    })
  })
})
