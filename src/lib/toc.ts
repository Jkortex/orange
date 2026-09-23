/*
 * 文内目录：
 * - 长文在正文前自动生成锚点目录，点击跳转对应章节；不做侧边悬浮与滚动高亮
 * - slug 规则是唯一事实源：extractToc（目录链接）与 rehype 标题 id 插件
 *   （markdown.tsx）同用 slugifyHeading + 同样的重名后缀，保证链接与锚点一致
 */

/** 目录收录的标题：二级/三级；id 即渲染后标题元素的锚点 */
export type TocHeading = { depth: 2 | 3; text: string; id: string }

/** 标题数达到此阈值才算长文并显示目录 */
export const TOC_MIN_HEADINGS = 3

function stripInlineMarkup(text: string): string {
  return (
    text
      // 行内代码/加粗/斜体/删除线/链接取其文本
      .replace(/`([^`]*)`/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      // 单下划线在词内常见（如标识符），只把 * 当作斜体标记，避免吞掉 __
      .replace(/(\*)(.*?)\1/g, '$2')
      .replace(/~~(.*?)~~/g, '$1')
      .trim()
  )
}

/** 标题文本 → 锚点 id：中英文保留，空格/下划线转连字符，其余符号丢弃 */
export function slugifyHeading(text: string): string {
  const clean = stripInlineMarkup(text)
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return clean || 'section'
}

/** 从 markdown 原文提取二级/三级标题（围栏代码块内的 # 行不算标题） */
export function extractToc(markdown: string): TocHeading[] {
  const headings: TocHeading[] = []
  const used = new Map<string, number>()
  let inFence = false

  for (const line of markdown.split('\n')) {
    const trimmed = line.trim()
    if (/^(`{3,}|~{3,})/.test(trimmed)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(trimmed)
    if (!match) continue
    const depth = match[1].length as 2 | 3
    const text = stripInlineMarkup(match[2])
    if (!text) continue
    const base = slugifyHeading(text)
    const count = used.get(base) ?? 0
    used.set(base, count + 1)
    headings.push({ depth, text, id: count === 0 ? base : `${base}-${count}` })
  }

  return headings
}

/** 长文判定：标题数达到阈值才显示目录 */
export function shouldShowToc(markdown: string): boolean {
  return extractToc(markdown).length >= TOC_MIN_HEADINGS
}
