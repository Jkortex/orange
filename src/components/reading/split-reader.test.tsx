// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SplitReader } from '@/components/reading/split-reader'

afterEach(() => {
  cleanup()
})

describe('SplitReader 双栏独立滚动组件', () => {
  it('桌面端同时渲染左右两个独立滚动区域', () => {
    render(
      <SplitReader
        leftNode={<div>左栏新精炼内容</div>}
        rightNode={<div>右栏原著参考内容</div>}
        leftTitle="核心实战"
        rightTitle="原著对照"
      />,
    )

    expect(screen.getAllByText('核心实战').length).toBeGreaterThan(0)
    expect(screen.getAllByText('原著对照').length).toBeGreaterThan(0)
    expect(screen.getAllByText('左栏新精炼内容').length).toBeGreaterThan(0)
    expect(screen.getAllByText('右栏原著参考内容').length).toBeGreaterThan(0)

    // 检查桌面端两个滚动 section 均具备 overflow-y-auto 与 h-full
    const leftSection = screen.getByRole('region', { name: '核心实战' })
    const rightSection = screen.getByRole('region', { name: '原著对照' })
    expect(leftSection.className).toContain('overflow-y-auto')
    expect(leftSection.className).toContain('h-full')
    expect(rightSection.className).toContain('overflow-y-auto')
    expect(rightSection.className).toContain('h-full')
  })

  it('移动端支持 Tab 切换核心精炼与原著对照', () => {
    render(
      <SplitReader
        leftNode={<div className="left-panel">左栏新精炼内容</div>}
        rightNode={<div className="right-panel">右栏原著参考内容</div>}
        leftTitle="核心实战"
        rightTitle="原著对照"
      />,
    )

    // 找到移动端右栏切换按钮并点击
    const rightTabBtn = screen.getByRole('button', { name: /原著对照/ })
    fireEvent.click(rightTabBtn)

    // 切换后包含右栏内容
    expect(screen.getAllByText('右栏原著参考内容').length).toBeGreaterThan(0)
  })

  it('点击全篇展开英文按钮可切换详情展开状态', () => {
    render(
      <div>
        <details className="en-disclosure">
          <summary>段落 1 英文</summary>
          <div>Original 1</div>
        </details>
        <SplitReader
          leftNode={<div>左栏</div>}
          rightNode={<div>右栏</div>}
        />
      </div>,
    )

    const toggleBtn = screen.getByRole('button', { name: /全篇展开英文/ })
    fireEvent.click(toggleBtn)

    const details = document.querySelector('details.en-disclosure') as HTMLDetailsElement
    expect(details.open).toBe(true)

    expect(screen.getByRole('button', { name: /折叠全篇英文/ })).toBeDefined()
  })

  it('支持点击 7:3 / 5:5 / 3:7 快速切换双栏比例', () => {
    render(
      <SplitReader
        leftNode={<div>左栏</div>}
        rightNode={<div>右栏</div>}
        leftTitle="左栏"
        rightTitle="右栏"
      />,
    )

    const leftSection = screen.getByRole('region', { name: '左栏' })
    const rightSection = screen.getByRole('region', { name: '右栏' })

    // 默认 50% / 50%
    expect(leftSection.style.width).toBe('50%')
    expect(rightSection.style.width).toBe('50%')

    // 点击 7:3
    const ratio73Btn = screen.getByRole('button', { name: '7 : 3' })
    fireEvent.click(ratio73Btn)
    expect(leftSection.style.width).toBe('70%')
    expect(rightSection.style.width).toBe('30%')

    // 点击 3:7
    const ratio37Btn = screen.getByRole('button', { name: '3 : 7' })
    fireEvent.click(ratio37Btn)
    expect(leftSection.style.width).toBe('30%')
    expect(rightSection.style.width).toBe('70%')
  })

  it('支持使用键盘左右方向键在分割线上微调宽度比例', () => {
    render(
      <SplitReader
        leftNode={<div>左栏</div>}
        rightNode={<div>右栏</div>}
        leftTitle="左栏"
        rightTitle="右栏"
      />,
    )

    const leftSection = screen.getByRole('region', { name: '左栏' })
    const separator = screen.getByRole('separator', { name: '拖拽调整左右栏宽度' })

    // 向左调整 (50% - 5% = 45%)
    fireEvent.keyDown(separator, { key: 'ArrowLeft' })
    expect(leftSection.style.width).toBe('45%')

    // 向右调整两次 (45% + 10% = 55%)
    fireEvent.keyDown(separator, { key: 'ArrowRight' })
    fireEvent.keyDown(separator, { key: 'ArrowRight' })
    expect(leftSection.style.width).toBe('55%')
  })
})


