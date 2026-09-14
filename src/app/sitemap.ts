import type { MetadataRoute } from 'next'
import {
  getAllEntries,
  getCategories,
  getAllTags,
} from '@/lib/content'

export const dynamic = 'force-static'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://orange.example.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const routes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/posts`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/music`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/skills`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ]

  // 内容条目（posts / music / skills）
  for (const entry of getAllEntries()) {
    routes.push({
      url: `${SITE_URL}/${entry.collection}/${entry.slug}`,
      lastModified: entry.data.date,
      changeFrequency: 'monthly',
      priority: entry.collection === 'posts' ? 0.8 : 0.7,
    })
  }

  // 分类
  for (const { name } of getCategories()) {
    routes.push({
      url: `${SITE_URL}/category/${name}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.5,
    })
  }

  // 标签
  for (const tag of getAllTags(['posts', 'music', 'skills'])) {
    routes.push({
      url: `${SITE_URL}/tags/${tag}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.5,
    })
  }

  return routes
}
