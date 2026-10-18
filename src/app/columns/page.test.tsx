// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import ColumnsPage from './page'
import { DISTRIBUTED_GO_COLUMN } from '@/lib/column-data'

afterEach(() => {
  cleanup()
})

describe('ColumnsPage 专栏页', () => {
  it('渲染专栏标题与说明', () => {
    render(<ColumnsPage />)

    expect(screen.getByRole('heading', { level: 1, name: '专栏' })).toBeTruthy()
    expect(screen.getByText(DISTRIBUTED_GO_COLUMN.title)).toBeTruthy()
    expect(screen.getByText(DISTRIBUTED_GO_COLUMN.subtitle)).toBeTruthy()
  })

  it('渲染全部 17 篇章节链接且指向对应文章路径', () => {
    render(<ColumnsPage />)

    const allChapters = DISTRIBUTED_GO_COLUMN.phases.flatMap((p) => p.chapters)
    expect(allChapters).toHaveLength(17)

    for (const chapter of allChapters) {
      const link = screen.getByRole('link', { name: new RegExp(chapter.title.replace(/[()（）]/g, '\\$&')) })
      expect(link).toBeTruthy()
      expect(link.getAttribute('href')).toBe(`/posts/${chapter.slug}`)
    }
  })

  it('渲染 5 大阶段的进阶路线图', () => {
    render(<ColumnsPage />)

    for (const phase of DISTRIBUTED_GO_COLUMN.phases) {
      expect(screen.getByText(new RegExp(phase.name))).toBeTruthy()
      expect(screen.getByText(phase.description)).toBeTruthy()
    }
  })
})
