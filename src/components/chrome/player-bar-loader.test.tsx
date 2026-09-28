// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PlayerProvider, usePlayer } from '@/components/player/player-provider'
import { PlayerBarLoader } from '@/components/chrome/player-bar-loader'
import { stubAudio, unstubAudio } from '@/components/test-utils/mock-audio'

beforeEach(() => {
  stubAudio()
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

afterEach(() => {
  cleanup()
  unstubAudio()
})

function Harness() {
  const { playAlbum } = usePlayer()
  return (
    <button
      type="button"
      onClick={() => playAlbum([{ title: '测试曲目', file: '/test.mp3' }])}
    >
      播放
    </button>
  )
}

describe('PlayerBarLoader', () => {
  it('无队列时不加载播放条 UI，播放后才挂载', async () => {
    render(
      <PlayerProvider>
        <PlayerBarLoader />
        <Harness />
      </PlayerProvider>,
    )

    expect(document.querySelector('[data-bar]')).toBeNull()
    expect(document.querySelector('[data-bar-spacer]')).toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '播放' }))
    })

    await waitFor(
      () => {
        expect(document.querySelector('[data-bar]')).not.toBeNull()
      },
      { timeout: 3000 },
    )
  })

  /*
   * 播放条是 fixed 悬浮层，不占文档流：它出现时必须自己补一个流内占位，
   * 否则会盖住页尾（footer 的年份/RSS）；main 也不必为此长期背 pb-20。
   */
  it('播放条挂载时同时生成占位块，队列清空后占位一起消失', async () => {
    render(
      <PlayerProvider>
        <PlayerBarLoader />
        <Harness />
      </PlayerProvider>,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '播放' }))
    })

    const spacer = await waitFor(
      () => {
        const el = document.querySelector('[data-bar-spacer]')
        expect(el).not.toBeNull()
        return el as HTMLElement
      },
      { timeout: 3000 },
    )
    expect(spacer.className).toContain('h-16')
  })
})
