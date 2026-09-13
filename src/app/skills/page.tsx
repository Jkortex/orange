import type { Metadata } from 'next'
import Link from 'next/link'
import { getSkillEntries } from '@/lib/content'
import { formatDate } from '@/lib/format'

export const metadata: Metadata = { title: '技能' }

// 技能列表：条目列表，供顶栏导航进入（docs/specs/content-model.md §11）
export default function SkillsPage() {
  const skills = getSkillEntries()

  return (
    <section className="mx-auto w-full max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">技能</h1>
      {skills.length === 0 ? (
        <p className="text-muted-foreground">还没有内容。</p>
      ) : (
        <ul className="divide-y divide-border">
          {skills.map((skill) => (
            <li key={skill.slug} className="py-4">
              <Link href={`/skills/${skill.slug}`} className="font-medium hover:text-primary">
                {skill.data.title}
              </Link>
              <p className="mt-1 text-sm text-muted-foreground">
                <code>{skill.data.name}</code>
                {skill.data.version !== undefined && ` · v${skill.data.version}`}
                {' · '}
                <time dateTime={skill.data.date.toISOString()}>
                  {formatDate(skill.data.date)}
                </time>
              </p>
              {skill.data.description && (
                <p className="mt-1 text-sm text-muted-foreground">{skill.data.description}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
