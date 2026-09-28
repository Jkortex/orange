import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildContentManifest, clearContentCache, ContentNotFoundError, getAdjacentEntries, getAllTags, getCategories, getCollection, getEntriesByCategory, getEntriesByTag, getEntry, getRecentEntries, getSkillEntries, getSkillPackage, listSkillSlugs } from '@/lib/content'

// 内容层测试：用临时目录构造 fixture，不依赖真实 content/
let contentDir: string

function writeFixture(relPath: string, raw: string) {
  const full = path.join(contentDir, relPath)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, raw, 'utf8')
}

beforeEach(() => {
  clearContentCache()
  contentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orange-content-'))
})

afterEach(() => {
  fs.rmSync(contentDir, { recursive: true, force: true })
})

describe('getCollection 正常解析', () => {
  it('解析 frontmatter 与正文，slug 取自文件名，按日期倒序', () => {
    writeFixture(
      'posts/2026-09-01-first.md',
      `---
title: 第一篇
date: 2026-09-01
tags: [a]
---

第一篇正文
`,
    )
    writeFixture(
      'posts/2026-09-13-second.md',
      `---
title: 第二篇
date: 2026-09-13
description: 描述
---

第二篇正文
`,
    )

    const entries = getCollection('posts', { contentDir })

    expect(entries).toHaveLength(2)
    // 新的在前
    expect(entries[0].collection).toBe('posts')
    expect(entries[0].slug).toBe('2026-09-13-second')
    expect(entries[0].data.title).toBe('第二篇')
    expect(entries[0].data.description).toBe('描述')
    expect(entries[0].data.date).toEqual(new Date('2026-09-13'))
    expect(entries[0].body).toContain('第二篇正文')
    expect(entries[1].slug).toBe('2026-09-01-first')
    expect(entries[1].data.tags).toEqual(['a'])
  })

  it('tags 缺省为空数组', () => {
    writeFixture(
      'posts/2026-09-01-no-tags.md',
      `---
title: 无标签
date: 2026-09-01
---

正文
`,
    )

    const entries = getCollection('posts', { contentDir })

    expect(entries[0].data.tags).toEqual([])
  })

  it('空集合目录返回空数组', () => {
    fs.mkdirSync(path.join(contentDir, 'life'), { recursive: true })

    expect(getCollection('life', { contentDir })).toEqual([])
  })

  it('同日期条目按 slug 提供稳定排序，不依赖文件系统枚举顺序', () => {
    writeFixture(
      'posts/2026-09-01-zebra.md',
      '---\ntitle: Zebra\ndate: 2026-09-01\n---\n正文',
    )
    writeFixture(
      'posts/2026-09-01-alpha.md',
      '---\ntitle: Alpha\ndate: 2026-09-01\n---\n正文',
    )

    expect(getCollection('posts', { contentDir }).map((entry) => entry.slug)).toEqual([
      '2026-09-01-alpha',
      '2026-09-01-zebra',
    ])
  })

  it('文件集合拒绝不符合 YYYY-MM-DD-slug 约定的文件名', () => {
    writeFixture(
      'posts/not-a-dated-entry.md',
      '---\ntitle: 错误文件名\ndate: 2026-09-01\n---\n正文',
    )

    expect(() => getCollection('posts', { contentDir })).toThrowError(/文件名|slug/)
  })
})

describe('getEntry 单条读取', () => {
  it('返回指定 slug 的条目', () => {
    writeFixture(
      'posts/2026-09-01-hello.md',
      `---
title: 你好
date: 2026-09-01
---

正文内容
`,
    )

    const entry = getEntry('posts', '2026-09-01-hello', { contentDir })

    expect(entry.data.title).toBe('你好')
    expect(entry.body).toContain('正文内容')
  })
})

describe('music 集合：专辑分组解析', () => {
  it('解析合法专辑：artist、tracks 列表、可选 year/cover', () => {
    writeFixture(
      'music/2026-09-01-orange-album.md',
      `---
title: 橘色专辑
date: 2026-09-01
artist: 橘子
year: 2026
cover: /media/music/covers/orange.jpg
tags: [橙色]
tracks:
  - title: 曲目一
    file: /media/music/orange-01.mp3
  - title: 曲目二
    file: /media/music/orange-02.mp3
---

专辑介绍正文
`,
    )

    const entries = getCollection('music', { contentDir })

    expect(entries).toHaveLength(1)
    expect(entries[0].data.artist).toBe('橘子')
    expect(entries[0].data.year).toBe(2026)
    expect(entries[0].data.cover).toBe('/media/music/covers/orange.jpg')
    expect(entries[0].data.tracks).toEqual([
      { title: '曲目一', file: '/media/music/orange-01.mp3' },
      { title: '曲目二', file: '/media/music/orange-02.mp3' },
    ])
    expect(entries[0].body).toContain('专辑介绍正文')
  })

  it('year 为字符串数字时被 coerce 为 number，缺省字段可用', () => {
    writeFixture(
      'music/2026-09-02-mini.md',
      `---
title: 小专辑
date: 2026-09-02
artist: 橘子树
year: '2025'
tracks:
  - title: 只有一首
    file: /media/music/mini.mp3
---

正文
`,
    )

    const entry = getEntry('music', '2026-09-02-mini', { contentDir })

    expect(entry.data.year).toBe(2025)
    expect(entry.data.cover).toBeUndefined()
    expect(entry.data.tracks).toHaveLength(1)
  })

  it('缺 artist 时报错', () => {
    writeFixture(
      'music/2026-09-03-no-artist.md',
      `---
title: 无艺术家
date: 2026-09-03
tracks:
  - title: 曲目
    file: /media/music/x.mp3
---

正文
`,
    )

    expect(() => getCollection('music', { contentDir })).toThrowError(/artist/)
  })

  it('tracks 为空数组时报错', () => {
    writeFixture(
      'music/2026-09-04-empty-tracks.md',
      `---
title: 空曲目
date: 2026-09-04
artist: 某人
tracks: []
---

正文
`,
    )

    expect(() => getCollection('music', { contentDir })).toThrowError(/tracks/)
  })

  it('track 缺 file 时报错', () => {
    writeFixture(
      'music/2026-09-05-no-file.md',
      `---
title: 缺文件
date: 2026-09-05
artist: 某人
tracks:
  - title: 曲目
---

正文
`,
    )

    expect(() => getCollection('music', { contentDir })).toThrowError(/file/)
  })

  it('year 超范围或非数字时报错', () => {
    writeFixture(
      'music/2026-09-06-bad-year.md',
      `---
title: 坏年份
date: 2026-09-06
artist: 某人
year: 1800
tracks:
  - title: 曲目
    file: /media/music/y.mp3
---

正文
`,
    )

    expect(() => getCollection('music', { contentDir })).toThrowError(/year/)

    writeFixture(
      'music/2026-09-07-text-year.md',
      `---
title: 文本年份
date: 2026-09-07
artist: 某人
year: abc
tracks:
  - title: 曲目
    file: /media/music/z.mp3
---

正文
`,
    )

    expect(() => getCollection('music', { contentDir })).toThrowError(/year/)
  })
})

describe('getRecentEntries 全类型聚合', () => {
  it('跨类型按日期倒序混合，截取 limit 条', () => {
    writeFixture(
      'posts/2026-09-01-post.md',
      `---
title: 文章
date: 2026-09-01
---

正文
`,
    )
    writeFixture(
      'life/2026-09-10-life.md',
      `---
title: 生活
date: 2026-09-10
---

正文
`,
    )
    writeFixture(
      'music/2026-09-13-album.md',
      `---
title: 专辑
date: 2026-09-13
artist: 某人
tracks:
  - title: 曲目
    file: /media/music/x.mp3
---

正文
`,
    )

    const entries = getRecentEntries(2, { contentDir })

    expect(entries).toHaveLength(2)
    expect(entries[0].collection).toBe('music')
    expect(entries[0].data.title).toBe('专辑')
    expect(entries[1].collection).toBe('life')
  })

  it('未注册的 photos 目录不会进入内容聚合或 manifest', () => {
    writeFixture(
      'posts/2026-09-01-post.md',
      '---\ntitle: 文章\ndate: 2026-09-01\n---\n正文',
    )
    writeFixture(
      'photos/2026-09-01-photo.md',
      '---\ntitle: 照片\ndate: 2026-09-02\n---\n未启用的内容集合',
    )

    const entries = getRecentEntries(10, { contentDir })
    const manifest = buildContentManifest({ contentDir })

    expect(entries.map((entry) => entry.collection)).toEqual(['posts'])
    expect(Object.keys(manifest.collections)).not.toContain('photos')
    expect(manifest.allEntries.map((entry) => String(entry.collection))).not.toContain('photos')
  })

  it('集合目录缺失（未启用类型）时跳过，不报错', () => {
    writeFixture(
      'posts/2026-09-01-only.md',
      `---
title: 仅有文章
date: 2026-09-01
---

正文
`,
    )
    // 其他未注册集合目录未建立

    const entries = getRecentEntries(10, { contentDir })

    expect(entries).toHaveLength(1)
    expect(entries[0].collection).toBe('posts')
  })

  it('全部集合为空时返回空数组', () => {
    expect(getRecentEntries(10, { contentDir })).toEqual([])
  })

  it('已启用集合 frontmatter 校验失败时抛错，不静默吞掉', () => {
    writeFixture(
      'posts/2026-09-01-missing-date.md',
      `---
title: 缺日期
---

正文
`,
    )
    // 其他未注册集合目录未建立（未启用类型）仍应跳过，但 posts 校验失败必须暴露

    expect(() => getRecentEntries(10, { contentDir })).toThrowError(/missing-date/)
  })
})

describe('异常边界', () => {
  it('frontmatter 缺 title 时报错，且错误信息包含文件路径', () => {
    writeFixture(
      'posts/2026-09-01-missing-title.md',
      `---
date: 2026-09-01
---

正文
`,
    )

    expect(() => getCollection('posts', { contentDir })).toThrowError(
      /2026-09-01-missing-title\.md/,
    )
  })

  it('date 非法时报错', () => {
    writeFixture(
      'posts/2026-09-01-bad-date.md',
      `---
title: 坏日期
date: not-a-date
---

正文
`,
    )

    expect(() => getCollection('posts', { contentDir })).toThrowError(
      /bad-date/,
    )
  })

  it('集合目录不存在时报错', () => {
    expect(() => getCollection('music', { contentDir })).toThrowError(/music/)
  })

  it('getEntry 遇到路径穿越字符时拒绝', () => {
    expect(() => getEntry('posts', '../secret', { contentDir })).toThrowError()
  })

  it('getEntry 文件不存在时使用可识别的 NotFound 错误', () => {
    fs.mkdirSync(path.join(contentDir, 'posts'), { recursive: true })

    expect(() => getEntry('posts', 'not-exist', { contentDir })).toThrowError(
      /not-exist/,
    )
    try {
      getEntry('posts', 'not-exist', { contentDir })
    } catch (error) {
      expect(error).toBeInstanceOf(ContentNotFoundError)
    }
  })
})

describe('分类聚合：category 由内容声明，构建时聚合，零代码改动', () => {
  const POST_CSS = '---\ntitle: CSS 文章\ndate: 2026-09-04\ncategory: css\n---\n正文'
  const POST_CSS2 = '---\ntitle: CSS 再谈\ndate: 2026-09-03\ncategory: css\n---\n正文'
  const POST_NO = '---\ntitle: 无分类\ndate: 2026-09-05\n---\n正文'
  const ALBUM = '---\ntitle: 欢快专辑\ndate: 2026-09-02\nartist: X\ncategory: cheerful\ntracks:\n  - title: 曲一\n    file: /media/music/a.wav\n---\n'

  it('getCategories 跨类型聚合去重计数，无分类条目不计入，按名称排序', () => {
    writeFixture('posts/2026-09-04-a.md', POST_CSS)
    writeFixture('posts/2026-09-03-b.md', POST_CSS2)
    writeFixture('posts/2026-09-05-c.md', POST_NO)
    writeFixture('music/2026-09-02-album.md', ALBUM)

    expect(getCategories({ contentDir })).toEqual([
      { name: 'cheerful', count: 1 },
      { name: 'css', count: 2 },
    ])
  })

  it('getCategories 全部无分类时返回空数组', () => {
    writeFixture('posts/2026-09-05-c.md', POST_NO)

    expect(getCategories({ contentDir })).toEqual([])
  })

  it('getEntriesByCategory 返回该分类全类型条目（日期倒序，跨集合）', () => {
    writeFixture('posts/2026-09-04-a.md', POST_CSS)
    writeFixture('music/2026-09-02-album.md', ALBUM)
    writeFixture('posts/2026-09-03-b.md', POST_CSS2)

    const entries = getEntriesByCategory('css', { contentDir })
    expect(entries.map((entry) => entry.slug)).toEqual(['2026-09-04-a', '2026-09-03-b'])
    expect(entries[0]?.collection).toBe('posts')
  })

  it('category 含非法字符（中文/空格）时校验报错，错误信息含字段名', () => {
    writeFixture('posts/2026-09-04-a.md', '---\ntitle: X\ndate: 2026-09-04\ncategory: 设计模式\n---\n')

    expect(() => getCollection('posts', { contentDir })).toThrowError(/category/)
  })
})

describe('标签聚合：指定集合（有详情路由的类型）去重聚合', () => {
  const POST = '---\ntitle: 文章\ndate: 2026-09-04\ntags: [a, b]\n---\n正文'
  const ALBUM = '---\ntitle: 专辑\ndate: 2026-09-05\nartist: X\ntags: [b, c]\ntracks:\n  - title: 曲一\n    file: /media/music/a.wav\n---\n'
  const NO_TAGS = '---\ntitle: 无标签\ndate: 2026-09-03\n---\n正文'

  it('getAllTags 跨集合去重聚合，按名称排序', () => {
    writeFixture('posts/2026-09-04-a.md', POST)
    writeFixture('music/2026-09-05-album.md', ALBUM)

    expect(getAllTags(['posts', 'music'], { contentDir })).toEqual(['a', 'b', 'c'])
  })

  it('getAllTags 只聚合指定集合（未登记类型不计入）', () => {
    writeFixture('posts/2026-09-04-a.md', POST)
    writeFixture('music/2026-09-05-album.md', ALBUM)

    expect(getAllTags(['posts'], { contentDir })).toEqual(['a', 'b'])
  })

  it('getAllTags 全部无标签时返回空数组', () => {
    writeFixture('posts/2026-09-03-c.md', NO_TAGS)

    expect(getAllTags(['posts'], { contentDir })).toEqual([])
  })

  it('getEntriesByTag 返回该标签全指定集合条目（日期倒序）', () => {
    writeFixture('posts/2026-09-04-a.md', POST)
    writeFixture('music/2026-09-05-album.md', ALBUM)
    writeFixture('posts/2026-09-03-c.md', NO_TAGS)

    const entries = getEntriesByTag('b', ['posts', 'music'], { contentDir })

    expect(entries.map((entry) => entry.slug)).toEqual(['2026-09-05-album', '2026-09-04-a'])
    expect(entries[0]?.collection).toBe('music')
  })

  it('getEntriesByTag 未知标签返回空数组', () => {
    writeFixture('posts/2026-09-04-a.md', POST)

    expect(getEntriesByTag('zzz', ['posts'], { contentDir })).toEqual([])
  })

  it('标签聚合含 skill 包条目（包形态不走单文件集合）', () => {
    writeFixture('posts/2026-09-04-a.md', POST)
    writeFixture(
      'skills/2026-09-14-tdd/SKILL.md',
      '---\ntitle: TDD\ndate: 2026-09-14\nname: tdd-basics\ntags: [workflow]\n---\n正文',
    )

    expect(getAllTags(['posts', 'skills'], { contentDir })).toEqual(['a', 'b', 'workflow'])

    const entries = getEntriesByTag('workflow', ['posts', 'skills'], { contentDir })
    expect(entries).toHaveLength(1)
    expect(entries[0].collection).toBe('skills')
  })
  it('manifest 预聚合所有已登记标签页类型，包含仅出现在 life 的标签', () => {
    writeFixture(
      'life/2026-09-01-life.md',
      '---\ntitle: 生活\ndate: 2026-09-01\ntags: [only-life]\n---\n正文',
    )

    const manifest = buildContentManifest({ contentDir })

    expect(manifest.allTags['life,music,posts,skills']).toEqual(['only-life'])
  })
})

describe('skills 包目录：SKILL.md + 附属文件，页面以目录形式展示', () => {
  const SKILL = `---
title: TDD 基础
date: 2026-09-14
name: tdd-basics
version: 1.0.0
author: Orange
tags: [workflow]
description: 红绿重构循环，测试先行。
---

# TDD 基础

## 红

先写失败的测试。

## 绿

写最少的实现让它通过。
`
  const TEMPLATE = '# 提交模板\n\n- 标题\n- 说明\n'
  const REFERENCE = '# 坑点\n\n- 别测实现细节\n'

  function writeSkill(slug: string) {
    writeFixture(`skills/${slug}/SKILL.md`, SKILL)
    writeFixture(`skills/${slug}/templates/checklist.md`, TEMPLATE)
    writeFixture(`skills/${slug}/references/pitfalls.md`, REFERENCE)
  }

  it('解析 SKILL.md frontmatter（name/version/author）与包文件清单', () => {
    writeSkill('2026-09-14-tdd-basics')

    const pkg = getSkillPackage('2026-09-14-tdd-basics', { contentDir })

    expect(pkg.slug).toBe('2026-09-14-tdd-basics')
    expect(pkg.data.name).toBe('tdd-basics')
    expect(pkg.data.version).toBe('1.0.0')
    expect(pkg.data.title).toBe('TDD 基础')
    expect(pkg.body).toContain('先写失败的测试')
    expect(pkg.files.map((f) => f.path).sort()).toEqual([
      'SKILL.md',
      'references/pitfalls.md',
      'templates/checklist.md',
    ])
    expect(pkg.files.find((f) => f.path === 'templates/checklist.md')?.content).toContain('提交模板')
  })

  it('重复读取同一 skill 包复用缓存，clearContentCache 后可重载', () => {
    writeSkill('2026-09-14-tdd-basics')

    const first = getSkillPackage('2026-09-14-tdd-basics', { contentDir })
    const second = getSkillPackage('2026-09-14-tdd-basics', { contentDir })
    expect(second).toBe(first)

    clearContentCache()
    expect(getSkillPackage('2026-09-14-tdd-basics', { contentDir })).not.toBe(first)
  })

  it('name 非 kebab-case 时构建即报错', () => {
    writeFixture(
      'skills/2026-09-14-bad/SKILL.md',
      '---\ntitle: 坏\ndate: 2026-09-14\nname: Bad_Name\n---\n正文',
    )

    expect(() => getSkillPackage('2026-09-14-bad', { contentDir })).toThrowError(/name/)
  })

  it('缺 SKILL.md 的包目录报错', () => {
    fs.mkdirSync(path.join(contentDir, 'skills/2026-09-14-empty'), { recursive: true })

    expect(() => getSkillPackage('2026-09-14-empty', { contentDir })).toThrowError(/SKILL\.md/)
  })

  it('slug 非法（路径穿越）时拒绝', () => {
    expect(() => getSkillPackage('../secret', { contentDir })).toThrowError()
  })

  it('listSkillSlugs 列出包目录（忽略散落 md）', () => {
    writeSkill('2026-09-14-tdd-basics')
    writeFixture('skills/stray.md', '---\ntitle: 散落\ndate: 2026-09-14\n---\n')

    expect(listSkillSlugs({ contentDir })).toEqual(['2026-09-14-tdd-basics'])
  })

  it('getSkillEntries 转为可聚合条目（首页/分类/tags 入流）', () => {
    writeSkill('2026-09-14-tdd-basics')

    const entries = getSkillEntries({ contentDir })

    expect(entries).toHaveLength(1)
    expect(entries[0].collection).toBe('skills')
    expect(entries[0].slug).toBe('2026-09-14-tdd-basics')
    expect(entries[0].data.title).toBe('TDD 基础')
    expect(entries[0].data.tags).toEqual(['workflow'])
  })

  it('skills 未启用（无目录）时聚合为空，不报错', () => {
    expect(getSkillEntries({ contentDir })).toEqual([])
    expect(listSkillSlugs({ contentDir })).toEqual([])
  })
})

describe('getAdjacentEntries 相邻条目', () => {
  it('正确获取按日期排序的上一篇与下一篇', () => {
    writeFixture('posts/2026-09-01-first.md', '---\ntitle: 第一篇\ndate: 2026-09-01\n---\n正文1')
    writeFixture('posts/2026-09-02-second.md', '---\ntitle: 第二篇\ndate: 2026-09-02\n---\n正文2')
    writeFixture('posts/2026-09-03-third.md', '---\ntitle: 第三篇\ndate: 2026-09-03\n---\n正文3')

    // 集合倒序：third (09-03), second (09-02), first (09-01)
    const secondAdj = getAdjacentEntries('posts', '2026-09-02-second', { contentDir })
    expect(secondAdj.next?.slug).toBe('2026-09-03-third')
    expect(secondAdj.prev?.slug).toBe('2026-09-01-first')

    const newestAdj = getAdjacentEntries('posts', '2026-09-03-third', { contentDir })
    expect(newestAdj.next).toBeNull()
    expect(newestAdj.prev?.slug).toBe('2026-09-02-second')

    const oldestAdj = getAdjacentEntries('posts', '2026-09-01-first', { contentDir })
    expect(oldestAdj.next?.slug).toBe('2026-09-02-second')
    expect(oldestAdj.prev).toBeNull()
  })
})
