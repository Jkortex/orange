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
      className="panel-bar type-caption flex items-center gap-1.5 border-b border-border-subtle px-3.5 py-1.5 overflow-x-auto select-none"
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
            className={`rounded-full px-2.5 py-1 font-medium transition-colors duration-150 ${
              isActive
                ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {chip.label}
          </button>
        )
      })}
    </div>
  )
}
