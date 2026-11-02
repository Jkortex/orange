import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  buildFileTree,
  clearContentCache,
  getSystemEntries,
  getSystemPackage,
  listSystemSlugs,
  systemSchema,
  toSystemOutline,
} from './content'

describe('系统工程内容层 (systems)', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'systems-test-'))
    clearContentCache()
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
    clearContentCache()
  })

  function createSystemDir(
    slug: string,
    frontmatter: Record<string, unknown>,
    body: string,
    files: Record<string, string> = {},
  ) {
    const sysDir = path.join(tempDir, 'systems', slug)
    fs.mkdirSync(sysDir, { recursive: true })

    const yamlLines = Object.entries(frontmatter).map(([k, v]) => {
      if (Array.isArray(v)) {
        return `${k}: [${v.map((x) => JSON.stringify(x)).join(', ')}]`
      }
      return `${k}: ${typeof v === 'string' ? JSON.stringify(v) : v}`
    })
    const md = `---\n${yamlLines.join('\n')}\n---\n\n${body}`
    fs.writeFileSync(path.join(sysDir, 'SYSTEM.md'), md, 'utf8')

    for (const [relPath, content] of Object.entries(files)) {
      const full = path.join(sysDir, relPath)
      fs.mkdirSync(path.dirname(full), { recursive: true })
      fs.writeFileSync(full, content, 'utf8')
    }
  }

  describe('systemSchema', () => {
    it('正确解析符合规范的系统 frontmatter', () => {
      const parsed = systemSchema.safeParse({
        title: 'Mini Raft',
        description: '分布式共识实现',
        date: new Date('2026-11-02'),
        category: 'systems',
        tags: ['raft', 'go'],
        name: 'mini-raft',
        architecture: 'Leader-Follower',
        language: 'Go',
      })
      expect(parsed.success).toBe(true)
    })

    it('非法 name（非 kebab-case）校验失败', () => {
      const parsed = systemSchema.safeParse({
        title: 'Bad Name',
        description: '测试',
        date: new Date('2026-11-02'),
        category: 'systems',
        tags: [],
        name: 'Mini_Raft',
      })
      expect(parsed.success).toBe(false)
    })
  })

  describe('listSystemSlugs & getSystemPackage', () => {
    it('目录不存在时返回空列表', () => {
      expect(listSystemSlugs({ contentDir: tempDir })).toEqual([])
    })

    it('正确列出系统 slug 并读取包内容与附属文件', () => {
      createSystemDir(
        'mini-raft',
        {
          title: 'Mini Raft',
          description: 'Raft 共识算法',
          date: new Date('2026-11-02'),
          category: 'systems',
          tags: ['raft'],
          name: 'mini-raft',
          language: 'Go',
        },
        '# Raft 设计说明\n架构图如下',
        {
          'cmd/main.go': 'package main\n\nfunc main() {}',
          'internal/raft/state.go': 'package raft\n\ntype State int',
        },
      )

      const slugs = listSystemSlugs({ contentDir: tempDir })
      expect(slugs).toEqual(['mini-raft'])

      const pkg = getSystemPackage('mini-raft', { contentDir: tempDir })
      expect(pkg.slug).toBe('mini-raft')
      expect(pkg.data.title).toBe('Mini Raft')
      expect(pkg.data.language).toBe('Go')
      expect(pkg.body).toContain('架构图如下')

      const paths = pkg.files.map((f) => f.path)
      expect(paths).toContain('SYSTEM.md')
      expect(paths).toContain('cmd/main.go')
      expect(paths).toContain('internal/raft/state.go')

      const mainGo = pkg.files.find((f) => f.path === 'cmd/main.go')
      expect(mainGo?.lineCount).toBe(3)
      expect(mainGo?.content).toBe('package main\n\nfunc main() {}')
    })

    it('缺少 SYSTEM.md 时抛出 ContentNotFoundError', () => {
      const badDir = path.join(tempDir, 'systems', 'empty-pkg')
      fs.mkdirSync(badDir, { recursive: true })
      fs.writeFileSync(path.join(badDir, 'foo.txt'), 'hello')

      expect(() => getSystemPackage('empty-pkg', { contentDir: tempDir })).toThrowError(
        /system 包缺入口：.*SYSTEM\.md/,
      )
    })
  })

  describe('buildFileTree', () => {
    it('将扁平文件列表组织为嵌套树形结构，SYSTEM.md 置顶，目录排在文件前', () => {
      const files = [
        { path: 'cmd/main.go', content: 'x', size: 10 },
        { path: 'internal/raft/state.go', content: 'x', size: 20 },
        { path: 'internal/raft/election.go', content: 'x', size: 30 },
        { path: 'internal/storage/wal.go', content: 'x', size: 40 },
        { path: 'SYSTEM.md', content: '# Readme', size: 50 },
        { path: 'go.mod', content: 'module test', size: 15 },
      ]

      const tree = buildFileTree(files)
      expect(tree[0].name).toBe('SYSTEM.md')
      expect(tree[0].type).toBe('file')

      const names = tree.map((n) => n.name)
      expect(names).toEqual(['SYSTEM.md', 'cmd', 'internal', 'go.mod'])

      const internal = tree.find((n) => n.name === 'internal')
      expect(internal?.type).toBe('directory')
      expect(internal?.children?.map((c) => c.name)).toEqual(['raft', 'storage'])

      const raft = internal?.children?.find((c) => c.name === 'raft')
      expect(raft?.children?.map((c) => c.name)).toEqual(['election.go', 'state.go'])
    })
  })

  describe('getSystemEntries', () => {
    it('正确将系统包转换为可供标签/全类型聚合的条目', () => {
      createSystemDir(
        'mini-kv',
        {
          title: 'Mini KV',
          description: '轻量键值存储',
          date: new Date('2026-11-02'),
          category: 'systems',
          tags: ['kv', 'storage'],
          name: 'mini-kv',
        },
        'KV 正文',
      )

      const entries = getSystemEntries({ contentDir: tempDir })
      expect(entries).toHaveLength(1)
      expect(entries[0].collection).toBe('systems')
      expect(entries[0].slug).toBe('mini-kv')
      expect(entries[0].data.title).toBe('Mini KV')
    })
  })

  describe('toSystemOutline', () => {
    it('只保留目录树与元信息，不携带任何文件正文', () => {
      createSystemDir(
        'mini-kv',
        {
          title: 'Mini KV',
          description: '轻量键值存储',
          date: new Date('2026-11-02'),
          category: 'systems',
          tags: ['kv'],
          name: 'mini-kv',
        },
        'KV 正文',
        { 'cmd/main.go': 'package main\n\nfunc main() {}\n' },
      )

      const outline = toSystemOutline(getSystemPackage('mini-kv', { contentDir: tempDir }))

      expect(outline.slug).toBe('mini-kv')
      expect(outline.filePaths).toEqual(['SYSTEM.md', 'cmd/main.go'])
      expect(outline.fileCount).toBe(2)
      expect(outline.lineCount).toBeGreaterThan(0)
      // 客户端载荷里绝不能出现正文（否则每个文件页都要重下整包）
      expect(JSON.stringify(outline)).not.toContain('package main')
      expect(JSON.stringify(outline)).not.toContain('KV 正文')
    })
  })
})
