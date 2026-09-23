import type { SearchScope } from './types'

export interface ScopeChip {
  id: SearchScope
  label: string
}

export const SCOPE_CHIPS: ScopeChip[] = [
  { id: 'all', label: '全部' },
  { id: 'posts', label: '文章' },
  { id: 'skills', label: '技能' },
  { id: 'life', label: '生活' },
  { id: 'music', label: '音乐' },
]

export function SearchFilterChips({
  activeScope,
  onSelectScope,
}: {
  activeScope: SearchScope
  onSelectScope: (scope: SearchScope) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="搜索范围过滤"
      className="flex items-center gap-1.5 border-b border-border/50 bg-muted/20 px-3.5 py-1.5 text-xs overflow-x-auto select-none"
    >
      {SCOPE_CHIPS.map((chip) => {
        const isActive = activeScope === chip.id
        return (
          <button
            key={chip.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onSelectScope(chip.id)}
            className={`rounded-full px-2.5 py-1 font-medium transition-all ${
              isActive
                ? 'bg-primary/15 text-primary ring-1 ring-primary/30 shadow-2xs'
                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
            }`}
          >
            {chip.label}
          </button>
        )
      })}
    </div>
  )
}
