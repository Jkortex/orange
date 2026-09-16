/*
 * 主题切换过渡（ui-ux.md §3.5 动效克制：仅状态过渡类微动效）：
 * - 优先 View Transitions + Web Animations API (WAAPI) 圆形扩散：
 *   新页以触发按钮为圆心、clip-path circle 从 0 展开至全屏，由合成器（Compositor）直接加速；
 *   显式隔离混合模式（mix-blend-mode: normal），消除重影泛白与加色白边。
 * - 不支持 View Transitions 的环境瞬时同步生效，彻底避免全量 DOM 扫描与同步重排性能损耗。
 * - prefers-reduced-motion / 无真实绘制环境（jsdom）直接同步切换。
 * - update() 始终同步执行（VT 回调内 / 直接调用），测试断言不受影响。
 */

export type ThemeTransitionOrigin = { x: number; y: number }

// 互斥：上一次过渡未完成时新的切换直接同步生效，避免两次快照交接撞车闪动
let running = false

function finishAfter(ms: number) {
  window.setTimeout(() => {
    running = false
  }, ms)
}

function defaultOrigin(): ThemeTransitionOrigin {
  if (typeof window === 'undefined') return { x: 0, y: 0 }
  // 右上角：顶栏切换按钮方位
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

  // 路径一：View Transitions + Web Animations API（现代浏览器）
  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => {
      ready?: Promise<void>
      finished?: Promise<unknown>
    }
  }
  if (!running && typeof doc.startViewTransition === 'function') {
    try {
      const o = origin ?? defaultOrigin()
      const w = window.innerWidth
      const h = window.innerHeight
      // 精确半径 = 圆心到最远角 + 冗余
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
          const animation = document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${o.x}px ${o.y}px)`,
                `circle(${Math.ceil(r)}px at ${o.x}px ${o.y}px)`,
              ],
            },
            {
              duration: 380,
              easing: 'ease-out',
              pseudoElement: '::view-transition-new(root)',
            },
          )
          return animation?.finished
        })
        .then(
          () => {
            running = false
          },
          () => {
            running = false
          },
        )

      // finished 释放 + 超时兜底（异常路径下 running 必须能复位）
      t?.finished?.then(
        () => {
          running = false
        },
        () => {
          running = false
        },
      )
      finishAfter(600)
      return
    } catch {
      running = false
      // 掉入退化路径
    }
  }
  if (running) {
    // 过渡中再次切换：直接同步生效，不开第二场过渡
    update()
    return
  }

  // 路径二：不支持 VT / jsdom 环境下的高性能退化（直接同步执行，零主线程重排开销）
  update()
}
