import type { SkillPackage } from '@/lib/content'
import { MarkdownRenderer } from '@/lib/markdown'
import { extractToc, type TocHeading } from '@/lib/toc'
import { PagefindFilters } from '@/components/listing/pagefind-filters'
import {
  SkillPackageExplorer,
  type RenderedSkillFile,
} from '@/components/listing/skill-package-explorer'
import { SKILL_ENTRY_FILE } from '@/lib/skill-routes'

/*
 * skill 包详情视图（每个文件一个静态页，`activePath` 决定本页渲染哪个文件）：
 * - 服务端只编译当前文件的 Markdown 与高亮，其余文件各自成页
 * - 客户端提供左侧文件导航 + 中间正文 + 右侧当前文件动态 TOC 的三栏布局
 * 这样页面里不会同时存在多个文件的正文（隐藏 DOM 与重复 heading id 都不存在了），
 * 且每个文件的内容都在产物 HTML 里，Pagefind 逐页可检索。
 */

export async function SkillPackageView({
  pkg,
  activePath = SKILL_ENTRY_FILE,
}: {
  pkg: SkillPackage
  activePath?: string
}) {
  const file = pkg.files.find((f) => f.path === activePath) ?? pkg.files[0]
  const text = file.path === SKILL_ENTRY_FILE ? pkg.body : file.content

  let node: React.ReactNode = null
  let headings: TocHeading[] = []
  if (file.path.endsWith('.md') && text !== null) {
    node = await MarkdownRenderer({ children: text })
    headings = extractToc(text)
  }

  const renderedFile: RenderedSkillFile = {
    path: file.path,
    content: text,
    headings,
    node,
  }

  return (
    <>
      {/* 搜索过滤元数据：按类型/分类下推给 Pagefind 索引 */}
      <PagefindFilters type="skills" category={pkg.data.category} />
      <SkillPackageExplorer
        pkg={pkg}
        renderedFile={renderedFile}
        activePath={file.path}
      />
    </>
  )
}
