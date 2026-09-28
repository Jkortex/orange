import type { ReactNode } from 'react'

/** 首页简介：品牌名由顶栏承担，这里只保留站点定位文案。 */
export type HomeHeaderProps = {
  badge?: ReactNode
  description?: ReactNode
}

export function HomeHeader({
  badge,
  description = '写代码、拍照、听歌，偶尔记点东西。',
}: HomeHeaderProps = {}) {
  return (
    <div className="mb-8">
      {badge && (
        <p className="chip chip-quiet mb-3">
          {badge}
        </p>
      )}
      {description && (
        <p className="type-body max-w-xl text-muted-foreground">{description}</p>
      )}
    </div>
  )
}
