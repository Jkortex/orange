import type { Root, Code } from 'mdast'
import { visit } from 'unist-util-visit'
import { renderMermaidSVG } from 'beautiful-mermaid'

/*
 * remark 插件：解析 ```mermaid 或 ```mmd 代码块
 * - 使用 beautiful-mermaid 在构建期/服务端同步生成高颜值、轻量无 DOM 依赖的静态 SVG
 * - 注入站点统一 CSS 变量（--card, --foreground, --border, --primary, --muted-foreground）
 * - 生成的 SVG 原生支持深浅主题切换，零客户端 JS 依赖
 * - 语法错误或不支持的语法捕获后优雅降级为普通代码块
 */

export interface RemarkMermaidOptions {
  /** 发生语法错误时是否在控制台打印警告，默认 true */
  warnOnError?: boolean
}

export function remarkMermaid(options: RemarkMermaidOptions = {}) {
  const { warnOnError = true } = options

  return (tree: Root) => {
    visit(tree, 'code', (node: Code) => {
      const lang = (node.lang || '').toLowerCase()
      if (lang !== 'mermaid' && lang !== 'mmd') return

      try {
        const svg = renderMermaidSVG(node.value, {
          transparent: true,
          bg: 'var(--card)',
          fg: 'var(--foreground)',
          line: 'var(--border)',
          accent: 'var(--primary)',
          muted: 'var(--muted-foreground)',
          surface: 'var(--muted)',
          border: 'var(--border)',
        })

        const data = (node.data || (node.data = {})) as Record<string, unknown>
        data.hName = 'mermaid-diagram'
        data.hProperties = {
          svg,
          code: node.value,
        }
      } catch (err) {
        if (warnOnError) {
          console.warn('[remark-mermaid] Failed to render mermaid diagram, falling back to code block:', err)
        }
      }
    })
  }
}
