// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SkillPackageExplorer, type RenderedSkillFile } from '@/components/listing/skill-package-explorer'
import type { SkillPackage } from '@/lib/content'

afterEach(() => {
  cleanup()
})

const pkg: SkillPackage = {
  slug: 'test-skill',
  data: {
    title: '测试技能包',
    date: new Date('2026-09-14'),
    tags: ['tools'],
    name: 'test-skill',
    version: '1.0.0',
  },
  body: '## 步骤一\n\n主文档正文',
  files: [
    { path: 'SKILL.md', content: '## 步骤一\n\n主文档正文' },
    { path: 'templates/tmpl.md', content: '## 模板说明\n\n模板内容' },
  ],
}

const renderedFiles: RenderedSkillFile[] = [
  {
    path: 'SKILL.md',
    content: '## 步骤一\n\n主文档正文',
    headings: [{ depth: 2, text: '步骤一', id: '步骤一' }],
    node: <p>主文档编译节点</p>,
  },
  {
    path: 'templates/tmpl.md',
    content: '## 模板说明\n\n模板内容',
    headings: [{ depth: 2, text: '模板说明', id: '模板说明' }],
    node: <p>模板编译节点</p>,
  },
]

describe('SkillPackageExplorer 交互测试', () => {
  it('默认显示 SKILL.md，并显示其对应目录', () => {
    render(<SkillPackageExplorer pkg={pkg} renderedFiles={renderedFiles} />)

    expect(screen.getByText('主文档编译节点')).toBeTruthy()
    expect(screen.getAllByRole('link', { name: '步骤一' }).length).toBeGreaterThan(0)
  })

  it('点击左侧或标签栏的切换文件，切换当前正文与右侧目录', () => {
    render(<SkillPackageExplorer pkg={pkg} renderedFiles={renderedFiles} />)

    const tmplButtons = screen.getAllByRole('button', { name: /templates\/tmpl\.md/ })
    fireEvent.click(tmplButtons[0])

    expect(screen.getByText('模板编译节点')).toBeTruthy()
    expect(screen.getAllByRole('link', { name: '模板说明' }).length).toBeGreaterThan(0)
  })

  it('渲染下载技能包按钮', () => {
    render(<SkillPackageExplorer pkg={pkg} renderedFiles={renderedFiles} />)

    const downloadBtn = screen.getByRole('button', { name: /下载技能包/ })
    expect(downloadBtn).toBeTruthy()
  })

  it('JSZip 仅在点击下载时动态加载', () => {
    const source = readFileSync('src/components/listing/skill-package-explorer.tsx', 'utf8')

    expect(source).not.toMatch(/^import JSZip/m)
    expect(source).toContain("import('jszip')")
  })
})
