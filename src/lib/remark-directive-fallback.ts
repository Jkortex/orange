import type { Root } from 'mdast'
import { visit } from 'unist-util-visit'

/*
 * remark-directive 会把正文中形如 :is()、:where()、::before 等纯文本或代码语法误解析为
 * textDirective 或 leafDirective。若没有对应插件处理，react-markdown 遇到未知指令会
 * 渲染为空 <div> 或丢弃内容，导致正文缺失且破坏文内目录（TOC）锚点 ID。
 *
 * 此插件在所有已知自定义指令插件之后运行，将所有未处理的 directive 节点安全还原为文本节点，
 * 并合并相邻文本节点，确保 HTML 渲染与 TOC 目录锚点完全一致。
 */

interface DirectiveNode {
  type: string
  name?: string
  attributes?: Record<string, unknown>
  children?: Array<{ type: string; [key: string]: unknown }>
  data?: {
    hName?: string
    [key: string]: unknown
  }
  position?: {
    start?: { offset?: number; line?: number; column?: number }
    end?: { offset?: number; line?: number; column?: number }
  }
}

interface ParentNode {
  children: Array<{ type: string; value?: string; [key: string]: unknown }>
}

interface VFileLike {
  value?: string | Uint8Array
}

function mergeAdjacentTexts(parent: ParentNode) {
  if (!parent.children || parent.children.length <= 1) return
  const merged: Array<{ type: string; value?: string; [key: string]: unknown }> = []
  for (const child of parent.children) {
    const prev = merged[merged.length - 1]
    if (prev && prev.type === 'text' && child.type === 'text') {
      prev.value = (prev.value || '') + (child.value || '')
    } else {
      merged.push(child)
    }
  }
  parent.children = merged
}

export function remarkDirectiveFallback() {
  return (tree: Root, file?: VFileLike) => {
    const parentsToMerge = new Set<ParentNode>()

    visit(tree, (rawNode, _index, rawParent) => {
      const directive = rawNode as DirectiveNode
      if (
        directive.type === 'textDirective' ||
        directive.type === 'leafDirective' ||
        (directive.type === 'containerDirective' && !directive.data?.hName)
      ) {
        const fileContent = typeof file?.value === 'string' ? file.value : undefined
        const raw =
          fileContent &&
          directive.position?.start?.offset !== undefined &&
          directive.position?.end?.offset !== undefined
            ? fileContent.slice(directive.position.start.offset, directive.position.end.offset)
            : `:${directive.name || ''}`

        const textNode = directive as unknown as {
          type: string
          value: string
          name?: unknown
          attributes?: unknown
          children?: unknown
          data?: unknown
        }
        textNode.type = 'text'
        textNode.value = raw
        delete textNode.name
        delete textNode.attributes
        delete textNode.children
        delete textNode.data

        if (rawParent && Array.isArray((rawParent as unknown as ParentNode).children)) {
          parentsToMerge.add(rawParent as unknown as ParentNode)
        }
      }
    })

    for (const parent of parentsToMerge) {
      mergeAdjacentTexts(parent)
    }
  }
}
