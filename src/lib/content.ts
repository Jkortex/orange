import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { z } from 'zod'

/*
 * 内容层（AGENTS.md 内容与渲染纪律）：
 * - zod schema 是 frontmatter 的唯一事实源，缺失/类型不符构建即报错
 * - 内容只在构建时由 fs 读取（纯前端红线），函数均为同步
 * - 一个 .md 文件 = 一个条目，slug 取自文件名（YYYY-MM-DD-slug）
 */

// 基础字段：所有内容集合共享
const baseSchema = z.object({
  title: z.string().min(1),
  date: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  description: z.string().optional(),
  // 分类：英文 slug（URL 与目录名安全）。分类由内容声明、构建时聚合（见 getCategories），
  // 新增分类 = 内容文件写新值，零代码改动（AGENTS.md 内容分类规范）
  category: z
    .string()
    .regex(/^[\w-]+$/, 'category 须为英文 slug（字母/数字/连字符/下划线），如 css、design-patterns')
    .optional(),
})

export const postSchema = baseSchema
export const lifeSchema = baseSchema
export const photoSchema = baseSchema.extend({
  location: z.string().optional(),
  cover: z.string().optional(),
})
export const musicSchema = baseSchema.extend({
  artist: z.string().min(1),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  cover: z.string().optional(),
  tracks: z
    .array(z.object({ title: z.string().min(1), file: z.string().min(1) }))
    .min(1),
})

export const skillSchema = baseSchema.extend({
  name: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'name 须为 kebab-case（小写字母/数字/连字符），如 tdd-basics'),
  version: z.string().optional(),
  author: z.string().optional(),
})

export const collectionSchemas = {
  posts: postSchema,
  life: lifeSchema,
  photos: photoSchema,
  music: musicSchema,
  skills: skillSchema,
} as const

export type CollectionType = keyof typeof collectionSchemas

export type CollectionEntry<T extends CollectionType> = {
  /** 所属集合，跨集合页（标签/归档）据此生成路由 */
  collection: T
  slug: string
  data: z.infer<(typeof collectionSchemas)[T]>
  body: string
}

export type GetOptions = {
  /** 默认项目根目录下的 content/；测试时注入临时目录 */
  contentDir?: string
}

const DEFAULT_CONTENT_DIR = path.join(process.cwd(), 'content')

function resolveContentDir(type: string, options?: GetOptions) {
  return path.join(options?.contentDir ?? DEFAULT_CONTENT_DIR, type)
}

/** slug 只允许字母/数字/连字符/下划线，防止路径穿越（来源是 URL 参数） */
function assertSafeSlug(slug: string) {
  if (!/^[\w-]+$/.test(slug)) {
    throw new Error(`非法 slug：${slug}`)
  }
}

function parseEntry<T extends CollectionType>(
  type: T,
  filePath: string,
  raw: string,
): CollectionEntry<T> {
  const { data, content } = matter(raw)
  const schema = collectionSchemas[type]
  const result = schema.safeParse(data)
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ')
    throw new Error(`frontmatter 校验失败 ${filePath}\n${issues}`)
  }
  return {
    collection: type,
    slug: path.basename(filePath).replace(/\.md$/, ''),
    data: result.data,
    body: content.trim(),
  } as CollectionEntry<T>
}

/** 读取一个内容集合，按日期倒序（新在前） */
export function getCollection<T extends CollectionType>(
  type: T,
  options?: GetOptions,
): CollectionEntry<T>[] {
  const dir = resolveContentDir(type, options)
  if (!fs.existsSync(dir)) {
    throw new Error(`内容集合目录不存在：${dir}`)
  }
  const files = fs.readdirSync(dir).filter((file) => file.endsWith('.md'))
  return files
    .map((file) =>
      parseEntry<T>(type, path.join(dir, file), fs.readFileSync(path.join(dir, file), 'utf8')),
    )
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
}

/** 读取单条内容；文件不存在或 slug 非法时抛错（页面层转 404） */
export function getEntry<T extends CollectionType>(
  type: T,
  slug: string,
  options?: GetOptions,
): CollectionEntry<T> {
  assertSafeSlug(slug)
  const filePath = path.join(resolveContentDir(type, options), `${slug}.md`)
  if (!fs.existsSync(filePath)) {
    throw new Error(`内容不存在：${filePath}`)
  }
  return parseEntry<T>(type, filePath, fs.readFileSync(filePath, 'utf8'))
}

export type AdjacentEntry = {
  slug: string
  title: string
}

export type AdjacentResult = {
  prev: AdjacentEntry | null
  next: AdjacentEntry | null
}

/** 获取指定条目在集合中的上一篇（更早）与下一篇（更新），集合按日期倒序 */
export function getAdjacentEntries<T extends CollectionType>(
  type: T,
  slug: string,
  options?: GetOptions,
): AdjacentResult {
  const entries = getCollection(type, options)
  const index = entries.findIndex((e) => e.slug === slug)
  if (index === -1) return { prev: null, next: null }
  const newer = index > 0 ? entries[index - 1] : null
  const older = index < entries.length - 1 ? entries[index + 1] : null
  return {
    next: newer ? { slug: newer.slug, title: newer.data.title } : null,
    prev: older ? { slug: older.slug, title: older.data.title } : null,
  }
}

/** 全类型聚合，按日期倒序（首页混合时间线 / 归档共用，AGENTS.md 界面布局规范第 6 条） */
export function getAllEntries(options?: GetOptions): CollectionEntry<CollectionType>[] {
  const fileEntries = (Object.keys(collectionSchemas) as CollectionType[])
    // skills 是包目录形态，不走单文件集合（见 getSkillEntries）；其余跳过未启用目录
    .filter((type) => type !== 'skills' && fs.existsSync(resolveContentDir(type, options)))
    .flatMap((type) => getCollection(type as Exclude<CollectionType, 'skills'>, options))
  return [...fileEntries, ...getSkillEntries(options)].sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime(),
  )
}

/** 全类型聚合后截取最近 limit 条 */
export function getRecentEntries(
  limit: number,
  options?: GetOptions,
): CollectionEntry<CollectionType>[] {
  return getAllEntries(options).slice(0, limit)
}

export type CategorySummary = { name: string; count: number }

/** 聚合全类型已用分类（构建时统计，无硬编码清单）；按名称排序保证输出稳定 */
export function getCategories(options?: GetOptions): CategorySummary[] {
  const counts = new Map<string, number>()
  for (const entry of getAllEntries(options)) {
    const category = entry.data.category
    if (!category) continue
    counts.set(category, (counts.get(category) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** 指定分类的全类型条目（日期倒序） */
export function getEntriesByCategory(
  name: string,
  options?: GetOptions,
): CollectionEntry<CollectionType>[] {
  return getAllEntries(options).filter((entry) => entry.data.category === name)
}

/** 标签聚合：指定集合（有详情路由的类型，见 content-model §6）的去重标签，按名称排序 */
export function getAllTags(types: CollectionType[], options?: GetOptions): string[] {
  const tags = new Set<string>()
  for (const entry of getTaggedEntries(types, options)) {
    for (const tag of entry.data.tags) tags.add(tag)
  }
  return [...tags].sort((a, b) => a.localeCompare(b))
}

/** 指定标签的条目（日期倒序，跨指定集合） */
export function getEntriesByTag(
  tag: string,
  types: CollectionType[],
  options?: GetOptions,
): CollectionEntry<CollectionType>[] {
  return getTaggedEntries(types, options)
    .filter((entry) => entry.data.tags.includes(tag))
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
}

/** 标签聚合的数据源：单文件集合 + skills 包条目（包形态不走 getCollection） */
function getTaggedEntries(
  types: CollectionType[],
  options?: GetOptions,
): CollectionEntry<CollectionType>[] {
  const fileEntries = types
    .filter((type) => type !== 'skills')
    .flatMap((type) => getCollection(type, options))
  return types.includes('skills') ? [...fileEntries, ...getSkillEntries(options)] : fileEntries
}

export type SkillFile = {
  /** 包内相对路径（如 templates/checklist.md），排序稳定保证目录输出一致 */
  path: string
  /** 文本内容；不可读（二进制/权限）时为 null，仅列出路径 */
  content: string | null
}

export type SkillPackage = {
  slug: string
  data: z.infer<typeof skillSchema>
  /** SKILL.md 正文（入口说明） */
  body: string
  /** 包内全部文件（含 SKILL.md 自身），相对路径排序 */
  files: SkillFile[]
}

/** 列出 skill 包目录（仅目录；散落的单文件 md 不是包，忽略） */
export function listSkillSlugs(options?: GetOptions): string[] {
  const dir = resolveContentDir('skills', options)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((name) => fs.statSync(path.join(dir, name)).isDirectory())
    .sort()
}

/** 读取单个 skill 包：SKILL.md 解析 + 包文件清单（详情页以目录形式展示） */
export function getSkillPackage(slug: string, options?: GetOptions): SkillPackage {
  assertSafeSlug(slug)
  const pkgDir = path.join(resolveContentDir('skills', options), slug)
  const skillFile = path.join(pkgDir, 'SKILL.md')
  if (!fs.existsSync(skillFile)) {
    throw new Error(`skill 包缺入口：${skillFile}`)
  }
  const { data, content } = matter(fs.readFileSync(skillFile, 'utf8'))
  const result = skillSchema.safeParse(data)
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ')
    throw new Error(`frontmatter 校验失败 ${skillFile}\n${issues}`)
  }
  return { slug, data: result.data, body: content.trim(), files: listPackageFiles(pkgDir) }
}

function listPackageFiles(pkgDir: string): SkillFile[] {
  const out: SkillFile[] = []
  const walk = (dir: string, base: string) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name)
      const rel = base ? `${base}/${name}` : name
      if (fs.statSync(full).isDirectory()) {
        walk(full, rel)
      } else {
        let content: string | null = null
        try {
          content = fs.readFileSync(full, 'utf8')
        } catch {
          content = null
        }
        out.push({ path: rel, content })
      }
    }
  }
  walk(pkgDir, '')
  return out.sort((a, b) => a.path.localeCompare(b.path))
}

/** skill 包转为可聚合条目（body 取 SKILL.md 正文，供首页/分类/tags 入流） */
export function getSkillEntries(options?: GetOptions): CollectionEntry<'skills'>[] {
  return listSkillSlugs(options)
    .map((slug) => {
      const pkg = getSkillPackage(slug, options)
      return {
        collection: 'skills',
        slug,
        data: pkg.data,
        body: pkg.body,
      } as CollectionEntry<'skills'>
    })
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
}
