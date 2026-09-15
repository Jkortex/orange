'use client'

import Link from 'next/link'
import { useState } from 'react'
import { formatDate } from '@/lib/format'

/*
 * 技能探索器：左侧分类列表（无折叠）+ 右侧条目列表，与 PostsExplorer 规范保持一致。
 * 「最近」为默认虚拟分类 = 全部技能按日期倒序；分类为纯过滤器，点击即时切换。
 */

export type SkillItem = {
  slug: string
  title: string
  /** ISO 字符串（服务端 Date.toISOString()） */
  date: string
  name: string
  version?: string
  author?: string
  category?: string
  description?: string
  tags: string[]
}

/** 从技能集合聚合分类与条数 */
function aggregateCategories(skills: SkillItem[]) {
  const counts = new Map<string, number>()
  for (const skill of skills) {
    if (!skill.category) continue
    counts.set(skill.category, (counts.get(skill.category) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function categoryClass(active: boolean) {
  return [
    'flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-all duration-200',
    active
      ? 'border-primary/30 bg-primary/10 font-medium text-primary shadow-xs'
      : 'border-transparent text-muted-foreground hover:border-border/60 hover:bg-muted/60 hover:text-foreground',
  ].join(' ')
}

export function SkillsExplorer({ skills }: { skills: SkillItem[] }) {
  const [active, setActive] = useState<string | null>(null) // null = 最近
  const categories = aggregateCategories(skills)
  const visible = active ? skills.filter((skill) => skill.category === active) : skills

  return (
    <div className="grid w-full gap-4 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-10">
      <aside className="sticky top-14 z-20 -mx-4 border-b border-border/40 bg-background/85 px-4 py-2.5 backdrop-blur-md md:static md:z-auto md:mx-0 md:border-b-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none md:sticky md:top-20 md:max-h-[calc(100vh-6rem)] md:overflow-y-auto md:pr-2">
        <nav aria-label="技能分类">
          <ul className="flex gap-1.5 overflow-x-auto pb-0.5 md:flex-col md:items-start md:gap-1 md:overflow-visible md:pb-0 scrollbar-none">
            <li>
              <button
                type="button"
                aria-pressed={active === null}
                onClick={() => setActive(null)}
                className={categoryClass(active === null)}
              >
                最近
              </button>
            </li>
            {categories.map(({ name, count }) => (
              <li key={name}>
                <button
                  type="button"
                  aria-pressed={active === name}
                  onClick={() => setActive(name)}
                  className={categoryClass(active === name)}
                >
                  {name}{' '}
                  <span className="text-xs text-muted-foreground">{count}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <section>
        <div className="mb-3 flex items-baseline gap-2">
          <h2 className="text-lg font-semibold tracking-tight">{active ?? '最近'}</h2>
          <span className="font-mono text-xs tabular-nums text-muted-foreground/70">共 {visible.length} 项</span>
        </div>
        {visible.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/70 bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground">还没有技能内容。</p>
        ) : (
          <ul key={active ?? 'recent'} className="divide-y divide-border/60 border-y border-border/60 animate-in fade-in-50 duration-200">
            {/* key 随分类重挂列表，播放一次淡入，表达过滤切换的即时反馈 */}
            {visible.map((skill) => (
              <li key={skill.slug} className="group px-3 py-4 transition-colors duration-200 hover:bg-muted/40 sm:mx-[-0.75rem] sm:rounded-xl sm:border sm:border-transparent sm:hover:border-border/60 sm:hover:bg-card sm:hover:shadow-xs">
                <Link
                  href={`/skills/${skill.slug}`}
                  className="font-medium tracking-tight transition-colors group-hover:text-primary"
                >
                  {skill.title}
                </Link>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  <code className="rounded bg-muted px-1 py-px font-mono text-xs">{skill.name}</code>
                  {skill.version !== undefined && ` · v${skill.version}`}
                  {skill.author !== undefined && ` · ${skill.author}`}
                  {' · '}
                  <time dateTime={skill.date} className="tabular-nums">
                    {formatDate(new Date(skill.date))}
                  </time>
                </p>
                {skill.description && (
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground/90">{skill.description}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
