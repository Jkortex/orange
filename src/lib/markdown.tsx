import type { ComponentProps, CSSProperties } from 'react'
import { createElement, isValidElement } from 'react'
import { MarkdownAsync } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkDirective from 'remark-directive'
import rehypePrettyCode from 'rehype-pretty-code'
import type { Components } from 'react-markdown'
import { remarkCallouts } from '@/lib/remark-callouts'
import { remarkMermaid } from '@/lib/remark-mermaid'
import { remarkCodeDemo } from '@/lib/remark-code-demo'
import { remarkDirectiveFallback } from '@/lib/remark-directive-fallback'
import { rehypeKeepCssVars } from '@/lib/rehype-css-vars'
import { rehypeHeadingIds } from '@/lib/rehype-heading-ids'
import { cn } from '@/lib/utils'
import { CodeBlock } from '@/components/reading/code-block'
import { CodeDemo, type CodeDemoProps } from '@/components/reading/code-demo'
import { MermaidDiagram, type MermaidDiagramProps } from '@/components/reading/mermaid-diagram'
import { MediaZoom } from '@/components/reading/media-zoom'
import { HeadingWithAnchor } from '@/components/reading/heading-anchor'

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
  /*
   * 宽表套一层横向滚动容器：表格自身是 overflow: hidden（为圆角），而 body 的
   * overflow-x: clip 又堵掉了整页横滚，5 列表格在手机上会被裁掉且触屏无从滚动。
   * 自动表格布局下 width:100% 是最小值，表格盒会涨到 min-content 而溢出这层容器，
   * 于是滚动条落在这里 —— a11y-scrollable 查询的正是 .prose .overflow-x-auto。
   */
  table: ({ node: _node, ...rest }: ComponentProps<'table'> & { node?: unknown }) => (
    <div className="overflow-x-auto">
      <table {...rest} />
    </div>
  ),
  /*
   * 正文图片套一层 MediaZoom 触发按钮，点击/回车放大查看。
   *
   * 几个细节：
   * - `node` 必须解构掉：它是 react-markdown 注入的 hast 节点，透传会把整个 AST 塞进 DOM 属性
   * - `w-full` 是刻意的：内容图（800 宽的架构示意图等）本就该占满正文栏；而这些 SVG 根标签
   *   写的是 `width="100%"`，没有内禀宽度，只能靠外部给定宽度
   * - `![](...)` 渲染为 `<p><button><img/></button></p>`，button 属于措辞内容，套在 p 里合法
   */
  img: ({
    node: _node,
    src,
    alt,
    loading,
    decoding,
    className,
    ...rest
  }: ComponentProps<'img'> & { node?: unknown }) => (
    <MediaZoom
      source={{ kind: 'image', src: String(src), alt: alt || '图片' }}
      label={`查看大图：${alt || '图片'}`}
      hint="点击查看大图"
      className="my-6 block w-full"
    >
      <img
        src={src}
        alt={alt || ''}
        loading={loading ?? 'lazy'}
        decoding={decoding ?? 'async'}
        className={cn('block h-auto w-full', className)}
        {...rest}
      />
    </MediaZoom>
  ),
  'code-demo': ({ node: _node, ...rest }: CodeDemoProps & { node?: unknown }) => (
    <CodeDemo {...rest} />
  ),
  'mermaid-diagram': ({ node: _node, ...rest }: MermaidDiagramProps & { node?: unknown }) => (
    <MermaidDiagram {...rest} />
  ),
  pre: ({ node: _node, 'data-hast-style': style, children, ...rest }: StyledProps<'pre'>) => {
    // 若子节点为已处理的 Mermaid 图表，直接返回，避免外层套多余的代码块外壳
    if (
      isValidElement(children) &&
      (children.type === MermaidDiagram || typeof (children.props as { svg?: unknown })?.svg === 'string')
    ) {
      return children
    }
    return <CodeBlock {...rest} style={parseStyle(style)}>{children}</CodeBlock>
  },
  code: makeStyled('code'),
  span: makeStyled('span'),
  mark: makeStyled('mark'),
} as Components

/** 内容渲染入口：输入 markdown 原文，输出带语义 token 样式的 React 树 */
export async function MarkdownRenderer({ children }: { children: string }) {
  return (
    <div className="prose max-w-none w-full">
      <MarkdownAsync
        remarkPlugins={[
          remarkGfm,
          remarkDirective,
          remarkCallouts,
          remarkMermaid,
          remarkCodeDemo,
          remarkDirectiveFallback,
        ]}
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
