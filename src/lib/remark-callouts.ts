import type { Root } from 'mdast'
import { visit } from 'unist-util-visit'

/*
 * remark-directive 只产出 mdast 指令节点，react-markdown 不认识未知节点会丢弃包装。
 * 此插件把容器指令（:::note 等）标记为同名自定义元素，交由 markdown.tsx 的 components 映射渲染。
 * 新增自定义块：在 CALLOUT_KINDS 登记名称，并在 components 中补映射。
 */
const CALLOUT_KINDS = new Set(['note'])

export function remarkCallouts() {
  return (tree: Root) => {
    visit(tree, 'containerDirective', (node) => {
      if (!node.name || !CALLOUT_KINDS.has(node.name)) return
      const data = node.data || (node.data = {})
      data.hName = node.name
    })
  }
}
