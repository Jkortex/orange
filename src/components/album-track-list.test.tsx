// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { AlbumTrackList } from './album-track-list'
import { PlayerProvider } from './player-provider'
import { stubAudio, unstubAudio, type MockAudio } from './test-utils/mock-audio'

const tracks = [
  { title: '曲目一', file: '/media/music/a.mp3' },
  { title: '曲目二', file: '/media/music/b.mp3' },
  { title: '曲目三', file: '/media/music/c.mp3' },
]

let audio: MockAudio

beforeEach(() => {
  audio = stubAudio()
})

afterEach(() => {
  cleanup()
  unstubAudio()
})

function renderList(props: Partial<{ tracks: typeof tracks }> = {}) {
  return render(
    <PlayerProvider>
      <AlbumTrackList tracks={tracks} {...props} />
    </PlayerProvider>,
  )
}

describe('AlbumTrackList 正常渲染', () => {
  it('渲染「播放全部」按钮与全部曲目行（含序号与标题）', () => {
    renderList()

    expect(screen.getByRole('button', { name: '播放全部' })).toBeTruthy()
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(rows[0].textContent).toContain('曲目一')
    expect(rows[1].textContent).toContain('曲目二')
  })

  it('未播放时没有当前曲目高亮行', () => {
    renderList()

    expect(screen.queryByRole('listitem', { current: true })).toBeNull()
  })
})

describe('AlbumTrackList 交互', () => {
  it('点击「播放全部」从第一首起播，按钮文案切为「暂停」', () => {
    renderList()

    fireEvent.click(screen.getByRole('button', { name: '播放全部' }))

    expect(audio.src).toBe('/media/music/a.mp3')
    expect(audio.play).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '暂停专辑' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '暂停专辑' }))
    expect(audio.pause).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '播放全部' })).toBeTruthy()
  })

  it('当前专辑播放中点击主按钮切换为暂停', () => {
    renderList()
    fireEvent.click(screen.getByRole('button', { name: '播放全部' }))
    expect(audio.play).toHaveBeenCalled()

    // 主按钮 aria-label=暂停专辑（与行内按钮的「暂停」区分），点击应暂停而非无响应
    fireEvent.click(screen.getByRole('button', { name: '暂停专辑' }))

    expect(audio.pause).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '播放全部' })).toBeTruthy()
  })

  it('点击曲目行按钮从该曲目起播并高亮当前行', () => {
    renderList()

    fireEvent.click(
      within(screen.getByRole('listitem', { name: '曲目 曲目二' })).getByRole('button', {
        name: '播放《曲目二》',
      }),
    )

    expect(audio.src).toBe('/media/music/b.mp3')
    const current = screen.getByRole('listitem', { current: true })
    expect(current.textContent).toContain('曲目二')
    expect(current.querySelector('.lucide-volume-2')).not.toBeNull()
  })

  it('当前播放行再点击切换为暂停', () => {
    renderList()
    fireEvent.click(screen.getByRole('button', { name: '播放全部' }))

    fireEvent.click(screen.getByRole('button', { name: '暂停' }))

    expect(audio.pause).toHaveBeenCalled()
    // 行内按钮切为「播放《曲目一》」
    expect(screen.getByRole('button', { name: '播放《曲目一》' })).toBeTruthy()
  })

  it('行内播放按钮带 hover 文字提示（符合图标化规范）', () => {
    renderList()

    const button = screen.getByRole('button', { name: '播放《曲目一》' })
    const tip = button.closest('.group')?.querySelector('[data-tip]')
    expect(tip).not.toBeNull()
    expect(tip?.textContent).toBe('播放《曲目一》')
    expect(tip?.className).toContain('opacity-0')
    expect(tip?.className).toContain('group-hover:opacity-100')
  })
})

describe('AlbumTrackList 异常渲染', () => {
  it('行内播放按钮具备足够触摸目标（p-2.5 ≈ 36px，移动端可点中）', () => {
    renderList()

    expect(screen.getByRole('button', { name: '播放《曲目一》' }).className).toContain('p-2.5')
  })

  it('tracks 为空时整体不渲染', () => {
    renderList({ tracks: [] })

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('listitem')).toBeNull()
  })

  it('tracks 在空与非空之间切换时正常渲染（React 19 下 Hooks 顺序违规为可恢复错误，此处以行为回归兜底）', () => {
    const { rerender } = render(
      <PlayerProvider>
        <AlbumTrackList tracks={tracks} />
      </PlayerProvider>,
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(3)

    rerender(
      <PlayerProvider>
        <AlbumTrackList tracks={[]} />
      </PlayerProvider>,
    )
    expect(screen.queryByRole('listitem')).toBeNull()

    rerender(
      <PlayerProvider>
        <AlbumTrackList tracks={tracks} />
      </PlayerProvider>,
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })
})
