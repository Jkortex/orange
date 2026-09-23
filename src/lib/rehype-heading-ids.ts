import type { Element, Root, Text } from 'hast'
import { slugifyHeading } from '@/lib/toc'

/*
 * 标题锚点 id（文首目录的跳转目标）：
 * - 只给 h2/h3 加 id（一级是文章标题、四级以下不入目录，与 extractToc 口径一致）
 * - slug 规则与去重后缀复用 toc.ts，保证渲染锚点与目录链接永远一致
 */

function textOf(node: Element): string {
  let out = ''
  for (const child of node.children) {
    if (child.type === 'text') out += (child as Text).value
    else if (child.type === 'element') out += textOf(child as Element)
  }
  return out
}

function assignIds(node: Element | Root, used: Map<string, number>): void {
  if (node.type === 'element') {
    const tag = (node as Element).tagName
    if ((tag === 'h2' || tag === 'h3') && !(node as Element).properties?.id) {
      const base = slugifyHeading(textOf(node as Element))
      const count = used.get(base) ?? 0
      used.set(base, count + 1)
      ;(node as Element).properties = {
        ...(node as Element).properties,
        id: count === 0 ? base : `${base}-${count}`,
      }
    }
  }
  for (const child of node.children) {
    if (child.type === 'element') assignIds(child, used)
  }
}

/** rehype 插件：h2/h3 注入与 extractToc 同口径的锚点 id */
export function rehypeHeadingIds() {
  return (tree: Root) => {
    assignIds(tree, new Map())
  }
}
