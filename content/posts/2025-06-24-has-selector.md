---
title: 'CSS :has() 选择器'
date: '2025-06-24'
tags:
  - CSS
  - 选择器
  - 布局
  - 交互
  - 表单
category: css
description: ':has() 是 CSS 的关系型伪类选择器，可基于子元素选择父元素、基于后续兄弟选择前序兄弟，打破 CSS 单向选择限制。'
---
import CodeDemo from '../../../components/CodeDemo.astro';
import './has-selector.css';

## 概述

`:has()` 是一个**关系型伪类（relational pseudo-class）**，它根据元素 **包含什么** 来选择该元素本身。它打破了 CSS 传统的单向选择限制：

- **子 → 父**：`parent:has(child)` — 根据后代元素选择祖先
- **后 → 前**：`prev:has(~ next)` — 根据后续兄弟选择前序兄弟

> W3C Selectors Level 4 规范描述："关系型伪类 `:has()` 是一个函数型伪类，接受一个选择器列表作为参数。如果其中任意一个选择器相对于该元素的 `:scope` 至少匹配一个元素，则代表该元素。"

### 解决了什么问题

| 限制 | 说明 | 过去需要 |
|------|------|---------|
| 只能向下选 | 父→子可以，子→父不行 | JavaScript `closest()` 或 class 切换 |
| 只能向后选 | `~` 和 `+` 选后续兄弟，没法向前 | JS 遍历 DOM 加类 |

### 优势

| 优势 | 说明 |
|------|------|
| **零 JS** | 纯 CSS 解决方案，无需事件监听 |
| **响应式** | 状态变化自动响应（hover、focus、invalid 等） |
| **干净标记** | HTML 无需额外类或 data 属性 |
| **可组合** | 可与 `:focus`、`:valid`、`:checked`、`~`、`+`、`>` 等任意组合 |

---

## 案例一：父选择器（基础）

最常见的场景：根据子元素的有无来设置父元素样式。以下卡片有的带标题（`figcaption`），有的不带，`:has()` 自动区分。


  <figure class="cd-card">
    <img src="https://picsum.photos/300/180?random=1" alt="thumbnail" />
  </figure>
  <figure class="cd-card">
    <img src="https://picsum.photos/300/180?random=2" alt="thumbnail" />
    <figcaption>Modern CSS: :has()</figcaption>
  </figure>
  <figure class="cd-card">
    <img src="https://picsum.photos/300/180?random=3" alt="thumbnail" />
    <figcaption>CSS Parent Selector</figcaption>
  </figure>
</div>`,
    },
    {
      name: 'style.css',
      code: `.cd-card {
  display: flex;
  flex-direction: row;
  border-radius: 10px;
  max-width: 280px;
  background: #f5f5f5;
  overflow: hidden;
}

.cd-card img {
  width: 120px;
  aspect-ratio: 1;
  object-fit: cover;
}

.cd-card:has(figcaption) {
  flex-direction: column;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.cd-card:has(figcaption) img {
  width: 100%;
  aspect-ratio: 16 / 9;
}`,
    },
  ]}
>
  <div class="card-container">
    <figure class="cd-card">
      <img src="https://picsum.photos/300/180?random=1" alt="thumbnail" />
    </figure>
    <figure class="cd-card">
      <img src="https://picsum.photos/300/180?random=2" alt="thumbnail" />
      <figcaption>Modern CSS: :has()</figcaption>
    </figure>
    <figure class="cd-card">
      <img src="https://picsum.photos/300/180?random=3" alt="thumbnail" />
      <figcaption>CSS Parent Selector</figcaption>
    </figure>
  </div>


没有 `:has()` 时，需要给带标题的卡片额外添加一个类名（如 `.card--has-title`），通过 JS 或后端控制。`:has()` 让 CSS 自己检测内容结构，自动应用样式——像 `if` 条件一样智能。

---

## 案例二：前序兄弟选择器

这是 `:has()` 最革命性的能力——**选择前面的兄弟元素**。在过去，纯 CSS 无法做到。


  <li>HTML</li>
  <li>CSS</li>
  <li>JavaScript</li>
  <li>React</li>
  <li>Vue</li>
</ul>`,
    },
    {
      name: 'style.css',
      code: `.sibling-list li {
  padding: 10px 16px;
  border-radius: 6px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  transition: all 0.25s ease;
}

.sibling-list li:has(~ li:hover) {
  opacity: 0.4;
  background: #f1f5f9;
}

.sibling-list li:hover {
  background: #dbeafe;
  border-color: #3b82f6;
  color: #1e40af;
  transform: translateX(4px);
}`,
    },
  ]}
>
  <ul class="sibling-list">
    <li>HTML</li>
    <li>CSS</li>
    <li>JavaScript</li>
    <li>React</li>
    <li>Vue</li>
  </ul>


**原理**：`li:has(~ li:hover)` 检查当前 `li` 的后面是否有 hover 状态的兄弟。如果有，说明当前 `li` 是"前面的项"，于是变淡。

`~` 是通用兄弟组合器，`:has(~ li:hover)` 等价于"我后面有 hover 的 li 吗"。

---

## 案例三：表单状态联动

`:has()` 可与表单伪类（`:focus`、`:valid`、`:invalid`、`:checked`）结合，实现纯 CSS 的表单交互——聚焦高亮、验证反馈、复选框联动按钮。


  <div class="form-field">
    <label>邮箱</label>
    <input type="email" placeholder="输入邮箱" required />
    <span class="field-error">请输入有效的邮箱地址</span>
  </div>
  <div class="form-field">
    <label>密码（至少 6 位）</label>
    <input type="text" pattern=".{6,}" placeholder="输入密码" required />
    <span class="field-error">密码不能少于 6 位</span>
  </div>
  <label class="agree-field">
    <input type="checkbox" />
    <span>我已阅读并同意用户协议</span>
  </label>
  <button class="demo-submit" type="submit" disabled>创建账号</button>
</form>`,
    },
    {
      name: 'style.css',
      code: `.form-field:has(input:focus) {
  border-color: #3b82f6;
  background: #f8faff;
}

.form-field:has(input:invalid:not(:placeholder-shown)) {
  border-color: #ef4444;
  background: #fef2f2;
}

.form-field:has(input:invalid:not(:placeholder-shown))
  .field-error { display: block; }

.form-field:has(input:valid:not(:placeholder-shown)) {
  border-color: #22c55e;
  background: #f0fdf4;
}

.demo-form:has(input[type="checkbox"]:checked)
  .demo-submit {
  background: #3b82f6;
  opacity: 1;
  cursor: pointer;
}`,
    },
  ]}
>
  <form class="demo-form" onsubmit="return false">
    <div class="form-field">
      <label>邮箱</label>
      <input type="email" placeholder="输入邮箱" required />
      <span class="field-error">请输入有效的邮箱地址</span>
    </div>
    <div class="form-field">
      <label>密码（至少 6 位）</label>
      <input type="text" pattern=".{6,}" placeholder="输入密码" required />
      <span class="field-error">密码不能少于 6 位</span>
    </div>
    <label class="agree-field">
      <input type="checkbox" />
      <span>我已阅读并同意用户协议</span>
    </label>
    <button class="demo-submit" type="submit" disabled>创建账号</button>
  </form>


**试试**：在预览中点击输入框聚焦 → 输入无效值 → 勾选协议，观察 UI 的自动响应。整个交互逻辑完全由 CSS 驱动。

---

## 高级用法

### 选择前第 n 个兄弟

与相邻兄弟组合器 `+` 结合，可以选中指定位置的前序兄弟元素。hover 蓝色圆圈试试：


  <div class="sq-box">1</div>
  <div class="sq-box">2</div>
  <div class="sq-box">3</div>
  <div class="sq-circle">•</div>
  <div class="sq-box">5</div>
  <div class="sq-box">6</div>
</div>`,
    },
    {
      name: 'style.css',
      code: `/* hover 圆圈时，它前面的方块变蓝色 */
.sq-box:has(+ .sq-circle:hover) {
  background: #2563eb;
  color: #fff;
  transform: scale(1.15);
}

/* 选择前第二个兄弟（紫色） */
.sq-box:has(+ * + .sq-circle:hover) {
  background: #7c3aed;
  color: #fff;
  transform: scale(1.1);
}`,
    },
  ]}
>
  <div class="sibling-demo">
    <div class="sq-box">1</div>
    <div class="sq-box">2</div>
    <div class="sq-box">3</div>
    <div class="sq-circle">•</div>
    <div class="sq-box">5</div>
    <div class="sq-box">6</div>
  </div>


` .box:has(+ .circle) {} ` — 选择 `.circle` **前一个**兄弟（蓝色高亮）

` .box:has(+ * + .circle) {} ` — 选择 `.circle` **前第二个**兄弟（紫色高亮）

`*` 是通配符，代表任意一个元素。可以用具体类名替代：` .box:has(+ .box + .circle) {} `

---

### 数量查询

根据子元素数量动态设置父元素样式——纯 CSS 的响应式内容感知：


  <ul class="qty-list">
    <span class="qty-label">2 项</span>
    <li>Alpha</li>
    <li>Beta</li>
  </ul>
  <ul class="qty-list">
    <span class="qty-label">5 项</span>
    <li>Alpha</li>
    <li>Beta</li>
    <li>Gamma</li>
    <li>Delta</li>
    <li>Epsilon</li>
  </ul>
  <ul class="qty-list">
    <span class="qty-label">8 项</span>
    <li>Alpha</li>
    <li>Beta</li>
    <li>Gamma</li>
    <li>Delta</li>
    <li>Epsilon</li>
    <li>Zeta</li>
    <li>Eta</li>
    <li>Theta</li>
  </ul>
</div>`,
    },
    {
      name: 'style.css',
      code: `/* 默认样式 */
.qty-list {
  border: 3px solid #e2e8f0;
  border-radius: 8px;
}

/* 至少 5 项 → 蓝色边框 */
.qty-list:has(> :nth-child(5)) {
  border-color: #3b82f6;
  background: #f8faff;
}

/* 至少 8 项 → 紫色边框 */
.qty-list:has(> :nth-child(8)) {
  border-color: #8b5cf6;
  background: #f5f3ff;
}`,
    },
  ]}
>
  <div class="qty-demo">
    <ul class="qty-list">
      <span class="qty-label">2 项</span>
      <li>Alpha</li>
      <li>Beta</li>
    </ul>
    <ul class="qty-list">
      <span class="qty-label">5 项</span>
      <li>Alpha</li>
      <li>Beta</li>
      <li>Gamma</li>
      <li>Delta</li>
      <li>Epsilon</li>
    </ul>
    <ul class="qty-list">
      <span class="qty-label">8 项</span>
      <li>Alpha</li>
      <li>Beta</li>
      <li>Gamma</li>
      <li>Delta</li>
      <li>Epsilon</li>
      <li>Zeta</li>
      <li>Eta</li>
      <li>Theta</li>
    </ul>
  </div>


关键选择器解析：

- `ul:has(> :nth-child(5)) {}` — 至少包含 5 项
- `ul:has(> :nth-child(3):last-child) {}` — 正好 3 项
- `ul:has(> :nth-child(7)):has(> :nth-child(-n+9):last-child) {}` — 7~9 项

---

### 模拟 `:only-of-selector`

与 `:not()` 组合，可以模拟 `:only-of-selector` 效果——仅当某选择器在兄弟中**唯一匹配**时才生效：


  <div class="only-group">
    <div class="only-item">A</div>
    <div class="only-item special">B</div>
    <div class="only-item">C</div>
    <div class="only-item">D</div>
    <span class="only-label">唯一 .special → 高亮</span>
  </div>
  <div class="only-group">
    <div class="only-item special">E</div>
    <div class="only-item">F</div>
    <div class="only-item special">G</div>
    <div class="only-item">H</div>
    <span class="only-label">两个 .special → 都不高亮</span>
  </div>
</div>`,
    },
    {
      name: 'style.css',
      code: `/* 仅当 .special 是兄弟中唯一匹配时生效 */
.special:not(:has(~ .special))
  :not(.special ~ *) {
  background: #3b82f6;
  color: #fff;
  transform: scale(1.1);
}`,
    },
  ]}
>
  <div class="only-demo">
    <div class="only-group">
      <div class="only-item">A</div>
      <div class="only-item special">B</div>
      <div class="only-item">C</div>
      <div class="only-item">D</div>
      <span class="only-label">唯一 .special → 高亮</span>
    </div>
    <div class="only-group">
      <div class="only-item special">E</div>
      <div class="only-item">F</div>
      <div class="only-item special">G</div>
      <div class="only-item">H</div>
      <span class="only-label">两个 .special → 都不高亮</span>
    </div>
  </div>


选择器解析：

- `.special:not(:has(~ .special))` — 后面没有其他 `.special` 兄弟（即最后一个）
- `.special:not(.special ~ *)` — 前面没有其他 `.special` 兄弟（即第一个）
- 两个条件同时满足 → 既是第一个又是最后一个 → **唯一**

---

### 与 `:is()` / `:where()` 结合

`:has()` 是**严格选择器**——参数中的无效选择器会使整条规则失效。` :is() ` 和 ` :where() ` 是宽松的，包裹后可让无效选择器被忽略。此外，`:is()` **继承参数中最高权重**，而 `:where()` **权重始终为 0**：


  <div class="spec-card">
    <span class="spec-label">:is()</span>
    <p class="spec-text" id="spec-is">使用 :is(.any-class, #spec-is)<br/>继承 ID 权重 → 蓝色</p>
  </div>
  <div class="spec-card">
    <span class="spec-label">:where()</span>
    <p class="spec-text" id="spec-where">使用 :where(.any-class, #spec-where)<br/>权重降为 0 → 紫色</p>
  </div>
</div>`,
    },
    {
      name: 'style.css',
      code: `/* :is() 继承参数中最高权重（#spec-is 的 ID 权重） */
.spec-card:has(:is(.any-class, #spec-is)) {
  border-color: #3b82f6;
}
.spec-card:has(:is(.any-class, #spec-is))
  .spec-text {
  color: #3b82f6;
  font-weight: 700;
}

/* :where() 权重始终为 0 */
.spec-card:has(:where(.any-class, #spec-where)) {
  border-color: #8b5cf6;
}
.spec-card:has(:where(.any-class, #spec-where))
  .spec-text {
  color: #8b5cf6;
  font-weight: 700;
}`,
    },
  ]}
>
  <div class="spec-demo">
    <div class="spec-card">
      <span class="spec-label">:is()</span>
      <p class="spec-text" id="spec-is">使用 :is(.any-class, #spec-is)<br/>继承 ID 权重 → 蓝色</p>
    </div>
    <div class="spec-card">
      <span class="spec-label">:where()</span>
      <p class="spec-text" id="spec-where">使用 :where(.any-class, #spec-where)<br/>权重降为 0 → 紫色</p>
    </div>
  </div>


关键区别：

- `:has(:is(.class, #id))` — `#id` 使整个选择器获得 ID 权重 `(1,0,0)`
- `:has(:where(.class, #id))` — `:where()` 将参数权重归零，选择器权重为 `(0,0,0)`

这也意味着：如果参数中包含**无效选择器**，`:has()` 自身会整条失效，而 `:has(:where(...))` 会忽略无效项继续工作。

---

## 总结：什么时候可以使用 :has()

### 浏览器支持

| Chrome | Safari | Firefox | Edge | 全球份额 |
|--------|--------|---------|------|---------|
| 105+ (2022.8) | 15.4+ (2022.3) | 121+ (2023.12) | 105+ (2022.8) | **~95%**+ |

> 数据来源：[Can I Use :has()](https://caniuse.com/css-has) — 截至 2025 年中，全球支持率已超过 95%，在桌面端接近 98%。

### 使用建议

| 场景 | 推荐度 | 说明 |
|------|--------|------|
| **渐进增强** | ✅ 强烈推荐 | 用 `:has()` 增强体验，降级到基础样式仍可用 |
| **内部工具 / 后台** | ✅ 放心用 | 用户浏览器版本可控 |
| **C端产品（现代浏览器）** | ✅ 放心用 | 放弃 IE，`:has()` 覆盖绝大多数用户 |
| **需要兼容旧浏览器** | ⚠️ 谨慎 | 配合 JS fallback，或仅用于非关键样式 |

### 推荐策略

**渐进增强**是最佳实践——先写基础样式，再用 `:has()` 叠加增强效果：

> **基础样式（所有浏览器）：** `.card { ... }`
>
> **增强样式（支持 `:has()` 的浏览器）：** `@supports selector(:has(*)) { .card:has(figcaption) { ... } }`

`@supports selector(:has(*))` 可以检测浏览器是否支持 `:has()`，在不支持的浏览器中优雅降级。

### 各场景方案一览

| 场景 | :has() 用法 | 替代方案 |
|------|------------|---------|
| 父级内容驱动样式 | `parent:has(child)` | JS `closest()` + class |
| 前序兄弟选择 | `li:has(~ li:hover)` | 纯 CSS 无法实现（需 JS） |
| 表单验证反馈 | `field:has(input:invalid)` | JS 事件监听 |
| 复选框联动按钮 | `form:has(:checked) button` | JS 事件监听 |
| 数量查询 | `:has(:nth-child(n):last-child)` | JS 计算长度 |

### 一句话总结

> **2025 年的今天，`:has()` 已经可以安全地用于生产环境。** 对于面向现代浏览器的项目，直接使用；对于需要兼容旧浏览器的项目，配合 `@supports` 做渐进增强即可。它是近二十年来 CSS 最具变革性的选择器，值得在每个项目中用起来。

## 参考资源

- [W3C Selectors Level 4 — :has()](https://drafts.csswg.org/selectors-4/#relational)
- [MDN: :has()](https://developer.mozilla.org/en-US/docs/Web/CSS/:has)
- [Can I Use :has()](https://caniuse.com/css-has)
- [CSS @supports selector()](https://developer.mozilla.org/en-US/docs/Web/CSS/@supports)
