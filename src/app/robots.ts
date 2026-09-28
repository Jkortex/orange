import type { MetadataRoute } from 'next'
import { getSiteUrl, joinSiteUrl } from '@/lib/site-url'

export const dynamic = 'force-static'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: joinSiteUrl(getSiteUrl(), '/sitemap.xml'),
  }
}
