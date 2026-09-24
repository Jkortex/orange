import type { Metadata } from 'next'
import { Wrench } from 'lucide-react'
import { getSkillEntries } from '@/lib/content'
import { SkillsExplorer, type SkillItem } from '@/components/listing/skills-explorer'
import { PageHeader } from '@/components/listing/page-header'

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
      <PageHeader
        title="技能"
        description="可交互的开发技能包与工作流 · 按分类过滤，即时切换。"
        icon={<Wrench aria-hidden />}
      />
      <SkillsExplorer skills={skills} />
    </div>
  )
}
