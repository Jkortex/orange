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
    <div className="space-y-4 p-2 text-sm">
      {/* 最近访问记录 */}
      {recentVisits.length > 0 && (
        <div>
          <div className="flex items-center justify-between px-2 pb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <History className="size-3.5" aria-hidden />
              <span>最近访问</span>
            </span>
            <button
              type="button"
              onClick={onClearRecent}
              className="text-[11px] text-muted-foreground/80 hover:text-foreground transition-colors"
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
                  className="flex w-full items-center justify-between rounded-lg p-2 text-left text-sm text-foreground transition-colors hover:bg-muted/70 group"
                >
                  <span className="truncate group-hover:text-primary transition-colors">{item.title}</span>
                  <span className="font-mono text-xs text-muted-foreground/60 truncate max-w-[140px]">
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
        <div className="flex items-center gap-1.5 px-2 pb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <Sparkles className="size-3.5 text-primary" aria-hidden />
          <span>常用推荐</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {suggestedActions.slice(0, 4).map((act) => (
            <button
              key={act.id}
              type="button"
              onClick={() => onSelectAction(act)}
              className="flex items-center justify-between rounded-lg border border-border/50 bg-card/60 p-2 text-left text-xs transition-all hover:border-primary/40 hover:bg-card active:scale-[0.99]"
            >
              <span className="font-medium text-foreground">{act.title}</span>
              {act.badge && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {act.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <p className="px-2 pt-1 text-center text-xs text-muted-foreground/70">
        输入任意关键词搜索全站文章、生活、音乐与章节大纲
      </p>
    </div>
  )
}
