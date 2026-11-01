import type { SystemFile, SystemPackage } from './content'

/*
 * 系统工程文件 ↔ 路由映射（系统详情是「一个文件一个静态页」）：
 * - 入口 SYSTEM.md 对应 /systems/<slug>，不额外占一层路由
 * - 附属文件保持完整路径与扩展名：/systems/<slug>/internal/raft/state.go
 *   （保留扩展名便于区分同名不同语言的文件，如 server.c 与 server.h）
 */

export const SYSTEM_ENTRY_FILE = 'SYSTEM.md'

/** 路由路径段（catch-all 段的原始形态，Next 侧解码后直接以 / 拼接还原） */
export function systemRouteParams(filePath: string): string[] {
  return filePath.split('/').filter(Boolean)
}

/** 工程内文件的可分享完整地址 */
export function systemFileHref(slug: string, filePath: string): string {
  if (filePath === SYSTEM_ENTRY_FILE) return `/systems/${slug}`
  const segments = systemRouteParams(filePath).map(encodeURIComponent)
  return `/systems/${slug}/${segments.join('/')}`
}

/** 入口之外的附属代码/配置文件（各自一个静态页） */
export function listSystemAttachments(pkg: SystemPackage): SystemFile[] {
  return pkg.files.filter((file) => file.path !== SYSTEM_ENTRY_FILE)
}

/** 由路由段反查工程内文件；不匹配返回 undefined（交由调用方 404） */
export function findSystemFileByRoute(
  files: SystemFile[],
  segments: string[],
): SystemFile | undefined {
  const target = segments.join('/')
  return files.find(
    (file) => file.path !== SYSTEM_ENTRY_FILE && systemRouteParams(file.path).join('/') === target,
  )
}
