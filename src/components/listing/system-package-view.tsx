import type { SystemPackage } from '@/lib/content'
import { MarkdownRenderer } from '@/lib/markdown'
import { extractToc, type TocHeading } from '@/lib/toc'
import { PagefindFilters } from '@/components/listing/pagefind-filters'
import {
  SystemPackageExplorer,
  type RenderedSystemFile,
} from '@/components/listing/system-package-explorer'
import { SYSTEM_ENTRY_FILE } from '@/lib/system-routes'

/*
 * system 包详情视图（每个文件一个静态页，`activePath` 决定本页渲染哪个文件）：
 * - 服务端只编译当前文件的 Markdown 与高亮，其余文件各自成页
 * - 客户端提供左侧递归目录树 + 中间代码/正文 + 右侧当前文件动态 TOC 的三栏布局
 * - 产物全量在静态 HTML 中，Pagefind 逐页可检索
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
    <>
      {/* 搜索过滤元数据：按类型/分类下推给 Pagefind 索引 */}
      <PagefindFilters type="systems" category={pkg.data.category} />
      <SystemPackageExplorer
        pkg={pkg}
        renderedFile={renderedFile}
        activePath={file.path}
      />
    </>
  )
}
