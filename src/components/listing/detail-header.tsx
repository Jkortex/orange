import Link from 'next/link'
import { BackButton } from '@/components/reading/back-button'

/*
 * 详情页眉（entry-view / skill-package-explorer 共用，同属 listing 组装层）：
 * - 返回链接 + 标题 + 元信息行 + 标签 + 可选描述/右侧操作；
 *   divided=true 时标题区带底部分隔（技能包样式，操作按钮放右侧）
 */

export type DetailHeaderProps = {
  backHref: string
  backLabel: string
  title: string
  /** 日期/阅读时长/编号等元信息（标签除外） */
  meta?: React.ReactNode
  tags?: string[]
  description?: string
  /** 右侧操作（如技能包下载按钮），divided 下与标题左右分栏 */
  actions?: React.ReactNode
  divided?: boolean
}

export function DetailHeader({
  backHref,
  backLabel,
  title,
  meta,
  tags = [],
  description,
  actions,
  divided = false,
}: DetailHeaderProps) {
  return (
    <div className="mb-8">
      <BackButton fallbackHref={backHref} fallbackLabel={backLabel} className="mb-6" />
      <header
        className={
          divided
            ? 'flex flex-col gap-4 border-b border-border-subtle pb-6 sm:flex-row sm:items-start sm:justify-between'
            : undefined
        }
      >
        <div className={divided ? 'space-y-2.5' : 'space-y-4'}>
          <h1 className="type-display text-balance">{title}</h1>
          {(meta || tags.length > 0) && (
            <div className="type-meta flex flex-wrap items-center gap-x-3 gap-y-2 text-muted-foreground">
              {meta}
              {tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {tags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/tags/${tag}`}
                      className="chip chip-subtle chip-interactive"
                    >
                      #{tag}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
          {description && (
            <p className="type-body max-w-3xl text-muted-foreground">{description}</p>
          )}
        </div>
        {actions}
      </header>
    </div>
  )
}
