import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderServerComponent } from './test-utils/render-server'
import { SkillPackageView } from './skill-package-view'
import type { SkillPackage } from '@/lib/content'

async function renderToHtml(pkg: SkillPackage) {
  return renderServerComponent(h(SkillPackageView, { pkg }))
}

function makePackage(): SkillPackage {
  return {
    slug: '2026-09-14-tdd-basics',
    data: {
      title: 'TDD 基础',
      date: new Date('2026-09-14'),
      tags: ['testing'],
      description: '红绿重构循环。',
      name: 'tdd-basics',
      version: '1.0.0',
    },
    body: '## 红\n\n先写失败的测试。\n\n## 绿\n\n让它通过。\n\n## 重构\n\n清理重复。',
    files: [
      { path: 'SKILL.md', content: '入口' },
      { path: 'references/pitfalls.md', content: '## 坑点\n\n别测实现细节。' },
      { path: 'templates/checklist.md', content: '## 清单\n\n- 跑测试\n' },
    ],
  }
}

describe('SkillPackageView 目录展示', () => {
  it('返回首页 + 标题 + 技能元信息（name/version）', async () => {
    const html = await renderToHtml(makePackage())

    expect(html).toContain('href="/"')
    expect(html).toContain('TDD 基础')
    expect(html).toContain('tdd-basics')
    expect(html).toContain('1.0.0')
  })

  it('头部显示文件 pills + 侧边栏列出全部文件并链到对应锚点', async () => {
    const html = await renderToHtml(makePackage())

    // header 文件 pills
    expect(html).toContain('references/pitfalls.md')
    expect(html).toContain('templates/checklist.md')
    // sidebar 文件列表
    expect(html).toContain('aria-label="技能导航"')
    expect(html).toContain('SKILL.md')
  })

  it('侧边栏含 heading TOC（目录）+ 文件列表两个分区', async () => {
    const html = await renderToHtml(makePackage())

    expect(html).toContain('目录')
    expect(html).toContain('文件')
    // heading TOC 包含 SKILL.md 的二级标题
    expect(html).toContain('#红')
    expect(html).toContain('#绿')
    expect(html).toContain('#重构')
  })

  it('侧边栏桌面端 sticky + 右侧，窄屏隐藏', async () => {
    const html = await renderToHtml(makePackage())

    expect(html).toContain('<aside')
    expect(html).toContain('md:sticky')
    expect(html).toContain('hidden md:block')
  })

  it('入口正文渲染 + 附属 md 文件分节渲染', async () => {
    const html = await renderToHtml(makePackage())

    expect(html).toContain('先写失败的测试')
    expect(html).toContain('别测实现细节')
    expect(html).toContain('跑测试')
  })
})

describe('SkillPackageView 异常渲染', () => {
  it('二进制文件仅列出路径并注明，不渲染内容', async () => {
    const pkg = makePackage()
    pkg.files.push({ path: 'assets/icon.png', content: null })
    const html = await renderToHtml(pkg)

    expect(html).toContain('assets/icon.png')
  })

  it('无附属文件时侧边栏仅含 heading TOC，无文件列表', async () => {
    const pkg = makePackage()
    pkg.files = [{ path: 'SKILL.md', content: '入口' }]
    const html = await renderToHtml(pkg)

    // 有 heading TOC（body 有 3 个二级标题）
    expect(html).toContain('技能导航')
    expect(html).toContain('目录')
    expect(html).toContain('#红')
    // 无文件列表分区
    expect(html).not.toContain('>文件<')
    expect(html).toContain('先写失败的测试')
  })
})
