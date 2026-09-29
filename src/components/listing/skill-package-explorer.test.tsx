// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { cleanup, render, screen } from '@testing-library/react'
import {
  SkillPackageExplorer,
  type RenderedSkillFile,
} from '@/components/listing/skill-package-explorer'
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

function renderExplorer(activePath: string) {
  const file = renderedFiles.find((f) => f.path === activePath)
  if (!file) throw new Error(`测试夹具缺少文件：${activePath}`)
  return render(
    <SkillPackageExplorer
      pkg={pkg}
      renderedFile={file}
      activePath={file.path}
    />,
  )
}

describe('SkillPackageExplorer 当前文件渲染', () => {
  it('渲染当前文件及其目录', () => {
    renderExplorer('SKILL.md')

    expect(screen.getByText('主文档编译节点')).toBeTruthy()
    expect(screen.getAllByRole('link', { name: '步骤一' }).length).toBeGreaterThan(0)
  })

  it('只挂载当前文件，避免隐藏 DOM 与重复 heading id', () => {
    renderExplorer('SKILL.md')

    expect(screen.getByText('主文档编译节点')).toBeTruthy()
    expect(screen.queryByText('模板编译节点')).toBeNull()
  })

  it('activePath 指向附件时，渲染该文件与它的目录', () => {
    renderExplorer('templates/tmpl.md')

    expect(screen.getByText('模板编译节点')).toBeTruthy()
    expect(screen.queryByText('主文档编译节点')).toBeNull()
    expect(screen.getAllByRole('link', { name: '模板说明' }).length).toBeGreaterThan(0)
  })

  it('文件列表是各文件静态页链接，当前文件标记 aria-current', () => {
    renderExplorer('templates/tmpl.md')

    const links = screen.getAllByRole('link', { name: /templates\/tmpl\.md/ })
    expect(links[0].getAttribute('href')).toBe('/skills/test-skill/templates/tmpl')
    expect(links.some((link) => link.getAttribute('aria-current') === 'page')).toBe(true)

    const entry = screen.getAllByRole('link', { name: 'SKILL.md' })[0]
    expect(entry.getAttribute('href')).toBe('/skills/test-skill')
  })

  it('不再用按钮在客户端切换文件（文件切换 = 路由导航）', () => {
    renderExplorer('SKILL.md')

    expect(screen.queryByRole('button', { name: /templates\/tmpl\.md/ })).toBeNull()
  })
})

describe('SkillPackageExplorer 其他交互', () => {
  it('渲染下载技能包按钮', () => {
    renderExplorer('SKILL.md')

    const downloadBtn = screen.getByRole('button', { name: /下载技能包/ })
    expect(downloadBtn).toBeTruthy()
  })

  it('JSZip 仅在点击下载时动态加载', () => {
    const source = readFileSync('src/components/listing/skill-package-explorer.tsx', 'utf8')

    expect(source).not.toMatch(/^import JSZip/m)
    expect(source).toContain("import('jszip')")
  })
})
