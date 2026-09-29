import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderServerComponent } from '@/components/test-utils/render-server'
import NotFound from './not-found'

/*
 * 404 是唯一一个「已经坏了」的页面：没有自定义页时，静态导出会用框架默认页，
 * 那段内联样式写死 #000/#fff 会盖掉站点主题，文案还是英文。
 * 这里守住自定义页的内容与出口；主题是否被写死颜色污染由 no-hardcoded-colors.test.ts 统一兜底。
 */
describe('404 页面', () => {
  it('用中文说明并提供搜索与返回两个出口', async () => {
    const html = await renderServerComponent(h(NotFound))

    expect(html).toContain('页面不存在')
    expect(html).toContain('可能已经移动或被删掉')
    expect(html).toContain('Ctrl/Cmd+K')
    expect(html).toContain('文章列表')
    expect(html).toContain('href="/"')
  })

  it('宽度归页面自己管（默认 max-w-2xl），不继承 chrome 的满宽', async () => {
    const html = await renderServerComponent(h(NotFound))

    expect(html).toMatch(/<section[^>]*class="[^"]*max-w-2xl[^"]*"/)
  })
})
