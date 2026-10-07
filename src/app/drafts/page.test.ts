import { describe, expect, it } from 'vitest'
import DraftsPage from './page'

/*
 * 草稿索引页的生产守卫：草稿仅在本地开发可见。
 * Vitest 下 NODE_ENV === 'test'（非 development），故 isDraftsEnabled() 为 false，
 * 页面须直接 notFound()（抛错），绝不渲染任何草稿内容。
 */
describe('草稿索引页生产守卫', () => {
  it('非开发环境（测试即非 dev）直接 notFound', () => {
    expect(() => DraftsPage()).toThrow()
  })
})
