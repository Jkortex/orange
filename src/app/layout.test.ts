import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/*
 * 守卫：草稿浮动入口必须挂在 dev 守卫之下，且全站仅此一处入口。
 * 若守卫被去掉或放宽，生产站点会出现通往 /drafts 的入口——虽然草稿内容仍读不到，但不应暴露该入口。
 * 用正则钉住「NODE_ENV === 'development' &&」与图标紧邻：改成 !== 'production' 之类的宽松判断也会失配。
 */
describe('layout 草稿入口守卫', () => {
  const source = readFileSync('src/app/layout.tsx', 'utf8')

  it('浮动入口被 NODE_ENV === development 守卫直接包裹', () => {
    expect(source).toMatch(
      /process\.env\.NODE_ENV\s*===\s*['"]development['"]\s*&&\s*<DraftFloatingButton\b/,
    )
  })

  it('全站仅此一处草稿入口（不留未加守卫的第二入口）', () => {
    expect(source.match(/<DraftFloatingButton\b/g)).toHaveLength(1)
  })
})
