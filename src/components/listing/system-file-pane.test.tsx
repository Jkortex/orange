// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubBrowserApis, unstubBrowserApis } from '@/components/test-utils/stub-browser-apis'
import type { SystemPackageOutline } from '@/lib/content'
import { SystemShell } from './system-shell'
import { SystemFilePane, type RenderedSystemFile } from './system-file-pane'

vi.mock('next/navigation', () => ({
  usePathname: () => '/systems/mini-raft/cmd/main.go',
}))

beforeEach(() => {
  stubBrowserApis()
})

afterEach(() => {
  cleanup()
  unstubBrowserApis()
})

const outline: SystemPackageOutline = {
  slug: 'mini-raft',
  data: {
    title: 'Mini Raft',
    description: 'Raft 实现',
    date: new Date('2026-11-02'),
    category: 'systems',
    tags: ['go'],
    name: 'mini-raft',
    language: 'Go',
  },
  tree: [{ name: 'cmd', path: 'cmd', type: 'directory', children: [] }],
  filePaths: ['cmd/main.go', 'README.md'],
  fileCount: 2,
  lineCount: 8,
}

function renderPane(file: RenderedSystemFile) {
  return render(
    <SystemShell outline={outline}>
      <SystemFilePane
        slug="mini-raft"
        file={file}
        filePaths={outline.filePaths}
        title={outline.data.title}
        metrics={{ language: 'Go', fileCount: 2, lineCount: 8 }}
      />
    </SystemShell>,
  )
}

describe('SystemFilePane 文件内容面板', () => {
  it('代码文件走代码视图，折行偏好由外壳持有', () => {
    renderPane({ path: 'cmd/main.go', content: 'package main', headings: [], node: null })

    expect(screen.getByText('package main')).toBeTruthy()

    const wrapBtn = screen.getByRole('button', { name: /折行/ })
    fireEvent.click(wrapBtn)
    expect(wrapBtn.getAttribute('aria-pressed')).toBe('true')
  })

  it('Markdown 文件渲染服务端编译好的正文，并可切换源码', () => {
    renderPane({
      path: 'README.md',
      content: '# 标题',
      headings: [],
      node: <div data-testid="markdown-rendered">正文</div>,
    })

    expect(screen.getByTestId('markdown-rendered')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /查看源码/ }))
    expect(screen.queryByTestId('markdown-rendered')).toBeNull()
    expect(screen.getByText('# 标题')).toBeTruthy()
  })

  it('二进制或超大文件只提示路径', () => {
    renderPane({ path: 'logo.png', content: null, headings: [], node: null })

    expect(screen.getByText(/二进制或大文件/)).toBeTruthy()
  })
})
