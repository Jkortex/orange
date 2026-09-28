/*
 * jsdom 缺失的浏览器 API 桩（Radix 浮层 / 复制按钮会用到）：
 * - ResizeObserver：Popover/Dropdown 的 floating-ui autoUpdate 依赖它
 * - matchMedia：主题与媒体查询分支
 * - scrollIntoView：目录高亮滚动
 * 使用方式：beforeEach(() => stubBrowserApis())，afterEach(() => unstubBrowserApis())
 */

const originalResizeObserver = globalThis.ResizeObserver
const originalMatchMedia = globalThis.matchMedia

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

export function unstubBrowserApis() {
  globalThis.ResizeObserver = originalResizeObserver
  globalThis.matchMedia = originalMatchMedia
}
