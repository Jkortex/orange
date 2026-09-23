// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { MermaidDiagram } from './mermaid-diagram'

afterEach(() => {
  cleanup()
})

describe('MermaidDiagram 正常渲染与交互', () => {
  const sampleSvg = '<svg data-testid="sample-svg"><text>节点A</text></svg>'
  const sampleCode = 'graph TD\n  A --> B'

  it('渲染 SVG 图表与控制栏', () => {
    render(<MermaidDiagram svg={sampleSvg} code={sampleCode} title="系统架构图" />)

    expect(screen.getByTestId('mermaid-diagram')).toBeTruthy()
    expect(screen.getByText('系统架构图')).toBeTruthy()
    expect(screen.getByText('Mermaid')).toBeTruthy()
    expect(screen.getByTestId('sample-svg')).toBeTruthy()
  })

  it('点击查看源码按钮，在图表和代码之间切换', () => {
    render(<MermaidDiagram svg={sampleSvg} code={sampleCode} />)

    const toggleBtn = screen.getByRole('button', { name: '查看 Mermaid 源码' })
    expect(toggleBtn).toBeTruthy()

    // 初始状态下展示 SVG
    expect(screen.getByTestId('sample-svg')).toBeTruthy()

    // 点击切换为源码
    fireEvent.click(toggleBtn)
    expect(screen.queryByTestId('sample-svg')).toBeNull()
    expect(screen.getByText(/graph TD/)).toBeTruthy()

    // 再次点击切回图表
    const backBtn = screen.getByRole('button', { name: '切换为图表视图' })
    fireEvent.click(backBtn)
    expect(screen.getByTestId('sample-svg')).toBeTruthy()
  })

  it('点击复制代码按钮能正常响应', () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    })

    render(<MermaidDiagram svg={sampleSvg} code={sampleCode} />)

    const copyBtn = screen.getByRole('button', { name: '复制图表代码' })
    fireEvent.click(copyBtn)

    expect(writeTextMock).toHaveBeenCalledWith(sampleCode)
  })

  it('无内容时安全返回 null', () => {
    const { container } = render(<MermaidDiagram />)
    expect(container.firstChild).toBeNull()
  })
})
