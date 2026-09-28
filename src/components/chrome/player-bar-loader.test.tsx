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
})
