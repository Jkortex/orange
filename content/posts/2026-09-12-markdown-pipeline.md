---
title: 渲染管线的设计取舍
date: 2026-09-12
category: meta
tags: [blog]
description: 为什么选择 react-markdown 而不是 MDX。
---

## 结论

内容文件保持纯 markdown，可移植性优先；所有动态渲染都发生在组件层。

> 这样未来更换渲染方案时，内容仓库不需要任何改动。
