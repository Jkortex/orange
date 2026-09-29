import { describe, expect, it, vi } from 'vitest'
import {
  getAllEntries,
  getAllTags,
  getCategories,
  getSkillPackage,
  listSkillSlugs,
  TAGGED_TYPES,
} from '@/lib/content'
import type { SkillPackage } from '@/lib/content'
import sitemap from './sitemap'

vi.mock('@/lib/content', () => ({
  getAllEntries: vi.fn(() => []),
  getAllTags: vi.fn(() => []),
  getCategories: vi.fn(() => []),
  getSkillPackage: vi.fn(),
  listSkillSlugs: vi.fn(() => []),
  TAGGED_TYPES: ['posts', 'life', 'music', 'skills'],
}))

const mockedGet = vi.mocked(getSkillPackage)
const mockedList = vi.mocked(listSkillSlugs)

function pkg(slug: string, files: string[]): SkillPackage {
  return {
    slug,
    data: {
      title: slug,
      date: new Date('2026-09-14'),
      tags: [],
      name: slug,
    },
    body: '入口',
    files: files.map((path) => ({ path, content: 'x' })),
  }
}

function urls() {
  return sitemap().map((route) => route.url)
}

describe('sitemap 技能包文件页', () => {
  it('列出每个附属文件的可分享地址，入口不重复出现', () => {
    mockedList.mockReturnValue(['tdd'])
    mockedGet.mockReturnValue(
      pkg('tdd', ['SKILL.md', 'references/pitfalls.md', 'templates/checklist.md']),
    )

    expect(urls()).toEqual([
      'https://orange.example.com',
      'https://orange.example.com/life',
      'https://orange.example.com/music',
      'https://orange.example.com/skills',
      'https://orange.example.com/skills/tdd/references/pitfalls',
      'https://orange.example.com/skills/tdd/templates/checklist',
    ])
  })

  it('文件页优先级低于包页，不与正文条目争夺权重', () => {
    mockedList.mockReturnValue(['tdd'])
    mockedGet.mockReturnValue(pkg('tdd', ['SKILL.md', 'notes.md']))

    const fileRoute = sitemap().find((route) => route.url.endsWith('/skills/tdd/notes'))
    expect(fileRoute?.priority).toBe(0.4)
    expect(fileRoute?.lastModified).toEqual(new Date('2026-09-14'))
  })

  it('无技能包时不产生文件页', () => {
    mockedList.mockReturnValue([])
    expect(urls().some((url) => url.includes('/skills/'))).toBe(false)
  })
})
