import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

const KEEP_DIR = 'D:\\work\\keep\\src\\content\\knowledge'
const ORANGE_POSTS_DIR = 'D:\\codes\\orange\\content\\posts'

const CATEGORY_MAP = {
  principles: 'principles',
  laws: 'laws',
  engineering: 'engineering',
  css: 'css',
  mysql: 'database',
  redis: 'database',
}

function walk(dir) {
  let files = []
  const list = fs.readdirSync(dir)
  for (const item of list) {
    const full = path.join(dir, item)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) {
      files = files.concat(walk(full))
    } else if (item.endsWith('.md') || item.endsWith('.mdx')) {
      files.push(full)
    }
  }
  return files
}

const allFiles = walk(KEEP_DIR)
console.log(`Found ${allFiles.length} files in Keep knowledge directory.`)

let successCount = 0

for (const file of allFiles) {
  const rel = path.relative(KEEP_DIR, file)
  const parts = rel.split(path.sep)
  const folder = parts[0]
  let baseName = path.basename(file).replace(/\.mdx?$/, '')
  if (baseName === 'getting-started') {
    baseName = `${folder}-getting-started`
  }

  const category = CATEGORY_MAP[folder] || 'tech'

  const raw = fs.readFileSync(file, 'utf8')
  const { data, content } = matter(raw)

  // 提取有效日期 YYYY-MM-DD
  let dateStr = '2026-05-20'
  if (data.created) {
    try {
      const d = new Date(data.created)
      if (!isNaN(d.getTime())) {
        dateStr = d.toISOString().slice(0, 10)
      }
    } catch {}
  }

  // 构造标准 slug: YYYY-MM-DD-slug.md
  const targetFileName = `${dateStr}-${baseName}.md`
  const targetPath = path.join(ORANGE_POSTS_DIR, targetFileName)

  // 清洗正文开头的 # 标题（避免与页面 header 渲染的 H1 重复）
  let cleanBody = content.trim()
  if (cleanBody.startsWith('# ')) {
    const firstNewline = cleanBody.indexOf('\n')
    if (firstNewline !== -1) {
      cleanBody = cleanBody.slice(firstNewline).trim()
    }
  }

  // 清洗可能存在的 CodeDemo 语法标签
  cleanBody = cleanBody.replace(/<CodeDemo[\s\S]*?>/g, '')
  cleanBody = cleanBody.replace(/<\/CodeDemo>/g, '')

  // 准备 frontmatter
  const tags = Array.isArray(data.tags) ? data.tags : []
  const newFrontmatter = {
    title: data.title || baseName,
    date: dateStr,
    tags,
    category,
  }
  if (data.description) {
    newFrontmatter.description = data.description
  }

  const output = matter.stringify(cleanBody, newFrontmatter)
  fs.writeFileSync(targetPath, output, 'utf8')
  successCount++
}

console.log(`Successfully migrated ${successCount} articles to ${ORANGE_POSTS_DIR}.`)
