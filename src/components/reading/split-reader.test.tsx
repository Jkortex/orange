// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  SPLIT_READER_PREFS_KEY,
  SplitReader,
} from '@/components/reading/split-reader'

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
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

    // 点击 8:2
    const ratio82Btn = screen.getByRole('button', { name: '8 : 2' })
    fireEvent.click(ratio82Btn)
    expect(leftSection.style.width).toBe('80%')
    expect(rightSection.style.width).toBe('20%')

    // 点击 2:8
    const ratio28Btn = screen.getByRole('button', { name: '2 : 8' })
    fireEvent.click(ratio28Btn)
    expect(leftSection.style.width).toBe('20%')
    expect(rightSection.style.width).toBe('80%')
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

  it('支持通过顶栏视图模式切换「仅看精炼」、「双栏对照」、「仅看原著」', () => {
    render(
      <SplitReader
        leftNode={<div>左栏核心内容</div>}
        rightNode={<div>右栏原著内容</div>}
        leftTitle="核心实战"
        rightTitle="原著对照"
      />,
    )

    // 初始状态为双栏模式
    expect(screen.getByRole('region', { name: '核心实战' })).toBeDefined()
    expect(screen.getByRole('region', { name: '原著对照' })).toBeDefined()
    expect(screen.getByRole('separator', { name: '拖拽调整左右栏宽度' })).toBeDefined()

    // 点击「仅看精炼」切换到仅左栏单栏模式
    const onlyLeftBtn = screen.getByRole('button', { name: '仅看精炼' })
    fireEvent.click(onlyLeftBtn)

    // 左栏占满 100%，右栏隐藏，分割线隐藏
    const leftSectionOnly = screen.getByRole('region', { name: '核心实战' })
    expect(leftSectionOnly.style.width).toBe('100%')
    expect(screen.queryByRole('separator', { name: '拖拽调整左右栏宽度' })).toBeNull()
    expect(screen.queryByRole('region', { name: '原著对照' })).toBeNull()

    // 点击「仅看原著」切换到仅右栏单栏模式
    const onlyRightBtn = screen.getByRole('button', { name: '仅看原著' })
    fireEvent.click(onlyRightBtn)

    // 右栏占满 100%，左栏隐藏
    const rightSectionOnly = screen.getByRole('region', { name: '原著对照' })
    expect(rightSectionOnly.style.width).toBe('100%')
    expect(screen.queryByRole('separator', { name: '拖拽调整左右栏宽度' })).toBeNull()
    expect(screen.queryByRole('region', { name: '核心实战' })).toBeNull()

    // 点击「双栏对照」切回双栏并排
    const splitBtn = screen.getByRole('button', { name: '双栏对照' })
    fireEvent.click(splitBtn)
    expect(screen.getByRole('region', { name: '核心实战' })).toBeDefined()
    expect(screen.getByRole('region', { name: '原著对照' })).toBeDefined()
    expect(screen.getByRole('separator', { name: '拖拽调整左右栏宽度' })).toBeDefined()
  })

  it('视图模式、比例与宽屏/长文开关用 aria-pressed 表达当前状态', () => {
    render(
      <SplitReader
        leftNode={<div>左栏</div>}
        rightNode={<div>右栏</div>}
        leftTitle="左栏"
        rightTitle="右栏"
      />,
    )

    const pressed = (name: string) =>
      screen.getByRole('button', { name }).getAttribute('aria-pressed')

    expect(pressed('双栏对照')).toBe('true')
    expect(pressed('仅看精炼')).toBe('false')
    expect(pressed('5 : 5')).toBe('true')
    expect(pressed('7 : 3')).toBe('false')
    expect(pressed('展开宽屏模式')).toBe('false')
    expect(pressed('长文展开流动')).toBe('false')

    fireEvent.click(screen.getByRole('button', { name: '7 : 3' }))
    expect(pressed('7 : 3')).toBe('true')
    expect(pressed('5 : 5')).toBe('false')

    fireEvent.click(screen.getByRole('button', { name: '仅看精炼' }))
    expect(pressed('仅看精炼')).toBe('true')
    expect(pressed('双栏对照')).toBe('false')

    fireEvent.click(screen.getByRole('button', { name: '展开宽屏模式' }))
    expect(pressed('恢复标准宽度')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: '长文展开流动' }))
    expect(pressed('工作台独立滚动')).toBe('true')
  })

  it('分割线支持双击重置为 50:50，并支持点击折叠按钮快速切换单栏', () => {
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

    // 先点击 7:3 调整比例
    fireEvent.click(screen.getByRole('button', { name: '7 : 3' }))
    expect(leftSection.style.width).toBe('70%')

    // 双击分割线复位为 50:50
    fireEvent.doubleClick(separator)
    expect(leftSection.style.width).toBe('50%')

    // 点击分割线上的「折叠左栏 / 仅看原著」快捷按钮
    const collapseLeftBtn = screen.getByTitle('折叠左栏，仅看原著')
    fireEvent.click(collapseLeftBtn)
    expect(screen.queryByRole('region', { name: '左栏' })).toBeNull()
    expect(screen.getByRole('region', { name: '右栏' }).style.width).toBe('100%')

    // 切回双栏并测试「折叠右栏 / 仅看精炼」快捷按钮
    fireEvent.click(screen.getByRole('button', { name: /双栏对照/ }))
    const collapseRightBtn = screen.getByTitle('折叠右栏，仅看精炼')
    fireEvent.click(collapseRightBtn)
    expect(screen.queryByRole('region', { name: '右栏' })).toBeNull()
    expect(screen.getByRole('region', { name: '左栏' }).style.width).toBe('100%')
  })

  it('把比例/宽屏/长文设置持久化，重新挂载后恢复', () => {
    const first = render(
      <SplitReader
        leftNode={<div>左栏</div>}
        rightNode={<div>右栏</div>}
        leftTitle="左栏"
        rightTitle="右栏"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '7 : 3' }))
    fireEvent.click(screen.getByRole('button', { name: '展开宽屏模式' }))
    fireEvent.click(screen.getByRole('button', { name: '长文展开流动' }))

    expect(JSON.parse(localStorage.getItem(SPLIT_READER_PREFS_KEY) ?? '{}')).toEqual({
      ratio: 70,
      viewMode: 'split',
      isWide: true,
      isFluidHeight: true,
    })

    first.unmount()
    render(
      <SplitReader
        leftNode={<div>左栏</div>}
        rightNode={<div>右栏</div>}
        leftTitle="左栏"
        rightTitle="右栏"
      />,
    )

    expect(screen.getByRole('region', { name: '左栏' }).style.width).toBe('70%')
    expect(screen.getByRole('button', { name: '恢复标准宽度' })).toBeDefined()
    expect(screen.getByRole('button', { name: '工作台独立滚动' })).toBeDefined()
  })

  it('恢复「仅看原著」视图模式', () => {
    localStorage.setItem(
      SPLIT_READER_PREFS_KEY,
      JSON.stringify({ ratio: 70, viewMode: 'right', isWide: false, isFluidHeight: false }),
    )

    render(
      <SplitReader
        leftNode={<div>左栏</div>}
        rightNode={<div>右栏</div>}
        leftTitle="左栏"
        rightTitle="右栏"
      />,
    )

    expect(screen.queryByRole('region', { name: '左栏' })).toBeNull()
    expect(screen.getByRole('region', { name: '右栏' }).style.width).toBe('100%')
    expect(screen.getByRole('button', { name: '仅看原著' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('存储值非法时回退默认值，不崩溃', () => {
    localStorage.setItem(
      SPLIT_READER_PREFS_KEY,
      JSON.stringify({ ratio: 999, viewMode: 'nope', isWide: 'yes', isFluidHeight: 1 }),
    )

    render(
      <SplitReader
        leftNode={<div>左栏</div>}
        rightNode={<div>右栏</div>}
        leftTitle="左栏"
        rightTitle="右栏"
      />,
    )

    expect(screen.getByRole('region', { name: '左栏' }).style.width).toBe('50%')
    expect(screen.getByRole('button', { name: '双栏对照' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '展开宽屏模式' })).toBeDefined()
  })

  it('JSON 损坏时回退默认值', () => {
    localStorage.setItem(SPLIT_READER_PREFS_KEY, '{')

    render(
      <SplitReader
        leftNode={<div>左栏</div>}
        rightNode={<div>右栏</div>}
        leftTitle="左栏"
        rightTitle="右栏"
      />,
    )

    expect(screen.getByRole('region', { name: '左栏' }).style.width).toBe('50%')
  })

  it('重置按钮把比例/视图/宽屏/长文恢复默认，并写回存储', () => {
    render(
      <SplitReader
        leftNode={<div>左栏</div>}
        rightNode={<div>右栏</div>}
        leftTitle="左栏"
        rightTitle="右栏"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '7 : 3' }))
    fireEvent.click(screen.getByRole('button', { name: '展开宽屏模式' }))
    fireEvent.click(screen.getByRole('button', { name: '长文展开流动' }))
    fireEvent.click(screen.getByRole('button', { name: '仅看原著' }))

    // 单栏模式下比例组隐藏，重置按钮仍常驻
    fireEvent.click(screen.getByRole('button', { name: '重置分栏设置' }))

    expect(screen.getByRole('region', { name: '左栏' }).style.width).toBe('50%')
    expect(screen.getByRole('region', { name: '右栏' }).style.width).toBe('50%')
    expect(screen.getByRole('button', { name: '双栏对照' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '展开宽屏模式' })).toBeDefined()
    expect(screen.getByRole('button', { name: '长文展开流动' })).toBeDefined()
    expect(JSON.parse(localStorage.getItem(SPLIT_READER_PREFS_KEY) ?? '{}')).toEqual({
      ratio: 50,
      viewMode: 'split',
      isWide: false,
      isFluidHeight: false,
    })
  })

  it('快捷键 1/2/3 切换视图，w/l 切换宽屏与长文，0 重置', () => {
    render(
      <SplitReader
        leftNode={<div>左栏</div>}
        rightNode={<div>右栏</div>}
        leftTitle="左栏"
        rightTitle="右栏"
      />,
    )

    fireEvent.keyDown(document, { key: '1' })
    expect(screen.getByRole('region', { name: '左栏' }).style.width).toBe('100%')

    fireEvent.keyDown(document, { key: '3' })
    expect(screen.getByRole('region', { name: '右栏' }).style.width).toBe('100%')

    fireEvent.keyDown(document, { key: '2' })
    expect(screen.getByRole('region', { name: '左栏' }).style.width).toBe('50%')

    fireEvent.keyDown(document, { key: 'w' })
    expect(screen.getByRole('button', { name: '恢复标准宽度' })).toBeDefined()

    fireEvent.keyDown(document, { key: 'l' })
    expect(screen.getByRole('button', { name: '工作台独立滚动' })).toBeDefined()

    fireEvent.keyDown(document, { key: '0' })
    expect(screen.getByRole('region', { name: '左栏' }).style.width).toBe('50%')
    expect(screen.getByRole('button', { name: '展开宽屏模式' })).toBeDefined()
    expect(screen.getByRole('button', { name: '长文展开流动' })).toBeDefined()
    expect(screen.getByRole('button', { name: '双栏对照' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('输入框或浮层内不触发分栏快捷键', () => {
    render(
      <>
        <input aria-label="备注" />
        <div role="dialog" aria-modal="true" aria-label="站内搜索" />
        <SplitReader
          leftNode={<div>左栏</div>}
          rightNode={<div>右栏</div>}
          leftTitle="左栏"
          rightTitle="右栏"
        />
      </>,
    )

    fireEvent.keyDown(screen.getByLabelText('备注'), { key: '1' })
    expect(screen.getByRole('region', { name: '左栏' }).style.width).toBe('50%')

    fireEvent.keyDown(document, { key: '1' })
    expect(screen.getByRole('region', { name: '左栏' }).style.width).toBe('50%')
  })

  it('localStorage 写入失败时仍能正常切换（仅本次会话生效）', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })

    render(
      <SplitReader
        leftNode={<div>左栏</div>}
        rightNode={<div>右栏</div>}
        leftTitle="左栏"
        rightTitle="右栏"
      />,
    )

    expect(() => fireEvent.click(screen.getByRole('button', { name: '7 : 3' }))).not.toThrow()
    expect(screen.getByRole('region', { name: '左栏' }).style.width).toBe('70%')
  })

  it('支持切换宽屏全宽阅读模式与自然长文流动高度模式', () => {
    const { container } = render(
      <SplitReader
        leftNode={<div>左栏</div>}
        rightNode={<div>右栏</div>}
        leftTitle="左栏"
        rightTitle="右栏"
      />,
    )

    const workbench = container.querySelector('.split-reader-container')
    expect(workbench).toBeDefined()
    expect(workbench?.className).not.toContain('split-reader-wide')

    // 点击宽屏模式切换按钮
    const wideToggleBtn = screen.getByRole('button', { name: /展开宽屏模式/ })
    fireEvent.click(wideToggleBtn)
    expect(workbench?.className).toContain('split-reader-wide')

    // 再次点击恢复标准宽度
    const compactToggleBtn = screen.getByRole('button', { name: /恢复标准宽度/ })
    fireEvent.click(compactToggleBtn)
    expect(workbench?.className).not.toContain('split-reader-wide')

    // 点击流动长文高度模式切换按钮
    const flowToggleBtn = screen.getByRole('button', { name: /长文展开流动/ })
    fireEvent.click(flowToggleBtn)
    expect(workbench?.className).toContain('split-reader-flow')

    // 再次点击切回工作台固定视口
    const workbenchToggleBtn = screen.getByRole('button', { name: /工作台独立滚动/ })
    fireEvent.click(workbenchToggleBtn)
    expect(workbench?.className).not.toContain('split-reader-flow')
  })
})


