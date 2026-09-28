import type { MetadataRoute } from 'next'
import {
  getAllEntries,
  getCategories,
  getAllTags,
  TAGGED_TYPES,
} from '@/lib/content'
import { getSiteUrl, joinSiteUrl } from '@/lib/site-url'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl()
  const generatedAt = new Date()
  const routes: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: generatedAt,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: joinSiteUrl(siteUrl, '/posts'),
      lastModified: generatedAt,
      changeFrequency: 'daily',
      priority: 0.9,
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

  return routes
}
