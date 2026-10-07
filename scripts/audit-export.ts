/*
 * 生产产物守卫（postbuild，紧接 pagefind 之后运行）：
 * 扫描 out/，确保草稿内容与草稿浮动入口绝不泄漏到线上。命中即 exit 1，让构建失败，
 * 从而在部署前拦截回归（例如有人给草稿新增了未加守卫的入口，或改了 manifest 扫描范围）。
 *
 * 两类检查：
 *  1. 内容泄漏：任何草稿 slug（content/drafts/*.md 的文件名去扩展名）不得出现在 out/ 的任何文件里
 *     （含二进制，按 Buffer 比对；slug 为 ASCII，能穿透 pagefind 索引）。
 *  2. 入口泄漏：任何 .html 不得含草稿入口按钮的渲染标记 aria-label="草稿（仅本地）"。
 *     只查 HTML —— 组件源码会打进 JS chunk，但那不会「显示」图标；只有被 SSR 进 HTML 才算泄漏。
 */
import fs from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.join(process.cwd(), 'out')
const DRAFTS_DIR = path.join(process.cwd(), 'content', 'drafts')

/** 草稿入口按钮的无障碍名（与 src/components/chrome/draft-floating-button.tsx 的 label 一致） */
const DRAFT_ICON_MARKUP = 'aria-label="草稿（仅本地）"'

if (!fs.existsSync(OUT_DIR)) {
  console.error('[audit] 未找到 out/，请先执行 next build')
  process.exit(1)
}

const draftSlugs = fs.existsSync(DRAFTS_DIR)
  ? fs
      .readdirSync(DRAFTS_DIR)
      .filter((file) => file.endsWith('.md'))
      .map((file) => file.replace(/\.md$/, ''))
  : []

const findings: string[] = []

function walk(dir: string) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const rel = path.relative(OUT_DIR, full)
    if (fs.statSync(full).isDirectory()) {
      walk(full)
      continue
    }

    const buffer = fs.readFileSync(full)
    for (const slug of draftSlugs) {
      if (buffer.includes(slug)) findings.push(`${rel} 含草稿 slug：${slug}`)
    }
    if (name.endsWith('.html') && buffer.includes(DRAFT_ICON_MARKUP)) {
      findings.push(`${rel} 含草稿入口图标`)
    }
  }
}

walk(OUT_DIR)

if (findings.length > 0) {
  console.error('[audit] 草稿泄漏到生产产物，构建中止：')
  for (const finding of findings) console.error(`  - ${finding}`)
  process.exit(1)
}

console.log(`[audit] 通过：out/ 无草稿内容与草稿入口（已检查 ${draftSlugs.length} 篇草稿）`)
