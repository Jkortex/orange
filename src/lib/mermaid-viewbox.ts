/*
 * beautiful-mermaid 生成的 SVG，viewBox 不是以内容为中心的 —— 实测两例：
 *
 * - `graph TD`：viewBox `0 0 626.566 1156.04`，内容 bbox 四边边距都是 40 → 本来就居中
 * - `sequenceDiagram`：viewBox `0 0 720.64 510`，内容 bbox 左边距 51.53、其余三边 30
 *   → 内容整体偏右 10.77 用户单位，桌面浮层里合 15.3px（约容器宽的 1.5%）
 *
 * 后者在正文里只是「图看着没对齐」，一旦进了放大浮层就很显眼：浮层把 SVG 拉满画布，
 * 那 1.5% 被同样放大，图明显右偏。上游 RenderOptions 没有任何缩放/内边距/居中参数，
 * 所以只能等 SVG 进了浏览器、量出真实 bbox 之后自己把 viewBox 收紧回中心。
 *
 * 为什么是「收紧到最小边距」而不是「裁到 bbox」：defs 里还留着不可见的箭头 marker
 * （x 0、宽 8）和时序图角色的小人路径（x 3），裁到 bbox 会把它们切掉。取四边边距的最小值
 * 既能保证四边等距，又完整保留了上游自己留的余量。
 *
 * 纯函数与 DOM 胶水分开：前者可单测，后者只负责读写属性，出错一律静默放弃 ——
 * 这只是视觉微调，任何异常都不该让图表整个挂掉。
 */

export interface ViewBox {
  minX: number
  minY: number
  width: number
  height: number
}

/** getBBox() 的返回值里我们真正关心的部分（DOMRect 自带一堆其它字段） */
export interface Box {
  x: number
  y: number
  width: number
  height: number
}

/** 四边边距的最大差值小于这个数（用户单位）就当作已经居中 —— 亚像素级的不对称看不出来 */
export const SYMMETRY_TOLERANCE = 0.5

/**
 * 解析 viewBox 属性。只认「恰好四个有限数、宽高为正」，其余一律 null：
 * 拿到半个 viewBox 比拿不到更糟，写回去就是一张彻底画不出来的图。
 */
export function parseViewBox(raw: string | null | undefined): ViewBox | null {
  if (!raw) return null

  // SVG 允许逗号或任意空白（含换行）分隔，两种都认
  const parts = raw.trim().split(/[\s,]+/)
  if (parts.length !== 4) return null

  const [minX, minY, width, height] = parts.map(Number)
  if (![minX, minY, width, height].every(Number.isFinite)) return null
  if (width <= 0 || height <= 0) return null

  return { minX, minY, width, height }
}

/** 收敛到 0.01 用户单位：上游 SVG 的输出精度本来就只有两位，更细的差值既写不出也无意义 */
function round2(value: number): number {
  const rounded = Math.round(value * 100) / 100
  // 把 -0 归一成 0，免得属性里出现 "-0"
  return rounded === 0 ? 0 : rounded
}

/**
 * 求以内容为中心、四边等距的新 viewBox；本来就已经居中则返回 null。
 *
 * 新边距取四边现有边距的**最小值**（而不是固定值），这样上游自己留的留白原样保留，
 * 我们只是把多出来的那侧收掉。
 *
 * 返回 null 的三种情况都是「不动」：已经居中（差值在 tolerance 内）、内容已溢出 viewBox、
 * 内容或 viewBox 数据不可用（空盒、NaN）。溢出时中心化救不了它，硬缩只会裁内容。
 */
export function centerViewBoxOnContent(
  viewBox: ViewBox,
  content: Box,
  tolerance = SYMMETRY_TOLERANCE,
): ViewBox | null {
  if (![content.x, content.y, content.width, content.height].every(Number.isFinite)) return null
  if (content.width <= 0 || content.height <= 0) return null

  const pads = [
    content.x - viewBox.minX, // 左
    content.y - viewBox.minY, // 上
    viewBox.minX + viewBox.width - (content.x + content.width), // 右
    viewBox.minY + viewBox.height - (content.y + content.height), // 下
  ]

  const pad = Math.min(...pads)
  if (pad < 0) return null
  if (Math.max(...pads) - pad <= tolerance) return null

  return {
    minX: round2(content.x - pad),
    minY: round2(content.y - pad),
    width: round2(content.width + pad * 2),
    height: round2(content.height + pad * 2),
  }
}

/**
 * DOM 胶水：就地量出 bbox 并把根元素的 viewBox 收紧回中心。
 *
 * 必须在浏览器里跑 —— getBBox() 要真实布局，jsdom 没实现（会抛），
 * 这也是它不能放进 markdown 构建期管线的原因。
 */
export function centerSvgViewBox(svg: SVGSVGElement): void {
  const current = parseViewBox(svg.getAttribute('viewBox'))
  if (!current) return

  let box: Box
  try {
    const rect = svg.getBBox()
    box = { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  } catch {
    // 未布局、已脱离文档、或环境没实现 —— 都不是错误，放弃校正即可
    return
  }

  const next = centerViewBoxOnContent(current, box)
  if (!next) return

  svg.setAttribute('viewBox', `${next.minX} ${next.minY} ${next.width} ${next.height}`)
}
