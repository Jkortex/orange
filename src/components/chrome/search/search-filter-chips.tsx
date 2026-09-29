import type { SearchScope } from './types'

interface ScopeChip {
  id: SearchScope
  label: string
}

const SCOPE_CHIPS: ScopeChip[] = [
  { id: 'all', label: '全部' },
  { id: 'posts', label: '文章' },
  { id: 'skills', label: '技能' },
  { id: 'life', label: '生活' },
  { id: 'music', label: '音乐' },
]

/*
 * 范围切换是「过滤开关」而非标签页：它不切换任何 tabpanel，
 * 因此用 role=group + aria-pressed，而不是残缺的 tab/tablist 语义。
 */
export function SearchFilterChips({
  activeScope,
  onSelectScope,
}: {
  activeScope: SearchScope
  onSelectScope: (scope: SearchScope) => void
}) {
  return (
    <div
      role="group"
      aria-label="搜索范围过滤"
      className="panel-bar type-caption flex items-center gap-1.5 border-b border-border-subtle px-3.5 py-1.5 overflow-x-auto select-none"
    >
      {SCOPE_CHIPS.map((chip) => {
        const isActive = activeScope === chip.id
        return (
          <button
            key={chip.id}
            type="button"
            aria-pressed={isActive}
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
