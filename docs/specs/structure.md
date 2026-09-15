# 前端结构规范（structure）

> 状态：已确认（2026-09-15）
> 上位：`docs/specs/ui-ux.md`（定原则）与各功能分篇（定行为）。本文定**文件放在哪里**，不定行为与视觉。
> 与代码的关系：本文是判定标准；现有实现与本文不一致时以本文为准。新增文件先按 §3 判定归属，归属不明时修订本文而非随意放置。

## 1. 目标与原则

1. **路由薄、领域厚**：`src/app/` 只做参数解析 + 构建期取数 + 组装组件；状态、过滤、播放、交互一律下沉到 `src/components/<domain>/`。
2. **按领域分组，不按技术种类分组**：先看"属于哪个功能"（播放器/阅读/列表/全局壳），再看"是什么技术"（组件/hook/工具）。不设顶层 `hooks/`、`utils/` 大杂烩（唯一的 `lib/utils.ts` 只放 `cn`）。
3. **共享必须挣得**：新代码先放在所属领域目录；第二次复用时才提升到 `primitives/` 或 `lib/`。不预建通用层。
4. **静态导出兼容**：`lib/content.ts` 之外不出现 `node:fs`；客户端不请求内容；不引入与 `output: 'export'` 冲突的能力（Server Actions、ISR、默认图片优化等）。
5. **小步演进**：当前体量（~30 组件）用"分层 + 领域子目录"即可；任一领域超过 ~5 组件 + 自有 lib + 自有类型时，才整体提升为 `src/features/<domain>/`（届时纯 `git mv`，不重写逻辑）。

## 2. 目标目录树

```text
src/
  app/                            # 薄路由：layout/page/[slug]/rss/robots/sitemap
    layout.tsx                    # 唯一持有全局壳：PlayerProvider + chrome 组件
    page.tsx                      # 首页混合时间线（取数 + 组装，无状态）
    posts/[slug]/page.tsx         # readEntry + EntryView（<50 行）
    music/[slug]/page.tsx         # 专辑头 + AlbumTrackList
    skills/[slug]/page.tsx        # SkillPackageView
    tags/[tag]/page.tsx
    category/[name]/page.tsx
  components/
    chrome/                       # 全局壳（layout.tsx 直接引用）：header-nav,
                                  # search-dialog, theme-select/toggle, player-bar,
                                  # back-to-top, hotkey-help-modal,
                                  # route-scroll-reset, recent-tracker
    player/                       # 播放域：player-provider, album-card, album-track-list
    reading/                      # 阅读域：toc, mobile-toc-drawer, heading-anchor,
                                  # reading-progress, code-block, adjacent-nav,
                                  # related-entries, back-button
    listing/                      # 列表与详情视图：entry-view, posts-explorer,
                                  # skills-explorer, skill-package-explorer,
                                  # skill-package-view
    primitives/                   # 真通用、无领域依赖：tip, a11y-scrollable, type-badge
    ui/                           # shadcn vendor：行为冻结，只允许语义 token 微调
    test-utils/                   # render-server, mock-audio（仅测试引用）
  lib/
    content.ts                    # zod schema + fs 聚合（构建期唯一数据源）
    markdown.tsx                  # react-markdown 管线 + components 映射（各集合共用）
    remark-callouts.ts            # directive 自定义块
    rehype-css-vars.ts            # Shiki CSS 变量暂存
    rehype-heading-ids.ts         # 标题锚点 id
    toc.ts                        # extractToc / shouldShowToc / slugifyHeading
    format.ts                     # formatDate / formatTime / estimateReadingTime
    pagefind.ts                   # 运行时索引加载（客户端）
    utils.ts                      # cn() 唯一
  styles/theme.css                # 语义 token 唯一存放处
```

## 3. 归属判定（新文件三问）

```text
新文件？
├─ 是 URL / feed / sitemap / layout？            → src/app/<type>/...
├─ 是 shadcn Dialog/Slider/Menu 原语？           → src/components/ui/（vendor，不改行为）
├─ 只被 layout.tsx 全局挂载？                    → src/components/chrome/
├─ 只服务一个内容域（播放/专辑）？               → src/components/player/
├─ 服务正文阅读（目录/进度/代码/导航/推荐）？    → src/components/reading/
├─ 服务列表页/详情页组装（explorer/view/badge）？ → src/components/listing/
├─ 两个以上领域复用、且无领域概念？              → src/components/primitives/（需说明复用者）
├─ 纯函数（日期/时长/分词/索引）？               → src/lib/<toc|format|pagefind|utils>.ts
├─ markdown 新 :::directive 语法？               → remark 插件放 src/lib/ + 映射进
│                                                 lib/markdown.tsx + 展示组件放 reading/
└─ 新内容类型？                                  → 走 §7 SOP（content/ + schema + app/ + 登记）
```

| 输入 | 输出 | 示例 |
|---|---|---|
| 新内容类型 | `content/<type>/` + `content.ts` schema + `app/<type>/[slug]/page.tsx` + `TAGGED_TYPES`/`TypeBadge` 登记 | `photos/` |
| 列表过滤交互 | `components/listing/<type>-explorer.tsx`（client，构建期数据经 props 内嵌） | `PostsExplorer` |
| 详情视图 | `components/listing/entry-view.tsx`（server，复用 `readEntry/entryMetadata`） | `EntryView` |
| 全局状态 | `components/chrome\|player/*-provider.tsx`，实例唯一挂在 `layout.tsx` | `PlayerProvider` |
| unified 插件 | `src/lib/remark-*.ts` / `rehype-*.ts`，在 `markdown.tsx` 一处装配 | `remark-callouts` |

## 4. 目录职责与依赖方向

1. **`app/`**：允许依赖 `lib/*` + `components/*`；禁止 `useState/useEffect`（过滤类页面把状态包进 `listing/*-explorer` 客户端组件，路由文件只传构建期数据）。
2. **`chrome/`**：可依赖 `player/`（读播放态，如 `search-dialog` 经 `useOptionalPlayer` 暂停提示音）、`primitives/`、`ui/`、`lib/pagefind|format`；禁止依赖 `reading/`、`listing/`。
3. **`player/`**：可依赖 `primitives/`、`lib/format`、`lib/content` 类型；禁止依赖 `chrome/`、`listing/`。
4. **`reading/`**：可依赖 `primitives/`、`lib/toc|format|markdown`；禁止依赖 `player/`、`listing/`、`chrome/`。
5. **`listing/`**：可依赖 `reading/`（Toc/RelatedEntries）、`player/` 类型（`PlayerTrack`）、`primitives/`、`lib/*`；是唯一的"组装层"，允许跨域组装。
6. **`primitives/`、`ui/`、`lib/*`**：禁止依赖任何领域目录（`chrome/player/reading/listing`），例外两处：① `lib/markdown.tsx` 允许映射 `reading/` 的展示组件（它是渲染管线指定的唯一装配点，content-model 要求各集合共用）；② `*.test.*` 允许为造数据使用 `node:fs`（如 `content.test.ts` 的临时目录）。`lib/content.ts` 之外禁止 `node:fs`。
7. **导入一律绝对路径**：`@/components/<domain>/<file>`、`@/lib/<file>`；领域内部互引也用绝对路径，不用 `./` 相对路径（移动文件时少改、归属显性）。

## 5. 命名与文件级规则

1. **一文件一组件**，文件名 = 导出名 kebab-case（`player-bar.tsx` → `PlayerBar`，`usePlayer` 与 `PlayerProvider` 同文件）。
2. **Props 类型同文件导出**：`export type AlbumCardProps`，调用方直接引用，不另建 `types.ts`。
3. **文件头注释三行内**：说明归属的 spec 小节 + Server/Client 原因（如"全局壳，layout 唯一挂载，故 client"）。存量注释保留，新文件必须写。
4. **`app/*.tsx` 预算 50 行**：超限即抽到 `components/`；`page.tsx` 出现 `useState` 即违规。
5. **测试就近存放**：`foo.tsx` + `foo.test.tsx` 同目录，至少覆盖正常渲染 + 空/坏输入各一例。

## 6. Server / Client 边界

1. 默认 Server Component；仅确有交互（播放、过滤、对话框、快捷键、滚动监听）才加 `'use client'`。
2. `content.ts`（`fs` + `gray-matter` + `zod`）只在 Server Components / Route / SSG 调用；客户端经 props 接收构建期数据，不直接 import 内容读取函数（`search-dialog` 读 Pagefind 索引是例外，因索引本就是运行时产物）。
3. 单例浏览器对象（`Audio`）只允许 `player-provider.tsx` 创建；其余组件一律经 `usePlayer` / `useOptionalPlayer` 操作。

## 7. 新增功能 SOP

### 7.1 新增内容类型（如 `photos`）

1. 建 `content/<type>/` 目录；2. 在 `content.ts` 加 schema（复用基础字段）；3. 加 `app/<type>/[slug]/page.tsx`（复用 `readEntry/entryMetadata`，展示复用 `listing/entry-view` 或按专辑模式自建）；4.（可选）独立 feed；5. 有详情路由则登记 `TAGGED_TYPES` + `TypeBadge`。渲染管线、主题零改动（详见 content-model §7）。

### 7.2 新增列表交互（如"按年份过滤专辑"）

状态包进 `components/listing/` 或 `components/player/` 的 explorer 组件内，`app/` 只负责构建期取数后经 props 传入；不新增路由、不做客户端内容请求。

### 7.3 新增 markdown 自定义块（如 `:::demo`）

`src/lib/remark-*.ts`（或复用 `remark-callouts`）解析 → `lib/markdown.tsx` 的 `components` 映射 → 展示组件放在 `components/reading/`；内容文件不写 JSX（内容与渲染纪律）。

## 8. 不做什么

1. 不设顶层 `hooks/`、`helpers/`、`types/`、`constants/` 大杂烩目录；不为单文件建目录。
2. `lib/` 当前 9 文件保持平铺；超过 ~12 文件或某关注点 ≥4 文件时再分子目录（如 `lib/markdown/`），届时同步修订本文 §2。
3. 不跨域直接引用（`player/` → `listing/` 等）；复用需求先提升到 `primitives/`/`lib/`，再依赖。

## 9. 验收口径

1. 「新文件按 §3 三问能找到唯一归属」；「`app/` 无 `useState`，超 50 行必有抽取理由」。
2. 「`primitives`/`ui`/`lib` 无对领域目录的引用」（`rg '@/components/(chrome|player|reading|listing)' src/components/primitives src/components/ui src/lib` 仅允许 §4.6 的两处例外：`lib/markdown.tsx` → `reading/` 装配、`*.test.*` 的测试设施）。
3. 「领域间无横向引用」（`player/` 内无 `@/components/listing`，`reading/` 内无 `@/components/player|listing|chrome`，以此类推；`listing` 作为组装层可引用 `reading`/`player` 类型，`chrome` 可经 `useOptionalPlayer` 读播放态）。
4. 「`node:fs` 只出现在 `lib/content.ts` 与 `*.test.*`」（`rg 'node:fs' src` 无其他命中）。
5. 「新增内容类型走 §7.1 五步即完整，渲染管线与主题零改动」。
