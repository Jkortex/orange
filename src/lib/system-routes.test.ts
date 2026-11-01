import { describe, expect, it } from 'vitest'
import {
  SYSTEM_ENTRY_FILE,
  findSystemFileByRoute,
  listSystemAttachments,
  systemFileHref,
  systemRouteParams,
} from './system-routes'
import type { SystemPackage } from './content'

function mockPackage(slug: string, paths: string[]): SystemPackage {
  return {
    slug,
    data: {
      title: slug,
      date: new Date('2026-11-02'),
      tags: ['system'],
      name: slug,
      category: 'systems',
    },
    body: '# Readme',
    tree: [],
    files: paths.map((path) => ({
      path,
      content: 'dummy',
      size: 10,
    })),
  }
}

describe('system-routes', () => {
  describe('systemFileHref', () => {
    it('入口 SYSTEM.md 映射到系统根路由 /systems/<slug>', () => {
      expect(systemFileHref('mini-raft', SYSTEM_ENTRY_FILE)).toBe('/systems/mini-raft')
    })

    it('附属文件映射到 /systems/<slug>/<path> 且保留扩展名', () => {
      expect(systemFileHref('mini-raft', 'cmd/main.go')).toBe('/systems/mini-raft/cmd/main.go')
      expect(systemFileHref('mini-raft', 'internal/raft/state.go')).toBe(
        '/systems/mini-raft/internal/raft/state.go',
      )
    })
  })

  describe('systemRouteParams', () => {
    it('将文件路径切分为 catch-all 参数段', () => {
      expect(systemRouteParams('cmd/main.go')).toEqual(['cmd', 'main.go'])
      expect(systemRouteParams('internal/raft/state.go')).toEqual(['internal', 'raft', 'state.go'])
    })
  })

  describe('listSystemAttachments', () => {
    it('排除入口 SYSTEM.md，仅保留附属文件', () => {
      const pkg = mockPackage('mini-raft', [
        SYSTEM_ENTRY_FILE,
        'cmd/main.go',
        'internal/raft/state.go',
      ])
      const attachments = listSystemAttachments(pkg)
      expect(attachments.map((f) => f.path)).toEqual(['cmd/main.go', 'internal/raft/state.go'])
    })
  })

  describe('findSystemFileByRoute', () => {
    const pkg = mockPackage('mini-raft', [
      SYSTEM_ENTRY_FILE,
      'cmd/main.go',
      'internal/raft/state.go',
    ])

    it('根据路径段反查系统文件', () => {
      const found = findSystemFileByRoute(pkg.files, ['cmd', 'main.go'])
      expect(found?.path).toBe('cmd/main.go')
    })

    it('匹配不到或匹配 SYSTEM.md 返回 undefined', () => {
      expect(findSystemFileByRoute(pkg.files, ['SYSTEM.md'])).toBeUndefined()
      expect(findSystemFileByRoute(pkg.files, ['not-found.go'])).toBeUndefined()
    })
  })
})
