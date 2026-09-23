'use client'

import {
  ChevronLeft,
  ChevronRight,
  Music,
  Pause,
  Play,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { usePlayer } from '@/components/player/player-provider'
import { Slider } from '@/components/ui/slider'
import { IconButton } from '@/components/primitives/icon-button'
import { Tip } from '@/components/primitives/tip'
import { formatTime } from '@/lib/format'

/*
 * 全局播放条（docs/specs/player.md §5/§6，ui-ux.md §5）：
 * - fixed bottom 悬浮层：不占文档流、footer 不让位，滚动到底时 footer 下缘被覆盖
 *   （Spotify/YouTube Music 式悬浮 chrome）；无队列时整体不渲染，零常驻留白
 * - 进度（可拖拽/键盘）+ 时间 + 音量（按钮/滑杆）+ 三键 + 关闭；音量组窄屏收起
 * - 内部内容与全站 2xl 对齐；控制按钮为图标化操作，aria-label + hover 提示
 */

export function PlayerBar() {
  const {
    queue,
    index,
    playing,
    currentTime,
    duration,
    volume,
    muted,
    toggle,
    next,
    prev,
    clear,
    seekTo,
    setVolume,
    toggleMute,
  } = usePlayer()
  if (index === null) return null

  const track = queue[index]
  const playLabel = playing ? '暂停' : '播放'
  const finite = Number.isFinite(duration) && duration > 0
  const muteLabel = muted ? '取消静音' : '静音'
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  return (
    <div data-bar className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/85 shadow-[0_-12px_40px_-16px_rgb(0_0_0/0.3)] backdrop-blur-xl animate-in slide-in-from-bottom duration-300">
      <div className="mx-auto flex h-16 max-w-2xl items-center gap-3 px-4">
        {track.cover ? (
          <img src={track.cover} alt="" className="size-10 rounded-lg border border-border/60 object-cover" />
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted text-muted-foreground">
            <Music className="size-5" aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium tracking-tight">{track.title}</p>
          {track.artist && <p className="truncate text-[13px] text-muted-foreground">{track.artist}</p>}
        </div>
        <div role="group" aria-label="播放进度" className="flex min-w-0 flex-1 items-center gap-2">
          <span className="hidden font-mono text-xs tabular-nums text-muted-foreground/80 sm:inline">
            {formatTime(currentTime)}
          </span>
          <Slider
            min={0}
            max={finite ? duration : 100}
            step={1}
            value={[finite ? Math.min(currentTime, duration) : 0]}
            onValueChange={([v]) => seekTo(v ?? 0)}
          />
          <span className="hidden font-mono text-xs tabular-nums text-muted-foreground/80 sm:inline">
            {formatTime(duration)}
          </span>
        </div>
        <div data-volume role="group" aria-label="音量" className="hidden shrink-0 items-center gap-1 md:flex">
          <IconButton
            label={muteLabel}
            onClick={toggleMute}
            buttonClassName="rounded-md p-2 text-muted-foreground hover:text-foreground"
          >
            <VolumeIcon className="size-5" aria-hidden />
          </IconButton>
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={[muted ? 0 : volume]}
            onValueChange={([v]) => setVolume(v ?? 1)}
            className="w-20"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            label="上一首"
            onClick={prev}
            buttonClassName="rounded-md p-2 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </IconButton>
          <span className="group relative inline-flex">
            <button
              type="button"
              aria-label={playLabel}
              onClick={toggle}
              className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors duration-200 hover:brightness-[1.05]"
            >
              {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            </button>
            <Tip className="bottom-full right-0 mb-1.5">{playLabel}</Tip>
          </span>
          <IconButton
            label="下一首"
            onClick={next}
            buttonClassName="rounded-md p-2 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="size-5" aria-hidden />
          </IconButton>
          <IconButton
            label="关闭播放条"
            onClick={clear}
            buttonClassName="rounded-md p-2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" aria-hidden />
          </IconButton>
        </div>
      </div>
    </div>
  )
}
