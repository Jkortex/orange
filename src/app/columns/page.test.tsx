// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import ColumnsPage from './page'
import { ALL_COLUMNS, PLANNED_COLUMNS } from '@/lib/column-data'

afterEach(() => {
  cleanup()
})

describe('ColumnsPage 专栏中心', () => {
  it('渲染专栏中心标题与说明', () => {
    render(<ColumnsPage />)

    expect(screen.getByRole('heading', { level: 1, name: '专栏中心' })).toBeTruthy()
    expect(screen.getByText('精选实战专栏')).toBeTruthy()
  })

  it('渲染所有已发布的专栏卡片及其跳转入口', () => {
    render(<ColumnsPage />)

    for (const col of ALL_COLUMNS) {
      expect(screen.getByText(col.title)).toBeTruthy()
      expect(screen.getByText(col.subtitle)).toBeTruthy()
      const link = screen.getByRole('link', { name: col.title })
      expect(link.getAttribute('href')).toBe(`/columns/${col.id}`)
    }
  })

  it('按专栏渲染定位标签', () => {
    render(<ColumnsPage />)

    for (const col of ALL_COLUMNS) {
      expect(screen.getByText(col.focus ?? '全栈实践')).toBeTruthy()
    }
  })

  it('渲染筹备规划中专栏板块', () => {
    render(<ColumnsPage />)

    expect(screen.getByText('更多专栏筹备中')).toBeTruthy()
    for (const p of PLANNED_COLUMNS) {
      expect(screen.getByText(p.title)).toBeTruthy()
      expect(screen.getByText(p.description)).toBeTruthy()
    }
  })
})
