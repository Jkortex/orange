import { getAllEntries } from '@/lib/content'

// RSS 全文输出：静态 Route Handler，构建时预渲染为 rss.xml（output: 'export' 兼容）
export const dynamic = 'force-static'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://orange.example.com'
const SITE_TITLE = 'Orange'
const SITE_DESCRIPTION = '个人博客：文章、生活、摄影与音乐'

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function GET() {
  // 聚合文章与技能包
  const entries = getAllEntries().filter(
    (e) => e.collection === 'posts' || e.collection === 'skills',
  )

  const items = entries
    .map((entry) => {
      const url = `${SITE_URL}/${entry.collection}/${entry.slug}`
      const desc = entry.data.description ?? entry.body.slice(0, 300)
      return `    <item>
      <title>${escapeXml(entry.data.title)}</title>
      <link>${url}</link>
      <guid>${url}</guid>
      <pubDate>${entry.data.date.toUTCString()}</pubDate>
      <description><![CDATA[${desc}]]></description>
    </item>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE_TITLE}</title>
    <link>${SITE_URL}</link>
    <description>${SITE_DESCRIPTION}</description>
    <language>zh-CN</language>
${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: { 'content-type': 'application/rss+xml; charset=utf-8' },
  })
}
