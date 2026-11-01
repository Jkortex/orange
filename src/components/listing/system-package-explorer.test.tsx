// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SystemPackageExplorer } from './system-package-explorer'
import type { SystemPackage } from '@/lib/content'

afterEach(() => {
  cleanup()
})

const mockPkg: SystemPackage = {
  slug: 'mini-raft',
  data: {
    title: 'Mini Raft 分布式系统',
    description: 'Raft 状态机与共识实现',
    date: new Date('2026-11-02'),
    category: 'systems',
    tags: ['raft', 'go'],
    name: 'mini-raft',
    architecture: 'Leader-Follower',
    language: 'Go',
  },
  body: '# Raft 入口',
  tree: [
    { name: 'SYSTEM.md', path: 'SYSTEM.md', type: 'file', size: 100 },
    {
      name: 'cmd',
      path: 'cmd',
      type: 'directory',
      children: [{ name: 'main.go', path: 'cmd/main.go', type: 'file', size: 50 }],
    },
  ],
  files: [
    { path: 'SYSTEM.md', content: '# Raft 入口', size: 100, lineCount: 1 },
    { path: 'cmd/main.go', content: 'package main', size: 50, lineCount: 1 },
  ],
}

describe('SystemPackageExplorer 系统工程工作台', () => {
  it('正确渲染系统标题、语言与架构信息', () => {
    render(
      <SystemPackageExplorer
        pkg={mockPkg}
        activePath="SYSTEM.md"
        renderedFile={{
          path: 'SYSTEM.md',
          content: '# Raft 入口',
          headings: [{ id: 'raft-heading', text: 'Raft 入口', depth: 2 }],
          node: <div data-testid="markdown-rendered">Raft 入口正文</div>,
        }}
      />,
    )

    expect(screen.getByText('Mini Raft 分布式系统')).toBeTruthy()
    expect(screen.getByText('Go')).toBeTruthy()
    expect(screen.getByText(/Leader-Follower/)).toBeTruthy()
    expect(screen.getByTestId('markdown-rendered')).toBeTruthy()
  })

  it('渲染普通代码文件时调用代码预览组件', () => {
    render(
      <SystemPackageExplorer
        pkg={mockPkg}
        activePath="cmd/main.go"
        renderedFile={{
          path: 'cmd/main.go',
          content: 'package main',
          headings: [],
          node: null,
        }}
      />,
    )

    expect(screen.getByText('package main')).toBeTruthy()
  })
})
