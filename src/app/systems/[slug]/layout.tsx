import { notFound } from 'next/navigation'
import { getSystemPackage, isContentNotFoundError, toSystemOutline } from '@/lib/content'
import { PagefindFilters } from '@/components/listing/pagefind-filters'
import { SystemShell } from '@/components/listing/system-shell'

/*
 * 系统工程外壳：页眉、文件树与三栏网格挂在 layout 上，
 * 在 `/systems/<slug>` 与 `/systems/<slug>/<file...>` 之间切换时不重挂载，
 * 因此树展开状态与滚动位置都能保留（文件页只替换中间内容）。
 */

type Params = { params: Promise<{ slug: string }> }

export default async function SystemLayout({
  children,
  params,
}: Params & { children: React.ReactNode }) {
  const { slug } = await params

  let pkg
  try {
    pkg = getSystemPackage(slug)
  } catch (error) {
    if (isContentNotFoundError(error)) notFound()
    throw error
  }

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* 搜索过滤元数据：按类型/分类下推给 Pagefind 索引 */}
      <PagefindFilters type="systems" category={pkg.data.category} />
      <SystemShell outline={toSystemOutline(pkg)}>{children}</SystemShell>
    </div>
  )
}
