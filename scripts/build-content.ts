import fs from 'node:fs'
import path from 'node:path'
import { buildContentManifest } from '../src/lib/content.ts'

const targetDir = path.join(process.cwd(), '.generated')
const targetFile = path.join(targetDir, 'content-manifest.json')

console.log('[prebuild] 构建内容索引清单 (Content Manifest)...')
const startTime = performance.now()

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true })
}

const manifest = buildContentManifest({ skipManifest: true })
const tempFile = `${targetFile}.${process.pid}.tmp`

try {
  // 先写同目录临时文件，再原子替换，避免中断留下半截 JSON。
  fs.writeFileSync(tempFile, JSON.stringify(manifest), 'utf8')
  fs.renameSync(tempFile, targetFile)
} finally {
  if (fs.existsSync(tempFile)) fs.rmSync(tempFile, { force: true })
}

const duration = (performance.now() - startTime).toFixed(2)
console.log(`[prebuild] 成功生成清单: ${targetFile} (耗时 ${duration}ms)`)
console.log(
  `[prebuild] 统计: ${manifest.allEntries.length} 篇条目, ${manifest.categories.length} 个分类, ${manifest.skills.slugs.length} 个技能包`,
)
