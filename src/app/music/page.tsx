import type { Metadata } from 'next'
import { Music } from 'lucide-react'
import { getCollection } from '@/lib/content'
import { AlbumCard } from '@/components/player/album-card'
import { PageHeader } from '@/components/listing/page-header'
import { EmptyState } from '@/components/primitives/empty-state'

export const metadata: Metadata = { title: '音乐' }

// 音乐：专辑网格（构建时读取，AGENTS.md 界面布局规范 §4.3）
export default function MusicPage() {
  const albums = getCollection('music')

  return (
    <section className="mx-auto w-full max-w-2xl animate-in fade-in-50 duration-300">
      <PageHeader
        title="音乐"
        description="一篇内容即一张专辑 · 点击封面进入详情，不进详情页也可直接播放。"
        icon={<Music aria-hidden />}
      />
      {albums.length === 0 ? (
        <EmptyState message="还没有内容。" />
      ) : (
        <ul className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2">
          {albums.map((album) => (
            <AlbumCard
              key={album.slug}
              slug={album.slug}
              title={album.data.title}
              artist={album.data.artist}
              year={album.data.year}
              cover={album.data.cover}
              tracks={album.data.tracks}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
