// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MediaZoom, type MediaZoomSource } from '@/components/reading/media-zoom'
import {
  stubBrowserApis,
  stubSvgBBox,
  unstubBrowserApis,
} from '@/components/test-utils/stub-browser-apis'

beforeEach(() => {
  // Radix Dialog 需要 ResizeObserver
  stubBrowserApis()
})

afterEach(() => {
  cleanup()
  unstubBrowserApis()
})

const imageSource: MediaZoomSource = {
  kind: 'image',
  src: '/media/architecture/system-architecture.svg',
  alt: '系统架构图',
}
const svgSource: MediaZoomSource = {
  kind: 'svg',
  svg: '<svg data-testid="sample-svg"><text>节点A</text></svg>',
  alt: '流程架构图',
}

function renderZoom(source: MediaZoomSource, hint?: string) {
  const utils = render(
    <MediaZoom source={source} label={`查看大图：${source.alt}`} hint={hint}>
      <span>触发内容</span>
    </MediaZoom>,
  )
  return { ...utils, trigger: screen.getByRole('button', { name: `查看大图：${source.alt}` }) }
}

function open(source: MediaZoomSource = imageSource) {
  const utils = renderZoom(source)
  fireEvent.click(utils.trigger)
  return utils
}

const percent = () => screen.getByRole('status').textContent
const zoomIn = () => screen.getByRole('button', { name: '放大' })
const zoomOut = () => screen.getByRole('button', { name: '缩小' })

describe('MediaZoom 触发按钮', () => {
  it('关闭态不渲染浮层', () => {
    renderZoom(imageSource)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('按钮声明自己是浮层触发器，并按 hint 渲染悬停角标', () => {
    const { trigger } = renderZoom(imageSource, '点击查看大图')
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(screen.getByText('点击查看大图')).toBeDefined()
  })

  it('不传 hint 时不渲染角标', () => {
    renderZoom(imageSource)
    expect(screen.queryByText('点击查看大图')).toBeNull()
  })

  it('点击后打开浮层，焦点被收进浮层内部', () => {
    open()
    const dialog = screen.getByRole('dialog', { name: /系统架构图/ })
    expect(dialog.contains(document.activeElement)).toBe(true)
  })
})

describe('MediaZoom 两种媒体源', () => {
  it('图片源渲染 img，并把 alt 同时用作浮层标题', () => {
    open(imageSource)
    expect(screen.getByAltText('系统架构图')).toBeDefined()
    expect(screen.getByRole('dialog', { name: /系统架构图（放大查看）/ })).toBeDefined()
  })

  /*
   * 内联 SVG 是本组件相对灯箱/第三方图片缩放库存在的理由：那些库只吃 <img src>。
   * 同时它不能带 .mermaid-canvas —— 那条规则是给正文用的（只压宽度、未分层），
   * 浮层里要的是「确定盒子 + preserveAspectRatio 等比留白」。
   */
  it('SVG 源内联渲染，且不套正文的 .mermaid-canvas 契约', () => {
    const { container } = open(svgSource)
    expect(screen.getByTestId('sample-svg')).toBeDefined()
    expect(container.ownerDocument.querySelector('span.mermaid-canvas')).toBeNull()
    expect(screen.getByTestId('sample-svg').parentElement?.className).toContain('[&>svg]:h-full')
  })

  it('空 SVG 字符串不崩', () => {
    open({ kind: 'svg', svg: '', alt: '空图' })
    expect(screen.getByRole('dialog', { name: /空图/ })).toBeDefined()
  })

  /*
   * 用户报的正是这一处：浮层刚打开时 mermaid 图整体偏右，调一下缩放又「看着正常了」。
   * 根因在上游 viewBox 不以内容为中心（实测左 51.53、其余三边 30），而浮层把 SVG 拉满画布，
   * 那 1.5% 的偏心被同样放大成 15px 左右。挂载时量一次 bbox 收紧 viewBox 是唯一能修的地方，
   * 所以这条链路（MediaZoom → MermaidCanvas → lib/mermaid-viewbox）必须锁住。
   */
  it('浮层里的 mermaid 图挂载后就把偏心的 viewBox 收紧到居中', () => {
    stubSvgBBox({ x: 51.53, y: 30, width: 639.11, height: 450 })

    open({
      kind: 'svg',
      svg: '<svg data-testid="offset-svg" viewBox="0 0 720.64 510"><text>节点A</text></svg>',
      alt: '时序图',
    })

    expect(screen.getByTestId('offset-svg').getAttribute('viewBox')).toBe('21.53 0 699.11 510')
  })
})

describe('MediaZoom 缩放', () => {
  it('默认 100%：复位钮此时禁用', () => {
    open()
    expect(percent()).toBe('100%')
    expect(screen.getByRole('button', { name: '复位' })).toHaveProperty('disabled', true)
  })

  it('每点一次「放大」加一档 25%', () => {
    open()

    fireEvent.click(zoomIn())
    expect(percent()).toBe('125%')

    fireEvent.click(zoomIn())
    expect(percent()).toBe('150%')
  })

  it('放大到上限 400% 后「放大」禁用，缩小到下限 50% 后「缩小」禁用', () => {
    open()

    for (let i = 0; i < 20; i++) fireEvent.click(zoomIn())
    expect(percent()).toBe('400%')
    expect(zoomIn()).toHaveProperty('disabled', true)

    for (let i = 0; i < 30; i++) fireEvent.click(zoomOut())
    expect(percent()).toBe('50%')
    expect(zoomOut()).toHaveProperty('disabled', true)
  })

  it('复位回到 100%', () => {
    open()
    fireEvent.click(zoomIn())
    fireEvent.click(zoomIn())
    expect(percent()).toBe('150%')

    fireEvent.click(screen.getByRole('button', { name: '复位' }))
    expect(percent()).toBe('100%')
  })

  /*
   * 缩放的实现方式换成了 transform，但「倍率以铺满画布的尺寸为基准」这条契约不能变 ——
   * 媒体盒必须是 100%（而不是由图片原始像素决定），否则 50%/400% 就失去意义。
   * 库的 content 默认 fit-content，靠 contentStyle 内联改成 100%。
   */
  it('媒体盒铺满画布，倍率以它为基准', () => {
    const { container } = open(svgSource)
    const content = container.ownerDocument.querySelector('.react-transform-component') as HTMLElement

    expect(content.style.width).toBe('100%')
    expect(content.style.height).toBe('100%')
  })

  it('画布是键盘可达的缩放区域，并按 min/max 限制在 50%~400%', () => {
    const { container } = open()
    const wrapper = container.ownerDocument.querySelector('.react-transform-wrapper') as HTMLElement

    expect(wrapper.getAttribute('aria-label')).toContain('可缩放查看区域')
    // 库在启用 keyboard 时自己补 tabIndex，方向键平移靠它拿到焦点
    expect(wrapper.getAttribute('tabindex')).toBe('0')
  })
})

describe('MediaZoom 滚轮缩放', () => {
  it('滚轮改变比例（画布无可滚动内容，滚轮归缩放）', () => {
    const { container } = open()
    const wrapper = container.ownerDocument.querySelector('.react-transform-wrapper')!

    fireEvent.wheel(wrapper, { deltaY: -100 })
    expect(percent()).toBe('120%')

    fireEvent.wheel(wrapper, { deltaY: 100 })
    expect(percent()).toBe('100%')
  })
})

describe('MediaZoom 生命周期', () => {
  it('关闭再打开，比例复位到 100%', async () => {
    const { trigger } = open()
    fireEvent.click(zoomIn())
    expect(percent()).toBe('125%')

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    fireEvent.click(trigger)
    expect(percent()).toBe('100%')
  })

  it('关闭后把焦点还给触发按钮', async () => {
    const { trigger } = open()

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    // Radix 在 setTimeout(0) 里走 onCloseAutoFocus
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })
})
