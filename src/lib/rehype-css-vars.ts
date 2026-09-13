import type { Element, Root } from 'hast'

/*
 * 保护 rehype-pretty-code 注入的内联 CSS 变量：
 * react-markdown 底层用 hast-util-to-jsx-runtime 渲染，它会把 style 字符串交给
 * style-to-js 解析；遇到 --shiki-* 这类 CSS 自定义属性会解析失败，并在
 * ignoreInvalidStyle 下静默降级为 {}，导致主题变量在最终 HTML 中丢失。
 * 这里在 hast 阶段把 style 原样挪到 data-hast-style，组件层（markdown.tsx
 * 的 makeStyled）再还原为 React style 对象，彻底绕开该解析。
 */

function moveStyle(node: Element | Root): void {
  if (node.type === 'element' && typeof node.properties?.style === 'string') {
    node.properties['data-hast-style'] = node.properties.style
    delete node.properties.style
  }
  for (const child of node.children) {
    if (child.type === 'element') moveStyle(child)
  }
}

/** rehype 插件：把 style 字符串暂存为 data-hast-style，避免 style-to-js 丢弃 CSS 变量 */
export function rehypeKeepCssVars() {
  return (tree: Root) => {
    moveStyle(tree)
  }
}
