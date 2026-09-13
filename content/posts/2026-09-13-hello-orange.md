---
title: 你好，Orange
date: 2026-09-13
category: meta
tags: [meta, blog]
description: 博客骨架的第一篇文章，用于验证内容管线。
---

## 为什么是骨架

这是一篇示例文章，用于验证从 markdown 到 React 组件的完整渲染管线：frontmatter 校验、构建时读取、节点级自定义映射。

:::note
这是一个 remark-directive 自定义块（`:::note`），映射为语义 token 样式的组件，内容文件中不写任何 JSX/HTML。
:::

## GFM 支持

支持表格、删除线、任务列表等：

| 特性 | 状态 |
| --- | --- |
| 代码高亮 | Shiki dual theme |
| 自定义块 | remark-directive |
| 全文 RSS | 已接入 |

删除线示例：~~旧的方案~~。

## 代码块

```ts
// 构建时高亮，随主题切换（dual theme）
export function hello(name: string) {
  return `你好，${name}`
}
```
