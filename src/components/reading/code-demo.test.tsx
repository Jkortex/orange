// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CodeDemo } from './code-demo'

afterEach(() => {
  cleanup()
})

describe('CodeDemo 组件', () => {
  it('正常渲染标题、iframe 预览与展开代码按钮', () => {
    render(
      <CodeDemo
        title="按钮效果"
        html="<button>Click</button>"
        css="button { color: blue; }"
      />,
    )

    expect(screen.getByText('按钮效果')).toBeTruthy()
    const iframe = screen.getByTitle('按钮效果')
    expect(iframe).toBeTruthy()
    expect(iframe.getAttribute('srcdoc')).toContain('<button>Click</button>')
    expect(iframe.getAttribute('srcdoc')).toContain('button { color: blue; }')
    expect(screen.getByRole('button', { name: '查看代码' })).toBeTruthy()
  })

  it('点击查看代码展开折叠区并展示 Tab', () => {
    render(
      <CodeDemo
        title="Tab切换演示"
        html="<div>HTML Content</div>"
        css=".test { color: green; }"
      />,
    )

    const toggleBtn = screen.getByRole('button', { name: '查看代码' })
    fireEvent.click(toggleBtn)

    expect(screen.getByRole('button', { name: '收起代码' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'HTML' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'CSS' })).toBeTruthy()
    expect(screen.getByText('<div>HTML Content</div>')).toBeTruthy()

    // 切换至 CSS Tab
    const cssTab = screen.getByRole('button', { name: 'CSS' })
    fireEvent.click(cssTab)
    expect(screen.getByText('.test { color: green; }')).toBeTruthy()
  })

  it('点击重置按钮刷新 iframe key', () => {
    render(
      <CodeDemo
        title="刷新测试"
        html="<p>Reload</p>"
      />,
    )

    const resetBtn = screen.getByRole('button', { name: '重置演示' })
    fireEvent.click(resetBtn)
    expect(screen.getByTitle('刷新测试')).toBeTruthy()
  })

  it('响应 resize message 动态调整高度并保持稳定不无限循环', () => {
    render(
      <CodeDemo
        title="高度调整测试"
        html="<p>Height Test</p>"
      />,
    )

    const iframe = screen.getByTitle('高度调整测试') as HTMLIFrameElement
    expect(iframe.style.height).toBe('140px')

    // 触发 message 事件
    fireEvent(
      window,
      new MessageEvent('message', {
        data: { type: 'orange-demo-resize', height: 260 },
      }),
    )
    expect(iframe.style.height).toBe('264px')

    // 微小变动 (<= 2px) 维持原高度，避免重排死循环
    fireEvent(
      window,
      new MessageEvent('message', {
        data: { type: 'orange-demo-resize', height: 261 },
      }),
    )
    expect(iframe.style.height).toBe('264px')
  })
})
