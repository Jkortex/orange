// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { DetailHeader } from '@/components/listing/detail-header'

afterEach(() => {
  cleanup()
})

describe('DetailHeader 正常渲染', () => {
  it('渲染返回链接、标题、元信息与标签', () => {
    render(
      <DetailHeader
        backHref="/posts"
        backLabel="文章列表"
        title="标题"
        meta={<time dateTime="2026-09-01">2026-09-01</time>}
        tags={['红', '绿']}
      />,
    )
    expect(screen.getByRole('link', { name: /文章列表/ })).toHaveProperty('href', expect.stringContaining('/posts'))
    expect(screen.getByRole('heading', { name: '标题' })).toBeTruthy()
    expect(screen.getByText('2026-09-01')).toBeTruthy()
    expect(screen.getByRole('link', { name: '#红' }).getAttribute('href')).toBe('/tags/红')
  })

  it('divided 下渲染右侧操作与底部分隔', () => {
    render(
      <DetailHeader backHref="/" backLabel="首页" title="包" divided actions={<button type="button">下载</button>} />,
    )
    expect(screen.getByRole('button', { name: '下载' })).toBeTruthy()
  })
})

describe('DetailHeader 异常渲染', () => {
  it('无标签无描述时不渲染空容器', () => {
    const { container } = render(<DetailHeader backHref="/" backLabel="首页" title="包" />)
    expect(container.querySelector('header')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /#/ })).toBeNull()
  })
})
