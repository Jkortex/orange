import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { z } from 'zod'
// 相对导入：本文件也被 scripts/*.ts 以 node --experimental-strip-types 直接加载，那条路径不解析 @/ 别名
import { compareText } from './format.ts'
import { countByCategory, groupByCategory } from './categories.ts'

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

export const postSchema = baseSchema.extend({
  /**
   * 所属专栏 id（如 ai-ddd）：专栏文章只出现在专栏页与直达链接，
   * 不进文章列表（首页列表与分类聚合都排除专栏文章）
   */
  column: z
    .string()
    .regex(/^[\w-]+$/, 'column 须为英文 slug（字母/数字/连字符/下划线），如 ai-ddd')
    .optional(),
})
export const lifeSchema = baseSchema.extend({
  location: z.string().optional(),
  weather: z.string().optional(),
  /** 生活记录内嵌的图片引用；不是独立的 photos 内容集合 */
  photos: z.array(z.string()).default([]),
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

export const systemSchema = baseSchema.extend({
  name: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'name 须为 kebab-case（小写字母/数字/连字符），如 mini-raft'),
  architecture: z.string().optional(),
  language: z.string().optional(),
  repoUrl: z.string().url().optional(),
  version: z.string().optional(),
})

export const collectionSchemas = {
  posts: postSchema,
  life: lifeSchema,
  music: musicSchema,
  skills: skillSchema,
  systems: systemSchema,
} as const

export type CollectionType = keyof typeof collectionSchemas

/** 拥有标签落地页的内容类型；路由页、sitemap 与 manifest 共用此注册表。 */
export const TAGGED_TYPES: CollectionType[] = ['posts', 'music', 'skills', 'systems', 'life']

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
  /** 内部控制：跳过 manifest 直接动态读取（生成 manifest 时使用） */
  skipManifest?: boolean
}

export class ContentNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ContentNotFoundError'
  }
}

export function isContentNotFoundError(error: unknown): error is ContentNotFoundError {
  return error instanceof ContentNotFoundError
}

export type ContentManifest = {
  version: number
  generatedAt: string
  collections: {
    [K in CollectionType]: CollectionEntry<K>[]
  }
  skills: {
    slugs: string[]
    packages: Record<string, SkillPackage>
    entries: CollectionEntry<'skills'>[]
  }
  systems: {
    slugs: string[]
    packages: Record<string, SystemPackage>
    entries: CollectionEntry<'systems'>[]
  }
  allEntries: CollectionEntry<CollectionType>[]
  categories: CategorySummary[]
  entriesByCategory: Record<string, CollectionEntry<CollectionType>[]>
  allTags: Record<string, string[]>
  adjacent: Record<string, AdjacentResult>
}

const MANIFEST_PATH = path.join(process.cwd(), '.generated', 'content-manifest.json')
const MANIFEST_VERSION = 5
let loadedManifest: ContentManifest | null = null

function loadManifestFromDisk(): ContentManifest | null {
  if (loadedManifest) return loadedManifest
  if (!fs.existsSync(MANIFEST_PATH)) return null
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf8')
    loadedManifest = JSON.parse(raw, (key, value) => {
      if (key === 'date' && typeof value === 'string') {
        return new Date(value)
      }
      return value
    }) as ContentManifest
    if (loadedManifest.version !== MANIFEST_VERSION) {
      throw new Error(
        `内容清单版本不兼容：${MANIFEST_PATH}（期望 ${MANIFEST_VERSION}，实际 ${loadedManifest.version}）`,
      )
    }
    return loadedManifest
  } catch (error) {
    // 清单存在却无法读取时必须 fail-fast；只有不存在才允许回退到源码目录。
    throw new Error(`内容清单读取失败：${MANIFEST_PATH}，请重新运行 prebuild`, { cause: error })
  }
}

const DEFAULT_CONTENT_DIR = path.join(process.cwd(), 'content')

function resolveContentDir(type: string, options?: GetOptions) {
  return path.join(options?.contentDir ?? DEFAULT_CONTENT_DIR, type)
}

const ENTRY_FILENAME_PATTERN = /^\d{4}-\d{2}-\d{2}-[\w-]+\.md$/

/** slug 只允许字母/数字/连字符/下划线，防止路径穿越（来源是 URL 参数） */
function assertSafeSlug(slug: string) {
  if (!/^[\w-]+$/.test(slug)) {
    throw new ContentNotFoundError(`非法 slug：${slug}`)
  }
}

function assertEntryFilename(filePath: string) {
  const filename = path.basename(filePath)
  if (!ENTRY_FILENAME_PATTERN.test(filename)) {
    throw new Error(`内容文件名必须符合 YYYY-MM-DD-slug.md：${filePath}`)
  }
}

/**
 * 校验正文 Markdown 代码块定界符的语法完整性：
 * 1. 嵌套代码块长度冲突：内层 ```lang 长度 >= 外层定界符长度，内层闭合时会提前截断外层；外层必须使用至少 4 个反引号（````）
 * 2. 连续紧邻定界符（如 ```\n```）：内层嵌套代码块提前闭合外层引发结构断裂
 * 3. 代码块未正常闭合
 */
export function assertMarkdownFences(filePath: string, content: string): void {
  const lines = content.split('\n')
  let inCode = false
  let openFence = ''
  let openLine = 0
  let lastCloseLine = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = line.match(/^ {0,3}([`~]{3,})(.*)$/)
    if (match) {
      const fence = match[1]
      const info = match[2].trim()
      const lineNum = i + 1

      if (!inCode) {
        if (lastCloseLine === lineNum - 1) {
          throw new Error(
            `Markdown 代码块校验失败 ${filePath}:${lineNum}：发现紧邻的代码块定界符（与第 ${lastCloseLine} 行连续），疑似内层嵌套代码块提前闭合外层引发结构断裂。若需在代码块内展示代码，外层必须使用至少 4 个反引号（\`\`\`\`）。`,
          )
        }
        inCode = true
        openFence = fence
        openLine = lineNum
      } else {
        if (fence[0] === openFence[0] && fence.length >= openFence.length && info === '') {
          inCode = false
          lastCloseLine = lineNum
        } else if (fence[0] === openFence[0] && fence.length >= openFence.length && info !== '') {
          throw new Error(
            `Markdown 代码块校验失败 ${filePath}:${lineNum}：内层代码块标记（${fence}${info}）反引号长度大于等于外层定界符（第 ${openLine} 行 ${openFence}），内层闭合时会提前截断外层！外层必须使用至少 ${fence.length + 1} 个反引号（如 \`\`\`\`）。`,
          )
        }
      }
    }
  }

  if (inCode) {
    throw new Error(
      `Markdown 代码块校验失败 ${filePath}:${openLine}：代码块（${openFence}）未正常闭合，请检查文件末尾或嵌套匹配。`,
    )
  }
}

function compareEntries<T extends CollectionType>(
  a: CollectionEntry<T>,
  b: CollectionEntry<T>,
) {
  const dateDiff = b.data.date.getTime() - a.data.date.getTime()
  if (dateDiff !== 0) return dateDiff
  return compareText(a.slug, b.slug) || compareText(a.collection, b.collection)
}

function parseEntry<T extends CollectionType>(
  type: T,
  filePath: string,
  raw: string,
): CollectionEntry<T> {
  assertEntryFilename(filePath)
  let parsed: ReturnType<typeof matter>
  try {
    parsed = matter(raw)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`frontmatter 解析失败 ${filePath}: ${message}`, { cause: error })
  }
  const { data, content } = parsed
  assertMarkdownFences(filePath, content)
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

const collectionCache = new Map<string, CollectionEntry<any>[]>()
const skillPackageCache = new Map<string, SkillPackage>()
const systemPackageCache = new Map<string, SystemPackage>()

/** 清除内容缓存（用于测试动态重载） */
export function clearContentCache(): void {
  collectionCache.clear()
  skillPackageCache.clear()
  systemPackageCache.clear()
  loadedManifest = null
}

/** 读取一个内容集合，按日期倒序（新在前） */
export function getCollection<T extends CollectionType>(
  type: T,
  options?: GetOptions,
): CollectionEntry<T>[] {
  const dir = resolveContentDir(type, options)
  if (!options?.contentDir && !options?.skipManifest) {
    const manifest = loadManifestFromDisk()
    if (manifest) {
      if (!fs.existsSync(dir)) {
        throw new Error(`内容集合目录不存在：${dir}`)
      }
      return (manifest.collections[type] ?? []) as CollectionEntry<T>[]
    }
  }

  const cacheKey = `${type}:${dir}`
  if (collectionCache.has(cacheKey)) {
    return collectionCache.get(cacheKey) as CollectionEntry<T>[]
  }
  if (!fs.existsSync(dir)) {
    throw new Error(`内容集合目录不存在：${dir}`)
  }
  const files = fs.readdirSync(dir).filter((file) => file.endsWith('.md'))
  const entries = files
    .map((file) =>
      parseEntry<T>(type, path.join(dir, file), fs.readFileSync(path.join(dir, file), 'utf8')),
    )
    .sort(compareEntries)
  collectionCache.set(cacheKey, entries)
  return entries
}

/** 读取单条内容；文件不存在或 slug 非法时抛错（页面层转 404） */
export function getEntry<T extends CollectionType>(
  type: T,
  slug: string,
  options?: GetOptions,
): CollectionEntry<T> {
  assertSafeSlug(slug)
  if (!options?.contentDir && !options?.skipManifest) {
    const manifest = loadManifestFromDisk()
    if (manifest) {
      const entry = (manifest.collections[type] as CollectionEntry<T>[] | undefined)?.find(
        (e) => e.slug === slug,
      )
      if (entry) return entry
      const filePath = path.join(resolveContentDir(type, options), `${slug}.md`)
      throw new ContentNotFoundError(`内容不存在：${filePath}`)
    }
  }

  const filePath = path.join(resolveContentDir(type, options), `${slug}.md`)
  if (!fs.existsSync(filePath)) {
    throw new ContentNotFoundError(`内容不存在：${filePath}`)
  }
  return parseEntry<T>(type, filePath, fs.readFileSync(filePath, 'utf8'))
}

/*
 * 草稿（content/drafts/）：仅本地开发可读的预览专区，绝不进入任何生产聚合。
 * 不注册进 collectionSchemas / TAGGED_TYPES，故 manifest、sitemap、rss、tags、categories 均不可见。
 * 故意绕过 manifest 与模块缓存、直读 fs：编辑已有草稿后刷新浏览器即生效（新增文件仍需重启，见 AGENTS.md 清单缓存约定）。
 */

/** 草稿是否可读：仅开发环境开启；测试经 options.contentDir 注入临时目录时也开启 */
export function isDraftsEnabled(options?: GetOptions): boolean {
  return process.env.NODE_ENV === 'development' || Boolean(options?.contentDir)
}

function resolveDraftsDir(options?: GetOptions) {
  return path.join(options?.contentDir ?? DEFAULT_CONTENT_DIR, 'drafts')
}

/** 读取全部草稿，按日期倒序（复用 posts 的 schema 与文件名约定，形状即 CollectionEntry<'posts'>） */
export function getDrafts(options?: GetOptions): CollectionEntry<'posts'>[] {
  if (!isDraftsEnabled(options)) return []
  const dir = resolveDraftsDir(options)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.md'))
    .map((file) =>
      parseEntry('posts', path.join(dir, file), fs.readFileSync(path.join(dir, file), 'utf8')),
    )
    .sort(compareEntries)
}

/** 读取单条草稿；未启用 / slug 非法 / 文件不存在均抛 ContentNotFoundError（页面转 404） */
export function getDraft(slug: string, options?: GetOptions): CollectionEntry<'posts'> {
  if (!isDraftsEnabled(options)) throw new ContentNotFoundError(`草稿仅在本地开发可用：${slug}`)
  assertSafeSlug(slug)
  const filePath = path.join(resolveDraftsDir(options), `${slug}.md`)
  if (!fs.existsSync(filePath)) throw new ContentNotFoundError(`草稿不存在：${filePath}`)
  return parseEntry('posts', filePath, fs.readFileSync(filePath, 'utf8'))
}

export type AdjacentEntry = {
  slug: string
  title: string
}

export type AdjacentResult = {
  prev: AdjacentEntry | null
  next: AdjacentEntry | null
}

/** 集合按日期倒序，计算每个条目的相邻结果（next=更新，prev=更早）；keyOf 决定返回键 */
function computeAdjacent<T extends CollectionType>(
  list: CollectionEntry<T>[],
  keyOf: (entry: CollectionEntry<T>) => string = (entry) => entry.slug,
): Record<string, AdjacentResult> {
  const adjacent: Record<string, AdjacentResult> = {}
  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    const newer = i > 0 ? list[i - 1] : null
    const older = i < list.length - 1 ? list[i + 1] : null
    adjacent[keyOf(item)] = {
      next: newer ? { slug: newer.slug, title: newer.data.title } : null,
      prev: older ? { slug: older.slug, title: older.data.title } : null,
    }
  }
  return adjacent
}

/** 获取指定条目在集合中的上一篇（更早）与下一篇（更新），集合按日期倒序 */
export function getAdjacentEntries<T extends CollectionType>(
  type: T,
  slug: string,
  options?: GetOptions,
): AdjacentResult {
  if (!options?.contentDir && !options?.skipManifest) {
    const manifest = loadManifestFromDisk()
    if (manifest) {
      const key = `${type}/${slug}`
      return manifest.adjacent[key] ?? { prev: null, next: null }
    }
  }

  const entries = getCollection(type, options)
  return computeAdjacent(entries)[slug] ?? { prev: null, next: null }
}

/** 全类型聚合，按日期倒序（归档共用） */
export function getAllEntries(options?: GetOptions): CollectionEntry<CollectionType>[] {
  if (!options?.contentDir && !options?.skipManifest) {
    const manifest = loadManifestFromDisk()
    if (manifest) {
      return manifest.allEntries
    }
  }

  const fileEntries = (Object.keys(collectionSchemas) as CollectionType[])
    // skills 与 systems 是包目录形态，不走单文件集合；其余跳过未启用目录
    .filter(
      (type) =>
        type !== 'skills' &&
        type !== 'systems' &&
        fs.existsSync(resolveContentDir(type, options)),
    )
    .flatMap(
      (type) =>
        getCollection(type as Exclude<CollectionType, 'skills' | 'systems'>, options),
    )
  return [
    ...fileEntries,
    ...getSkillEntries(options),
    ...getSystemEntries(options),
  ].sort(compareEntries)
}

export type CategorySummary = { name: string; count: number }

/**
 * 是否专栏文章：frontmatter 声明了 column 的条目。
 * 专栏文章有独立的入口（专栏页），不进入文章列表（首页列表 / 分类聚合 / RSS）。
 */
export function isColumnEntry(entry: { data: object }): boolean {
  return Boolean((entry.data as { column?: string | undefined }).column)
}

/** 文章列表条目（排除专栏文章）；专栏文章只在专栏页与直达链接出现 */
export function getArticleEntries(options?: GetOptions): CollectionEntry<'posts'>[] {
  return getCollection('posts', options).filter((entry) => !isColumnEntry(entry))
}

/** 聚合全类型已用分类（构建时统计，无硬编码清单）；按名称排序保证输出稳定；专栏文章不计入 */
export function getCategories(options?: GetOptions): CategorySummary[] {
  if (!options?.contentDir && !options?.skipManifest) {
    const manifest = loadManifestFromDisk()
    if (manifest) {
      return manifest.categories
    }
  }

  return countByCategory(
    getAllEntries(options).filter((entry) => !isColumnEntry(entry)),
    (entry) => entry.data.category,
  )
}

/** 指定分类的全类型条目（日期倒序）；专栏文章不计入分类页 */
export function getEntriesByCategory(
  name: string,
  options?: GetOptions,
): CollectionEntry<CollectionType>[] {
  if (!options?.contentDir && !options?.skipManifest) {
    const manifest = loadManifestFromDisk()
    if (manifest) {
      return manifest.entriesByCategory[name] ?? []
    }
  }

  return getAllEntries(options).filter(
    (entry) => entry.data.category === name && !isColumnEntry(entry),
  )
}

/** 标签聚合：指定集合（有详情路由的类型，见 content-model §6）的去重标签，按名称排序 */
export function getAllTags(types: CollectionType[], options?: GetOptions): string[] {
  if (!options?.contentDir && !options?.skipManifest) {
    const manifest = loadManifestFromDisk()
    if (manifest) {
      const key = [...types].sort().join(',')
      if (manifest.allTags[key]) {
        return manifest.allTags[key]
      }
    }
  }

  const tags = new Set<string>()
  for (const entry of getTaggedEntries(types, options)) {
    for (const tag of entry.data.tags) tags.add(tag)
  }
  return [...tags].sort(compareText)
}

/** 指定标签的条目（日期倒序，跨指定集合） */
export function getEntriesByTag(
  tag: string,
  types: CollectionType[],
  options?: GetOptions,
): CollectionEntry<CollectionType>[] {
  return getTaggedEntries(types, options)
    .filter((entry) => entry.data.tags.includes(tag))
    .sort(compareEntries)
}

/** 标签聚合的数据源：单文件集合 + skills/systems 包条目（包形态不走 getCollection） */
function getTaggedEntries(
  types: CollectionType[],
  options?: GetOptions,
): CollectionEntry<CollectionType>[] {
  const fileEntries = types
    .filter(
      (type) =>
        type !== 'skills' &&
        type !== 'systems' &&
        fs.existsSync(resolveContentDir(type, options)),
    )
    .flatMap((type) => getCollection(type, options))
  const extra: CollectionEntry<CollectionType>[] = []
  if (types.includes('skills')) extra.push(...getSkillEntries(options))
  if (types.includes('systems')) extra.push(...getSystemEntries(options))
  return [...fileEntries, ...extra]
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
  if (!options?.contentDir && !options?.skipManifest) {
    const manifest = loadManifestFromDisk()
    if (manifest) {
      return manifest.skills.slugs
    }
  }

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
  if (!options?.contentDir && !options?.skipManifest) {
    const manifest = loadManifestFromDisk()
    if (manifest) {
      const pkg = manifest.skills.packages[slug]
      if (pkg) return pkg
      const pkgDir = path.join(resolveContentDir('skills', options), slug)
      const skillFile = path.join(pkgDir, 'SKILL.md')
      throw new ContentNotFoundError(`skill 包缺入口：${skillFile}`)
    }
  }

  const pkgDir = path.join(resolveContentDir('skills', options), slug)
  const cacheKey = `${pkgDir}`
  const cached = skillPackageCache.get(cacheKey)
  if (cached) return cached

  const skillFile = path.join(pkgDir, 'SKILL.md')
  if (!fs.existsSync(skillFile)) {
    throw new ContentNotFoundError(`skill 包缺入口：${skillFile}`)
  }
  const { data, content } = matter(fs.readFileSync(skillFile, 'utf8'))
  assertMarkdownFences(skillFile, content)
  const result = skillSchema.safeParse(data)
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ')
    throw new Error(`frontmatter 校验失败 ${skillFile}\n${issues}`)
  }
  const pkg: SkillPackage = {
    slug,
    data: result.data,
    body: content.trim(),
    files: listPackageFiles(pkgDir),
  }
  skillPackageCache.set(cacheKey, pkg)
  return pkg
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
  return out.sort((a, b) => compareText(a.path, b.path))
}

/** skill 包转为可聚合条目（body 取 SKILL.md 正文，供分类/tags 入流） */
export function getSkillEntries(options?: GetOptions): CollectionEntry<'skills'>[] {
  if (!options?.contentDir && !options?.skipManifest) {
    const manifest = loadManifestFromDisk()
    if (manifest) {
      return manifest.skills.entries
    }
  }

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
    .sort(compareEntries)
}

export type SystemFile = {
  /** 包内相对路径（如 internal/raft/state.go），稳定排序 */
  path: string
  /** 文本内容；不可读或二进制为 null */
  content: string | null
  /** 字节数 */
  size: number
  /** 代码行数（文本文件） */
  lineCount?: number
}

export type FileTreeNode = {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
  size?: number
}

export type SystemPackage = {
  slug: string
  data: z.infer<typeof systemSchema>
  /** SYSTEM.md 正文（架构与设计说明） */
  body: string
  /** 嵌套目录树，供左侧文件树导航直接使用 */
  tree: FileTreeNode[]
  /** 包内全部文件列表，包含 SYSTEM.md */
  files: SystemFile[]
}

const IGNORED_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  '.next',
  'target',
  'vendor',
  '.DS_Store',
  '.turbo',
])

function shouldIgnore(name: string): boolean {
  return IGNORED_NAMES.has(name)
}

const MAX_TEXT_FILE_SIZE = 1024 * 1024 // 1MB

function listSystemFiles(pkgDir: string): SystemFile[] {
  const out: SystemFile[] = []
  const walk = (dir: string, base: string) => {
    for (const name of fs.readdirSync(dir)) {
      if (shouldIgnore(name)) continue
      const full = path.join(dir, name)
      const rel = base ? `${base}/${name}` : name
      const stat = fs.statSync(full)
      if (stat.isDirectory()) {
        walk(full, rel)
      } else {
        let content: string | null = null
        let lineCount: number | undefined
        if (stat.size <= MAX_TEXT_FILE_SIZE) {
          try {
            content = fs.readFileSync(full, 'utf8')
            lineCount = content.split('\n').length
          } catch {
            content = null
          }
        }
        out.push({
          path: rel,
          content,
          size: stat.size,
          lineCount,
        })
      }
    }
  }
  walk(pkgDir, '')
  return out.sort((a, b) => compareText(a.path, b.path))
}

export function buildFileTree(files: Array<{ path: string; size?: number }>): FileTreeNode[] {
  type TempNode = {
    name: string
    path: string
    type: 'file' | 'directory'
    children?: Map<string, TempNode>
    size?: number
  }

  const rootDirectories = new Map<string, TempNode>()
  const rootFiles: FileTreeNode[] = []

  for (const file of files) {
    const parts = file.path.split('/')
    if (parts.length === 1) {
      rootFiles.push({
        name: file.path,
        path: file.path,
        type: 'file',
        size: file.size,
      })
      continue
    }

    let currentMap = rootDirectories
    let curPath = ''
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      curPath = curPath ? `${curPath}/${part}` : part
      let dirNode = currentMap.get(part)
      if (!dirNode) {
        dirNode = {
          name: part,
          path: curPath,
          type: 'directory',
          children: new Map(),
        }
        currentMap.set(part, dirNode)
      }
      currentMap = dirNode.children!
    }

    const fileName = parts[parts.length - 1]
    currentMap.set(fileName, {
      name: fileName,
      path: file.path,
      type: 'file',
      size: file.size,
    })
  }

  function convertMap(map: Map<string, TempNode>): FileTreeNode[] {
    const dirs: FileTreeNode[] = []
    const fls: FileTreeNode[] = []

    for (const node of map.values()) {
      if (node.type === 'directory') {
        dirs.push({
          name: node.name,
          path: node.path,
          type: 'directory',
          children: convertMap(node.children!),
        })
      } else {
        fls.push({
          name: node.name,
          path: node.path,
          type: 'file',
          size: node.size,
        })
      }
    }

    dirs.sort((a, b) => compareText(a.name, b.name))
    fls.sort((a, b) => compareText(a.name, b.name))
    return [...dirs, ...fls]
  }

  const rootDirs = convertMap(rootDirectories)

  const systemMd = rootFiles.find((f) => f.name === 'SYSTEM.md')
  const otherFiles = rootFiles
    .filter((f) => f.name !== 'SYSTEM.md')
    .sort((a, b) => compareText(a.name, b.name))

  const result: FileTreeNode[] = []
  if (systemMd) result.push(systemMd)
  result.push(...rootDirs)
  result.push(...otherFiles)
  return result
}

/** 列出 system 包目录 */
export function listSystemSlugs(options?: GetOptions): string[] {
  if (!options?.contentDir && !options?.skipManifest) {
    const manifest = loadManifestFromDisk()
    if (manifest) {
      return manifest.systems?.slugs ?? []
    }
  }

  const dir = resolveContentDir('systems', options)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((name) => fs.statSync(path.join(dir, name)).isDirectory())
    .sort()
}

/** 读取单个 system 包：SYSTEM.md 解析 + 递归目录树生成 */
export function getSystemPackage(slug: string, options?: GetOptions): SystemPackage {
  assertSafeSlug(slug)
  if (!options?.contentDir && !options?.skipManifest) {
    const manifest = loadManifestFromDisk()
    if (manifest) {
      const pkg = manifest.systems?.packages[slug]
      if (pkg) return pkg
      const pkgDir = path.join(resolveContentDir('systems', options), slug)
      const systemFile = path.join(pkgDir, 'SYSTEM.md')
      throw new ContentNotFoundError(`system 包缺入口：${systemFile}`)
    }
  }

  const pkgDir = path.join(resolveContentDir('systems', options), slug)
  const cacheKey = `${pkgDir}`
  const cached = systemPackageCache.get(cacheKey)
  if (cached) return cached

  const systemFile = path.join(pkgDir, 'SYSTEM.md')
  if (!fs.existsSync(systemFile)) {
    throw new ContentNotFoundError(`system 包缺入口：${systemFile}`)
  }
  const { data, content } = matter(fs.readFileSync(systemFile, 'utf8'))
  assertMarkdownFences(systemFile, content)
  const result = systemSchema.safeParse(data)
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ')
    throw new Error(`frontmatter 校验失败 ${systemFile}\n${issues}`)
  }
  const files = listSystemFiles(pkgDir)
  const pkg: SystemPackage = {
    slug,
    data: result.data,
    body: content.trim(),
    tree: buildFileTree(files),
    files,
  }
  systemPackageCache.set(cacheKey, pkg)
  return pkg
}

/** system 包转为条目（供标签/分类等聚合） */
export function getSystemEntries(options?: GetOptions): CollectionEntry<'systems'>[] {
  if (!options?.contentDir && !options?.skipManifest) {
    const manifest = loadManifestFromDisk()
    if (manifest) {
      return manifest.systems?.entries ?? []
    }
  }

  return listSystemSlugs(options)
    .map((slug) => {
      const pkg = getSystemPackage(slug, options)
      return {
        collection: 'systems',
        slug,
        data: pkg.data,
        body: pkg.body,
      } as CollectionEntry<'systems'>
    })
    .sort(compareEntries)
}

/** 构建全量内容清单（供 prebuild 生成静态 manifest.json） */
export function buildContentManifest(options?: GetOptions): ContentManifest {
  const opts: GetOptions = { ...options, skipManifest: true }

  const collections = {
    posts: [],
    life: [],
    music: [],
    skills: [],
    systems: [],
  } as ContentManifest['collections']

  collections.posts = fs.existsSync(resolveContentDir('posts', opts))
    ? getCollection('posts', opts)
    : []
  collections.life = fs.existsSync(resolveContentDir('life', opts))
    ? getCollection('life', opts)
    : []
  collections.music = fs.existsSync(resolveContentDir('music', opts))
    ? getCollection('music', opts)
    : []

  const slugs = listSkillSlugs(opts)
  const packages: Record<string, SkillPackage> = {}
  for (const slug of slugs) {
    packages[slug] = getSkillPackage(slug, opts)
  }
  const skillEntries = getSkillEntries(opts)
  collections.skills = skillEntries

  const systemSlugs = listSystemSlugs(opts)
  const systemPackages: Record<string, SystemPackage> = {}
  for (const slug of systemSlugs) {
    systemPackages[slug] = getSystemPackage(slug, opts)
  }
  const systemEntries = getSystemEntries(opts)
  collections.systems = systemEntries

  const allEntries = getAllEntries(opts)

  const { categories, entriesByCategory } = groupByCategory(
    // 专栏文章不进文章列表，分类聚合同样排除
    allEntries.filter((entry) => !isColumnEntry(entry)),
    (entry) => entry.data.category,
  )

  const adjacent: Record<string, AdjacentResult> = {}
  for (const type of Object.keys(collectionSchemas) as CollectionType[]) {
    Object.assign(
      adjacent,
      computeAdjacent(collections[type] || [], (entry) => `${type}/${entry.slug}`),
    )
  }

  const allTags: Record<string, string[]> = {}
  const targetCombos: CollectionType[][] = [
    TAGGED_TYPES,
    ['posts', 'music', 'skills'],
    ['posts'],
  ]
  for (const combo of targetCombos) {
    const key = [...combo].sort().join(',')
    allTags[key] = getAllTags(combo, opts)
  }

  return {
    version: MANIFEST_VERSION,
    generatedAt: new Date().toISOString(),
    collections,
    skills: {
      slugs,
      packages,
      entries: skillEntries,
    },
    systems: {
      slugs: systemSlugs,
      packages: systemPackages,
      entries: systemEntries,
    },
    allEntries,
    categories,
    entriesByCategory,
    allTags,
    adjacent,
  }
}
