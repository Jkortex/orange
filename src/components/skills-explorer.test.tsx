// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SkillsExplorer, type SkillItem } from './skills-explorer'

afterEach(() => {
  cleanup()
})

const skills: SkillItem[] = [
  {
    slug: '2026-09-14-tdd-basics',
    title: 'TDD 基础',
    name: 'tdd-basics',
    version: '1.0.0',
    date: '2026-09-14T00:00:00.000Z',
    category: 'workflow',
    tags: ['testing'],
    description: '红绿重构循环',
  },
  {
    slug: '2026-09-10-git-flow',
    title: 'Git 工作流',
    name: 'git-flow',
    date: '2026-09-10T00:00:00.000Z',
    category: 'git',
    tags: ['git'],
  },
]

describe('SkillsExplorer 正常渲染', () => {
  it('侧栏渲染「最近」与分类（含条数）', () => {
    render(<SkillsExplorer skills={skills} />)

    expect(screen.getByRole('button', { name: '最近' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'workflow 1' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'git 1' })).toBeTruthy()
  })

  it('条目渲染名称、代号与链接', () => {
    render(<SkillsExplorer skills={skills} />)

    const link = screen.getByRole('link', { name: 'TDD 基础' }) as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/skills/2026-09-14-tdd-basics')
    expect(screen.getByText('tdd-basics')).toBeTruthy()
  })

  it('点击分类过滤条目', () => {
    render(<SkillsExplorer skills={skills} />)

    fireEvent.click(screen.getByRole('button', { name: 'workflow 1' }))

    expect(screen.getByRole('link', { name: 'TDD 基础' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Git 工作流' })).toBeNull()
  })
})
