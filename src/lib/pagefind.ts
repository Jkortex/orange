/*
 * Pagefind 索引加载器：索引由 postbuild（pagefind --site out）生成到 out/pagefind/，
 * 仅在构建产物中可用。dev 环境导入失败 → 返回 null，由 UI 层提示降级（纯前端红线：无运行时内容请求，
 * 索引同样是构建期产物）。
 */

export type PagefindResultItem = {
  url: string
  meta?: { title?: string }
  excerpt?: string
  /** data-pagefind-filter 产出的过滤元数据（key → 该页命中的值） */
  filters?: Record<string, string[]>
}

export type PagefindSearchOptions = {
  /** 过滤下推：{ type: ['posts'] } 表示只取索引中标记了 type:posts 的页面 */
  filters?: Record<string, string | string[]>
}

export type PagefindApi = {
  search: (
    query: string | null,
    options?: PagefindSearchOptions,
  ) => Promise<{ results: { data: () => Promise<PagefindResultItem> }[] }>
}

// 模块级缓存：null 也缓存（dev 环境避免每次输入都重复加载失败）
let cached: PagefindApi | null | undefined

export async function loadPagefind(): Promise<PagefindApi | null> {
  if (cached !== undefined) return cached
  try {
    // 变量 URL + 打包器忽略标注，阻止构建期静态解析不存在的索引文件
    const url = `${window.location.origin}/pagefind/pagefind.js`
    const mod = (await import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ url
    )) as Partial<PagefindApi> & { default?: Partial<PagefindApi> }
    const api = (mod.default ?? mod) as PagefindApi
    if (typeof api?.search !== 'function') throw new Error('Pagefind API 不完整')
    cached = api
  } catch {
    cached = null
  }
  return cached
}
