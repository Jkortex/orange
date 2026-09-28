import type { SkillPackage } from '@/lib/content'
import { MarkdownRenderer } from '@/lib/markdown'
import { extractToc, type TocHeading } from '@/lib/toc'
import { ProseFontLink } from '@/components/reading/prose-font-link'
import {
  SkillPackageExplorer,
  type RenderedSkillFile,
} from '@/components/listing/skill-package-explorer'

/*
 * skill 包详情视图：
 * - 服务端完成全量文件的 Markdown 构建与高亮编译
 * - 客户端提供左侧文件选项卡切换 + 中间正文 + 右侧当前文档动态 TOC 的三栏极客体验
 */

export async function SkillPackageView({ pkg }: { pkg: SkillPackage }) {
  const renderedFiles: RenderedSkillFile[] = await Promise.all(
    pkg.files.map(async (file) => {
      let node: React.ReactNode = null
      let headings: TocHeading[] = []
      const text = file.path === 'SKILL.md' ? pkg.body : file.content

      if (file.path.endsWith('.md') && text !== null) {
        node = await MarkdownRenderer({ children: text })
        headings = extractToc(text)
      }

      return {
        path: file.path,
        content: text,
        headings,
        node,
      }
    }),
  )

  return (
    <>
      <ProseFontLink />
      <SkillPackageExplorer pkg={pkg} renderedFiles={renderedFiles} />
    </>
  )
}
