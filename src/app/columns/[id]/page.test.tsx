// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import ColumnDetailPage, { generateStaticParams, generateMetadata } from './page'
import { DISTRIBUTED_GO_COLUMN, getAllColumns } from '@/lib/column-data'

afterEach(() => {
  cleanup()
})

describe('ColumnDetailPage 专栏详情与路线图页', () => {
  it('generateStaticParams 返回所有专栏的 id', () => {
    const params = generateStaticParams()
    const expected = getAllColumns().map((c) => ({ id: c.id }))
    expect(params).toEqual(expected)
  })

  it('generateMetadata 正确生成专栏元信息', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ id: 'distributed-go' }) })
    expect(meta.title).toBe(DISTRIBUTED_GO_COLUMN.title)
    expect(meta.description).toBe(DISTRIBUTED_GO_COLUMN.description)
  })

  it('渲染专栏标题与说明', async () => {
    const el = await ColumnDetailPage({ params: Promise.resolve({ id: 'distributed-go' }) })
    render(el)

    expect(screen.getByRole('heading', { level: 1, name: DISTRIBUTED_GO_COLUMN.title })).toBeTruthy()
    expect(screen.getByText(DISTRIBUTED_GO_COLUMN.subtitle)).toBeTruthy()
  })

  it('渲染全部 17 篇章节链接且指向对应文章路径', async () => {
    const el = await ColumnDetailPage({ params: Promise.resolve({ id: 'distributed-go' }) })
    render(el)

    const allChapters = DISTRIBUTED_GO_COLUMN.phases.flatMap((p) => p.chapters)
    expect(allChapters).toHaveLength(17)

    for (const chapter of allChapters) {
      const link = screen.getByRole('link', { name: new RegExp(chapter.title.replace(/[()（）]/g, '\\$&')) })
      expect(link).toBeTruthy()
      expect(link.getAttribute('href')).toBe(`/posts/${chapter.slug}`)
    }
  })

  it('渲染 5 大阶段的进阶路线图', async () => {
    const el = await ColumnDetailPage({ params: Promise.resolve({ id: 'distributed-go' }) })
    render(el)

    for (const phase of DISTRIBUTED_GO_COLUMN.phases) {
      expect(screen.getByText(new RegExp(phase.name))).toBeTruthy()
      expect(screen.getByText(phase.description)).toBeTruthy()
    }
  })

  it('不存在的专栏 id 触发 notFound', async () => {
    await expect(
      ColumnDetailPage({ params: Promise.resolve({ id: 'non-existent-column' }) }),
    ).rejects.toThrow()
  })
})
