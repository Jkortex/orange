import type { MetadataRoute } from 'next'
import {
  getAllEntries,
  getCategories,
  getAllTags,
  getSkillPackage,
  listSkillSlugs,
  TAGGED_TYPES,
} from '@/lib/content'
import { listSkillAttachments, skillFileHref } from '@/lib/skill-routes'
import { getSiteUrl, joinSiteUrl } from '@/lib/site-url'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl()
  const generatedAt = new Date()
  const routes: MetadataRoute.Sitemap = [
    {
      // 根路径即文章列表
      url: siteUrl,
      lastModified: generatedAt,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: joinSiteUrl(siteUrl, '/life'),
      lastModified: generatedAt,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: joinSiteUrl(siteUrl, '/music'),
      lastModified: generatedAt,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: joinSiteUrl(siteUrl, '/skills'),
      lastModified: generatedAt,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ]

  // 内容条目（所有拥有详情路由的集合）
  for (const entry of getAllEntries()) {
    routes.push({
      url: joinSiteUrl(siteUrl, `/${entry.collection}/${entry.slug}`),
      lastModified: entry.data.date,
      changeFrequency: 'monthly',
      priority: entry.collection === 'posts' ? 0.8 : 0.7,
    })
  }

  // 分类
  for (const { name } of getCategories()) {
    routes.push({
      url: joinSiteUrl(siteUrl, `/category/${name}`),
      lastModified: generatedAt,
      changeFrequency: 'weekly',
      priority: 0.5,
    })
  }

  // 标签
  for (const tag of getAllTags(TAGGED_TYPES)) {
    routes.push({
      url: joinSiteUrl(siteUrl, `/tags/${tag}`),
      lastModified: generatedAt,
      changeFrequency: 'weekly',
      priority: 0.5,
    })
  }

  // 技能包内的文件页（包页本身已由 getAllEntries 收录）
  for (const slug of listSkillSlugs()) {
    const pkg = getSkillPackage(slug)
    for (const file of listSkillAttachments(pkg)) {
      routes.push({
        url: joinSiteUrl(siteUrl, skillFileHref(slug, file.path)),
        lastModified: pkg.data.date,
        changeFrequency: 'monthly',
        priority: 0.4,
      })
    }
  }

  return routes
}
