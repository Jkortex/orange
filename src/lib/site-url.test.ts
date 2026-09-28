import { describe, expect, it } from 'vitest'
import { getSiteUrl, joinSiteUrl } from '@/lib/site-url'

describe('site URL', () => {
  it('去除配置值末尾斜杠并保留站点根路径', () => {
    expect(getSiteUrl('https://orange.example.com///')).toBe('https://orange.example.com')
    expect(joinSiteUrl('https://orange.example.com/', '/posts')).toBe(
      'https://orange.example.com/posts',
    )
  })

  it('拒绝非 HTTP(S) 地址，避免生成不可部署的 SEO 产物', () => {
    expect(() => getSiteUrl('javascript:alert(1)')).toThrowError(/HTTP\(S\)/)
  })
})
