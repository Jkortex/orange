import type { Root, Paragraph, Text } from 'mdast'
import { visit } from 'unist-util-visit'

/*
 * remark 插件：解析 :::video 容器指令。
 *
 *   :::video
 *   src: /media/posts/x.mp4
 *   poster: /media/posts/x.jpg
 *   title: 系统演示
 *   这里是图注（可选，任意非键值行都并入图注）
 *   :::
 *
 * 注意：本仓库的 remark-directive 不解析 `{...}` 属性语法（会退化成普通段落），
 * 故 src/poster/title 一律写在指令正文里，按 `key: value` 行解析。
 *
 * 转为 <video> hast 元素，交由 markdown.tsx 的 components 映射渲染为 VideoPlayer。
 * 缺少 src 时不认领（不设 hName），交给 remarkDirectiveFallback 还原为纯文本。
 */

interface DirectiveNode {
  type: string
  name?: string
  children?: Array<{ type: string; [key: string]: unknown }>
  data?: {
    hName?: string
    hProperties?: Record<string, unknown>
    [key: string]: unknown
  }
}

function paragraphText(para: Paragraph): string {
  return para.children
    .filter((c): c is Text => c.type === 'text')
    .map((c) => c.value)
    .join('')
}

const META_RE = /^\s*(src|poster|title)\s*[:=]\s*(.+?)\s*$/

export function remarkVideo() {
  return (tree: Root) => {
    visit(tree, (rawNode) => {
      const node = rawNode as DirectiveNode
      if (node.type !== 'containerDirective') return
      if (node.name !== 'video') return

      let src = ''
      let poster = ''
      let title = ''
      const captionLines: string[] = []

      for (const child of node.children || []) {
        if (child.type !== 'paragraph') continue
        for (const line of paragraphText(child as unknown as Paragraph).split('\n')) {
          const m = line.match(META_RE)
          if (m) {
            if (m[1] === 'src') src = m[2]
            else if (m[1] === 'poster') poster = m[2]
            else title = m[2]
          } else if (line.trim()) {
            captionLines.push(line.trim())
          }
        }
      }

      if (!src) return

      // 内容已抽取为 hProperties，清空子树避免重复渲染
      node.children = []

      const data = node.data || (node.data = {})
      data.hName = 'video'
      data.hProperties = { src, poster, title, caption: captionLines.join(' ') }
    })
  }
}
