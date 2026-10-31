// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import ColumnDetailPage, { generateStaticParams, generateMetadata } from './page'
import { getAllColumns, getColumn } from '@/lib/column-data'

const DISTRIBUTED_GO_COLUMN = getColumn('distributed-go')!
const AI_DDD_COLUMN = getColumn('ai-ddd')!
const RUST_SYSTEMS_COLUMN = getColumn('rust-systems-engineering')!
const DATA_INTENSIVE_COLUMN = getColumn('data-intensive-systems')!

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

describe('ColumnDetailPage AI 增强的领域驱动设计专栏', () => {
  it('generateMetadata 正确生成新专栏元信息', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ id: 'ai-ddd' }) })
    expect(meta.title).toBe(AI_DDD_COLUMN.title)
    expect(meta.description).toBe(AI_DDD_COLUMN.description)
  })

  it('渲染全部 12 篇章节链接且指向对应文章路径', async () => {
    const el = await ColumnDetailPage({ params: Promise.resolve({ id: 'ai-ddd' }) })
    render(el)

    const allChapters = AI_DDD_COLUMN.phases.flatMap((p) => p.chapters)
    expect(allChapters).toHaveLength(12)
    expect(AI_DDD_COLUMN.totalArticles).toBe(12)

    for (const chapter of allChapters) {
      const link = screen.getByRole('link', { name: new RegExp(chapter.title.replace(/[()（）]/g, '\\$&')) })
      expect(link.getAttribute('href')).toBe(`/posts/${chapter.slug}`)
    }
  })

  it('渲染 3 大阶段的进阶路线图与专栏定位标签', async () => {
    const el = await ColumnDetailPage({ params: Promise.resolve({ id: 'ai-ddd' }) })
    render(el)

    for (const phase of AI_DDD_COLUMN.phases) {
      expect(screen.getByText(new RegExp(phase.name))).toBeTruthy()
      expect(screen.getByText(phase.description)).toBeTruthy()
    }
    expect(screen.getByText(AI_DDD_COLUMN.focus!)).toBeTruthy()
  })
})

describe('ColumnDetailPage Rust 现代系统级工程实战专栏', () => {
  it('generateMetadata 正确生成 Rust 专栏元信息', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ id: 'rust-systems-engineering' }) })
    expect(meta.title).toBe(RUST_SYSTEMS_COLUMN.title)
    expect(meta.description).toBe(RUST_SYSTEMS_COLUMN.description)
  })

  it('渲染全部 25 篇章节链接且指向对应文章路径', async () => {
    const el = await ColumnDetailPage({ params: Promise.resolve({ id: 'rust-systems-engineering' }) })
    const { container } = render(el)

    const allChapters = RUST_SYSTEMS_COLUMN.phases.flatMap((p) => p.chapters)
    expect(allChapters).toHaveLength(25)
    expect(RUST_SYSTEMS_COLUMN.totalArticles).toBe(25)

    for (const chapter of allChapters) {
      const link = container.querySelector(`a[href="/posts/${chapter.slug}"]`)
      expect(link).toBeTruthy()
      expect(link?.textContent).toContain(chapter.title)
    }
  }, 15000)

  it('渲染 4 大阶段的进阶路线图与专栏定位标签', async () => {
    const el = await ColumnDetailPage({ params: Promise.resolve({ id: 'rust-systems-engineering' }) })
    render(el)

    for (const phase of RUST_SYSTEMS_COLUMN.phases) {
      expect(screen.getByText(new RegExp(phase.name))).toBeTruthy()
      expect(screen.getByText(phase.description)).toBeTruthy()
    }
    expect(screen.getAllByText(RUST_SYSTEMS_COLUMN.focus!).length).toBeGreaterThan(0)
  })
})

describe('ColumnDetailPage 数据密集型系统架构实战专栏', () => {
  it('generateMetadata 正确生成 DDIA 专栏元信息', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ id: 'data-intensive-systems' }) })
    expect(meta.title).toBe(DATA_INTENSIVE_COLUMN.title)
    expect(meta.description).toBe(DATA_INTENSIVE_COLUMN.description)
  })

  it('渲染全部 15 篇章节链接且指向对应文章路径', async () => {
    const el = await ColumnDetailPage({ params: Promise.resolve({ id: 'data-intensive-systems' }) })
    const { container } = render(el)

    const allChapters = DATA_INTENSIVE_COLUMN.phases.flatMap((p) => p.chapters)
    expect(allChapters).toHaveLength(15)
    expect(DATA_INTENSIVE_COLUMN.totalArticles).toBe(15)

    for (const chapter of allChapters) {
      const link = container.querySelector(`a[href="/posts/${chapter.slug}"]`)
      expect(link).toBeTruthy()
      expect(link?.textContent).toContain(chapter.title)
    }
  }, 15000)

  it('渲染 3 大阶段的进阶路线图与专栏定位标签', async () => {
    const el = await ColumnDetailPage({ params: Promise.resolve({ id: 'data-intensive-systems' }) })
    render(el)

    for (const phase of DATA_INTENSIVE_COLUMN.phases) {
      expect(screen.getByText(new RegExp(phase.name))).toBeTruthy()
      expect(screen.getByText(phase.description)).toBeTruthy()
    }
    expect(screen.getAllByText(DATA_INTENSIVE_COLUMN.focus!).length).toBeGreaterThan(0)
  })
})
