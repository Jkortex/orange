// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CodeBlock } from '@/components/reading/code-block'

afterEach(() => {
  cleanup()
})

describe('CodeBlock', () => {
  it('正常渲染 pre 和复制按钮', () => {
    render(
      <CodeBlock data-testid="pre">
        <code>const hello = &quot;world&quot;</code>
      </CodeBlock>,
    )

    const btn = screen.getByRole('button', { name: '复制代码' })
    expect(btn).toBeTruthy()
    expect(screen.getByTestId('pre')).toBeTruthy()
  })

  it('不渲染 macOS 三色指示点（硬编码颜色已清除），保留语言标签', () => {
    const { container } = render(
      <CodeBlock data-language="ts">
        <code>x</code>
      </CodeBlock>,
    )

    expect(
      container.querySelectorAll('[class*="bg-red-"], [class*="bg-amber-"], [class*="bg-emerald-"]'),
    ).toHaveLength(0)
    expect(screen.getByText('ts')).toBeTruthy()
    expect(screen.getByRole('button', { name: '复制代码' })).toBeTruthy()
  })

  it('点击复制后调用 clipboard API', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    })

    render(
      <CodeBlock>
        <code>hello world</code>
      </CodeBlock>,
    )

    const btn = screen.getByRole('button', { name: '复制代码' })
    fireEvent.click(btn)

    expect(writeTextMock).toHaveBeenCalledWith('hello world')
  })
})
