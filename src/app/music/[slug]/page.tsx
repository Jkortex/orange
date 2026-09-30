import type { Metadata } from 'next'
import { Music } from 'lucide-react'
import { getCollection } from '@/lib/content'
import { entryMetadata, readEntry } from '@/components/listing/entry-view'
import { BackButton } from '@/components/reading/back-button'
import { AlbumTrackList } from '@/components/player/album-track-list'
import { PagefindFilters } from '@/components/listing/pagefind-filters'

type Params = { params: Promise<{ slug: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  const entries = getCollection('music')
  if (entries.length === 0) return [{ slug: '__empty__' }]
  return entries.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  return entryMetadata('music', slug)
}

// 专辑详情：头部信息（封面/艺术家/专辑名/年份·曲目数）+ 曲目列表（AGENTS.md 界面布局规范 §4.4）
export default async function MusicDetailPage({ params }: Params) {
  const { slug } = await params
  const entry = readEntry('music', slug)
  const { title, artist, year, cover, tracks, description } = entry.data

  return (
    <article className="mx-auto w-full max-w-2xl">
      {/* 搜索过滤元数据：按类型下推给 Pagefind 索引 */}
      <PagefindFilters type="music" />

      <BackButton fallbackHref="/music" fallbackLabel="音乐" className="mb-6" />
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end">
        <div className="w-40 sm:w-48">
          {cover ? (
            <img
              src={cover}
              alt={`${title} 封面`}
              className="media-frame aspect-square w-full object-cover"
            />
          ) : (
            <div className="media-frame flex aspect-square w-full items-center justify-center text-muted-foreground">
              <Music className="size-12" aria-hidden />
            </div>
          )}
        </div>
        <div>
          <p className="type-meta text-muted-foreground">{artist}</p>
          <h1 className="type-display mt-1">{title}</h1>
          <p className="type-meta mt-2 text-muted-foreground">
            {[year, `${tracks.length} 首曲目`].filter((item) => item !== undefined).join(' · ')}
          </p>
          {description && <p className="type-body mt-3 text-muted-foreground">{description}</p>}
        </div>
      </header>
      <AlbumTrackList tracks={tracks} cover={cover} artist={artist} />
    </article>
  )
}
