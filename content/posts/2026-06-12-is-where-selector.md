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
import CodeDemo from '../../../components/CodeDemo.astro';
import './is-where-selector.css';

## 概述

`:is()` 和 `:where()` 最大的实用价值在于配合两者的**特异性差异**，构建"底座样式可被轻松覆盖"的组件体系。

| 伪类 | 特异性 | 适合谁用 |
|------|--------|---------|
| **`:where()`** | **始终为 0** | 组件作者 — 底座样式不怕被外部覆盖 |
| **`:is()`** | **取参数中最高** | 外部使用者 — 批量覆盖组件样式 |

---

## 案例一：:is() 简化多选择器

`:is()` 避免重复书写相同选择器，让 hover、focus 等状态管理更简洁。


  <div class="isw-card" tabindex="0">
    <h3>卡片标题</h3>
    <p>hover 或 focus 此卡片，标题和描述颜色同步变化</p>
  </div>
  <div class="isw-card" tabindex="0">
    <h3>另一张卡片</h3>
    <p>:is() 让代码更简洁</p>
  </div>


不用 `:is()` 需要重复写：`.card:hover, .card:focus-within`。

---

## 案例二：组件用 :where()，外部轻松覆盖

> 组件作者用 `:where()` 定义默认样式（特异性 0）→ 外部用普通类就能覆盖。

下方两个按钮，左侧用常规选择器定义内部样式，右侧用 `:where()`。外部尝试用 `.outer-theme` 覆盖，结果截然不同：


  <div style="display:flex;gap:24px;flex-wrap:wrap;justify-content:center;padding:8px 0;">
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px;min-width:180px;">
      <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;padding:4px 12px;border-radius:4px;background:#fef3c7;color:#92400e;">不用 :where()</div>
      <button class="nowhere-btn nowhere-outer">
        <span class="btn-icon">★</span>
        <span class="btn-label">按钮</span>
      </button>
      <div style="font-size:0.7rem;color:#9ca3af;text-align:center;">外部覆盖失败 — 组件样式优先级更高</div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px;min-width:180px;">
      <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;padding:4px 12px;border-radius:4px;background:#dbeafe;color:#1e40af;">用 :where()</div>
      <div class="outer-theme">
        <button class="where-btn">
          <span class="btn-icon">★</span>
          <span class="btn-label">按钮</span>
        </button>
      </div>
      <div style="font-size:0.7rem;color:#9ca3af;text-align:center;">外部覆盖成功 — :where() 特异性为 0</div>
    </div>
  </div>


| 选择器 | 特异性 | 结果 |
|--------|--------|------|
| `.btn .icon`（组件，无 `:where()`）| 0,0,1,1 | **高** → 外部 `.outer-theme .icon`（0,0,2,0）能覆盖吗？**能，但需写两层** |
| `.where-btn :where(.icon)`（组件，有 `:where()`）| 0,0,1,**0** | **低** → 外部 `.outer-theme .icon`（0,0,2,0）轻松覆盖 |
| `.outer-theme .icon`（外部覆盖）| 0,0,2,0 | 始终高于 `:where()` 底座 |

> **组件最佳实践**：内部元素样式用 `:where()` 包裹 → 外部使用者仅需一个类即可定制，无需 `!important`。

---

## 案例三：外部用 :is() 批量覆盖组件

外部使用者可以借助 `:is()` 一次覆盖多个组件类型，结合 `:where()` 底座，覆盖极其轻量。


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

<div class="dark-is isw-theme-demo">
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
</div>`,
    },
    {
      name: 'style.css',
      code: `/* 默认亮色 (组件用 :where() 定义底座) */
.where-btn :where(.btn-label)  { color: #0f172a; }
.where-btn :where(.btn-icon)  { color: #64748b; }

/* 暗色主题：:is() 一次性覆盖三个组件 */
.dark-is :is(.where-btn, .where-badge, .where-tag) {
  background: #1e1b4b;
}

.dark-is :is(.where-btn, .where-badge, .where-tag) .btn-label {
  color: #e0e7ff;
}

.dark-is :is(.where-btn, .where-badge, .where-tag) .btn-icon {
  color: #a5b4fc;
}`,
    },
  ]}
>
  <div style="display:flex;flex-direction:column;gap:12px;">
    <div style="font-size:0.75rem;font-weight:600;color:#6b7280;">亮色（默认）</div>
    <div class="isw-theme-demo">
      <button class="where-btn"><span class="btn-icon">★</span><span class="btn-label">按钮</span></button>
      <span class="where-badge"><span class="btn-icon">◆</span><span class="btn-label">徽章</span></span>
      <span class="where-tag"><span class="btn-icon">#</span><span class="btn-label">标签</span></span>
    </div>
    <div style="font-size:0.75rem;font-weight:600;color:#6b7280;margin-top:8px;">暗色（`:is()` 批量覆盖）</div>
    <div class="dark-is isw-theme-demo">
      <button class="where-btn"><span class="btn-icon">★</span><span class="btn-label">按钮</span></button>
      <span class="where-badge"><span class="btn-icon">◆</span><span class="btn-label">徽章</span></span>
      <span class="where-tag"><span class="btn-icon">#</span><span class="btn-label">标签</span></span>
    </div>
  </div>


不用 `:is()` 需要重复写三条：`.dark-is .where-btn { ... } .dark-is .where-badge { ... } .dark-is .where-tag { ... }`

---

## 总结

| | `:where()` | `:is()` |
|--|-----------|---------|
| **特异性** | 始终为 0 | 取参数中最高 |
| **谁用** | **组件作者** — 定义底座样式 | **外部使用者** — 批量覆盖 |
| **效果** | 外部一个类就能覆盖，无需 `!important` | 减少重复，一条规则覆盖多目标 |

核心思想：**组件用 `:where()` 写底座，外部用 `:is()` 或普通类覆盖** — 两者配合，样式定制变得极其轻量。
