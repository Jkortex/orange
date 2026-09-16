import type { ReactNode } from 'react'

export type HomeHeaderProps = {
  badge?: ReactNode
  title?: ReactNode
  description?: ReactNode
}

export function HomeHeader({
  badge = '个人数字空间 · 编程 / 生活 / 音乐',
  title = '你好，这里是 Orange 🍊',
  description = '记录编程技术、生活随想与音乐专辑的个人数字空间。',
}: HomeHeaderProps = {}) {
  return (
    <div className="mb-10 space-y-3">
      {badge && (
        <p className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-1 text-[13px] font-medium text-muted-foreground shadow-xs">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
          </span>
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
