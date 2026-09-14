import { describe, expect, it } from 'vitest'
import { estimateReadingTime, formatDate, formatTime } from './format'

describe('formatDate', () => {
  it('统一输出 YYYY-MM-DD', () => {
    expect(formatDate(new Date('2026-09-05'))).toBe('2026-09-05')
    expect(formatDate(new Date('2026-01-02'))).toBe('2026-01-02')
  })
})

describe('formatTime 播放时长', () => {
  it('秒 → m:ss', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(65)).toBe('1:05')
    expect(formatTime(180)).toBe('3:00')
    expect(formatTime(61.7)).toBe('1:01')
  })
})

describe('formatTime 异常边界', () => {
  it('时长未知（NaN/无限/负数）显示 --:--，不编造数字', () => {
    expect(formatTime(NaN)).toBe('--:--')
    expect(formatTime(Infinity)).toBe('--:--')
    expect(formatTime(-5)).toBe('--:--')
  })
})

describe('estimateReadingTime', () => {
  it('正确估算中文与英文混合文本的字数与用时', () => {
    const text = '这是测试内容，包含若干中文汉字。'
    const res = estimateReadingTime(text)
    expect(res.words).toBeGreaterThan(10)
    expect(res.minutes).toBe(1)
  })

  it('长文本正确递增分钟数', () => {
    const longText = '汉字 '.repeat(400)
    const res = estimateReadingTime(longText)
    expect(res.minutes).toBeGreaterThanOrEqual(2)
  })
})
