import { describe, expect, it } from 'vitest'
import {
  SKILL_ENTRY_FILE,
  findSkillFileByRoute,
  findSkillFileRouteCollisions,
  listSkillAttachments,
  skillFileHref,
  skillFileRoutePath,
  skillRouteParams,
} from '@/lib/skill-routes'
import type { SkillPackage } from '@/lib/content'

const pkg: SkillPackage = {
  slug: 'tdd-basics',
  data: {
    title: 'TDD 基础',
    date: new Date('2026-09-14'),
    tags: [],
    name: 'tdd-basics',
  },
  body: '入口',
  files: [
    { path: 'SKILL.md', content: '入口' },
    { path: 'references/pitfalls.md', content: '坑点' },
    { path: 'templates/checklist.md', content: '清单' },
  ],
}

describe('skillFileRoutePath', () => {
  it('去掉最后一段扩展名，保留目录层级', () => {
    expect(skillFileRoutePath('references/pitfalls.md')).toBe('references/pitfalls')
    expect(skillFileRoutePath('templates/checklist.md')).toBe('templates/checklist')
  })

  it('非 md 文件同样去扩展名（保持 URL 不出现双扩展名）', () => {
    expect(skillFileRoutePath('assets/icon.png')).toBe('assets/icon')
    expect(skillFileRoutePath('scripts/run.sh')).toBe('scripts/run')
  })

  it('无扩展名的文件原样返回', () => {
    expect(skillFileRoutePath('LICENSE')).toBe('LICENSE')
  })

  it('点开头的文件（.gitignore）不当作扩展名剥掉', () => {
    expect(skillFileRoutePath('.gitignore')).toBe('.gitignore')
    expect(skillFileHref('tdd-basics', '.gitignore')).toBe('/skills/tdd-basics/.gitignore')
  })
})

describe('skillFileHref', () => {
  it('入口文件 SKILL.md 就是包页面本身，不额外占一层路由', () => {
    expect(skillFileHref('tdd-basics', SKILL_ENTRY_FILE)).toBe('/skills/tdd-basics')
  })

  it('附属文件挂到包路由之下', () => {
    expect(skillFileHref('tdd-basics', 'references/pitfalls.md')).toBe(
      '/skills/tdd-basics/references/pitfalls',
    )
  })

  it('路径含非 ASCII 时逐段编码，产出合法 URL', () => {
    expect(skillFileHref('tdd-basics', '参考/坑点.md')).toBe(
      '/skills/tdd-basics/%E5%8F%82%E8%80%83/%E5%9D%91%E7%82%B9',
    )
  })
})

describe('skillRouteParams', () => {
  it('转成 catch-all 需要的路径段数组', () => {
    expect(skillRouteParams('references/pitfalls.md')).toEqual(['references', 'pitfalls'])
    expect(skillRouteParams('assets/icon.png')).toEqual(['assets', 'icon'])
  })
})

describe('listSkillAttachments', () => {
  it('附件 = 除入口外的全部文件（保持排序）', () => {
    expect(listSkillAttachments(pkg).map((f) => f.path)).toEqual([
      'references/pitfalls.md',
      'templates/checklist.md',
    ])
  })
})

describe('findSkillFileByRoute', () => {
  it('由路由段反查回包内文件', () => {
    expect(findSkillFileByRoute(pkg.files, ['references', 'pitfalls'])?.path).toBe(
      'references/pitfalls.md',
    )
  })

  it('未知路径与入口路径都查不到文件（交由路由 404）', () => {
    expect(findSkillFileByRoute(pkg.files, ['references', 'nope'])).toBeUndefined()
    expect(findSkillFileByRoute(pkg.files, ['SKILL'])).toBeUndefined()
  })
})

describe('findSkillFileRouteCollisions', () => {
  it('去扩展名后撞车时报出冲突文件（否则一个文件会覆盖另一个）', () => {
    const collisions = findSkillFileRouteCollisions([
      { path: 'notes.md', content: 'a' },
      { path: 'notes.txt', content: 'b' },
    ])

    expect(collisions).toEqual([['notes', ['notes.md', 'notes.txt']]])
  })

  it('入口文件不参与撞车检查（它在上一层路由）', () => {
    expect(
      findSkillFileRouteCollisions([
        { path: 'SKILL.md', content: 'a' },
        { path: 'SKILL.txt', content: 'b' },
      ]),
    ).toEqual([])
  })

  it('正常包没有撞车', () => {
    expect(findSkillFileRouteCollisions(pkg.files)).toEqual([])
  })
})
