# 技术选型文档

> 项目：个人博客（纯前端）
> 日期：2026-09-13
> 状态：已确认

## 1. 背景与目标

- **产品形态**：个人博客，以文章内容为主，后续会扩展文章之外的功能模块
- **部署方式**：通过 Vercel 等免费平台托管，纯前端、无后端、无数据库
- **技术偏好**：React 生态；UI 从零自定义设计，不依赖现成主题
- **内容管线**：解析 Markdown 原始文本，用 React 组件渲染，节点级可定制，并作为未来扩展的基础

## 2. 需求清单

| 类别 | 需求 |
|---|---|
| 内容 | Markdown 写作、文章列表、归档页、标签/分类 |
| 订阅 | RSS 全文输出 |
| 搜索 | 站内搜索（无后端、零成本） |
| 外观 | 完全自定义 UI |
| 扩展 | 自定义 Markdown 块语法 → React 组件；未来可能加入交互式功能 |

## 3. 选型总览

| 层 | 选型 | 版本 | 说明 |
|---|---|---|---|
| 框架 | Next.js（App Router） | 16.3.x | Active LTS，Turbopack 默认构建器 |
| UI 库 | React | 19.2 | 与 Next 16 配套 |
| 渲染模式 | `output: 'export'` 静态导出 | — | 全站纯静态 HTML，契合纯前端定位 |
| Markdown 渲染 | react-markdown + remark-gfm + remark-directive | 最新 | 原始文本 → AST → React 组件映射 |
| 代码高亮 | rehype-pretty-code（基于 Shiki） | 最新 | 构建时高亮，零客户端 JS；备选见 §4.4 |
| frontmatter | gray-matter | 最新 | 解析文章元数据（标题/日期/标签等） |
| 样式 | Tailwind CSS | 4 | 无配置文件，自定义 UI 效率高 |
| 站内搜索 | Pagefind | 最新 | 构建后对静态 HTML 建索引，无后端 |
| RSS | 构建脚本生成 `rss.xml` | — | 与内容管线复用同一数据源 |
| 托管 | Vercel | — | Git push 自动构建部署，免费额度充足 |

## 4. 分项选型依据

### 4.1 框架：Next.js 16（而非 Astro / Hugo / VuePress）

**结论**：Next.js 16.3.x，App Router。

决策过程：

1. 初版选型（无框架偏好场景）推荐过 Astro——内容型网站默认零 JS，性能天花板高。
2. 用户确认两点后改判：① React 生态优先；② 未来不只是文章，要解析 Markdown 原文并用 React 组件渲染，产品会向应用形态演进。
3. 整个应用是 React 应用时，Next.js 是官方元框架，且为 Vercel 亲儿子，后续接入动态功能（Server Actions、PPR、Cache Components）无需换架构。

Next 16 关键事实（截至 2026-09）：

- 2025-10-21 发布，当前稳定版 16.3.4（2026-08-31），Active LTS；15.5 已转 Maintenance LTS
- Turbopack 成为默认构建器（构建提速 2-5x，Fast Refresh 提速 5-10x）
- 配套 React 19.2（View Transitions、`useEffectEvent`、`<Activity/>`）
- 2026-05 与 2026-08 有多次安全补丁发布，新项目直接使用 `next@16.3.3+`

被排除方案：

| 方案 | 排除原因 |
|---|---|
| Astro | 内容站最优但整体为非 React 应用；未来应用化扩展需迁移 |
| Hugo / Hexo | 模板语法老旧，从零定制现代 UI 体验差 |
| VuePress / VitePress | 偏文档站，主题定制受默认布局约束，且非 React |

### 4.2 渲染模式：静态导出（`output: 'export'`）

- 构建产物为纯静态 HTML/CSS/JS，无服务器运行时，符合"纯前端"定位
- 不锁定 Vercel——任何静态托管平台（Cloudflare Pages、GitHub Pages 等）均可部署
- 内容源为仓库内 `content/` 目录的 Markdown 文件，构建时用 `fs` 读取 + `gray-matter` 解析，`generateStaticParams` 生成全量文章页
- git 即内容源，无 CMS、无数据库、无月费

### 4.3 Markdown 渲染：react-markdown 管线

**结论**：`react-markdown` + `remark-gfm` + `remark-directive`（+ gray-matter 处理 frontmatter）。

候选对比：

| 候选 | 优势 | 劣势 | 结论 |
|---|---|---|---|
| **react-markdown**（unified 生态） | 节点级 `components` 映射；插件生态最全（GFM/数学公式/自定义语法） | 需自行组合插件 | ✅ 采用 |
| markdown-to-jsx（v9.8.1） | 零依赖、解析极快、支持 RSC | 插件生态小，扩展自定义语法能力弱 | 备选 |
| MDX | markdown 内直接写 JSX | 模型不同：要求内容作者写 JSX、解析严格、需编译步骤；与"解析原始文本渲染"的需求不符 | 排除 |

核心管线：

```tsx
// 渲染任意 Markdown 原文，节点级自定义
<ReactMarkdown
  remarkPlugins={[remarkGfm, remarkDirective]}
  components={{
    h2: ({ children }) => <SectionTitle>{children}</SectionTitle>,
    code: CustomCodeBlock,
    img: LazyImage,
    a: SmartLink,
    // 未来扩展入口：remark-directive 自定义块 → 任意 React 组件
  }}
>
  rawMarkdownText
</ReactMarkdown>
```

未来扩展的标准路径：

- `remark-gfm`：表格、任务列表、删除线、自动链接
- `remark-math` + KaTeX：数学公式（按需加入）
- `remark-directive`：自定义块/行内语法 → 任意 React 组件，是"不仅是文章"扩展的标准入口，无需引入 MDX

### 4.4 代码高亮：Shiki 体系

**结论**：`rehype-pretty-code`（构建时 Shiki 高亮，零客户端 JS）；当文章出现超大代码块（数百行）时，可切换到 `shiki-highlight-api`（CSS Custom Highlight API 实现）。

CSS Custom Highlight API 调研结论（2026-09）：

- [`shiki-highlight-api`](https://www.npmjs.com/package/shiki-highlight-api)（v1.2.0，活跃维护）是该 API 的成熟实现：传统方案每个 token 包一层 `<span>`（200 行代码 ≈ 2000+ DOM 节点），改用 Highlight API 的 Range 注册后 DOM 节点减少约 90%，视觉输出一致
- 浏览器支持已全绿：Chrome/Edge 105+、Safari 17.2+、Firefox 140+；自带 `codeToHtmlFallback()` 降级
- **Trade-off**：需在浏览器执行小脚本将 Range 注册到 `CSS.highlights`，JS 执行前代码块无高亮；经典 Shiki 为构建时内联样式，零 JS
- 两者同基于 Shiki（transformers 通用），切换成本低，故先采用经典方案

### 4.5 站内搜索：Pagefind

- 构建完成后对静态 HTML 建索引，运行时纯前端查询，无后端、无第三方服务、零成本
- 中英文分词支持良好，是静态博客搜索的事实标准
- 备选：构建时生成 JSON 索引 + fuse.js 客户端检索（全量索引随文章数线性膨胀，文章规模大后劣于 Pagefind 的分片索引）

### 4.6 托管：Vercel

- Git 集成，push 即自动构建部署，预览环境（每个 PR 一个 URL）
- Next.js 官方平台，`output: 'export'` 零配置支持
- 免费额度对个人博客完全够用；静态导出产物也可随时迁移到其他平台

## 5. 参考架构

内容模型按**多类型集合**设计（文章、生活、图片、音乐等），每类型一个目录；二进制资源与内容元数据分离。

```
content/                      # 所有内容（git 管理，文本元数据）
  posts/                      # 技术文章
  life/                       # 生活随笔
  photos/                     # 摄影：每个 .md = 一个相册/一张图的元数据
  music/                      # 音乐：歌曲/歌单元数据
public/
  media/                      # 二进制资源（只被 frontmatter/正文引用）
    photos/
    music/
src/
  lib/
    content.ts                # 通用加载器 getCollection(type) + 每类型 zod schema
    markdown.tsx              # react-markdown 管线 + components 映射表（所有类型共用）
  app/
    layout.tsx
    page.tsx                  # 首页（聚合最新内容）
    posts/[slug]/page.tsx     # 文章页（generateStaticParams）
    music/[slug]/page.tsx     # 播放器页
    skills/[slug]/page.tsx    # 技能包详情
    tags/[tag]/page.tsx       # 标签聚合（跨类型）
    rss.xml/route.ts          # 主 feed（posts）；未来可扩展各类型 feed
next.config.ts                # output: 'export'；图片需 images.unoptimized 或自定义 loader
```

设计要点：

1. **目录即集合**：共享基础 frontmatter 字段（`title/date/tags`），各类型扩展专属字段（photos：`location/cover`；music：`artist/album/audioUrl`），zod 分 schema 校验，类型安全
2. **资源分离**：图片/音频放 `public/media/`，markdown 只存引用；未来迁移 CDN/R2 只需改 URL 字段，内容仓库不被大文件撑爆
3. **渲染管线共用**：photos/music 页面本质是"frontmatter 数据 + 自定义 React 组件"，与"React 组件渲染"架构一致

数据流：

```
content/*.md → fs + gray-matter（frontmatter，按类型 zod 校验）
            → react-markdown 管线（remark-gfm/directive → components 映射 → React 组件）
            → SSG 静态 HTML
            → Pagefind 构建后索引
            → Vercel 部署
```

## 6. 参考资料

- [Next.js 16 发布公告（2025-10-21）](https://nextjs.org/blog/next-16)
- [Next.js 16 版本与生命周期](https://versionlog.com/nextjs/16/)
- [Next.js 2026-08 安全更新（升级至 16.3.3+）](https://nextjs.org/blog/august-2026-security-release)
- [shiki-highlight-api（CSS Custom Highlight API 实现）](https://www.npmjs.com/package/shiki-highlight-api)
- [Shiki 官方文档](https://shiki.style/guide/install)
- [Next.js 官方 MDX 指南（对比参考）](https://preview.nextjs.org/docs/pages/guides/mdx)
- [markdown-to-jsx（备选方案）](https://www.npmjs.com/package/markdown-to-jsx)
