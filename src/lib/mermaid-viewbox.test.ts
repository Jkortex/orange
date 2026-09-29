// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  centerSvgViewBox,
  centerViewBoxOnContent,
  parseViewBox,
  type Box,
  type ViewBox,
} from '@/lib/mermaid-viewbox'

/*
 * 这组用例里的两串数字是**实测值**，不是编的：
 * 它们来自 beautiful-mermaid 生成的真实 SVG（repro 脚本量过 getBBox），
 * 一个对称、一个不对称，正好覆盖「该动」与「不该动」两侧。
 */
/** graph TD 案例：四边内边距都是 40，本来就居中 */
const symmetric: { viewBox: ViewBox; content: Box } = {
  viewBox: { minX: 0, minY: 0, width: 626.566, height: 1156.04 },
  content: { x: 40, y: 40, width: 546.57, height: 1076.04 },
}
/** sequenceDiagram 案例：左边距 51.53，其余三边 30 —— 内容整体偏右 10.77 用户单位 */
const asymmetric: { viewBox: ViewBox; content: Box } = {
  viewBox: { minX: 0, minY: 0, width: 720.64, height: 510 },
  content: { x: 51.53, y: 30, width: 639.11, height: 450 },
}

const center = (box: Box | ViewBox) => {
  const x = 'x' in box ? box.x : box.minX
  const y = 'y' in box ? box.y : box.minY
  return { x: x + box.width / 2, y: y + box.height / 2 }
}

describe('parseViewBox', () => {
  it('解析空白分隔的四个数', () => {
    expect(parseViewBox('0 0 626.566 1156.04')).toEqual({
      minX: 0,
      minY: 0,
      width: 626.566,
      height: 1156.04,
    })
  })

  it('逗号分隔、混合分隔、多余空白、负数与小数都认', () => {
    expect(parseViewBox('0,0,720.64,510')).toEqual({
      minX: 0,
      minY: 0,
      width: 720.64,
      height: 510,
    })
    expect(parseViewBox('  10 , 20\t300\n200  ')).toEqual({
      minX: 10,
      minY: 20,
      width: 300,
      height: 200,
    })
    expect(parseViewBox('-5.5 -1.25 100 50')).toEqual({
      minX: -5.5,
      minY: -1.25,
      width: 100,
      height: 50,
    })
  })

  it('参数个数不对、含非数字、宽高非正数都返回 null', () => {
    expect(parseViewBox('0 0 100')).toBeNull()
    expect(parseViewBox('0 0 100 50 7')).toBeNull()
    expect(parseViewBox('0 0 auto 50')).toBeNull()
    expect(parseViewBox('0 0 NaN 50')).toBeNull()
    expect(parseViewBox('0 0 0 50')).toBeNull()
    expect(parseViewBox('0 0 100 0')).toBeNull()
    expect(parseViewBox('0 0 -100 50')).toBeNull()
  })

  it('空值返回 null（属性缺失或写成空串都不该抛）', () => {
    expect(parseViewBox(null)).toBeNull()
    expect(parseViewBox(undefined)).toBeNull()
    expect(parseViewBox('')).toBeNull()
    expect(parseViewBox('   ')).toBeNull()
  })
})

describe('centerViewBoxOnContent', () => {
  it('把不对称的 viewBox 收紧到以内容为中心，同时保留原有最小边距', () => {
    const next = centerViewBoxOnContent(asymmetric.viewBox, asymmetric.content)

    // 四边边距 51.53 / 30 / 30 / 30 → 取最小 30，所以 viewBox 恰好缩掉左侧多出的 21.53
    expect(next).not.toBeNull()
    expect(next?.minX).toBeCloseTo(21.53)
    expect(next?.minY).toBeCloseTo(0)
    expect(next?.width).toBeCloseTo(699.11)
    expect(next?.height).toBeCloseTo(510)
    // 结果会收敛到 0.01 用户单位，故这里只要求「肉眼等中心」，不要求位级相等
    expect(center(next!).x).toBeCloseTo(center(asymmetric.content).x, 1)
    expect(center(next!).y).toBeCloseTo(center(asymmetric.content).y, 1)
  })

  it('校正后 viewBox 仍然完整包住内容（只收边距，绝不裁内容）', () => {
    const next = centerViewBoxOnContent(asymmetric.viewBox, asymmetric.content)!

    expect(next.minX).toBeLessThanOrEqual(asymmetric.content.x)
    expect(next.minY).toBeLessThanOrEqual(asymmetric.content.y)
    expect(next.minX + next.width).toBeGreaterThanOrEqual(
      asymmetric.content.x + asymmetric.content.width,
    )
    expect(next.minY + next.height).toBeGreaterThanOrEqual(
      asymmetric.content.y + asymmetric.content.height,
    )
  })

  it('本来就对称时返回 null（不动，省掉一次无意义的重排）', () => {
    expect(centerViewBoxOnContent(symmetric.viewBox, symmetric.content)).toBeNull()
  })

  it('viewBox 原点非零时也按四边边距判断，而不是按绝对坐标', () => {
    expect(
      centerViewBoxOnContent(
        { minX: 10, minY: 20, width: 300, height: 200 },
        { x: 30, y: 40, width: 260, height: 160 },
      ),
    ).toBeNull()
  })

  it('容差内的轻微不对称不算不对称', () => {
    const viewBox = { minX: 0, minY: 0, width: 100, height: 100 }
    const content = { x: 20.2, y: 20, width: 60, height: 60 }

    expect(centerViewBoxOnContent(viewBox, content, 0.5)).toBeNull()
    expect(centerViewBoxOnContent(viewBox, content, 0.1)).not.toBeNull()
  })

  it('内容超出 viewBox 时返回 null —— 中心化救不了溢出，硬缩只会裁掉内容', () => {
    const viewBox = { minX: 0, minY: 0, width: 100, height: 100 }

    expect(centerViewBoxOnContent(viewBox, { x: -5, y: 10, width: 80, height: 80 })).toBeNull()
    expect(centerViewBoxOnContent(viewBox, { x: 10, y: 10, width: 95, height: 80 })).toBeNull()
  })

  it('空内容（宽或高为 0）与非有限值返回 null', () => {
    const viewBox = { minX: 0, minY: 0, width: 100, height: 100 }

    expect(centerViewBoxOnContent(viewBox, { x: 10, y: 10, width: 0, height: 80 })).toBeNull()
    expect(centerViewBoxOnContent(viewBox, { x: 10, y: 10, width: 80, height: 0 })).toBeNull()
    expect(
      centerViewBoxOnContent(viewBox, { x: Number.NaN, y: 10, width: 80, height: 80 }),
    ).toBeNull()
    expect(
      centerViewBoxOnContent(viewBox, { x: 10, y: 10, width: Number.POSITIVE_INFINITY, height: 80 }),
    ).toBeNull()
  })

  it('内容四边边距全为 0 时也返回 null（已经贴边，没有可收的余量）', () => {
    expect(
      centerViewBoxOnContent(
        { minX: 0, minY: 0, width: 80, height: 80 },
        { x: 0, y: 0, width: 80, height: 80 },
      ),
    ).toBeNull()
  })
})

/** 造一个真 SVG 根元素；jsdom 没有布局，getBBox 必须由用例自己补 */
function makeSvg(viewBox: string | null, bbox?: Box | (() => Box)) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  if (viewBox !== null) svg.setAttribute('viewBox', viewBox)
  if (bbox) {
    svg.getBBox = () => {
      if (typeof bbox === 'function') return bbox() as DOMRect
      return { ...bbox, top: bbox.y, right: bbox.x + bbox.width, bottom: bbox.y + bbox.height, left: bbox.x, toJSON: () => ({}) } as DOMRect
    }
  }
  return svg
}

describe('centerSvgViewBox（DOM 胶水）', () => {
  it('读 getBBox 改写 viewBox 属性', () => {
    const svg = makeSvg('0 0 720.64 510', asymmetric.content)

    centerSvgViewBox(svg)

    expect(svg.getAttribute('viewBox')).toBe('21.53 0 699.11 510')
  })

  it('已经对称时不写回（属性原样保留）', () => {
    const svg = makeSvg('0 0 626.566 1156.04', symmetric.content)

    centerSvgViewBox(svg)

    expect(svg.getAttribute('viewBox')).toBe('0 0 626.566 1156.04')
  })

  it('没有 viewBox 或 viewBox 非法时直接放弃，不写回半成品', () => {
    const withoutViewBox = makeSvg(null, asymmetric.content)
    centerSvgViewBox(withoutViewBox)
    expect(withoutViewBox.getAttribute('viewBox')).toBeNull()

    const brokenViewBox = makeSvg('0 0 auto', asymmetric.content)
    centerSvgViewBox(brokenViewBox)
    expect(brokenViewBox.getAttribute('viewBox')).toBe('0 0 auto')
  })

  it('getBBox 抛错或不存在都不崩（jsdom 里本来就没有实现）', () => {
    const throwing = makeSvg('0 0 720.64 510', () => {
      throw new Error('Not implemented')
    })
    expect(() => centerSvgViewBox(throwing)).not.toThrow()
    expect(throwing.getAttribute('viewBox')).toBe('0 0 720.64 510')

    const missing = makeSvg('0 0 720.64 510')
    expect(() => centerSvgViewBox(missing)).not.toThrow()
    expect(missing.getAttribute('viewBox')).toBe('0 0 720.64 510')
  })

  it('getBBox 返回空盒（未布局）时不写回', () => {
    const svg = makeSvg('0 0 720.64 510', { x: 0, y: 0, width: 0, height: 0 })

    centerSvgViewBox(svg)

    expect(svg.getAttribute('viewBox')).toBe('0 0 720.64 510')
  })
})
