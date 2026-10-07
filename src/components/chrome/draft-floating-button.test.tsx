// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DraftFloatingButton } from '@/components/chrome/draft-floating-button'
import { PlayerProvider, usePlayer, type PlayerTrack } from '@/components/player/player-provider'
import { stubAudio } from '@/components/test-utils/mock-audio'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const tracks: PlayerTrack[] = [{ title: '曲目一', file: '/media/music/a.mp3' }]

// 测试触发器：入队以模拟播放条出现
function PlayButton() {
  const { playAlbum } = usePlayer()
  return <button onClick={() => playAlbum(tracks)}>开始播放</button>
}

function renderDraft() {
  return render(
    <PlayerProvider>
      <DraftFloatingButton />
      <PlayButton />
    </PlayerProvider>,
  )
}

beforeEach(() => {
  stubAudio()
})

afterEach(() => {
  cleanup()
  push.mockReset()
})

describe('DraftFloatingButton 正常渲染', () => {
  it('图标按钮语义完备：aria-label 与提示一致，触摸目标达标', () => {
    renderDraft()

    const button = screen.getByRole('button', { name: '草稿（仅本地）' })
    expect(button.className).toContain('size-9')
    const tip = button.parentElement?.querySelector('[data-tip]')
    expect(tip?.textContent).toBe('草稿（仅本地）')
  })

  it('定位在左下角（left-* 而非 right-*），避开右下角浮动栈', () => {
    renderDraft()

    const wrapper = screen.getByRole('button', { name: '草稿（仅本地）' }).parentElement
    expect(wrapper?.className).toContain('left-4')
    expect(wrapper?.className).not.toContain('right-')
  })
})

describe('DraftFloatingButton 异常渲染', () => {
  it('无播放队列时抬到 Next.js 调试徽标之上（bottom-[4.5rem]，不再是 bottom-6）', () => {
    renderDraft()

    const wrapper = screen.getByRole('button', { name: '草稿（仅本地）' }).parentElement
    expect(wrapper?.className).toContain('bottom-[4.5rem]')
    expect(wrapper?.className).not.toContain('bottom-6')
  })

  it('有播放队列时上移避让播放条（bottom-20，仍高于徽标顶沿）', () => {
    renderDraft()

    fireEvent.click(screen.getByRole('button', { name: '开始播放' }))

    const wrapper = screen.getByRole('button', { name: '草稿（仅本地）' }).parentElement
    expect(wrapper?.className).toContain('bottom-20')
    expect(wrapper?.className).not.toContain('bottom-[4.5rem]')
  })
})

describe('DraftFloatingButton 交互', () => {
  it('点击跳转 /drafts', () => {
    renderDraft()

    fireEvent.click(screen.getByRole('button', { name: '草稿（仅本地）' }))

    expect(push).toHaveBeenCalledWith('/drafts')
  })
})
