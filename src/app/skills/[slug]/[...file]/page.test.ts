import { describe, expect, it, vi } from 'vitest'
import { getSkillPackage, listSkillSlugs } from '@/lib/content'
import type { SkillPackage } from '@/lib/content'
import { generateStaticParams } from './page'

vi.mock('@/lib/content', () => ({
  getSkillPackage: vi.fn(),
  isContentNotFoundError: vi.fn(() => false),
  listSkillSlugs: vi.fn(),
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

describe('技能包文件路由 generateStaticParams', () => {
  it('每个附属文件一个静态页，入口 SKILL.md 不占子路由', () => {
    mockedList.mockReturnValue(['tdd'])
    mockedGet.mockReturnValue(
      pkg('tdd', ['SKILL.md', 'references/pitfalls.md', 'templates/checklist.md']),
    )

    expect(generateStaticParams()).toEqual([
      { slug: 'tdd', file: ['references', 'pitfalls'] },
      { slug: 'tdd', file: ['templates', 'checklist'] },
    ])
  })

  it('只有入口文件的包不产生子路由', () => {
    mockedList.mockReturnValue(['solo'])
    mockedGet.mockReturnValue(pkg('solo', ['SKILL.md']))

    expect(generateStaticParams()).toEqual([])
  })

  it('两个文件去掉扩展名后撞车时直接让构建失败，不静默覆盖', () => {
    mockedList.mockReturnValue(['bad'])
    mockedGet.mockReturnValue(pkg('bad', ['SKILL.md', 'notes.md', 'notes.txt']))

    expect(() => generateStaticParams()).toThrow(/notes\.md[\s\S]*notes\.txt/)
  })
})
