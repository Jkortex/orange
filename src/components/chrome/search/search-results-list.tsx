import { useEffect, useRef } from 'react'
import type { SearchGroup, UnifiedSearchItem } from './types'

export function SearchResultsList({
  groups,
  selectedIndex,
  onSelect,
}: {
  groups: SearchGroup[]
  selectedIndex: number
  onSelect: (item: UnifiedSearchItem) => void
}) {
  const selectedRef = useRef<HTMLAnchorElement | HTMLButtonElement | null>(null)

  useEffect(() => {
    if (selectedRef.current && typeof selectedRef.current.scrollIntoView === 'function') {
      selectedRef.current.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  // 计算全局拍平索引对应的条目
  let currentIndex = 0

  return (
    <div className="space-y-3.5 p-2">
      {groups.map((group) => {
        if (group.items.length === 0) return null

        return (
          <div key={group.id} className="space-y-1">
            {/* 分组标题 */}
            <div className="px-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {`${group.label} (${group.items.length})`}
            </div>

            {/* 分组内容列表 */}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const itemIndex = currentIndex++
                const isSelected = selectedIndex === itemIndex

                if (item.url) {
                  return (
                    <li key={item.id}>
                      <a
                        ref={isSelected ? (el) => { selectedRef.current = el } : undefined}
                        href={item.url}
                        onClick={(e) => {
                          e.preventDefault()
                          onSelect(item)
                        }}
                        className={`group flex flex-col rounded-lg p-2.5 transition-colors duration-150 text-left ${
                          isSelected
                            ? 'bg-primary/15 ring-1 ring-primary/30 shadow-2xs'
                            : 'hover:bg-muted/70'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`font-medium truncate text-sm ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                            {item.title}
                          </span>
                          {item.badge && (
                            <span className="shrink-0 rounded-md border border-border/60 bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        {item.excerpt && (
                          <span
                            className="mt-1 block text-xs text-muted-foreground line-clamp-2 [&>mark]:bg-primary/20 [&>mark]:text-foreground [&>mark]:font-medium"
                            dangerouslySetInnerHTML={{ __html: item.excerpt }}
                          />
                        )}
                        {!item.excerpt && item.subtitle && (
                          <span className="mt-0.5 block text-xs text-muted-foreground truncate">
                            {item.subtitle}
                          </span>
                        )}
                      </a>
                    </li>
                  )
                }

                return (
                  <li key={item.id}>
                    <button
                      ref={isSelected ? (el) => { selectedRef.current = el } : undefined}
                      type="button"
                      onClick={() => onSelect(item)}
                      className={`group flex w-full items-center justify-between rounded-lg p-2.5 transition-colors duration-150 text-left ${
                        isSelected
                          ? 'bg-primary/15 ring-1 ring-primary/30 shadow-2xs'
                          : 'hover:bg-muted/70'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <span className={`font-medium truncate text-sm block ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                          {item.title}
                        </span>
                        {item.subtitle && (
                          <span className="mt-0.5 block text-xs text-muted-foreground truncate">
                            {item.subtitle}
                          </span>
                        )}
                      </div>
                      {item.badge && (
                        <span className="shrink-0 rounded-md border border-border/60 bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
