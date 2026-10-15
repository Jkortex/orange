import type { Root, Code, Paragraph, Text } from 'mdast'
import { visit } from 'unist-util-visit'

/*
 * remark 插件：解析 :::system-flow 容器指令
 * - 提取段落标题（或 title: 属性）
 * - 提取 JSON 代码块中的系统设计拓扑与时序配置
 * - 转换为 <system-flow> hast 元素，交由 markdown.tsx 映射为 SystemFlow 组件
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

function extractText(para: Paragraph): string {
  return para.children
    .filter((c): c is Text => c.type === 'text')
    .map((c) => c.value)
    .join('')
}

const TITLE_RE = /^\s*title\s*[:=]\s*(.+?)\s*$/

export function remarkSystemFlow() {
  return (tree: Root) => {
    visit(tree, (rawNode) => {
      const node = rawNode as DirectiveNode
      if (node.type !== 'containerDirective') return
      if (node.name !== 'system-flow' && node.name !== 'systemflow') return

      let title =
        (typeof node.attributes?.title === 'string' ? node.attributes.title : '') ||
        (typeof node.attributes?.name === 'string' ? node.attributes.name : '')
      let rawConfig = ''

      for (const child of node.children || []) {
        if (child.type === 'paragraph' && !title) {
          const text = extractText(child as unknown as Paragraph).trim()
          const m = text.match(TITLE_RE)
          if (m) {
            title = m[1].trim()
          } else if (text) {
            title = text
          }
          continue
        }

        if (child.type === 'code') {
          const code = child as unknown as Code
          const lang = (code.lang || '').toLowerCase()
          if (lang === 'json' || lang === 'jsonc' || !lang) {
            rawConfig = code.value
          }
        }
      }

      // 如果未包含合法的配置代码块，不认领，交给 fallback 插件处理
      if (!rawConfig.trim()) return

      // 已被抽取为属性，清空子节点避免重复展示内部的原始 JSON 代码
      node.children = []

      const data = node.data || (node.data = {})
      data.hName = 'system-flow'
      data.hProperties = {
        title,
        rawConfig,
      }
    })
  }
}
