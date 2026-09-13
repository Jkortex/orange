# AGENTS.md

本项目全局上下文，所有 AI 会话与协作者必须遵循。

## 项目概要

纯前端个人博客，内容类型：文章（posts）/ 生活（life）/ 图片（photos）/ 音乐（music）/ 技能（skills，包目录形态）。
技术栈：Next.js 16（App Router，`output: 'export'` 静态导出）+ React 19 + Tailwind CSS 4 + react-markdown 管线 + Pagefind + Vercel。
完整选型与架构见 [docs/tech-selection.md](docs/tech-selection.md)。

## UI 主题规范（强制）

主题 = 一组语义化 CSS 变量。保证主题随时切换/新增零成本的前提是以下纪律，任何组件代码不得违反：

1. **组件只使用语义 token**：如 `bg-background`、`text-foreground`、`text-muted-foreground`、`bg-primary`、`border-border`。禁止出现任何硬编码颜色（`bg-white`、`text-zinc-500`、`#fff` 等字面量，调色板类与任意值均不允许）。
2. **新颜色先入 token**：确需新语义（如 `--success`、`--surface-raised`）时，先在 theme 文件的**每套**主题变量块中补齐定义，再在组件中使用；不允许只给单套主题加值。
3. **多主题结构**：每套主题一个变量块（`:root[data-theme='xxx']`，含对应 `.dark` 变体）。切换通过 `document.documentElement.dataset.theme` + localStorage 持久化，纯客户端实现，不得引入服务端逻辑（与静态导出兼容）。
4. **UI token 集中管理**：全部主题变量集中在单一 theme 文件（如 `src/styles/theme.css`），不散落在各组件。
5. **代码高亮联动**：Shiki 使用 dual theme（CSS 变量联动），随主题切换，不做运行时重渲染。
6. **新增主题 = 新增一个变量块**：组件代码零改动；调色工具自选，产物只需符合上述变量块结构。
7. **图标化与 hover 提示（强制）**：只有「操作型 UI」允许用图标替代文字，且须同时满足三条判据——①图标是业界通用隐喻（太阳/月亮、搜索、设置、RSS 等，自造/冷僻图标禁用）；②元素位于紧凑工具栏（header/footer/行内操作），常驻文字挤占空间；③控件无需常驻展示当前值（如主题选择器要显示当前主题名，不满足）。内容型文本永不隐藏：品牌名、页面标题、正文、菜单项标签一律保留文字。图标化按钮的硬性规则：始终携带与提示文案一致的 `aria-label` 作为无障碍兜底；hover 与 focus 都要显示文字提示（`group-hover`/`group-focus-within`）；提示为纯视觉补充，标注 `aria-hidden` 避免读屏重复朗读。触摸端硬性规则（iPadOS Safari 伪装桌面匹配 `hover: hover`，媒体查询无法排除）：①图标按钮触摸目标 ≥36px；②`any-pointer: coarse` 设备上 tooltip 由 globals.css 全局隐藏（避免 iOS 两段式 tap 吞掉首次点击），语义由 `aria-label` 兜底；③控件不得依赖 hover 才可见，hover-only 展示一律改常显或提供非 hover 触达路径。

## 界面布局规范（强制）

界面布局的原则（骨架、页面组织、交互）见 [docs/specs/ui-ux.md](docs/specs/ui-ux.md)，各功能的
行为与边界见 `docs/specs/` 下各分篇（`player.md` / `search.md` / `content-model.md`）；以下为不可违反的纪律：

1. **全局骨架恒定**：header（sticky top-0，z-40）/ main（flex-1，宽度由页面自持）/ footer 三层结构 + 全局播放条（fixed bottom-0，z-50 悬浮层）+ 全局搜索（顶栏按钮 + Ctrl/Cmd+K Modal）。骨架层级、高度、z 序全站唯一，页面只替换 main 内容区。
2. **内容宽度页面自持**：默认页面（首页/详情/音乐/分类/标签）`max-w-2xl` 居中，正文文本行 `max-w-prose`；文章页（/posts）为双栏 `max-w-5xl`（左分类列表 + 右条目列表）。禁止页面级另起规范外宽度（音乐网格在 2xl 内做响应式列）。
3. **播放条为全局 chrome**：由 layout 层 `PlayerProvider`（'use client'）持有队列与单例音频，页面切换播放不中断；组件不得自行创建 Audio 实例。播放条为 `fixed bottom-0` 悬浮层——不占文档流、footer 不让位，滚动到底时 footer 下缘被覆盖（Spotify 式悬浮 chrome）；无队列时零常驻留白、不渲染；右侧提供关闭按钮清除队列退出播放。
4. **图标化按钮复用主题规范第 7 条**：播放/暂停等操作按钮必须满足三判据，并携带 `aria-label` + hover/focus 文字提示。
5. **音乐资源按专辑组织**：一个 md 文件 = 一张专辑，tracks 列表引用 `public/media/music/` 下音频；封面在 `public/media/music/covers/`。
6. **首页为统一混合时间线**：首页按日期倒序聚合全部类型（类型徽标 + 统一紧凑条目骨架），新内容类型自动入流，不做分区区块。文章页（/posts）左侧为分类列表（无折叠，构建期由内容聚合，新增分类零代码改动），右侧为条目列表；默认「最近」= 全部文章按日期倒序，点击分类为客户端即时过滤（数据构建期内嵌进客户端组件，不发内容请求）。
7. **站内搜索为全局 chrome**：顶栏搜索图标按钮（满足图标化三判据，aria-label + hover/focus 提示）与 Ctrl/Cmd+K 快捷键共同唤起 Modal；结果来自构建期 Pagefind 索引（postbuild 生成 `out/pagefind/`），UI 用语义 token 自绘，不引入 Pagefind UI 默认样式；dev 无索引时显示降级提示；对话框经 Portal 挂 body，z 序与播放条同级。

## 内容与渲染纪律（强制）

1. **frontmatter 以 zod schema 为唯一事实源**：字段定义集中在 `src/lib/content.ts`，缺失/类型不符构建即报错；不允许在页面里做无 schema 的字段访问。
2. **内容文件不写 JSX/HTML**：自定义块一律用 remark-directive 语法（`:::xxx`）+ components 映射实现，保持内容可移植。
3. **内容只在构建时读取**：由 `fs` 读取 `content/` 并 SSG 预渲染，客户端不发内容请求（纯前端红线）。

## React / 架构纪律（强制）

1. **Server Components 默认**：仅确有交互的组件加 `'use client'`，客户端 JS 是需要管理的资产。
2. **依赖红线**：不引入与 `output: 'export'` 不兼容的能力（Server Actions、ISR、默认 Image Optimization 等）；不引入后端、数据库、付费服务。
3. **资源引用约定**：图片/音频等一律放 `public/media/<type>/`，markdown/frontmatter 只存引用；`next/image` 统一走 unoptimized 或项目自定义 loader，不逐页各写各的。
4. **通用原语优先 shadcn/ui**：Dialog / DropdownMenu / Slider 等复杂交互原语直接采用 `src/components/ui/`（registry 文件 vendor，`cn` 驻 `src/lib/utils.ts`），不手写 Portal / focus trap / 键盘导航；Toc / PlayerProvider / PostsExplorer 等领域组件自研。vendor 文件只允许语义 token 级微调（如遮罩改 `bg-background/80`），行为逻辑不改；新增 token 仍遵守主题规范第 2 条（每套主题块补齐）。注：shadcn CLI 在本环境无法启动（其 MCP 依赖与 pnpm store 内 zod 冲突），故手工 vendor，不跑 `init`/`add`。

## 测试规范（强制：红-绿-重构-反思）

先测试后实现：用测试定义组件的功能与边界，再写实现。每轮开发固定走以下循环：

1. **定边界**：动手实现前先写测试，至少覆盖两类：
   - **正常渲染**：合法 props/内容下的预期输出与交互
   - **异常渲染**：空数据、frontmatter 缺字段、非法/超长输入等边界
2. **红→绿循环**：跑测试 → 失败 → 修复并让**一个**测试通过 → 循环直至全部通过；不实现任何当前测试未要求的功能。
3. **重构节点**：全部通过后进入重构——识别重复逻辑、提炼复用；提炼时与项目整体结构一起考虑，以测试为安全网、以最小复杂度为限。
4. **反思节点**：每轮结束回答两个问题——哪些做得好、哪些可改善（流程或实现），结论用于优化下一轮流程与项目设计；沉淀条目追加到 `docs/retrospectives.md`（含日期，一行一条）。

工具链默认：Vitest + React Testing Library（组件）；内容层/纯函数用 node 环境测试。

## 新增内容类型 SOP

新增内容类型固定步骤，渲染管线（markdown.tsx）、主题、组件层零改动：

1. 建 `content/<type>/` 目录
2. 在 `src/lib/content.ts` 增加 zod schema（复用基础字段 title/date/tags + 类型专属字段）
3. 加 `src/app/<type>/[slug]/page.tsx` 路由
4. （可选）加独立 feed
5. 若有详情路由：在标签聚合清单（`tags/[tag]/page.tsx` 的 `TAGGED_TYPES`）登记，类型徽标文案（`TypeBadge`）按需补齐；完整规则见 [docs/specs/content-model.md](docs/specs/content-model.md) §7

## 音乐内容规范（强制）

- **一个 md 文件 = 一张专辑**：`content/music/YYYY-MM-DD-slug.md`，schema 见 `musicSchema`（artist/date/title 必填，year/cover/category/description 可选，tracks 至少 1 首）
- **资源位置固定**：音频一律 `public/media/music/`，封面 `public/media/music/covers/`；md 只存引用（`file: /media/music/xx.mp3`、`cover: /media/music/covers/xx.jpg`），二进制与内容分离
- **曲目即队列**：tracks 列表顺序 = 专辑曲目顺序，也是「播放全部」的队列顺序
- **新增专辑 = 建 md + 放音频**：网格页/详情页/分类页/首页时间线自动收录，代码零改动
- **音频体积分层**（Vercel Hobby 静态文件上传上限 100 MB，音频入 public/ 不可持续）：本地试听/少量演示音频可放 `public/media/music/`；正式专辑音频放对象存储（推荐 Cloudflare R2：10GB 免费 + 零出口流量费），`file`/`cover` 直接写完整 `https://` 外链——schema 为 `z.string()` 天然兼容，播放器/封面组件零改动；迁移 = 改 md 里的 URL

## 内容分类规范（强制：内容驱动，零代码改动）

- **分类由内容声明**：frontmatter `category`（英文 slug，`[\w-]+`，schema 正则校验、构建即报错），所有集合共享同一基础字段——文章如 `css`、`design-patterns`，音乐专辑如 `cheerful`、`quiet`；可选字段，无分类照常发布
- **分类清单构建时聚合**（`getCategories`/`getEntriesByCategory`，无硬编码）——**新增分类 = 在内容文件写上新 category 值，零代码改动**；分类页 `/category/<name>` 全类型聚合展示，未使用的分类自动不生成页面
- **category 与 tags 职责分离**：category 是单归属栏目（导航/聚合维度），tags 是自由多标签（检索维度），不互相替代

## 工程杂项

- **slug 规则**：内容目录名用 `YYYY-MM-DD-<english-or-pinyin-slug>`，URL 稳定且按时间天然有序
- **语言约定**：界面文案中文；代码注释与文档中文
- **Git 提交**：conventional commits（feat/fix/docs/chore...）
