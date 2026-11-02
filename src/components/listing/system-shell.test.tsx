// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubBrowserApis, unstubBrowserApis } from '@/components/test-utils/stub-browser-apis'
import type { SystemPackageOutline } from '@/lib/content'

vi.mock('next/navigation', () => ({
  usePathname: () => '/systems/mini-raft/internal/raft/state.go',
}))

import { SystemShell } from './system-shell'

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  stubBrowserApis()
})

afterEach(() => {
  unstubBrowserApis()
})

const outline: SystemPackageOutline = {
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
  tree: [
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
  ],
  filePaths: ['SYSTEM.md', 'internal/raft/state.go'],
  fileCount: 2,
  lineCount: 30,
}

describe('SystemShell 系统工程常驻外壳', () => {
  it('渲染页眉、文件树与子内容，并按当前地址高亮文件', () => {
    render(
      <SystemShell outline={outline}>
        <div data-testid="pane">文件内容</div>
      </SystemShell>,
    )

    expect(screen.getByText('Mini Raft 分布式系统')).toBeTruthy()
    expect(screen.getByText('Go')).toBeTruthy()
    expect(screen.getByText('2 个文件')).toBeTruthy()
    expect(screen.getByTestId('pane')).toBeTruthy()

    // 地址推导出的激活文件（布局层拿不到子路由 params）
    const activeLink = screen.getByRole('link', { name: /state\.go/ })
    expect(activeLink.getAttribute('aria-current')).toBe('page')
  })

  it('下载按钮指向构建期生成的静态 zip', () => {
    render(
      <SystemShell outline={outline}>
        <div />
      </SystemShell>,
    )

    const download = screen.getByRole('link', { name: '下载工程源码' })
    expect(download.getAttribute('href')).toBe('/downloads/systems/mini-raft.zip')
    expect(download.hasAttribute('download')).toBe(true)
  })
})
