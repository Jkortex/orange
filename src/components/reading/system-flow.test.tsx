// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { stubBrowserApis, unstubBrowserApis } from '@/components/test-utils/stub-browser-apis'
import { SystemFlow } from '@/components/reading/system-flow'

describe('SystemFlow 系统设计动效组件', () => {
  beforeEach(() => {
    stubBrowserApis()
    // 补充 jsdom 缺失的 DOMMatrixReadOnly
    if (typeof globalThis.DOMMatrixReadOnly === 'undefined') {
      globalThis.DOMMatrixReadOnly = class DOMMatrixReadOnly {
        m11 = 1
        m22 = 1
        m41 = 0
        m42 = 0
      } as unknown as typeof DOMMatrixReadOnly
    }
  })

  afterEach(() => {
    cleanup()
    unstubBrowserApis()
  })

  const sampleConfig = {
    title: '缓存穿透防护演示',
    nodes: [
      { id: 'client', label: 'Web Client', type: 'client' as const, x: 50, y: 50 },
      { id: 'cache', label: 'Redis Cluster', type: 'cache' as const, x: 200, y: 50 },
    ],
    edges: [{ id: 'e1', source: 'client', target: 'cache', label: 'GET' }],
    steps: [
      {
        step: 1,
        title: '初始请求',
        description: '客户端发起查询请求',
        activeEdges: ['e1'],
        activeNodes: ['client'],
      },
      {
        step: 2,
        title: '缓存命中并返回',
        description: 'Redis 命中数据，直接响应',
        activeEdges: ['e1'],
        activeNodes: ['cache'],
      },
    ],
  }

  it('正常渲染标题、流程图画布与当前步骤说明', () => {
    render(<SystemFlow config={sampleConfig} />)

    // 检查标题
    expect(screen.getByText('缓存穿透防护演示')).toBeDefined()
    // 检查当前第 1 步的信息
    expect(screen.getByText('初始请求')).toBeDefined()
    expect(screen.getByText('客户端发起查询请求')).toBeDefined()
    // 检查步骤指示器
    expect(screen.getByText(/1 \/ 2/)).toBeDefined()
  })

  it('支持点击下一步与上一步切换演进步骤', () => {
    render(<SystemFlow config={sampleConfig} />)

    const nextBtn = screen.getByRole('button', { name: '下一步' })
    fireEvent.click(nextBtn)

    // 此时应当切换至第 2 步
    expect(screen.getByText('缓存命中并返回')).toBeDefined()
    expect(screen.getByText('Redis 命中数据，直接响应')).toBeDefined()
    expect(screen.getByText(/2 \/ 2/)).toBeDefined()

    // 点击上一步回到第 1 步
    const prevBtn = screen.getByRole('button', { name: '上一步' })
    fireEvent.click(prevBtn)
    expect(screen.getByText('初始请求')).toBeDefined()
  })

  it('重置按钮可快速回到第一步', () => {
    render(<SystemFlow config={sampleConfig} />)

    const nextBtn = screen.getByRole('button', { name: '下一步' })
    fireEvent.click(nextBtn)
    expect(screen.getByText(/2 \/ 2/)).toBeDefined()

    const resetBtn = screen.getByRole('button', { name: '重置流程' })
    fireEvent.click(resetBtn)
    expect(screen.getByText(/1 \/ 2/)).toBeDefined()
  })

  it('配置解析失败时渲染友好提示而不抛出未捕获异常', () => {
    render(<SystemFlow rawConfig="{ broken json config" />)

    expect(screen.getByText('系统流程图配置解析失败')).toBeDefined()
  })

  it('无 steps 配置时依然正常渲染静态/常规流程图', () => {
    const staticConfig = {
      title: '常规架构图',
      nodes: [{ id: '1', label: 'Service A', x: 0, y: 0 }],
      edges: [],
    }
    render(<SystemFlow config={staticConfig} />)

    expect(screen.getByText('常规架构图')).toBeDefined()
  })
})
