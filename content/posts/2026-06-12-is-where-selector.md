---
title: 'CSS :is() 与 :where() 选择器'
date: '2026-06-12'
tags:
  - CSS
  - 选择器
  - 伪类
  - 特异性
  - 组件
category: css
description: ':is() 和 :where() 的核心差异在特异性。组件用 :where() 写底座样式，外部用 :is() 或普通类轻松覆盖。'
---

## 概述

`:is()` 和 `:where()` 最大的实用价值在于配合两者的**特异性差异**，构建"底座样式可被轻松覆盖"的组件体系。

| 伪类 | 特异性 | 适合谁用 |
|------|--------|---------|
| **`:where()`** | **始终为 0** | 组件作者 — 底座样式不怕被外部覆盖 |
| **`:is()`** | **取参数中最高** | 外部使用者 — 批量覆盖组件样式 |

---

## 案例一：:is() 简化多选择器

`:is()` 避免重复书写相同选择器，让 hover、focus 等状态管理更简洁。

:::demo[案例一：:is() 简化状态与层级]

```html
<div class="isw-card" tabindex="0">
  <h3>卡片标题（可 Hover 或 Focus）</h3>
  <p>hover 或 focus 此卡片，卡片边框、阴影与标题描述颜色同步变化。</p>
</div>
<div class="isw-card" tabindex="0">
  <h3>另一张卡片</h3>
  <p>:is() 让多状态伪类书写更简洁紧凑。</p>
</div>
```

```css
.isw-card {
  padding: 16px 20px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
  margin-bottom: 12px;
}

.isw-card h3 {
  margin: 0 0 6px 0;
  font-size: 1rem;
  font-weight: 600;
  color: #334155;
  transition: color 0.2s ease;
}

.isw-card p {
  margin: 0;
  font-size: 0.875rem;
  color: #64748b;
  transition: color 0.2s ease;
}

/* 使用 :is() 一次性组合多个交互状态 */
.isw-card:is(:hover, :focus-visible) {
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
  transform: translateY(-2px);
}

.isw-card:is(:hover, :focus-visible) h3 {
  color: #2563eb;
}

.isw-card:is(:hover, :focus-visible) p {
  color: #1d4ed8;
}
```

:::

不用 `:is()` 需要重复写：`.isw-card:hover, .isw-card:focus-visible` 等一系列选择器。

---

## 案例二：组件用 :where()，外部轻松覆盖

> 组件作者用 `:where()` 定义默认样式（特异性 0）→ 外部用普通类就能覆盖。

下方两个按钮，左侧用常规选择器定义内部样式，右侧用 `:where()`。外部尝试用 `.outer-theme` 覆盖，结果截然不同：

:::demo[案例二：:where() 特异性为 0 的覆盖对比]

```html
<div class="demo-wrapper">
  <div class="btn-col">
    <span class="badge badge-amber">不用 :where()</span>
    <button class="nowhere-btn nowhere-outer">
      <span class="btn-icon">★</span>
      <span class="btn-label">按钮</span>
    </button>
    <span class="caption">外部覆盖失败 — 组件内部样式优先级更高</span>
  </div>

  <div class="btn-col">
    <span class="badge badge-blue">用 :where()</span>
    <div class="outer-theme">
      <button class="where-btn">
        <span class="btn-icon">★</span>
        <span class="btn-label">按钮</span>
      </button>
    </div>
    <span class="caption">外部覆盖成功 — :where() 特异性为 0</span>
  </div>
</div>
```

```css
.demo-wrapper {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  justify-content: center;
  padding: 12px 0;
}

.btn-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 180px;
}

.badge {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 4px 12px;
  border-radius: 4px;
}

.badge-amber {
  background: #fef3c7;
  color: #92400e;
}

.badge-blue {
  background: #dbeafe;
  color: #1e40af;
}

.caption {
  font-size: 0.75rem;
  color: #9ca3af;
  text-align: center;
}

button {
  cursor: pointer;
  border: 1px solid #cbd5e1;
  padding: 8px 18px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  background: #ffffff;
  transition: all 0.2s ease;
}

/* ❌ 未用 :where()：.nowhere-btn .btn-label 特异性为 (0,0,1,1) */
.nowhere-btn .btn-label {
  color: #0f172a;
}
.nowhere-btn .btn-icon {
  color: #64748b;
}

/* 外部只写了一个类：.nowhere-outer (0,0,1,0)，权重不足无法覆盖标签颜色 */
.nowhere-outer .btn-label {
  color: #2563eb;
}

/* ✅ 使用 :where()：特异性恒为 0，整体仅为 .where-btn 的权重 (0,0,1,0) */
.where-btn :where(.btn-label) {
  color: #0f172a;
}
.where-btn :where(.btn-icon) {
  color: #64748b;
}

/* 外部主题：.outer-theme .btn-label 权重为 (0,0,2,0)，轻松覆盖！ */
.outer-theme .where-btn {
  background: #eff6ff;
  border-color: #93c5fd;
}
.outer-theme .btn-label {
  color: #2563eb;
  font-weight: 600;
}
.outer-theme .btn-icon {
  color: #3b82f6;
}
```

:::

| 选择器 | 特异性 | 结果 |
|--------|--------|------|
| `.btn .icon`（组件，无 `:where()`）| 0,0,1,1 | **高** → 外部 `.outer-theme .icon`（0,0,2,0）能覆盖吗？**能，但需写两层** |
| `.where-btn :where(.icon)`（组件，有 `:where()`）| 0,0,1,**0** | **低** → 外部 `.outer-theme .icon`（0,0,2,0）轻松覆盖 |
| `.outer-theme .icon`（外部覆盖）| 0,0,2,0 | 始终高于 `:where()` 底座 |

> **组件最佳实践**：内部元素样式用 `:where()` 包裹 → 外部使用者仅需一个类即可定制，无需 `!important`。

---

## 案例三：外部用 :is() 批量覆盖组件

外部使用者可以借助 `:is()` 一次覆盖多个组件类型，结合 `:where()` 底座，覆盖极其轻量。

:::demo[案例三：:is() 批量覆盖多组件]

```html
<div class="demo-box">
  <div class="group-title">亮色（默认底座）</div>
  <div class="component-row">
    <button class="where-btn">
      <span class="btn-icon">★</span>
      <span class="btn-label">按钮</span>
    </button>
    <span class="where-badge">
      <span class="btn-icon">◆</span>
      <span class="btn-label">徽章</span>
    </span>
    <span class="where-tag">
      <span class="btn-icon">#</span>
      <span class="btn-label">标签</span>
    </span>
  </div>

  <div class="group-title" style="margin-top: 16px;">暗色（:is() 批量覆盖三个组件）</div>
  <div class="dark-is component-row">
    <button class="where-btn">
      <span class="btn-icon">★</span>
      <span class="btn-label">按钮</span>
    </button>
    <span class="where-badge">
      <span class="btn-icon">◆</span>
      <span class="btn-label">徽章</span>
    </span>
    <span class="where-tag">
      <span class="btn-icon">#</span>
      <span class="btn-label">标签</span>
    </span>
  </div>
</div>
```

```css
.demo-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
}

.component-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.where-btn,
.where-badge,
.where-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  border: 1px solid transparent;
}

.where-btn {
  background: #ffffff;
  border-color: #cbd5e1;
  cursor: pointer;
}

.where-badge {
  background: #e2e8f0;
}

.where-tag {
  background: #f1f5f9;
}

/* 组件底座：使用 :where() 定义低特异性样式 */
.where-btn :where(.btn-label),
.where-badge :where(.btn-label),
.where-tag :where(.btn-label) {
  color: #0f172a;
}

.where-btn :where(.btn-icon),
.where-badge :where(.btn-icon),
.where-tag :where(.btn-icon) {
  color: #64748b;
}

/* 暗色主题：使用 :is() 一次性批量覆盖按钮、徽章、标签 */
.dark-is :is(.where-btn, .where-badge, .where-tag) {
  background: #1e1b4b;
  border-color: #312e81;
}

.dark-is :is(.where-btn, .where-badge, .where-tag) .btn-label {
  color: #e0e7ff;
}

.dark-is :is(.where-btn, .where-badge, .where-tag) .btn-icon {
  color: #a5b4fc;
}
```

:::

不用 `:is()` 需要重复写三条：`.dark-is .where-btn { ... } .dark-is .where-badge { ... } .dark-is .where-tag { ... }`。

---

## 总结

| | `:where()` | `:is()` |
|--|-----------|---------|
| **特异性** | 始终为 0 | 取参数中最高 |
| **谁用** | **组件作者** — 定义底座样式 | **外部使用者** — 批量覆盖 |
| **效果** | 外部一个类就能覆盖，无需 `!important` | 减少重复，一条规则覆盖多目标 |

核心思想：**组件用 `:where()` 写底座，外部用 `:is()` 或普通类覆盖** — 两者配合，样式定制变得极其轻量。
