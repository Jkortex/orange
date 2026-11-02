import { describe, expect, it } from 'vitest'
import { detectCodeLanguage, highlightCode } from './highlight'

describe('detectCodeLanguage 语言推断', () => {
  it('按扩展名映射到 Shiki 语言', () => {
    expect(detectCodeLanguage('cmd/gateway/main.go')).toBe('go')
    expect(detectCodeLanguage('migrations/000001_init_schema.up.sql')).toBe('sql')
    expect(detectCodeLanguage('config/tempo.yaml')).toBe('yaml')
    expect(detectCodeLanguage('docker-compose.yml')).toBe('yaml')
    expect(detectCodeLanguage('README.md')).toBe('markdown')
  })

  it('无扩展名的已知文件按文件名映射', () => {
    expect(detectCodeLanguage('Makefile')).toBe('make')
    expect(detectCodeLanguage('deploy/Dockerfile')).toBe('docker')
  })

  it('未知类型退回 text（不着色但不报错）', () => {
    expect(detectCodeLanguage('go.sum')).toBe('text')
    expect(detectCodeLanguage('weird.xyz')).toBe('text')
    expect(detectCodeLanguage('LICENSE')).toBe('text')
  })
})

describe('highlightCode 构建期着色', () => {
  it('逐行返回 token，内容与原文一致', async () => {
    const code = 'package main\n\nfunc main() {}'
    const lines = await highlightCode(code, 'go')

    expect(lines).not.toBeNull()
    expect(lines).toHaveLength(3)
    expect(lines![0].map((t) => t.content).join('')).toBe('package main')
    expect(lines![1]).toEqual([])
  })

  it('关键字带双主题色变量，交由 html.dark 切换', async () => {
    const lines = await highlightCode('func main() {}', 'go')
    const keyword = lines![0].find((t) => t.content === 'func')

    expect(keyword?.style).toMatchObject({
      '--shiki-light': expect.any(String),
      '--shiki-dark': expect.any(String),
    })
  })

  it('text 语言退化为无样式 token', async () => {
    const lines = await highlightCode('hello world', 'text')
    expect(lines![0].every((t) => t.style === undefined)).toBe(true)
  })

  it('超大文件返回 null，由调用方回退纯文本', async () => {
    const huge = 'a\n'.repeat(4000)
    expect(await highlightCode(huge, 'go')).toBeNull()
  })
})
