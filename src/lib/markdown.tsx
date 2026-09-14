import type { ComponentProps, CSSProperties } from 'react'
import { createElement } from 'react'
import { MarkdownAsync } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkDirective from 'remark-directive'
import rehypePrettyCode from 'rehype-pretty-code'
import type { Components } from 'react-markdown'
import { remarkCallouts } from './remark-callouts'
import { rehypeKeepCssVars } from './rehype-css-vars'
import { rehypeHeadingIds } from './rehype-heading-ids'
import { CodeBlock } from '@/components/code-block'
import { HeadingWithAnchor } from '@/components/heading-anchor'

/*
 * Markdown 渲染管线（AGENTS.md 内容与渲染纪律）：
 * - 所有集合的正文统一走此管线，节点级 components 映射
 * - rehype-pretty-code（Shiki dual theme）：构建时高亮，defaultColor:false 使每个
 *   token 同时输出 --shiki-light/--shiki-dark 变量，由 globals.css 的 html.dark
 *   规则联动切换，零客户端 JS
 * - 异步插件需要 MarkdownAsync（RSC 构建时执行）
 */

const rehypePrettyCodeOptions = {
  theme: { light: 'github-light', dark: 'github-dark' },
  defaultColor: false,
  keepBackground: false,
}

// rehypeKeepCssVars 把 style 字符串暂存在 data-hast-style（见插件注释），这里还原成
// React style 对象；React 19 不接受字符串 style，也丢弃不了 CSS 变量
function parseStyle(style: unknown): CSSProperties | undefined {
  if (typeof style !== 'string' || !style) return undefined
  return Object.fromEntries(
    style
      .split(';')
      .map((decl) => decl.split(':'))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key.trim(), value.trim()]),
  ) as CSSProperties
}

type StyledProps<T extends 'pre' | 'code' | 'span' | 'mark'> = ComponentProps<T> & {
  node?: unknown
  'data-hast-style'?: string
}

// rehype-pretty-code 会给 code/span/mark/pre 注入内联样式，统一做暂存属性 → 对象转换；
// 无 style 的节点（如行内代码）原样透传
function makeStyled<T extends 'pre' | 'code' | 'span' | 'mark'>(Tag: T) {
  const Styled = ({ node: _node, 'data-hast-style': style, ...rest }: StyledProps<T>) =>
    createElement(Tag, { ...rest, style: parseStyle(style) })
  return Styled
}

// remark-directive 自定义块（:::note 等）→ 组件映射；`node` 是 react-markdown 注入的 hast 节点，不下传 DOM
const components = {
  h2: ({ node: _node, id, children, ...rest }: ComponentProps<'h2'> & { node?: unknown }) => (
    <HeadingWithAnchor as="h2" id={id} {...rest}>
      {children}
    </HeadingWithAnchor>
  ),
  h3: ({ node: _node, id, children, ...rest }: ComponentProps<'h3'> & { node?: unknown }) => (
    <HeadingWithAnchor as="h3" id={id} {...rest}>
      {children}
    </HeadingWithAnchor>
  ),
  note: ({ node: _node, ...rest }: ComponentProps<'aside'> & { node?: unknown }) => (
    <aside data-callout="note" {...rest} />
  ),
  pre: ({ node: _node, 'data-hast-style': style, ...rest }: StyledProps<'pre'>) => (
    <CodeBlock {...rest} style={parseStyle(style)} />
  ),
  code: makeStyled('code'),
  span: makeStyled('span'),
  mark: makeStyled('mark'),
} as Components

/** 内容渲染入口：输入 markdown 原文，输出带语义 token 样式的 React 树 */
export async function MarkdownRenderer({ children }: { children: string }) {
  return (
    <div className="prose max-w-none w-full">
      <MarkdownAsync
        remarkPlugins={[remarkGfm, remarkDirective, remarkCallouts]}
        rehypePlugins={[
          [rehypePrettyCode, rehypePrettyCodeOptions],
          rehypeKeepCssVars,
          rehypeHeadingIds,
        ]}
        components={components}
      >
        {children}
      </MarkdownAsync>
    </div>
  )
}
