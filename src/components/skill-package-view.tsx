import Link from 'next/link'
import type { SkillPackage } from '@/lib/content'
import { formatDate } from '@/lib/format'
import { MarkdownRenderer } from '@/lib/markdown'
import { extractToc, shouldShowToc } from '@/lib/toc'

/*
 * skill 包详情视图（docs/specs/content-model.md §11）：
 * - 纯服务端渲染，零客户端 JS
 * - 双栏：正文 + 右侧导航（heading TOC + 文件列表）
 * - 头部：标题 → 元信息 → 文件摘要（pills）
 * - SKILL.md 为入口正文；附属 md 分节渲染；代码/文本原样 <pre>；二进制仅列出
 */

export function SkillPackageView({ pkg }: { pkg: SkillPackage }) {
  const attachments = pkg.files.filter((file) => file.path !== 'SKILL.md')
  const headings = shouldShowToc(pkg.body) ? extractToc(pkg.body) : []
  const hasAside = headings.length > 0 || attachments.length > 0

  return (
    <article id="skill-top">
      <Link href="/" className="mb-6 inline-block text-sm text-muted-foreground hover:text-primary">
        ← 首页
      </Link>
      <header className="mb-8">
        <h1 className="text-3xl font-semibold">{pkg.data.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          <code>{pkg.data.name}</code>
          {pkg.data.version !== undefined && ` · v${pkg.data.version}`}
          {pkg.data.author !== undefined && ` · ${pkg.data.author}`}
          {' · '}
          <time dateTime={pkg.data.date.toISOString()}>{formatDate(pkg.data.date)}</time>
          {pkg.data.tags.map((tag) => (
            <Link key={tag} href={`/tags/${tag}`} className="ml-2 hover:text-primary">
              #{tag}
            </Link>
          ))}
        </p>
        {pkg.data.description && <p className="mt-3 text-sm text-muted-foreground">{pkg.data.description}</p>}
        {attachments.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {attachments.map((file) => (
              <span
                key={file.path}
                className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground"
              >
                {file.path}
              </span>
            ))}
          </div>
        )}
      </header>
      <div className="grid w-full gap-6 md:grid-cols-[minmax(0,1fr)_14rem] md:gap-10">
        <div className="min-w-0">
          <MarkdownRenderer>{pkg.body}</MarkdownRenderer>
          {attachments.map((file, i) => (
            <section key={file.path} id={`skill-file-${i}`} className="mt-10 scroll-mt-20">
              <h2 className="mb-3 font-mono text-sm text-muted-foreground">{file.path}</h2>
              {file.path.endsWith('.md') && file.content !== null ? (
                <MarkdownRenderer>{file.content}</MarkdownRenderer>
              ) : file.content !== null ? (
                <pre className="overflow-x-auto rounded-md border border-border bg-muted p-4 text-sm">
                  <code>{file.content}</code>
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground">二进制文件，仅列出路径。</p>
              )}
            </section>
          ))}
        </div>
        {hasAside && (
          <aside className="hidden md:block">
            <nav
              aria-label="技能导航"
              className="space-y-4 rounded-md border border-border bg-muted px-4 py-3 md:sticky md:top-20"
            >
              {headings.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">目录</p>
                  <ol className="space-y-1.5 text-sm">
                    {headings.map((heading) => (
                      <li key={heading.id} className={heading.depth === 3 ? 'ml-3' : undefined}>
                        <a href={`#${heading.id}`} className="text-muted-foreground hover:text-foreground">
                          {heading.text}
                        </a>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {attachments.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">文件</p>
                  <ol className="space-y-1.5 text-sm">
                    <li>
                      <a href="#skill-top" className="text-muted-foreground hover:text-foreground">
                        SKILL.md
                      </a>
                    </li>
                    {attachments.map((file, i) => (
                      <li key={file.path}>
                        <a href={`#skill-file-${i}`} className="text-muted-foreground hover:text-foreground">
                          {file.path}
                        </a>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </nav>
          </aside>
        )}
      </div>
    </article>
  )
}
