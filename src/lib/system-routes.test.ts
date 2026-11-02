import { describe, expect, it } from 'vitest'
import {
  SYSTEM_ENTRY_FILE,
  activeSystemPath,
  findSystemFileByRoute,
  listSystemAttachments,
  systemDownloadHref,
  systemFileHref,
  systemRouteParams,
  systemSlugFromPathname,
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

  describe('activeSystemPath', () => {
    it('系统根路由对应入口文件', () => {
      expect(activeSystemPath('/systems/mini-raft', 'mini-raft')).toBe(SYSTEM_ENTRY_FILE)
      expect(activeSystemPath('/systems/mini-raft/', 'mini-raft')).toBe(SYSTEM_ENTRY_FILE)
    })

    it('由地址还原当前文件路径（含 URL 编码）', () => {
      expect(activeSystemPath('/systems/mini-raft/cmd/main.go', 'mini-raft')).toBe('cmd/main.go')
      expect(activeSystemPath('/systems/mini-raft/a%20b.go', 'mini-raft')).toBe('a b.go')
    })

    it('地址不属于该工程时回退到入口', () => {
      expect(activeSystemPath('/systems/other/cmd/main.go', 'mini-raft')).toBe(SYSTEM_ENTRY_FILE)
    })
  })

  describe('systemSlugFromPathname', () => {
    it('识别工程根与文件页，非系统路由返回 null', () => {
      expect(systemSlugFromPathname('/systems/mini-raft')).toBe('mini-raft')
      expect(systemSlugFromPathname('/systems/mini-raft/cmd/main.go')).toBe('mini-raft')
      expect(systemSlugFromPathname('/systems')).toBeNull()
      expect(systemSlugFromPathname('/posts/hello')).toBeNull()
    })
  })

  describe('systemDownloadHref', () => {
    it('指向构建期生成的静态压缩包', () => {
      expect(systemDownloadHref('mini-raft')).toBe('/downloads/systems/mini-raft.zip')
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
