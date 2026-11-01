// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SystemFileTree } from './system-file-tree'
import type { FileTreeNode } from '@/lib/content'

afterEach(() => {
  cleanup()
})

const mockTree: FileTreeNode[] = [
  { name: 'SYSTEM.md', path: 'SYSTEM.md', type: 'file', size: 100 },
  {
    name: 'internal',
    path: 'internal',
    type: 'directory',
    children: [
      {
        name: 'raft',
        path: 'internal/raft',
        type: 'directory',
        children: [
          { name: 'state.go', path: 'internal/raft/state.go', type: 'file', size: 50 },
        ],
      },
    ],
  },
  { name: 'go.mod', path: 'go.mod', type: 'file', size: 30 },
]

describe('SystemFileTree 树形文件导航', () => {
  it('正确渲染文件与目录结构', () => {
    render(<SystemFileTree tree={mockTree} slug="mini-raft" activePath="SYSTEM.md" />)

    expect(screen.getByText('SYSTEM.md')).toBeTruthy()
    expect(screen.getByText('go.mod')).toBeTruthy()
    expect(screen.getByText('internal')).toBeTruthy()
  })

  it('激活的文件带有 aria-current="page"', () => {
    render(
      <SystemFileTree tree={mockTree} slug="mini-raft" activePath="internal/raft/state.go" />,
    )

    const activeLink = screen.getByRole('link', { name: /state\.go/ })
    expect(activeLink.getAttribute('aria-current')).toBe('page')
  })

  it('点击文件夹可以折叠和重新展开', () => {
    render(<SystemFileTree tree={mockTree} slug="mini-raft" activePath="SYSTEM.md" />)

    const folderBtn = screen.getByRole('button', { name: /internal/ })
    // 初始 internal 是展开状态
    expect(screen.getByText('raft')).toBeTruthy()

    // 点击折叠
    fireEvent.click(folderBtn)
    expect(screen.queryByText('raft')).toBeNull()

    // 再次点击展开
    fireEvent.click(folderBtn)
    expect(screen.getByText('raft')).toBeTruthy()
  })
})
