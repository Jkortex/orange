import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderServerComponent } from '@/components/test-utils/render-server'
import { PagefindFilters } from '@/components/listing/pagefind-filters'

describe('PagefindFilters', () => {
  it('类型与分类各占一个过滤属性（Pagefind inline 过滤不可并列在同一列表）', async () => {
    const html = await renderServerComponent(
      h(PagefindFilters, { type: 'posts', category: 'css' }),
    )

    expect(html).toContain('data-pagefind-filter="type:posts"')
    expect(html).toContain('data-pagefind-filter="category:css"')
    // 不得用逗号把两个 inline 过滤塞进同一个属性
    expect(html).not.toContain('type:posts, category:css')
  })

  it('没有分类时只输出类型过滤', async () => {
    const html = await renderServerComponent(h(PagefindFilters, { type: 'life' }))

    expect(html).toContain('data-pagefind-filter="type:life"')
    expect(html).not.toContain('category:')
  })

  it('过滤元素不产出可见文本', async () => {
    const html = await renderServerComponent(
      h(PagefindFilters, { type: 'music', category: 'jazz' }),
    )

    expect(html.replace(/<[^>]*>/g, '')).toBe('')
  })
})

/* 新增内容类型时容易漏挂过滤元数据（漏了 = 该类型在范围搜索里直接消失） */
const DETAIL_VIEWS = [
  'components/listing/entry-view.tsx',
  'components/listing/skill-package-view.tsx',
  'app/music/[slug]/page.tsx',
]

describe('详情页过滤元数据覆盖', () => {
  it.each(DETAIL_VIEWS)('%s 渲染了 PagefindFilters', (relative) => {
    const source = readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8')
    expect(source).toContain('<PagefindFilters')
  })
})
