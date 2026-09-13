import type { TocHeading } from '@/lib/toc'

/*
 * 文首锚点目录（docs/specs/ui-ux.md §2.6）：
 * - 纯服务端渲染的锚点导航，无客户端 JS；点击即浏览器原生锚点跳转
 * - 是否显示由调用方按 shouldShowToc 判定，本组件只负责呈现
 */

export function Toc({ headings }: { headings: TocHeading[] }) {
  if (headings.length === 0) return null

  return (
    <nav aria-label="文章目录" className="mb-8 rounded-md border border-border bg-muted px-4 py-3">
      <ol className="space-y-1.5 text-sm">
        {headings.map((heading) => (
          <li key={heading.id} className={heading.depth === 3 ? 'ml-4' : undefined}>
            <a href={`#${heading.id}`} className="text-muted-foreground hover:text-foreground">
              {heading.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
