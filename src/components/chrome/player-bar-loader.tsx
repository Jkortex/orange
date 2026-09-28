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
  return <PlayerBar />
}
