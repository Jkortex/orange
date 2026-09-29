import { describe, expect, it } from 'vitest'
import type { Root as HastRoot } from 'hast'
import type { Root as MdastRoot } from 'mdast'
import { rehypeHeadingIds } from '@/lib/rehype-heading-ids'
import { rehypeKeepCssVars } from '@/lib/rehype-css-vars'
import { remarkCallouts } from '@/lib/remark-callouts'
import { remarkDirectiveFallback } from '@/lib/remark-directive-fallback'
import { slugifyHeading } from '@/lib/toc'

/*
 * 插件层单测：这些转换器此前只经 markdown.test.ts 端到端间接覆盖，
 * 分支（偏移量缺失、已有 id、未知指令）出错时端到端断言往往仍然通过，故在此逐支路固化契约。
 * 直接构造 AST 而不是跑 unified 管线：unified / remark-parse 不是声明依赖，
 * pnpm 的严格 node_modules 下测试里 import 不到。
 */

describe('remarkDirectiveFallback 未处理指令还原为文本', () => {
  it('按源文件偏移量还原原文，并把相邻文本节点合并回去', () => {
    const tree = {
      type: 'root',
      children: [
        { type: 'text', value: '案例一：' },
        {
          type: 'textDirective',
          name: 'is',
          attributes: {},
          children: [],
          position: { start: { offset: 4 }, end: { offset: 9 } },
        },
        { type: 'text', value: ' 简化' },
      ],
    } as unknown as MdastRoot

    remarkDirectiveFallback()(tree, { value: '案例一：:is() 简化' })

    // 三个节点合并成一个文本节点，否则 TOC 取标题文本时会得到带空档的结果
    expect(tree.children).toHaveLength(1)
    expect(tree.children[0]).toEqual({ type: 'text', value: '案例一：:is() 简化' })
  })

  it('拿不到文件内容或偏移量时退化为 :name', () => {
    const node = { type: 'textDirective', name: 'where', position: undefined }
    const tree = { type: 'root', children: [node] } as unknown as MdastRoot

    remarkDirectiveFallback()(tree)

    expect(tree.children[0]).toEqual({ type: 'text', value: ':where' })
  })

  it('还原后清掉指令专有字段，不留半截指令节点', () => {
    const node = {
      type: 'leafDirective',
      name: 'before',
      attributes: { a: '1' },
      children: [{ type: 'text', value: 'x' }],
      data: { hName: 'div' },
      position: { start: { offset: 0 }, end: { offset: 8 } },
    }
    const tree = { type: 'root', children: [node] } as unknown as MdastRoot

    remarkDirectiveFallback()(tree, { value: '::before' })

    expect(Object.keys(node).sort()).toEqual(['position', 'type', 'value'])
    expect(node).toMatchObject({ type: 'text', value: '::before' })
  })

  it('已被 remarkCallouts 认领的容器指令原样保留（:::note 不能被吃成文本）', () => {
    const note = {
      type: 'containerDirective',
      name: 'note',
      data: { hName: 'note' },
      children: [{ type: 'text', value: '提示内容' }],
    }
    const tree = { type: 'root', children: [note] } as unknown as MdastRoot

    remarkDirectiveFallback()(tree)

    expect(tree.children[0]).toBe(note)
    expect(note.type).toBe('containerDirective')
    expect(note.children).toEqual([{ type: 'text', value: '提示内容' }])
  })

  it('没有指令时不动树，也不因缺 children 抛错', () => {
    const tree = { type: 'root', children: [] } as unknown as MdastRoot

    expect(() => remarkDirectiveFallback()(tree)).not.toThrow()
    expect(tree.children).toEqual([])
  })
})

describe('remarkCallouts 容器指令映射', () => {
  type DirectiveNode = { type: string; name?: string; children: unknown[]; data?: { hName?: string } }

  it('登记过的 :::note 标记 hName，交由 components 渲染', () => {
    const note: DirectiveNode = { type: 'containerDirective', name: 'note', children: [] }
    const tree = { type: 'root', children: [note] } as unknown as MdastRoot

    remarkCallouts()(tree)

    expect(note.data).toEqual({ hName: 'note' })
  })

  it('未登记的容器指令不标记，留给 fallback 还原为文本', () => {
    const unknown: DirectiveNode = { type: 'containerDirective', name: 'unknown', children: [] }
    const tree = { type: 'root', children: [unknown] } as unknown as MdastRoot

    remarkCallouts()(tree)

    expect(unknown.data).toBeUndefined()
  })

  it('无 name 的容器指令不抛错也不标记', () => {
    const nameless: DirectiveNode = { type: 'containerDirective', children: [] }
    const tree = { type: 'root', children: [nameless] } as unknown as MdastRoot

    expect(() => remarkCallouts()(tree)).not.toThrow()
    expect(nameless.data).toBeUndefined()
  })
})

describe('rehypeKeepCssVars 保护内联 CSS 变量', () => {
  it('style 字符串挪到 data-hast-style 并删掉原字段（style-to-js 会丢掉 --shiki-*）', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'span',
          properties: { style: '--shiki-light:#111;--shiki-dark:#eee', className: ['token'] },
          children: [],
        },
      ],
    } as unknown as HastRoot

    rehypeKeepCssVars()(tree)

    const props = (tree.children[0] as { properties: Record<string, unknown> }).properties
    expect(props['data-hast-style']).toBe('--shiki-light:#111;--shiki-dark:#eee')
    expect(props.style).toBeUndefined()
    expect(props.className).toEqual(['token'])
  })

  it('递归处理嵌套元素', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'code',
          properties: {},
          children: [
            { type: 'element', tagName: 'span', properties: { style: '--shiki-light:#111' }, children: [] },
          ],
        },
      ],
    } as unknown as HastRoot

    rehypeKeepCssVars()(tree)

    const inner = (
      (tree.children[0] as { children: unknown[] }).children[0] as {
        properties: Record<string, unknown>
      }
    ).properties
    expect(inner['data-hast-style']).toBe('--shiki-light:#111')
  })

  it('非字符串 style 与无 style 节点都不动', () => {
    const tree = {
      type: 'root',
      children: [
        { type: 'element', tagName: 'p', properties: { style: { color: 'red' } }, children: [] },
        { type: 'element', tagName: 'p', properties: {}, children: [] },
      ],
    } as unknown as HastRoot

    rehypeKeepCssVars()(tree)

    const [first, second] = tree.children as unknown as Array<{
      properties: Record<string, unknown>
    }>
    expect(first.properties.style).toEqual({ color: 'red' })
    expect(first.properties['data-hast-style']).toBeUndefined()
    expect(second.properties).toEqual({})
  })
})

describe('rehypeHeadingIds 注入锚点', () => {
  function heading(tagName: string, text: string, properties: Record<string, unknown> = {}) {
    return {
      type: 'element',
      tagName,
      properties,
      children: [{ type: 'text', value: text }],
    }
  }

  it('只给 h2/h3 加 id，一级与四级以下不入目录', () => {
    const tree = {
      type: 'root',
      children: [
        heading('h1', '一级'),
        heading('h2', '二级'),
        heading('h3', '三级'),
        heading('h4', '四级'),
      ],
    } as unknown as HastRoot

    rehypeHeadingIds()(tree)

    const ids = (tree.children as unknown as Array<{ properties: Record<string, unknown> }>).map(
      (node) => node.properties.id,
    )
    expect(ids).toEqual([undefined, slugifyHeading('二级'), slugifyHeading('三级'), undefined])
  })

  it('重名标题按出现次序加后缀，与 extractToc 同口径', () => {
    const tree = {
      type: 'root',
      children: [heading('h2', '方法'), heading('h2', '方法'), heading('h2', '方法')],
    } as unknown as HastRoot

    rehypeHeadingIds()(tree)

    const base = slugifyHeading('方法')
    expect(
      (tree.children as unknown as Array<{ properties: Record<string, unknown> }>).map(
        (node) => node.properties.id,
      ),
    ).toEqual([base, `${base}-1`, `${base}-2`])
  })

  it('已有 id 的标题不被覆盖（上游插件已给的锚点优先）', () => {
    const tree = {
      type: 'root',
      children: [heading('h2', '方法', { id: '自定义' })],
    } as unknown as HastRoot

    rehypeHeadingIds()(tree)

    const node = tree.children[0] as unknown as { properties: Record<string, unknown> }
    expect(node.properties.id).toBe('自定义')
  })

  it('标题里嵌了行内元素时取全文文本再算 slug', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'h2',
          properties: {},
          children: [
            { type: 'text', value: '用 ' },
            { type: 'element', tagName: 'code', properties: {}, children: [{ type: 'text', value: 'grid' }] },
            { type: 'text', value: ' 布局' },
          ],
        },
      ],
    } as unknown as HastRoot

    rehypeHeadingIds()(tree)

    const node = tree.children[0] as unknown as { properties: Record<string, unknown> }
    expect(node.properties.id).toBe(slugifyHeading('用 grid 布局'))
  })
})
