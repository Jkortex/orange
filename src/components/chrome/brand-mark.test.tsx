import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { renderServerComponent } from '@/components/test-utils/render-server'
import { BrandMark } from '@/components/chrome/brand-mark'

describe('BrandMark 品牌标', () => {
  it('渲染为装饰性 SVG（aria-hidden，随 className 定尺寸/颜色）', async () => {
    const html = await renderServerComponent(<BrandMark className="size-4 text-primary" />)
    expect(html).toContain('<svg')
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('size-4')
    // 单色：图形只用 currentColor，不写死颜色（AGENTS.md 主题规范第 1 条）
    expect(html).toContain('currentColor')
  })
})

/*
 * 品牌与字体接线守卫：站点标识只有一处（BrandMark / icon.svg），
 * 且 UI 字体不再回落到 Geist Sans（Vercel 默认观感）。
 */
describe('品牌与字体接线守卫', () => {
  const layout = readFileSync(fileURLToPath(new URL('../../app/layout.tsx', import.meta.url)), 'utf8')
  const css = readFileSync(fileURLToPath(new URL('../../app/globals.css', import.meta.url)), 'utf8')
  const icon = readFileSync(fileURLToPath(new URL('../../app/icon.svg', import.meta.url)), 'utf8')

  it('站点图标与品牌标同形（环 + 叶）', () => {
    expect(icon).toContain('<circle')
    expect(icon).toContain('M19 9.2')
  })

  it('layout 用 BrandMark 作品牌标，不再用 lucide Citrus', () => {
    expect(layout).toContain('BrandMark')
    expect(layout).not.toContain('Citrus')
  })

  it('layout 不再引入 Geist Sans', () => {
    expect(layout).not.toContain('geist/font/sans')
    expect(layout).not.toContain('GeistSans')
  })

  it('--font-sans 以 HarmonyOS 打头，不含 geist-sans', () => {
    const line = css.match(/--font-sans:[^;]+;/)?.[0] ?? ''
    expect(line).toContain('"HarmonyOS Sans SC"')
    expect(line).not.toContain('font-geist-sans')
  })
})
