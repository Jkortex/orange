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

  /*
   * 圆点本体只有 6px 高，直接当按钮在触屏上点不中。
   * 按钮只管尺寸与命中（h-9 = 36px），视觉交给内层 span。
   */
  it('分页圆点按钮的命中区是 36px，圆点本体仍是 6px 的小色块', () => {
    render(
      <ImageLightbox
        photos={photos}
        initialIndex={0}
        open={true}
        onOpenChange={vi.fn()}
        alt="日常随拍"
      />,
    )

    const dot = screen.getByRole('button', { name: '切换到第 2 张图片' })
    expect(dot.className).toContain('h-9')

    const visual = dot.firstElementChild as HTMLElement
    expect(visual.className).toContain('h-1.5')
  })

  it('点击分页圆点切到对应图片', () => {
    render(
      <ImageLightbox
        photos={photos}
        initialIndex={0}
        open={true}
        onOpenChange={vi.fn()}
        alt="日常随拍"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '切换到第 2 张图片' }))

    const img = screen.getByAltText('日常随拍 - 2/2') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('/media/life/photo2.svg')
  })

  /*
   * DialogContent 自带的关闭钮没有内边距、图标只有 16px，触屏上按不中，
   * 故整颗换成自绘的 36px 圆钮（vendor 那颗已被 showCloseButton={false} 关掉）。
   */
  it('关闭钮是 36px 圆钮，且浮层里只有这一颗', () => {
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
    const closes = screen.getAllByRole('button', { name: '关闭图片预览' })
    expect(closes).toHaveLength(1)
    expect(closes[0].className).toContain('size-9')

    // vendor 那颗带 sr-only「关闭」文案，不应存在
    expect(dialog.querySelector('.sr-only')?.textContent).not.toBe('关闭')
  })

  it('点击关闭钮回调 onOpenChange(false)', () => {
    const onOpenChange = vi.fn()
    render(
      <ImageLightbox
        photos={photos}
        initialIndex={0}
        open={true}
        onOpenChange={onOpenChange}
        alt="日常随拍"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '关闭图片预览' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
