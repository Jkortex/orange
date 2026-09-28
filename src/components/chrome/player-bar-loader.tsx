'use client'

import dynamic from 'next/dynamic'
import { usePlayerIndex } from '@/components/player/player-provider'

// 播放条只在队列非空时挂载；Provider 仍由根布局常驻，保证跨路由播放不中断。
const PlayerBar = dynamic(
  () => import('@/components/chrome/player-bar').then((module) => module.PlayerBar),
  { ssr: false },
)

export function PlayerBarLoader() {
  const index = usePlayerIndex()
  if (index === null) return null
  return (
    <>
      <PlayerBar />
      {/* 播放条 fixed 不占文档流，占位块负责把页尾顶出它的覆盖范围；无播放时两者都不存在 */}
      <div data-bar-spacer aria-hidden className="h-16" />
    </>
  )
}
