'use client'

import Link from 'next/link'
import { formatDateISO } from '@/lib/format'
import { Explorer } from '@/components/listing/explorer'

/*
 * 技能探索器：Explorer 薄封装，只定行结构（标题 + 包名/版本/作者/日期/描述）；
 * 全量展示无分页，过滤、侧栏、空态收敛在 Explorer，行级差异经 slot 注入
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

const SKILL_ROW_CLASS =
  'group px-3 py-4 transition-colors duration-150 hover:bg-muted/40 sm:mx-[-0.75rem] sm:rounded-xl sm:border sm:border-transparent sm:hover:border-border/60 sm:hover:bg-card sm:hover:shadow-xs'

export function SkillsExplorer({ skills }: { skills: SkillItem[] }) {
  return (
    <Explorer<SkillItem>
      items={skills}
      navLabel="技能分类"
      emptyMessage="还没有技能内容。"
      unit="项"
      getKey={(skill) => skill.slug}
      rowClassName={SKILL_ROW_CLASS}
      renderItem={(skill) => (
        <>
          <Link
            href={`/skills/${skill.slug}`}
            className="font-medium tracking-tight transition-colors group-hover:text-primary"
          >
            {skill.title}
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">
            <code className="rounded bg-muted px-1 py-px font-mono text-[13px]">{skill.name}</code>
            {skill.version !== undefined && ` · v${skill.version}`}
            {skill.author !== undefined && ` · ${skill.author}`}
            {' · '}
            <time dateTime={skill.date} className="tabular-nums">
              {formatDateISO(skill.date)}
            </time>
          </p>
          {skill.description && (
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground/90">
              {skill.description}
            </p>
          )}
        </>
      )}
    />
  )
}
