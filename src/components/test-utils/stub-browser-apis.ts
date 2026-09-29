/*
 * jsdom 缺失的浏览器 API 桩（Radix 浮层 / 复制按钮会用到）：
 * - ResizeObserver：Popover/Dropdown 的 floating-ui autoUpdate 依赖它
 * - matchMedia：主题与媒体查询分支
 * - scrollIntoView：目录高亮滚动
 * - SVGSVGElement.prototype.getBBox：mermaid 画布校正 viewBox 时要量真实几何
 * 使用方式：beforeEach(() => stubBrowserApis())，afterEach(() => unstubBrowserApis())
 */

import type { Box } from '@/lib/mermaid-viewbox'

const originalResizeObserver = globalThis.ResizeObserver
const originalMatchMedia = globalThis.matchMedia
const originalSvgGetBBox =
  typeof SVGSVGElement === 'undefined'
    ? undefined
    : Object.getOwnPropertyDescriptor(SVGSVGElement.prototype, 'getBBox')

export function stubBrowserApis() {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
  if (!globalThis.matchMedia) {
    globalThis.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof matchMedia
  }
}

/**
 * jsdom 没有布局引擎，getBBox 压根不存在（调用直接抛 TypeError）——
 * 需要它的组件必须自己补一个。box 可给值也可给函数：同一个元素要量两次、
 * 且两次结果不同（模拟字体加载前后）时用函数。
 */
export function stubSvgBBox(box: Box | (() => Box)) {
  Object.defineProperty(SVGSVGElement.prototype, 'getBBox', {
    configurable: true,
    writable: true,
    value: () => {
      const b = typeof box === 'function' ? box() : box
      return {
        ...b,
        top: b.y,
        right: b.x + b.width,
        bottom: b.y + b.height,
        left: b.x,
        toJSON: () => ({}),
      }
    },
  })
}

export function unstubBrowserApis() {
  globalThis.ResizeObserver = originalResizeObserver
  globalThis.matchMedia = originalMatchMedia

  // jsdom 本来就没有 getBBox，删掉即还原
  if (originalSvgGetBBox) {
    Object.defineProperty(SVGSVGElement.prototype, 'getBBox', originalSvgGetBBox)
  } else if (typeof SVGSVGElement !== 'undefined') {
    delete (SVGSVGElement.prototype as unknown as Record<string, unknown>).getBBox
  }
}
