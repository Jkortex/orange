import { useRef } from 'react'
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

const scopeIndex = (scope: SearchScope) => SCOPE_CHIPS.findIndex((chip) => chip.id === scope)

/*
 * 范围顺序的唯一来源：组内 ←/→ 与弹窗级 Shift+←/→ 共用同一套顺序与回绕，
 * 避免两处各写一遍「上一档 / 下一档」而漂移。
 */
export function stepScope(scope: SearchScope, delta: 1 | -1): SearchScope {
  const len = SCOPE_CHIPS.length
  return SCOPE_CHIPS[(scopeIndex(scope) + delta + len) % len].id
}

/*
 * 范围切换是「过滤开关」而非标签页：它不切换任何 tabpanel，
 * 因此用 role=group + aria-pressed，而不是残缺的 tab/tablist 语义。
 *
 * 键盘：整组只占一个 Tab 停靠点（roving tabindex，停在当前范围上），
 * 组内 ←/→/Home/End 移动并直接切换（分段控件的惯例：选中跟随焦点）。
 * 带修饰键的方向键不在这里处理，留给弹窗级 Shift+←/→。
 */
export function SearchFilterChips({
  activeScope,
  onSelectScope,
}: {
  activeScope: SearchScope
  onSelectScope: (scope: SearchScope) => void
}) {
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([])

  function activate(scope: SearchScope) {
    onSelectScope(scope)
    chipRefs.current[scopeIndex(scope)]?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return

    let next: SearchScope | null = null
    if (e.key === 'ArrowRight') next = stepScope(activeScope, 1)
    else if (e.key === 'ArrowLeft') next = stepScope(activeScope, -1)
    else if (e.key === 'Home') next = SCOPE_CHIPS[0].id
    else if (e.key === 'End') next = SCOPE_CHIPS[SCOPE_CHIPS.length - 1].id

    if (!next) return
    e.preventDefault()
    activate(next)
  }

  return (
    <div
      role="group"
      aria-label="搜索范围过滤"
      onKeyDown={handleKeyDown}
      className="panel-bar type-caption flex items-center gap-1.5 border-b border-border-subtle px-3.5 py-1.5 overflow-x-auto select-none"
    >
      {SCOPE_CHIPS.map((chip, index) => {
        const isActive = activeScope === chip.id
        return (
          <button
            key={chip.id}
            ref={(el) => {
              chipRefs.current[index] = el
            }}
            type="button"
            aria-pressed={isActive}
            tabIndex={isActive ? 0 : -1}
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
