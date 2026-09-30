export const DEFAULT_SITE_URL = 'https://orange-cnc.pages.dev'

/** 统一读取并规范化站点根地址，避免 sitemap/rss/robots 各自拼接出不同 URL。 */
export function getSiteUrl(value: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): string {
  const raw = value?.trim() || DEFAULT_SITE_URL
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error(`站点 URL 无效：${raw}`)
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`站点 URL 必须是 HTTP(S) 地址：${raw}`)
  }
  if (parsed.search || parsed.hash) {
    throw new Error(`站点 URL 不应包含 query/hash：${raw}`)
  }

  return parsed.toString().replace(/\/+$/, '')
}

export function joinSiteUrl(base: string, pathname: string): string {
  const normalizedBase = getSiteUrl(base)
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`
  return `${normalizedBase}${normalizedPath}`
}
