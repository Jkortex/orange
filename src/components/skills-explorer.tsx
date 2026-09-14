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
    'flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-sm transition-colors',
    active
      ? 'bg-primary/10 font-medium text-primary'
      : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground',
  ].join(' ')
}

export function SkillsExplorer({ skills }: { skills: SkillItem[] }) {
  const [active, setActive] = useState<string | null>(null) // null = 最近
  const categories = aggregateCategories(skills)
  const visible = active ? skills.filter((skill) => skill.category === active) : skills

  return (
    <div className="grid w-full gap-4 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-10">
      <aside>
        <nav aria-label="技能分类">
          <ul className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:items-start md:gap-1 md:overflow-visible md:pb-0">
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
        <div className="mb-2 flex items-baseline gap-2">
          <h2 className="text-lg font-medium">{active ?? '最近'}</h2>
          <span className="text-sm text-muted-foreground">共 {visible.length} 项</span>
        </div>
        {visible.length === 0 ? (
          <p className="py-8 text-muted-foreground">还没有技能内容。</p>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((skill) => (
              <li key={skill.slug} className="py-4">
                <Link
                  href={`/skills/${skill.slug}`}
                  className="font-medium hover:text-primary"
                >
                  {skill.title}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  <code>{skill.name}</code>
                  {skill.version !== undefined && ` · v${skill.version}`}
                  {skill.author !== undefined && ` · ${skill.author}`}
                  {' · '}
                  <time dateTime={skill.date}>
                    {formatDate(new Date(skill.date))}
                  </time>
                </p>
                {skill.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{skill.description}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
