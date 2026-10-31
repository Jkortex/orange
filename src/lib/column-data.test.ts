import { describe, expect, it } from 'vitest'
import { hydrateColumn, type ColumnSource, type ChapterSourcePost } from './column-data'

const source: ColumnSource = {
  id: 'demo',
  title: '《Demo 实战》',
  subtitle: '副标题',
  badge: '精品专栏',
  status: 'completed',
  tags: ['Demo'],
  description: '专栏简介',
  focus: '示例',
  highlights: [{ title: '亮点', desc: '说明' }],
  titlePrefix: 'Demo 实战',
  phases: [
    {
      name: '阶段一：开篇',
      description: '阶段说明',
      chapters: [
        { order: 0, slug: 'demo-00-guide' },
        { order: 1, slug: 'demo-01-start' },
      ],
    },
  ],
}

function posts(): Map<string, ChapterSourcePost> {
  return new Map([
    [
      'demo-00-guide',
      {
        slug: 'demo-00-guide',
        data: {
          title: 'Demo 实战（导读）：开篇',
          description: '导读描述',
          tags: ['导读'],
          date: new Date('2026-01-01T00:00:00Z'),
          category: 'demo',
        },
      },
    ],
    [
      'demo-01-start',
      {
        slug: 'demo-01-start',
        data: {
          title: 'Demo 实战（一）：第二章',
          description: '第二章描述',
          tags: ['第二章'],
          date: new Date('2026-02-02T00:00:00Z'),
          category: 'demo',
        },
      },
    ],
  ])
}

describe('hydrateColumn 专栏元数据单一事实源', () => {
  it('章节标题、描述、标签、阶段与序号全部由 frontmatter 派生', () => {
    const col = hydrateColumn(source, posts())

    expect(col.phases[0].chapters[0]).toEqual({
      order: 0,
      chapterNumber: '导读',
      slug: 'demo-00-guide',
      title: '开篇',
      description: '导读描述',
      phase: '阶段一：开篇',
      tags: ['导读'],
    })
    expect(col.phases[0].chapters[1]).toMatchObject({
      order: 1,
      chapterNumber: '第 01 篇',
      title: '第二章',
      description: '第二章描述',
      tags: ['第二章'],
    })
  })

  it('篇数、更新日期、状态文案与分类由章节内容派生', () => {
    const col = hydrateColumn(source, posts())

    expect(col.totalArticles).toBe(2)
    expect(col.updatedAt).toBe('2026-02-02')
    expect(col.statusText).toBe('2 篇已完结')
    expect(col.category).toBe('demo')
  })

  it('章节 slug 缺失时构建期直接失败', () => {
    const missing = posts()
    missing.delete('demo-01-start')

    expect(() => hydrateColumn(source, missing)).toThrow(/demo-01-start/)
  })

  it('同一专栏章节分类不一致时构建期直接失败', () => {
    const mixed = posts()
    const second = mixed.get('demo-01-start')!
    second.data.category = 'other'

    expect(() => hydrateColumn(source, mixed)).toThrow(/category/)
  })
})
