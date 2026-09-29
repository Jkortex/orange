import { describe, expect, it } from 'vitest'
import { countByCategory } from '@/lib/categories'

describe('countByCategory', () => {
  it('聚合条数并按名称排序，无分类条目跳过', () => {
    const items = [
      { category: 'css' },
      { category: 'meta' },
      { category: 'css' },
      {},
    ]
    expect(countByCategory(items, (item) => item.category)).toEqual([
      { name: 'css', count: 2 },
      { name: 'meta', count: 1 },
    ])
  })

  it('空集合返回空数组', () => {
    expect(countByCategory<{ category?: string }>([], (item) => item.category)).toEqual([])
  })

  it('按码位排序，与服务端 getCategories 同序（中文/大小写混排也不走拼音序）', () => {
    // localeCompare 会走 ICU 排序（中文按拼音），与服务端 compareText 的码位序不同，
    // 静态导出时 HTML 在构建环境烤死、客户端按访客 locale 水合 → 分类列表顺序错位
    const items = [
      { category: '架构' },
      { category: 'CSS' },
      { category: '数据库' },
      { category: '工作流' },
    ]
    expect(countByCategory(items, (item) => item.category)).toEqual([
      // 码位：'C'(0x43) < '工'(0x5DE5) < '数'(0x6570) < '架'(0x67B6)
      { name: 'CSS', count: 1 },
      { name: '工作流', count: 1 },
      { name: '数据库', count: 1 },
      { name: '架构', count: 1 },
    ])
  })

  it('排序结果不随运行环境的 localeCompare 实现变化', () => {
    const items = [{ category: 'css' }, { category: '架构' }, { category: 'workflow' }]
    const expected = countByCategory(items, (item) => item.category)

    const original = String.prototype.localeCompare
    // 换成「敌意」实现：任何用到 localeCompare 的排序都会立刻乱序
    String.prototype.localeCompare = function () {
      return 1
    }
    try {
      expect(countByCategory(items, (item) => item.category)).toEqual(expected)
    } finally {
      String.prototype.localeCompare = original
    }
  })
})
