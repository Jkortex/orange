// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ImageLightbox } from '@/components/listing/image-lightbox'

afterEach(() => {
  cleanup()
})

describe('ImageLightbox 基于 Radix Dialog 的图片预览灯箱', () => {
  const photos = ['/media/life/photo1.svg', '/media/life/photo2.svg']

  it('关闭状态下不渲染图片', () => {
    render(
      <ImageLightbox
        photos={photos}
        open={false}
        onOpenChange={vi.fn()}
      />,
    )

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('打开状态下正常渲染当前图片和计数', () => {
    render(
      <ImageLightbox
        photos={photos}
        initialIndex={0}
        open={true}
        onOpenChange={vi.fn()}
        alt="日常随拍"
      />,
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()

    const img = screen.getByAltText('日常随拍 - 1/2') as HTMLImageElement
    expect(img).toBeTruthy()
    expect(img.getAttribute('src')).toBe('/media/life/photo1.svg')
  })

  it('多图时点击「下一张」切换图片', () => {
    render(
      <ImageLightbox
        photos={photos}
        initialIndex={0}
        open={true}
        onOpenChange={vi.fn()}
        alt="日常随拍"
      />,
    )

    const nextBtn = screen.getByLabelText('下一张图片')
    fireEvent.click(nextBtn)

    const img = screen.getByAltText('日常随拍 - 2/2') as HTMLImageElement
    expect(img).toBeTruthy()
    expect(img.getAttribute('src')).toBe('/media/life/photo2.svg')
  })

  it('多图时通过键盘 ArrowRight 键切换图片', () => {
    render(
      <ImageLightbox
        photos={photos}
        initialIndex={0}
        open={true}
        onOpenChange={vi.fn()}
        alt="日常随拍"
      />,
    )

    fireEvent.keyDown(window, { key: 'ArrowRight' })

    const img = screen.getByAltText('日常随拍 - 2/2') as HTMLImageElement
    expect(img).toBeTruthy()
    expect(img.getAttribute('src')).toBe('/media/life/photo2.svg')
  })
})
