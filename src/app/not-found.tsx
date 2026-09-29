import type { Metadata } from 'next'
import { Compass } from 'lucide-react'
import { PageHeader } from '@/components/listing/page-header'
import { EmptyState } from '@/components/primitives/empty-state'
import { BackButton } from '@/components/reading/back-button'

/*
 * 404：静态导出时由构建产出 out/404.html，托管方对未命中的路径直接返回它。
 * 必须自定义——框架默认页自带一段写死黑/白底色的内联样式，会盖掉站点主题
 * （catppuccin 或暗色模式下整页被刷成纯黑/纯白），文案是英文，外面还套一个
 * 100vh 的居中块把页面顶高一屏。chrome 由 layout 自动带，这里只管正文。
 * robots: noindex 由框架给 404 页自动加上，无需手写。
 */
export const metadata: Metadata = { title: '页面不存在' }

export default function NotFound() {
  return (
    <section className="mx-auto w-full max-w-2xl animate-in fade-in-50 duration-300">
      <PageHeader
        title="页面不存在"
        description="这个地址没有内容，可能已经移动或被删掉了。"
        icon={<Compass aria-hidden />}
      />
      <EmptyState message="按 Ctrl/Cmd+K 可以搜索站内其它内容。" />
      {/* 兜底回文章列表；站内来源可识别时 BackButton 会换成更贴切的去处 */}
      <BackButton fallbackHref="/" fallbackLabel="文章列表" className="mt-6" />
    </section>
  )
}
