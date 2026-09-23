import type { ReactNode } from 'react'

export type HomeHeaderProps = {
  badge?: ReactNode
  title?: ReactNode
  description?: ReactNode
}

export function HomeHeader({
  badge,
  title = 'Orange',
  description = '写代码、拍照、听歌，偶尔记点东西。',
}: HomeHeaderProps = {}) {
  return (
    <div className="mb-10 space-y-3">
      {badge && (
        <p className="inline-flex items-center rounded-full border border-border/60 px-2.5 py-1 text-[13px] font-medium text-muted-foreground">
          {badge}
        </p>
      )}
      <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl sm:leading-[1.15]">
        {title}
      </h1>
      {description && (
        <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  )
}
