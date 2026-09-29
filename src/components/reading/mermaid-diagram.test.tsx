// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react'
import { MermaidDiagram } from './mermaid-diagram'
import { stubBrowserApis, unstubBrowserApis } from '@/components/test-utils/stub-browser-apis'

beforeEach(() => {
  // 放大查看用的是 Radix Dialog，需要 ResizeObserver
  stubBrowserApis()
})

afterEach(() => {
  cleanup()
  unstubBrowserApis()
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

  /*
   * 画布类名是 CSS 契约：globals.css 的 .mermaid-canvas > svg 负责把带写死 width/height
   * 的 SVG 拉回自适应宽度。类名一改，窄屏就会退回「必须横向滚动」。
   * 同时必须是块级 —— flex 子项的 min-width:auto 会撑住不缩。
   */
  it('画布带 mermaid-canvas 契约类，且不再是 flex / 横向滚动容器', () => {
    const { container } = render(<MermaidDiagram svg={sampleSvg} code={sampleCode} />)

    const canvas = container.querySelector('.mermaid-canvas')
    expect(canvas).not.toBeNull()
    expect(canvas?.className).toContain('block')
    expect(canvas?.className).not.toContain('flex')
    expect(canvas?.className).not.toContain('overflow-x-auto')
  })

  /*
   * 图表视图的画布外要包一层「放大查看」：窄屏自适应后细节仍难辨，放大是刚需。
   * 触发按钮的 aria-label 是唯一无障碍名，aria-haspopup 预告会弹对话框。
   */
  it('图表视图把画布包进「放大查看」触发按钮，并带悬停角标', () => {
    render(<MermaidDiagram svg={sampleSvg} code={sampleCode} title="系统架构图" />)

    const trigger = screen.getByRole('button', { name: '放大查看：系统架构图' })
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(screen.getByText('点击放大')).toBeTruthy()
    // 画布必须仍在触发按钮内部，否则点图打不开浮层
    expect(trigger.querySelector('.mermaid-canvas')).not.toBeNull()
  })

  it('点击画布打开浮层，浮层内是同一张图表', () => {
    render(<MermaidDiagram svg={sampleSvg} code={sampleCode} title="系统架构图" />)

    fireEvent.click(screen.getByRole('button', { name: '放大查看：系统架构图' }))

    const dialog = screen.getByRole('dialog', { name: /系统架构图（放大查看）/ })
    expect(within(dialog).getByTestId('sample-svg')).toBeTruthy()
  })

  it('源码视图不渲染放大触发按钮（避免「点击放大」的假承诺）', () => {
    render(<MermaidDiagram svg={sampleSvg} code={sampleCode} title="系统架构图" />)

    fireEvent.click(screen.getByRole('button', { name: '查看 Mermaid 源码' }))

    expect(screen.queryByRole('button', { name: /^放大查看/ })).toBeNull()
  })

  it('不渲染 macOS 三色指示点（硬编码颜色已清除）', () => {
    const { container } = render(<MermaidDiagram svg={sampleSvg} code={sampleCode} />)
    expect(
      container.querySelectorAll('[class*="bg-red-"], [class*="bg-amber-"], [class*="bg-emerald-"]'),
    ).toHaveLength(0)
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
