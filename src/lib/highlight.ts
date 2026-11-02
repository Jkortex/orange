import type { CSSProperties } from 'react'
import { codeToTokens, type BundledLanguage, type SpecialLanguage } from 'shiki'

/*
 * 构建期语法着色（系统工程文件查看器用）：
 * - 与 markdown 管线共用同一对 Shiki 主题，token 输出 --shiki-light/--shiki-dark，
 *   由 globals.css 的 html.dark 规则联动，零客户端 JS、无闪烁
 * - 每个文件页只高亮当前文件；超大文件退回纯文本，避免构建产物与导航载荷失控
 */

/** 必须与 markdown 管线的 rehype-pretty-code 主题一致（正文代码块与文件查看器同色） */
export const SHIKI_THEMES = { light: 'github-light', dark: 'github-dark' } as const

type ShikiLang = BundledLanguage | SpecialLanguage

const LANGUAGE_BY_EXTENSION: Record<string, ShikiLang> = {
  go: 'go',
  // go.mod 语法与 Go 足够接近，着色效果远好于纯文本
  mod: 'go',
  sql: 'sql',
  yaml: 'yaml',
  yml: 'yaml',
  json: 'json',
  md: 'markdown',
  markdown: 'markdown',
  sh: 'bash',
  bash: 'bash',
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  py: 'python',
  rs: 'rust',
  toml: 'toml',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  hpp: 'cpp',
  java: 'java',
  proto: 'proto',
  tf: 'hcl',
}

const LANGUAGE_BY_FILENAME: Record<string, ShikiLang> = {
  Makefile: 'make',
  Dockerfile: 'docker',
}

/** 由文件路径推断 Shiki 语言；未知类型一律 text（不着色但不报错） */
export function detectCodeLanguage(filePath: string): ShikiLang {
  const name = filePath.split('/').pop() ?? filePath
  const byName = LANGUAGE_BY_FILENAME[name]
  if (byName) return byName
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return 'text'
  return LANGUAGE_BY_EXTENSION[name.slice(dot + 1).toLowerCase()] ?? 'text'
}

export type CodeToken = {
  content: string
  style?: CSSProperties
}
export type CodeLine = CodeToken[]

const MAX_HIGHLIGHT_LINES = 3000
const MAX_HIGHLIGHT_BYTES = 200_000

/** Shiki token → 内联样式（自定义属性 + 粗斜体），交给 globals.css 按主题取色 */
function tokenStyle(token: {
  htmlStyle?: Record<string, string>
  fontStyle?: number
}): CSSProperties | undefined {
  const style: Record<string, string> = { ...token.htmlStyle }
  const fontStyle = token.fontStyle ?? 0
  if (fontStyle & 1) style.fontStyle = 'italic'
  if (fontStyle & 2) style.fontWeight = 'bold'
  if (fontStyle & 4) style.textDecoration = 'underline'
  return Object.keys(style).length > 0 ? (style as CSSProperties) : undefined
}

/**
 * 高亮整份文件：返回逐行的 token 列表；超大文件返回 null（调用方回退纯文本）。
 * 空行返回空数组，由渲染层补行高。
 */
export async function highlightCode(code: string, lang: ShikiLang): Promise<CodeLine[] | null> {
  const normalized = code.replace(/\r\n/g, '\n')
  if (normalized.length > MAX_HIGHLIGHT_BYTES) return null
  if (normalized.split('\n').length > MAX_HIGHLIGHT_LINES) return null

  const { tokens } = await codeToTokens(normalized, {
    lang,
    themes: SHIKI_THEMES,
    defaultColor: false,
  })

  return tokens.map((line) =>
    line.map((token) => ({ content: token.content, style: tokenStyle(token) })),
  )
}
