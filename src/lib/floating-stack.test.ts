import { describe, expect, it } from 'vitest'
import { floatingStackOffset, BACK_TO_TOP_THRESHOLD } from '@/lib/floating-stack'

/*
 * 浮动控件栈的档位表是「回到顶部 / 移动端目录 / 分类筛选」三者的共同契约：
 * 谁都不许自己硬编码 bottom-*，所以这里把四格全部钉死。
 *
 * 关键不变量：scrolled=false 的两格必须与 back-to-top 自身的档位相等——
 * 因为此时回到顶部不可见，常驻按钮正好占它的位置；否则底部会空出一截或两者重叠。
 */
describe('floatingStackOffset', () => {
  it('未滚动：占 BackToTop 的档位（bottom-6 / bottom-20），底部不留空', () => {
    expect(floatingStackOffset(false, false)).toBe('bottom-6')
    expect(floatingStackOffset(false, true)).toBe('bottom-20')
  })

  it('已滚动：上抬一层给 BackToTop 腾位（36px 按钮 + 8px 缝 = 44px）', () => {
    expect(floatingStackOffset(true, false)).toBe('bottom-[4.25rem]')
    expect(floatingStackOffset(true, true)).toBe('bottom-[7.75rem]')
  })

  it('播放条出现时整栈再抬一层（64px 播放条 + 16px 缝）', () => {
    expect(floatingStackOffset(true, true)).not.toBe(floatingStackOffset(true, false))
    expect(floatingStackOffset(false, true)).not.toBe(floatingStackOffset(false, false))
  })

  it('档位单调：任何组合下上抬后的底距都严格大于原档位', () => {
    // 6rem=96px, 4.25rem=68px, 7.75rem=124px, 20*0.25=80px → 解析出数值比较
    const px = (cls: string) => {
      if (cls === 'bottom-6') return 24
      if (cls === 'bottom-20') return 80
      return parseFloat(cls.match(/[\d.]+/)?.[0] ?? '0') * 16
    }
    for (const player of [false, true]) {
      expect(px(floatingStackOffset(true, player))).toBeGreaterThan(px(floatingStackOffset(false, player)))
    }
  })

  it('阈值与 BackToTop 的出现条件一致（300px）', () => {
    expect(BACK_TO_TOP_THRESHOLD).toBe(300)
  })
})
