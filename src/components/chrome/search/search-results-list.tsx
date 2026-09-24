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
            <div className="type-caption px-2 font-semibold tracking-wider text-muted-foreground uppercase">
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
                            ? 'bg-primary/10 ring-1 ring-primary/30'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`type-meta font-medium truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                            {item.title}
                          </span>
                          {item.badge && (
                            <span className="chip shrink-0">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        {item.excerpt && (
                          <span
                            className="type-caption mt-1 block text-muted-foreground line-clamp-2 [&>mark]:bg-primary/20 [&>mark]:text-foreground [&>mark]:font-medium"
                            dangerouslySetInnerHTML={{ __html: item.excerpt }}
                          />
                        )}
                        {!item.excerpt && item.subtitle && (
                          <span className="type-caption mt-0.5 block truncate text-muted-foreground">
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
                          ? 'bg-primary/10 ring-1 ring-primary/30'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <span className={`type-meta font-medium truncate block ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                          {item.title}
                        </span>
                        {item.subtitle && (
                          <span className="type-caption mt-0.5 block truncate text-muted-foreground">
                            {item.subtitle}
                          </span>
                        )}
                      </div>
                      {item.badge && (
                        <span className="chip shrink-0">
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
