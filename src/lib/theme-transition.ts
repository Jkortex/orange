/*
 * 主题切换过渡（ui-ux.md §3.5 动效克制：仅状态过渡类微动效）：
 * - 优先 View Transitions + Web Animations API (WAAPI) 圆形扩散：
 *   新页以触发按钮为圆心、clip-path circle 从 0 展开至全屏，由合成器（Compositor）直接加速；
 *   显式隔离混合模式（mix-blend-mode: normal），消除重影泛白与加色白边。
 * - 不支持 View Transitions 的环境瞬时同步生效，彻底避免全量 DOM 扫描与同步重排性能损耗。
 * - prefers-reduced-motion / 无真实绘制环境（jsdom）直接同步切换。
 * - update() 始终同步执行（VT 回调内 / 直接调用），测试断言不受影响。
 * - 快速连续切换时排队等候，当前动画完成后自动执行下一次，保持完整过渡体验。
 */

export type ThemeTransitionOrigin = { x: number; y: number }

let running = false
let pendingUpdate: (() => void) | null = null
let pendingOrigin: ThemeTransitionOrigin | undefined = undefined

function flushPending() {
  if (pendingUpdate) {
    const update = pendingUpdate
    const origin = pendingOrigin
    pendingUpdate = null
    pendingOrigin = undefined
    animateThemeChange(update, origin)
  }
}

function defaultOrigin(): ThemeTransitionOrigin {
  if (typeof window === 'undefined') return { x: 0, y: 0 }
  return { x: window.innerWidth, y: 0 }
}

export function animateThemeChange(update: () => void, origin?: ThemeTransitionOrigin) {
  if (typeof document === 'undefined') {
    update()
    return
  }
  const reduce =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce) {
    update()
    return
  }

  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => {
      ready?: Promise<void>
      finished?: Promise<unknown>
    }
  }

  // 路径一：View Transitions + Web Animations API（现代浏览器）
  if (typeof doc.startViewTransition === 'function') {
    if (running) {
      // 过渡中再次切换：排队，当前动画结束后自动执行
      pendingUpdate = update
      pendingOrigin = origin
      return
    }
    try {
      const o = origin ?? defaultOrigin()
      const w = window.innerWidth
      const h = window.innerHeight
      const r =
        Math.max(
          Math.hypot(o.x, o.y),
          Math.hypot(w - o.x, o.y),
          Math.hypot(o.x, h - o.y),
          Math.hypot(w - o.x, h - o.y),
        ) + 8

      running = true
      const t = doc.startViewTransition(update)
      t?.ready
        ?.then(() => {
          // VT 快照已捕获 "after" 状态后，再切换 color-scheme；
          // 此时浏览器原生控件重绘被圆形扩散遮罩覆盖，消除闪烁
          const isDark = document.documentElement.classList.contains('dark')
          document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'

          const animation = document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${o.x}px ${o.y}px)`,
                `circle(${Math.ceil(r)}px at ${o.x}px ${o.y}px)`,
              ],
            },
            {
              duration: 300,
              easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
              pseudoElement: '::view-transition-new(root)',
            },
          )
          return animation?.finished
        })
        .then(
          () => {
            running = false
            flushPending()
          },
          () => {
            running = false
            flushPending()
          },
        )

      t?.finished?.then(
        () => {
          running = false
          flushPending()
        },
        () => {
          running = false
          flushPending()
        },
      )
      // 超时兜底（异常路径下 running 必须能复位并处理排队）
      window.setTimeout(() => {
        if (running) {
          running = false
          flushPending()
        }
      }, 600)
      return
    } catch {
      running = false
      flushPending()
    }
  }

  // 路径二：不支持 VT / jsdom 环境下的高性能退化（直接同步执行）
  update()
}
