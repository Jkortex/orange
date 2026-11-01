import { describe, expect, it, vi } from 'vitest'
import { getSystemPackage, listSystemSlugs } from '@/lib/content'
import type { SystemPackage } from '@/lib/content'
import { generateStaticParams } from './page'

vi.mock('@/lib/content', () => ({
  getSystemPackage: vi.fn(),
  isContentNotFoundError: vi.fn(() => false),
  listSystemSlugs: vi.fn(),
}))

const mockedGet = vi.mocked(getSystemPackage)
const mockedList = vi.mocked(listSystemSlugs)

function mockPkg(slug: string, files: string[]): SystemPackage {
  return {
    slug,
    data: {
      title: slug,
      date: new Date('2026-11-02'),
      tags: [],
      name: slug,
      category: 'systems',
    },
    body: '入口',
    tree: [],
    files: files.map((path) => ({ path, content: 'x', size: 10 })),
  }
}

describe('系统包文件路由 generateStaticParams', () => {
  it('附属文件各自产生静态参数段，SYSTEM.md 不占子路由', () => {
    mockedList.mockReturnValue(['mini-raft'])
    mockedGet.mockReturnValue(
      mockPkg('mini-raft', ['SYSTEM.md', 'cmd/main.go', 'internal/raft/state.go']),
    )

    expect(generateStaticParams()).toEqual([
      { slug: 'mini-raft', file: ['cmd', 'main.go'] },
      { slug: 'mini-raft', file: ['internal', 'raft', 'state.go'] },
    ])
  })

  it('只有入口文件时不产生子路由', () => {
    mockedList.mockReturnValue(['mini-kv'])
    mockedGet.mockReturnValue(mockPkg('mini-kv', ['SYSTEM.md']))

    expect(generateStaticParams()).toEqual([])
  })
})
