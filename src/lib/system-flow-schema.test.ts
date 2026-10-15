import { describe, expect, it } from 'vitest'
import { parseSystemFlowConfig } from '@/lib/system-flow-schema'

describe('parseSystemFlowConfig 校验与解析', () => {
  it('正确解析标准的拓扑与步骤配置', () => {
    const raw = {
      title: '读写分离与缓存流转',
      height: 450,
      nodes: [
        { id: 'client', label: 'Client', type: 'client', x: 50, y: 100 },
        { id: 'redis', label: 'Redis Cache', type: 'cache', x: 250, y: 100 },
        { id: 'mysql', label: 'MySQL Primary', type: 'database', x: 450, y: 100 },
      ],
      edges: [
        { id: 'e1', source: 'client', target: 'redis', label: 'Query' },
        { id: 'e2', source: 'redis', target: 'mysql', label: 'Miss 回源' },
      ],
      steps: [
        {
          step: 1,
          title: '查询缓存',
          description: '客户端首先访问 Redis 缓存集群',
          activeEdges: ['e1'],
          activeNodes: ['client', 'redis'],
        },
        {
          step: 2,
          title: '缓存未命中，查数据库',
          description: 'Redis 未命中，回源查询 MySQL 主库',
          activeEdges: ['e2'],
          activeNodes: ['redis', 'mysql'],
          nodeStatus: { redis: 'warning' },
        },
      ],
    }

    const result = parseSystemFlowConfig(raw)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.title).toBe('读写分离与缓存流转')
      expect(result.data.height).toBe(450)
      expect(result.data.nodes).toHaveLength(3)
      expect(result.data.edges).toHaveLength(2)
      expect(result.data.steps).toHaveLength(2)
      expect(result.data.steps?.[1].nodeStatus?.redis).toBe('warning')
    }
  })

  it('支持从 JSON 字符串输入解析', () => {
    const jsonStr = JSON.stringify({
      nodes: [{ id: 'a', label: 'Service A' }],
      edges: [],
    })
    const result = parseSystemFlowConfig(jsonStr)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.nodes[0].x).toBe(0)
      expect(result.data.nodes[0].y).toBe(0)
      expect(result.data.nodes[0].type).toBe('default')
    }
  })

  it('缺失必填字段时返回友好错误而不是 throw', () => {
    // 缺少 label
    const invalid = {
      nodes: [{ id: 'a' }],
      edges: [],
    }
    const result = parseSystemFlowConfig(invalid)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBeTruthy()
    }
  })

  it('JSON 格式损坏时返回解析错误', () => {
    const brokenJson = '{ nodes: [ invalid json }'
    const result = parseSystemFlowConfig(brokenJson)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('JSON')
    }
  })
})
