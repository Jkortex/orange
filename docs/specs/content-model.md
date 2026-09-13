# 内容模型规格（content-model）

> 状态：已确认（2026-09-14）
> 上位：`AGENTS.md` 内容与渲染纪律 / 内容分类规范 / 新增内容类型 SOP。本文定字段、聚合与边界。
> 唯一事实源：`src/lib/content.ts` 的 zod schema；内容只在构建时读取（纯前端红线）。

## 1. 集合与目录

1. `content/<type>/` 一目录一集合：`posts`（文章）、`music`（专辑）、`skills`（技能包，目录形态，见 §11）；`life`、`photos` 为预留（schema 就绪，目录与路由缺失，启用走 §7）。
2. 一文件一条目：`YYYY-MM-DD-<英文或拼音 slug>.md`；URL slug 取自文件名（去扩展名），天然有序且稳定。技能包为例外：一条目为一目录（`content/skills/YYYY-MM-DD-<slug>/`），slug 取目录名。
3. slug 只允许字母/数字/连字符/下划线；非法 slug（路径穿越等）拒绝并转 404。

## 2. frontmatter 字段

1. 基础字段（全集合共享）：`title`（必填非空）、`date`（必填，可被 coerce 为日期）、`tags`（字符串数组，缺省 `[]`）、`description`（可选）、`category`（可选，§3）。
2. `posts` = 基础字段，无扩展。
3. `music` = 专辑：一篇 md 即一张专辑。扩展 `artist`（必填）、`tracks`（必填，非空数组，每项 `title` + `file` 必填）、`year`（可选，1900–2100）、`cover`（可选）。
4. `photos`（预留）：扩展 `location`、`cover`（均可选）。
5. `skills` 见 §11（`skillSchema`：`name` 必填 kebab-case 技能身份 + `version`/`author` 可选，其余复用基础字段）。
6. 校验纪律：缺失/类型不符**构建即报错**（错误信息含文件路径与字段名）；页面层不做无 schema 的字段访问。

## 3. category 与 tags

1. `category` 是单归属栏目（导航维度）：英文 slug（`[\w-]+`，非法值构建即报错）；可选，无分类照常发布。
2. `tags` 是自由多标签（检索维度）：任意字符串，可多个。
3. 两者职责分离、不互相替代；分类清单由内容声明、构建时聚合（§5），新增分类零代码改动。

## 4. 二进制分离

1. 音频/图片一律放 `public/media/<type>/`（封面 `covers/` 子目录）；md 只存引用，不存二进制。
2. `file`/`cover` 为 `z.string()`：本地路径与完整 `https://` 外链（对象存储，如 R2）天然兼容，迁移只改 md 里的 URL，组件零改动。
3. 体积分层：本地少量演示音频可进 `public/`；正式专辑放对象存储（Vercel Hobby 静态上限约 100MB，音频不可持续）。

## 5. 读取与聚合 API（构建期，`src/lib/content.ts`）

1. `getCollection(type)`：读一集合，按日期倒序；目录缺失（未启用类型）抛错——调用方按需捕获。
2. `getEntry(type, slug)`：读单条；不存在/非法 slug 抛错（页面层转 404）。
3. `getAllEntries()`：全类型聚合倒序；**跳过目录未建的未启用类型**，但已启用集合的校验错误必须抛出（坏内容不得静默消失）。
4. `getRecentEntries(limit)`：截取最近 N 条（首页混合时间线，新类型自动入流）。
5. `getCategories()` / `getEntriesByCategory(name)`：全类型分类聚合（去重计数，名称排序）与取条目；分类页由聚合结果驱动 `generateStaticParams`，未使用分类不生成页面。
6. `getAllTags(types)` / `getEntriesByTag(tag, types)`：标签聚合与取条目（§6）。
7. `listSkillSlugs()` / `getSkillPackage(slug)` / `getSkillEntries()`：技能包目录枚举、读包、转聚合条目（§11）。
8. 以上全为同步函数，只在构建时（Server Components/Route/SSG）调用，客户端不发内容请求。

## 6. 标签聚合范围

1. 标签页聚合**所有有详情路由的类型**（现为 `posts` + `music`）；条目链接指向各自分集路由。
2. 无路由的预留类型（`life`/`photos`）不参与——否则产出死链；其类型启用路由后在此登记（与 §7.5 同一步）。
3. 现状缺口（2026-09-14 已补）：此前只聚合 `posts`，专辑的 tags（如示例 `demo`）无着陆页——现聚合 `posts` + `music`，构建已验证 `/tags/demo` 生成。

## 7. 新增内容类型 SOP

1. 建 `content/<type>/` 目录。
2. 在 `content.ts` 加 zod schema（复用基础字段 + 专属字段）。
3. 加 `src/app/<type>/[slug]/page.tsx` 路由（复用 `readEntry` / `entryMetadata` / `EntryView` 或按专辑模式自建）。
4. （可选）加独立 feed。
5. 若该类型有详情路由：将其加入标签聚合类型清单（§6.2）与类型徽标文案（`TypeBadge`）；`getAllEntries` 与首页时间线自动收录，无需改动。
6. 渲染管线（`markdown.tsx`）、主题、其他组件层零改动。

## 8. RSS

1. 主 feed（`rss.xml`）输出 `posts` 全文；多类型 feed 按 §7.4 可选扩展。

## 9. 不做什么

1. 不做 CMS、数据库、运行时内容接口；git 即内容源。
2. 内容文件不写 JSX/HTML（自定义块走 remark-directive，见渲染纪律）。
3. 不做单文件多条目、不做文件名之外的排序字段（日期以 frontmatter 为准）。

## 10. 验收口径

自然语言断言：「缺 title/date 构建报错且指名文件」「中文 category 构建报错」「坏内容不静默消失」「新增分类零代码改动出分类页」「专辑 tags 有标签着陆页」「无路由类型不进标签页」「新增类型按 SOP 五步（+tags 登记）即完整」。

## 11. 技能包（目录形态）

三家 skill 规范（Claude / Codex / agentskills.io）已收敛：`SKILL.md`（`name` + `description` frontmatter + `#`/`##` 正文）+ `templates/` + `references/` + `scripts/`。本站直接以包目录为内容形态，页面以目录形式展示，**无需预处理拆分**。

1. 包布局：`content/skills/YYYY-MM-DD-<slug>/SKILL.md`（入口，必填）+ 任意附属文件/子目录；目录名沿用 slug 规则（有序稳定），`name` 字段承载标准 kebab-case 技能身份。
2. 章节分隔符 = `##` 二级标题（SKILL.md 正文惯例，可移植、零自定义语法）；页面目录由标题自动生成。
3. 详情页（`SkillPackageView`，纯服务端零 JS）：返回链 + 标题/`name`/`version`/`author` 元信息 + 包目录**右侧栏**（桌面端 sticky 跟随，窄屏叠放正文上方；与文章长文目录同侧）+ 入口正文 + 附属 md 分节渲染 + 代码/文本原样 `<pre>` + 二进制仅列出。目录放右侧是技能页签名；页面用宽容器（与文章双栏同档）。技能列表页（`/skills`）为条目列表，供导航进入。
4. 聚合：`getSkillEntries()` 转出的条目随首页/分类/tags 自动入流（`getAllEntries` 显式拼接；单文件 `getCollection('skills')` 不适用包形态）。
5. 附属文件标题建议与入口不重名（锚点 id 全局生成，重名取首个）。
