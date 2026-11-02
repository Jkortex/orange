'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode,
  FileText,
  Folder,
  FolderOpen,
} from 'lucide-react'
import type { FileTreeNode } from '@/lib/content'
import { systemFileHref } from '@/lib/system-routes'

export type SystemFileTreeProps = {
  tree: FileTreeNode[]
  slug: string
  activePath: string
}

function getFileIcon(name: string) {
  if (name.endsWith('.md') || name.endsWith('.txt')) {
    return <FileText className="size-4 shrink-0 text-primary" aria-hidden />
  }
  if (
    name.endsWith('.go') ||
    name.endsWith('.rs') ||
    name.endsWith('.c') ||
    name.endsWith('.h') ||
    name.endsWith('.cpp') ||
    name.endsWith('.ts') ||
    name.endsWith('.tsx') ||
    name.endsWith('.js') ||
    name.endsWith('.py') ||
    name.endsWith('.sh') ||
    name.endsWith('.json') ||
    name.endsWith('.toml') ||
    name.endsWith('.yaml') ||
    name.endsWith('.yml') ||
    name === 'Makefile' ||
    name === 'go.mod' ||
    name === 'Cargo.toml'
  ) {
    return <FileCode className="size-4 shrink-0 text-muted-foreground" aria-hidden />
  }
  return <File className="size-4 shrink-0 text-muted-foreground" aria-hidden />
}

function ancestorPaths(filePath: string): string[] {
  const parts = filePath.split('/')
  const ancestors: string[] = []
  let current = ''
  for (let i = 0; i < parts.length - 1; i++) {
    current = current ? `${current}/${parts[i]}` : parts[i]
    ancestors.push(current)
  }
  return ancestors
}

export function SystemFileTree({ tree, slug, activePath }: SystemFileTreeProps) {
  // 初始展开：activePath 的各级祖先 + 第一层所有文件夹（方便一览全貌）
  const initialOpenPaths = useMemo(() => {
    const set = new Set<string>(ancestorPaths(activePath))
    for (const node of tree) {
      if (node.type === 'directory') {
        set.add(node.path)
      }
    }
    return set
  }, [activePath, tree])

  const [openPaths, setOpenPaths] = useState<Set<string>>(initialOpenPaths)

  // 外壳常驻后展开状态不再随导航重置：切到被折叠目录里的文件时补开其祖先
  useEffect(() => {
    setOpenPaths((prev) => {
      const missing = ancestorPaths(activePath).filter((path) => !prev.has(path))
      if (missing.length === 0) return prev
      const next = new Set(prev)
      for (const path of missing) next.add(path)
      return next
    })
  }, [activePath])

  function toggleDirectory(dirPath: string) {
    setOpenPaths((prev) => {
      const next = new Set(prev)
      if (next.has(dirPath)) {
        next.delete(dirPath)
      } else {
        next.add(dirPath)
      }
      return next
    })
  }

  function renderNode(node: FileTreeNode, depth = 0) {
    const isDir = node.type === 'directory'
    const isOpen = openPaths.has(node.path)
    const isActive = node.path === activePath
    const paddingLeft = `${depth * 0.75 + 0.5}rem`

    if (isDir) {
      return (
        <li key={node.path} className="space-y-0.5">
          <button
            type="button"
            onClick={() => toggleDirectory(node.path)}
            aria-expanded={isOpen}
            style={{ paddingLeft }}
            className="type-meta flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left font-mono text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {isOpen ? (
              <ChevronDown className="size-3.5 shrink-0 opacity-70" aria-hidden />
            ) : (
              <ChevronRight className="size-3.5 shrink-0 opacity-70" aria-hidden />
            )}
            {isOpen ? (
              <FolderOpen className="size-4 shrink-0 text-primary/80" aria-hidden />
            ) : (
              <Folder className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className="truncate">{node.name}</span>
          </button>
          {isOpen && node.children && (
            <ul className="space-y-0.5">{node.children.map((child) => renderNode(child, depth + 1))}</ul>
          )}
        </li>
      )
    }

    return (
      <li key={node.path}>
        <Link
          href={systemFileHref(slug, node.path)}
          scroll={false}
          aria-current={isActive ? 'page' : undefined}
          style={{ paddingLeft }}
          className={`type-meta flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left font-mono transition-colors ${
            isActive
              ? 'bg-primary/10 font-medium text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <span className="inline-block size-3.5 shrink-0" aria-hidden />
          {getFileIcon(node.name)}
          <span className="truncate">{node.name}</span>
        </Link>
      </li>
    )
  }

  return (
    <nav aria-label="工程文件导航" className="space-y-1">
      <ul className="space-y-0.5">{tree.map((node) => renderNode(node, 0))}</ul>
    </nav>
  )
}
