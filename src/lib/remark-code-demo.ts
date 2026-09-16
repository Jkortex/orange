import type { Root, Code, Paragraph, Text } from 'mdast'
import { visit } from 'unist-util-visit'

/*
 * remark 插件：解析 :::demo 或 :::code-demo 容器指令
 * - 从子节点提取 ```html、```css、```js 代码块源码
 * - 将容器转换为 <code-demo> hast 元素，透传 html、css、js 及 title
 * - 保留子代码块供 rehype-pretty-code 继续执行语法高亮
 */

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

export function remarkCodeDemo() {
  return (tree: Root) => {
    visit(tree, (rawNode) => {
      const node = rawNode as DirectiveNode
      if (node.type !== 'containerDirective') return
      if (node.name !== 'demo' && node.name !== 'code-demo') return

      let html = ''
      let css = ''
      let js = ''
      let title =
        (typeof node.attributes?.title === 'string' ? node.attributes.title : '') ||
        (typeof node.attributes?.name === 'string' ? node.attributes.name : '')

      const filteredChildren: Array<{ type: string; [key: string]: unknown }> = []

      for (const child of node.children || []) {
        if (child.type === 'paragraph' && !title) {
          const para = child as unknown as Paragraph
          const text = para.children
            .filter((c): c is Text => c.type === 'text')
            .map((c) => c.value)
            .join('')
          if (text) {
            title = text
            continue
          }
        }

        if (child.type === 'code') {
          const code = child as unknown as Code
          const lang = (code.lang || '').toLowerCase()
          if (lang === 'html') {
            html = code.value
          } else if (lang === 'css') {
            css = code.value
          } else if (lang === 'js' || lang === 'javascript') {
            js = code.value
          }

          const data = (code.data || (code.data = {})) as Record<string, unknown>
          const hProperties = (data.hProperties || (data.hProperties = {})) as Record<string, unknown>
          hProperties['data-demo-lang'] = lang
          filteredChildren.push(code as unknown as { type: string; [key: string]: unknown })
        } else {
          filteredChildren.push(child)
        }
      }

      node.children = filteredChildren

      const data = node.data || (node.data = {})
      data.hName = 'code-demo'
      data.hProperties = {
        title,
        html,
        css,
        js,
      }
    })
  }
}
