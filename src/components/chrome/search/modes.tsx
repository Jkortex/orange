'use client'

import { Sparkles, Tag, ListTree } from 'lucide-react'
import type { CommandItem, SymbolItem, CategoryItem, Result } from './types'
import { scrollToHeading } from '@/lib/scroll'

// ── 命令模式 ──────────────────────────────────────────────

export function CommandMode({
  commands,
  selectedIndex,
  onSelect,
}: {
  commands: CommandItem[]
  selectedIndex: number
  onSelect: (cmd: CommandItem) => void
}) {
  if (commands.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">未找到匹配的命令。</p>
  }
  return (
    <ul className="space-y-1">
      {commands.map((c, i) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => onSelect(c)}
            className={`flex w-full items-center justify-between rounded-md p-2.5 text-left text-sm transition-colors ${
              selectedIndex === i
                ? 'bg-primary/15 ring-1 ring-primary/30'
                : 'hover:bg-muted'
            }`}
          >
            <div>
              <span className="font-medium text-foreground">{c.title}</span>
              <span className="mt-0.5 block text-[13px] text-muted-foreground">
                {c.desc}
              </span>
            </div>
            {c.keys && (
              <kbd className="rounded border border-border bg-muted/70 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                {c.keys}
              </kbd>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}

// ── 分类模式 ──────────────────────────────────────────────

export function CategoryMode({
  categories,
  selectedIndex,
  hasOutline,
  onSelect,
}: {
  categories: CategoryItem[]
  selectedIndex: number
  hasOutline: boolean
  onSelect: (cat: CategoryItem) => void
}) {
  if (categories.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">未找到匹配的分类。</p>
  }
  return (
    <ul className="space-y-1">
      {categories.map((c, i) => (
        <li key={c.slug}>
          <button
            type="button"
            onClick={() => onSelect(c)}
            className={`flex w-full items-center justify-between rounded-md p-2.5 text-left text-sm transition-colors ${
              selectedIndex === i
                ? 'bg-primary/15 ring-1 ring-primary/30'
                : 'hover:bg-muted'
            }`}
          >
            <div className="flex items-center gap-2">
              {c.href ? (
                <Sparkles className="h-4 w-4 text-primary shrink-0" aria-hidden />
              ) : (
                <Tag className="h-4 w-4 text-primary shrink-0" aria-hidden />
              )}
              <div>
                <span className="font-medium text-foreground">{c.label}</span>
                {c.desc && (
                  <span className="block text-xs text-muted-foreground">
                    {c.desc}
                  </span>
                )}
              </div>
            </div>
            <span className="font-mono text-xs text-muted-foreground shrink-0">
              @{c.slug}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

// ── 大纲模式 ──────────────────────────────────────────────

export function SymbolMode({
  symbols,
  selectedIndex,
  onSelect,
}: {
  symbols: SymbolItem[]
  selectedIndex: number
  onSelect: (sym: SymbolItem) => void
}) {
  if (symbols.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        当前页面未检测到子章节标题。
      </p>
    )
  }
  return (
    <ul className="space-y-1">
      {symbols.map((s, i) => (
        <li key={s.id}>
          <button
            type="button"
            onClick={() => onSelect(s)}
            className={`flex w-full items-center justify-between rounded-md p-2.5 text-left text-sm transition-colors ${
              selectedIndex === i
                ? 'bg-primary/15 ring-1 ring-primary/30'
                : 'hover:bg-muted'
            } ${s.depth === 3 ? 'pl-6' : ''}`}
          >
            <div className="flex items-center gap-2 truncate">
              <span className="font-mono text-xs text-primary font-semibold">
                {s.depth === 2 ? 'H2' : 'H3'}
              </span>
              <span className="truncate font-medium text-foreground">
                {s.title}
              </span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}

// ── 搜索模式 ──────────────────────────────────────────────

export function SearchMode({
  results,
  error,
  selectedIndex,
  onSelect,
}: {
  results: Result[] | null
  error: string | null
  selectedIndex: number
  onSelect: (result: Result) => void
}) {
  if (error) {
    return <p className="p-4 text-sm text-muted-foreground">{error}</p>
  }

  if (results === null) {
    return null
  }

  if (results.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">没有找到相关内容。</p>
    )
  }

  return (
    <ul>
      {results.map((r, i) => {
        const typeLabel = r.url.startsWith('/life/')
          ? '生活'
          : r.url.startsWith('/posts/')
            ? '文章'
            : r.url.startsWith('/music/')
              ? '音乐'
              : r.url.startsWith('/skills/')
                ? '技能'
                : null

        return (
          <li key={r.url}>
            <a
              href={r.url}
              className={`block rounded-md p-3 transition-colors ${
                selectedIndex === i
                  ? 'bg-primary/15 ring-1 ring-primary/30'
                  : 'hover:bg-primary/10'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="block font-medium truncate">{r.title}</span>
                {typeLabel && (
                  <span className="shrink-0 rounded-full border border-border/60 bg-muted/60 px-2 py-px text-[11px] font-medium text-muted-foreground">
                    {typeLabel}
                  </span>
                )}
              </div>
              <span
                className="mt-1 block text-sm text-muted-foreground [&>mark]:bg-primary/20 [&>mark]:text-foreground"
                dangerouslySetInnerHTML={{ __html: r.excerpt }}
              />
            </a>
          </li>
        )
      })}
    </ul>
  )
}

// ── 跳转辅助 ──────────────────────────────────────────────

export function jumpToHeading(id: string) {
  if (!scrollToHeading(id, { block: 'center' })) return
  const target = document.getElementById(id)
  if (target) {
    target.classList.add(
      'ring-2',
      'ring-primary/60',
      'rounded',
      'transition-all',
      'duration-300',
    )
    setTimeout(() => {
      target.classList.remove(
        'ring-2',
        'ring-primary/60',
        'rounded',
        'transition-all',
        'duration-300',
      )
    }, 2000)
  }
}
