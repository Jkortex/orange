// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { PageHeader } from '@/components/listing/page-header'

afterEach(() => {
  cleanup()
})

describe('PageHeader 正常渲染', () => {
  it('渲染标题与说明', () => {
    render(<PageHeader title="文章" description="分类即过滤器" />)
    expect(screen.getByRole('heading', { name: '文章' })).toBeTruthy()
    expect(screen.getByText('分类即过滤器')).toBeTruthy()
  })

  it('无说明时不渲染空段落', () => {
    render(<PageHeader title="技能" />)
    expect(screen.getByRole('heading', { name: '技能' })).toBeTruthy()
    expect(screen.queryByRole('paragraph')).toBeNull()
  })

  it('传入图标时由组件统一包裹徽章框', () => {
    const { container } = render(<PageHeader title="音乐" icon={<svg data-testid="icon" />} />)
    const badge = container.querySelector('[data-slot="page-header-icon"]')
    expect(badge).not.toBeNull()
    expect(badge?.querySelector('[data-testid="icon"]')).not.toBeNull()
  })

  it('无图标时不渲染徽章框', () => {
    const { container } = render(<PageHeader title="文章" />)
    expect(container.querySelector('[data-slot="page-header-icon"]')).toBeNull()
  })
})
