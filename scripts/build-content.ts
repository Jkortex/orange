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
fs.writeFileSync(targetFile, JSON.stringify(manifest, null, 2), 'utf8')

const duration = (performance.now() - startTime).toFixed(2)
console.log(`[prebuild] 成功生成清单: ${targetFile} (耗时 ${duration}ms)`)
console.log(
  `[prebuild] 统计: ${manifest.allEntries.length} 篇条目, ${manifest.categories.length} 个分类, ${manifest.skills.slugs.length} 个技能包`,
)
