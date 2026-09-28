// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PhotoGallery } from '@/components/listing/photo-gallery'

afterEach(() => {
  cleanup()
})

const photos = ['/media/life/a.svg', '/media/life/b.svg', '/media/life/c.svg']

describe('PhotoGallery 空数据', () => {
  it('没有照片时不渲染任何内容', () => {
    const { container } = render(<PhotoGallery photos={[]} alt="雨天" />)

    expect(container.firstChild).toBeNull()
  })
})

describe('PhotoGallery 单图', () => {
  it('prose 变体：整宽大图 + 悬停放大提示', () => {
    const { container } = render(<PhotoGallery photos={[photos[0]]} alt="雨天" />)

    expect(container.querySelector('.max-h-\\[30rem\\]')).toBeTruthy()
    expect(screen.getByText('点击查看大图')).toBeTruthy()
  })

  it('点击打开灯箱并定位到该图', () => {
    render(<PhotoGallery photos={[photos[0]]} alt="雨天" />)

    fireEvent.click(screen.getByRole('button', { name: '查看大图：雨天' }))

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByAltText('雨天 - 1/1')).toBeTruthy()
  })
})

describe('PhotoGallery 多图', () => {
  it('每张图都是可聚焦按钮并带序号（不是只有 onClick 的 div）', () => {
    render(<PhotoGallery photos={photos} alt="雨天" />)

    expect(screen.getByRole('button', { name: '查看大图：雨天（1）' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '查看大图：雨天（2）' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '查看大图：雨天（3）' })).toBeTruthy()
    expect(screen.getByLabelText('查看大图：雨天（2）').tagName).toBe('BUTTON')
  })

  it('点击第 2 张时灯箱直接定位到第 2 张', () => {
    render(<PhotoGallery photos={photos} alt="雨天" />)

    fireEvent.click(screen.getByRole('button', { name: '查看大图：雨天（2）' }))

    const img = screen.getByAltText('雨天 - 2/3') as HTMLImageElement
    expect(img.getAttribute('src')).toBe(photos[1])
  })

  it('2 张或 4 张用两列，其余三列', () => {
    const two = render(<PhotoGallery photos={photos.slice(0, 2)} alt="雨天" />)
    expect(two.container.querySelector('.grid-cols-2')).toBeTruthy()
    cleanup()

    const three = render(<PhotoGallery photos={photos} alt="雨天" />)
    expect(three.container.querySelector('.sm\\:grid-cols-3')).toBeTruthy()
  })
})

describe('PhotoGallery 变体差异', () => {
  it('card 变体是窄网格，不出现 prose 的整宽大图与提示文案', () => {
    const { container } = render(
      <PhotoGallery photos={photos} alt="雨天" variant="card" />,
    )

    expect(container.querySelector('.max-w-md')).toBeTruthy()
    expect(container.querySelector('.max-h-\\[30rem\\]')).toBeNull()
    expect(screen.queryByText('点击查看大图')).toBeNull()
  })

  it('card 变体同样能打开灯箱', () => {
    render(<PhotoGallery photos={photos} alt="雨天" variant="card" />)

    fireEvent.click(screen.getByRole('button', { name: '查看大图：雨天（1）' }))

    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})
