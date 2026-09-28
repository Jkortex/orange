import type { SkillFile, SkillPackage } from './content'

/*
 * 技能包文件 ↔ 路由映射（技能详情是「一个文件一个静态页」）：
 * - 入口 SKILL.md 就是 /skills/<slug>，不额外占一层路由
 * - 附属文件去掉最后一段扩展名挂在包路由之下：/skills/<slug>/references/pitfalls
 *   （去扩展名是为了静态导出后是 pitfalls.html，而不是 pitfalls.md.html）
 */

export const SKILL_ENTRY_FILE = 'SKILL.md'

const EXTENSION = /\.[^./]+$/

/** 文件路径 → 路由路径；`.gitignore` 这类点开头文件不做扩展名处理 */
export function skillFileRoutePath(filePath: string): string {
  return filePath.replace(EXTENSION, '') || filePath
}

/** 路由路径段（catch-all 段的原始形态，Next 侧解码后可直接比对） */
export function skillRouteParams(filePath: string): string[] {
  return skillFileRoutePath(filePath).split('/').filter(Boolean)
}

/** 包内文件的可分享地址 */
export function skillFileHref(slug: string, filePath: string): string {
  if (filePath === SKILL_ENTRY_FILE) return `/skills/${slug}`
  const segments = skillRouteParams(filePath).map(encodeURIComponent)
  return `/skills/${slug}/${segments.join('/')}`
}

/** 入口之外的文件（各自一个静态页） */
export function listSkillAttachments(pkg: SkillPackage): SkillFile[] {
  return pkg.files.filter((file) => file.path !== SKILL_ENTRY_FILE)
}

/** 由路由段反查包内文件；不匹配返回 undefined（交由调用方 404） */
export function findSkillFileByRoute(files: SkillFile[], segments: string[]): SkillFile | undefined {
  const target = segments.join('/')
  return files.find(
    (file) => file.path !== SKILL_ENTRY_FILE && skillRouteParams(file.path).join('/') === target,
  )
}

/**
 * 去扩展名后撞车的文件（notes.md 与 notes.txt 会映射到同一个路由）。
 * 返回 [路由, 冲突文件...] 列表。
 */
export function findSkillFileRouteCollisions(files: SkillFile[]): Array<[string, string[]]> {
  const byRoute = new Map<string, string[]>()
  for (const file of files) {
    if (file.path === SKILL_ENTRY_FILE) continue
    const route = skillFileRoutePath(file.path)
    const group = byRoute.get(route)
    if (group) group.push(file.path)
    else byRoute.set(route, [file.path])
  }
  return [...byRoute.entries()].filter(([, group]) => group.length > 1)
}

/** 撞车 = 构建期错误：一个文件会静默覆盖另一个 */
export function assertSkillFileRoutes(pkg: SkillPackage): void {
  const collisions = findSkillFileRouteCollisions(pkg.files)
  if (collisions.length === 0) return
  const detail = collisions
    .map(([route, paths]) => `${route} ← ${paths.join(' / ')}`)
    .join('; ')
  throw new Error(`skill 包 ${pkg.slug} 的文件路由撞车：${detail}`)
}
