/*
 * 主题切换过渡（ui-ux.md §3.5 动效克制：仅状态过渡类微动效）：
 * - 优先 View Transitions 圆形扩散：旧页快照原位保留，新页以右上按钮为圆心、
 *   clip-path circle(0 → 150vmax) 展开约 500ms，全程文字内容可见（快照而非实色遮罩）
 * - 不支持 View Transitions 的浏览器退化为波形渐变：按元素到右上角距离写入
 *   --theme-delay（0～260ms 错开），颜色原地插值，方向依然是右上 → 左下
 * - prefers-reduced-motion / 无真实绘制环境（jsdom）直接同步切换
 * - update() 始终同步执行（VT 回调内 / 直接调用），测试断言不受影响
 */

export type ThemeTransitionOrigin = { x: number; y: number }

const SPREAD_MS = 260
const DURATION_MS = 380
const MAX_WAVE_NODES = 4000

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

  // 路径一：View Transitions 圆形扩散（现代浏览器）
  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => { finished?: Promise<unknown> }
  }
  if (!running && typeof doc.startViewTransition === 'function') {
    try {
      const o = origin ?? defaultOrigin()
      const root = document.documentElement
      root.style.setProperty('--theme-tx', `${o.x}px`)
      root.style.setProperty('--theme-ty', `${o.y}px`)
      // 精确半径 = 圆心到最远角 + 冗余，避免 150vmax 超大光栅收尾掉帧
      const w = window.innerWidth
      const h = window.innerHeight
      const r =
        Math.max(
          Math.hypot(o.x, o.y),
          Math.hypot(w - o.x, o.y),
          Math.hypot(o.x, h - o.y),
          Math.hypot(w - o.x, h - o.y),
        ) + 8
      root.style.setProperty('--theme-r', `${Math.ceil(r)}px`)
      running = true
      const t = doc.startViewTransition(update)
      // finished 释放 + 超时兜底（异常路径下 running 必须能复位）
      t?.finished?.then(
        () => {
          running = false
        },
        () => {
          running = false
        },
      )
      finishAfter(700)
      return
    } catch {
      running = false
      // 掉入波形退化路径
    }
  }
  if (running) {
    // 过渡中再次切换：直接同步生效，不开第二场过渡
    update()
    return
  }

  // 路径二：波形渐变退化（无 VT 的浏览器 / jsdom）
  const root = document.documentElement
  const body = document.body
  const els = body ? Array.from(body.querySelectorAll('*')) : []
  const useWave = els.length > 0 && els.length <= MAX_WAVE_NODES

  if (useWave) {
    const ox = window.innerWidth
    const oy = 0
    const maxD = Math.hypot(window.innerWidth || 1, window.innerHeight || 1)
    for (const el of els) {
      const htmlEl = el as HTMLElement
      const rect = htmlEl.getBoundingClientRect?.()
      let delay = 0
      if (rect) {
        const d = Math.hypot(ox - (rect.left + rect.width / 2), oy - (rect.top + rect.height / 2))
        delay = Math.round((Math.min(d, maxD) / maxD) * SPREAD_MS)
      }
      htmlEl.style.setProperty('--theme-delay', `${delay}ms`)
    }
  }

  root.classList.add('theme-transition')
  update()
  running = true
  window.setTimeout(
    () => {
      root.classList.remove('theme-transition')
      if (useWave) {
        for (const el of els) {
          ;(el as HTMLElement).style.removeProperty('--theme-delay')
        }
      }
      running = false
    },
    SPREAD_MS + DURATION_MS + 100,
  )
}
