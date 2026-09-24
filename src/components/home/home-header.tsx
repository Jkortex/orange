import Link from 'next/link'
import type { ReactNode } from 'react'

/** 首页动态信号：把「最近一篇 / 在听」等实时内容直接摆进 hero */
export type HomeSignal = {
  /** 信号标签（如「最近」「在听」） */
  label: string
  /** 指向内容详情的站内路径 */
  href: string
  /** 展示文案（标题，或「标题 · 艺术家」） */
  text: string
}

export type HomeHeaderProps = {
  badge?: ReactNode
  title?: ReactNode
  description?: ReactNode
  signals?: HomeSignal[]
}

export function HomeHeader({
  badge,
  title = 'Orange',
  description = '写代码、拍照、听歌，偶尔记点东西。',
  signals = [],
}: HomeHeaderProps = {}) {
  return (
    <div className="mb-10 space-y-3">
      {badge && (
        <p className="type-caption inline-flex items-center rounded-full border border-border-subtle px-2.5 py-1 font-medium text-muted-foreground">
          {badge}
        </p>
      )}
      <h1 className="type-display text-balance">{title}</h1>
      {description && (
        <p className="type-body max-w-xl text-muted-foreground">{description}</p>
      )}
      {signals.length > 0 && (
        <p className="type-meta flex flex-wrap items-baseline gap-x-4 gap-y-1 pt-1">
          {signals.map((signal) => (
            <span key={signal.label} className="inline-flex min-w-0 items-baseline gap-1.5">
              <span className="shrink-0 text-muted-foreground">{signal.label}</span>
              <Link
                href={signal.href}
                className="truncate text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
              >
                {signal.text}
              </Link>
            </span>
          ))}
        </p>
      )}
    </div>
  )
}
