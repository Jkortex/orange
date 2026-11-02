import type { SystemPackage } from '@/lib/content'
import { MarkdownRenderer } from '@/lib/markdown'
import { extractToc, type TocHeading } from '@/lib/toc'
import {
  SystemFilePane,
  type RenderedSystemFile,
} from '@/components/listing/system-file-pane'
import { SYSTEM_ENTRY_FILE } from '@/lib/system-routes'

/*
 * system 包详情视图（每个文件一个静态页，`activePath` 决定本页渲染哪个文件）：
 * - 外壳（页眉 + 文件树 + 三栏网格）由 `systems/[slug]/layout.tsx` 常驻，切文件不重挂载
 * - 本组件只把「当前文件」的内容交给客户端，整包正文留在构建期
 * - 每个文件各自成页，静态 HTML 仍可被 Pagefind 逐页检索
 */

export async function SystemPackageView({
  pkg,
  activePath = SYSTEM_ENTRY_FILE,
}: {
  pkg: SystemPackage
  activePath?: string
}) {
  const file = pkg.files.find((f) => f.path === activePath) ?? pkg.files[0]
  const text = file.path === SYSTEM_ENTRY_FILE ? pkg.body : file.content

  let node: React.ReactNode = null
  let headings: TocHeading[] = []
  if (file.path.endsWith('.md') && text !== null) {
    node = await MarkdownRenderer({ children: text })
    headings = extractToc(text)
  }

  const renderedFile: RenderedSystemFile = {
    path: file.path,
    content: text,
    headings,
    node,
  }

  return (
    <SystemFilePane
      slug={pkg.slug}
      file={renderedFile}
      filePaths={pkg.files.map((f) => f.path)}
      title={pkg.data.title}
      metrics={{
        language: pkg.data.language,
        fileCount: pkg.files.length,
        lineCount: pkg.files.reduce((acc, f) => acc + (f.lineCount ?? 0), 0),
      }}
    />
  )
}
