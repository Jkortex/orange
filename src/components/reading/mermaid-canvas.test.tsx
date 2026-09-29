// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { MermaidCanvas } from '@/components/reading/mermaid-canvas'
import {
  stubSvgBBox,
  unstubBrowserApis,
} from '@/components/test-utils/stub-browser-apis'

/*
 * jsdom 没有布局引擎，getBBox 压根不存在 —— 这里给原型挂一个假的来模拟浏览器量到的几何。
 * 用例里的数字仍是实测值：sequenceDiagram 的内容 bbox 左边距 51.53、其余三边 30。
 */
const asymmetricBox = { x: 51.53, y: 30, width: 639.11, height: 450 }

const svgWith = (viewBox: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="720" height="510"><text>hi</text></svg>`

const rendered = (svg: string) => render(<MermaidCanvas svg={svg} className="mermaid-canvas block" />)
const viewBoxOf = (container: HTMLElement) => container.querySelector('svg')?.getAttribute('viewBox')

beforeEach(() => {
  stubSvgBBox(asymmetricBox)
})

afterEach(() => {
  cleanup()
  unstubBrowserApis()
})

describe('MermaidCanvas', () => {
  it('渲染传入的 SVG 字符串，类名由调用方决定', () => {
    const { container } = rendered(svgWith('0 0 720 510'))

    const host = container.firstElementChild
    expect(host?.tagName).toBe('SPAN')
    expect(host?.className).toBe('mermaid-canvas block')
    expect(container.querySelector('svg')).not.toBeNull()
    expect(container.querySelector('text')?.textContent).toBe('hi')
  })

  it('挂载后立刻把偏心的 viewBox 收紧到以内容为中心', () => {
    const { container } = rendered(svgWith('0 0 720.64 510'))

    expect(viewBoxOf(container)).toBe('21.53 0 699.11 510')
  })

  it('本来居中就不写回，属性保持上游原样', () => {
    stubSvgBBox({ x: 40, y: 40, width: 546.57, height: 1076.04 })
    const { container } = rendered(svgWith('0 0 626.566 1156.04'))

    expect(viewBoxOf(container)).toBe('0 0 626.566 1156.04')
  })

  it('viewBox 缺失或非法时原样渲染，不写回半成品', () => {
    const missing = render(
      <MermaidCanvas svg="<svg xmlns='http://www.w3.org/2000/svg'><text>hi</text></svg>" />,
    )
    expect(viewBoxOf(missing.container)).toBeNull()
    cleanup()

    const broken = rendered(svgWith('0 0 auto'))
    expect(viewBoxOf(broken.container)).toBe('0 0 auto')
  })

  it('浏览器没实现 getBBox（jsdom 的真实情况）时静默跳过，图表照常渲染', () => {
    unstubBrowserApis()

    const { container } = rendered(svgWith('0 0 720.64 510'))

    expect(viewBoxOf(container)).toBe('0 0 720.64 510')
    expect(container.querySelector('svg')).not.toBeNull()
  })
})
