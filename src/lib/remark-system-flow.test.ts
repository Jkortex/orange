import { describe, expect, it } from 'vitest'
import type { Root as MdastRoot } from 'mdast'
import { remarkSystemFlow } from '@/lib/remark-system-flow'

interface DirectiveNode {
  type: string
  name?: string
  attributes?: Record<string, unknown>
  children?: Array<{ type: string; [key: string]: unknown }>
  data?: {
    hName?: string
    hProperties?: Record<string, unknown>
    [key: string]: unknown
  }
}

describe('remarkSystemFlow 插件测试', () => {
  it('正确解析包含标题与 JSON 代码块的 :::system-flow 容器', () => {
    const config = {
      nodes: [{ id: '1', label: 'Node 1' }],
      edges: [],
    }

    const node: DirectiveNode = {
      type: 'containerDirective',
      name: 'system-flow',
      attributes: { title: '测试流程图' },
      children: [
        {
          type: 'code',
          lang: 'json',
          value: JSON.stringify(config),
        },
      ],
    }

    const tree = { type: 'root', children: [node] } as unknown as MdastRoot
    remarkSystemFlow()(tree)

    expect(node.data?.hName).toBe('system-flow')
    expect(node.data?.hProperties?.title).toBe('测试流程图')
    expect(node.data?.hProperties?.rawConfig).toBe(JSON.stringify(config))
  })

  it('支持首行段落作为标题，以及支持无 attributes 的写法', () => {
    const node: DirectiveNode = {
      type: 'containerDirective',
      name: 'system-flow',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: '段落标题：读写分离拓扑' }],
        },
        {
          type: 'code',
          lang: 'json',
          value: '{"nodes":[{"id":"a","label":"A"}],"edges":[]}',
        },
      ],
    }

    const tree = { type: 'root', children: [node] } as unknown as MdastRoot
    remarkSystemFlow()(tree)

    expect(node.data?.hName).toBe('system-flow')
    expect(node.data?.hProperties?.title).toBe('段落标题：读写分离拓扑')
    expect(node.data?.hProperties?.rawConfig).toBe('{"nodes":[{"id":"a","label":"A"}],"edges":[]}')
  })

  it('如果指令内没有 code 节点，不认领（不挂载 hName）', () => {
    const node: DirectiveNode = {
      type: 'containerDirective',
      name: 'system-flow',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: '纯文字无配置' }],
        },
      ],
    }

    const tree = { type: 'root', children: [node] } as unknown as MdastRoot
    remarkSystemFlow()(tree)

    expect(node.data?.hName).toBeUndefined()
  })

  it('其他指令（如 note, demo 等）不被误认领', () => {
    const node: DirectiveNode = {
      type: 'containerDirective',
      name: 'note',
      children: [{ type: 'code', lang: 'json', value: '{}' }],
    }

    const tree = { type: 'root', children: [node] } as unknown as MdastRoot
    remarkSystemFlow()(tree)

    expect(node.data?.hName).toBeUndefined()
  })
})
