import { History, Sparkles, X } from 'lucide-react'
import type { UnifiedSearchItem } from './types'

export interface RecentVisit {
  url: string
  title: string
}

export function SearchEmptyState({
  recentVisits,
  onClearRecent,
  onSelectRecent,
  suggestedActions,
  onSelectAction,
}: {
  recentVisits: RecentVisit[]
  onClearRecent: () => void
  onSelectRecent: (item: RecentVisit) => void
  suggestedActions: UnifiedSearchItem[]
  onSelectAction: (action: UnifiedSearchItem) => void
}) {
  return (
    <div className="type-meta space-y-4 p-2">
      {/* 最近访问记录 */}
      {recentVisits.length > 0 && (
        <div>
          <div className="type-caption flex items-center justify-between px-2 pb-1.5 font-semibold text-muted-foreground uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <History className="size-3.5" aria-hidden />
              <span>最近访问</span>
            </span>
            <button
              type="button"
              onClick={onClearRecent}
              className="type-caption text-muted-foreground transition-colors hover:text-foreground"
            >
              清除记录
            </button>
          </div>
          <ul className="space-y-0.5">
            {recentVisits.map((item) => (
              <li key={item.url}>
                <button
                  type="button"
                  onClick={() => onSelectRecent(item)}
                  className="group flex w-full items-center justify-between rounded-lg p-2 text-left text-foreground transition-colors hover:bg-surface-hover"
                >
                  <span className="truncate transition-colors group-hover:text-primary">{item.title}</span>
                  <span className="type-caption max-w-[140px] truncate font-mono text-muted-foreground">
                    {item.url}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 快捷推荐 */}
      <div>
        <div className="type-caption flex items-center gap-1.5 px-2 pb-1.5 font-semibold text-muted-foreground uppercase tracking-wider">
          <Sparkles className="size-3.5 text-primary" aria-hidden />
          <span>常用推荐</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {suggestedActions.slice(0, 4).map((act) => (
            <button
              key={act.id}
              type="button"
              onClick={() => onSelectAction(act)}
              className="type-caption flex items-center justify-between rounded-lg border border-border-subtle bg-surface p-2 text-left transition-all hover:border-primary/40 hover:bg-surface-hover active:scale-[0.99]"
            >
              <span className="font-medium text-foreground">{act.title}</span>
              {act.badge && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                  {act.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <p className="type-caption px-2 pt-1 text-center text-muted-foreground">
        输入任意关键词搜索全站文章、生活、音乐与章节大纲
      </p>
    </div>
  )
}
