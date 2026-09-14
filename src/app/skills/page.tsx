import type { Metadata } from 'next'
import { getSkillEntries } from '@/lib/content'
import { SkillsExplorer, type SkillItem } from '@/components/skills-explorer'

export const metadata: Metadata = { title: '技能' }

// 技能页：左侧分类列表 + 右侧技能包条目，与文章页保持一致的探索体验
export default function SkillsPage() {
  const skills: SkillItem[] = getSkillEntries().map((entry) => ({
    slug: entry.slug,
    title: entry.data.title,
    date: entry.data.date.toISOString(),
    name: entry.data.name,
    version: entry.data.version,
    author: entry.data.author,
    category: entry.data.category,
    description: entry.data.description,
    tags: entry.data.tags,
  }))

  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="mb-6 text-2xl font-semibold">技能</h1>
      <SkillsExplorer skills={skills} />
    </div>
  )
}
