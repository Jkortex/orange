import type { Metadata } from 'next'
import { getSkillEntries } from '@/lib/content'
import { SkillsExplorer, type SkillItem } from '@/components/listing/skills-explorer'

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
    <div className="mx-auto w-full max-w-5xl animate-in fade-in-50 duration-300">
      <div className="mb-8 space-y-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">技能</h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          可交互的开发技能包与工作流 · 按分类过滤，即时切换。
        </p>
      </div>
      <SkillsExplorer skills={skills} />
    </div>
  )
}
