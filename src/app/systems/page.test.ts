import { describe, expect, it, vi } from 'vitest'
import { renderServerComponent } from '@/components/test-utils/render-server'
import SystemsPage from './page'
import { getSystemEntries } from '@/lib/content'

vi.mock('@/lib/content', () => ({
  getSystemEntries: vi.fn(),
}))

const mockedEntries = vi.mocked(getSystemEntries)

describe('/systems 系统列表页', () => {
  it('正确渲染标题和系统列表项', async () => {
    mockedEntries.mockReturnValue([
      {
        collection: 'systems',
        slug: 'mini-raft',
        data: {
          title: 'Mini Raft 分布式系统',
          description: 'Raft 状态机与共识实现',
          date: new Date('2026-11-02'),
          category: 'systems',
          tags: ['raft'],
          name: 'mini-raft',
          language: 'Go',
        },
        body: '',
      },
    ])

    const html = await renderServerComponent(SystemsPage())
    expect(html).toContain('系统')
    expect(html).toContain('Mini Raft 分布式系统')
    expect(html).toContain('mini-raft')
  })
})
