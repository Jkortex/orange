# 反思记录

按 AGENTS.md 测试规范，每轮开发结束沉淀一条（日期 + 做得好的 / 可改善的）。

## 2026-09-14

- 交互四件套落地（详情返回链 / 长文文首目录 / 全局回到顶部 / 顶栏常驻），全程红-绿：toc 纯函数 10 用例、标题锚点 id 进管线、Toc 组件 3 用例、EntryView SSR 断言 4 用例、BackToTop 6 用例，共 134 测试全绿 + 13 页静态构建。目录 slug 与标题 id 同源（toc.ts 唯一事实源 + rehype 插件复用），链接与锚点永不错位。做得好的：EntryView 这类含异步 MarkdownRenderer 的服务端组件用 renderToReadableStream 在 node 断言 HTML，比 jsdom 省事且覆盖目录/返回/空态；BackToTop 用 usePlayer 感知队列避让播放条，条件定位直接进测试。可改善：MockAudio 在第 5 个测试文件重复、tooltip 标记第 6 次复制，共享测试工具与 Tooltip 小组件的提炼已欠两轮，下轮功能规格前先还这笔债。

- 清理与重构轮：MockAudio 五份拷贝收敛为 test-utils/mock-audio（增强版超集 + stubAudio/unstubAudio，测试文件彻底摆脱 vi）；tooltip 六处收敛为 Tip 组件（基础显隐收敛、位置类透传，外层 .group 结构不动）。137 测试全绿 + 构建过，零行为变更。做得好的：重构以测试为安全网，中途一次误删 vi 引用导致 25 红，安全网立刻报警、补 unstubAudio 后转绿，验证了网的有效性。可改善：提炼本可更早（第三次复制时即动手），"三振出局"可定为团队规则；player.md 功能规格仍是下一优先级。

- shadcn/ui 接入轮：CLI 在本环境启动即崩（MCP SDK 与 pnpm store 内 zod 冲突，init/help 全灭），改手工 vendor（utils + dialog/dropdown-menu/slider，cva/clsx/tailwind-merge/tw-animate-css + 3 个 radix）；tailwind-merge 经核实未过时（v3.6.0 支持 Tailwind v4.0-4.3，周下载 8000 万），项目本身已是 Tailwind v4 无需迁移。主题 token 按纪律补齐（popover/secondary 系进每套主题块）。主题菜单与搜索 Modal 迁至 Radix（删手写 Portal/外部点击/Esc/菜单逻辑约 60 行）。137 测试全绿 + 构建过。做得好的：读 Radix 源码定位三处 jsdom 行为差（菜单 pointerdown 展开、document 监听 setTimeout(0) 挂载、Esc 监听在 document），测试改用真实事件序列而非降级断言；Tooltip 本轮刻意不迁（自研 Tip 视觉一致且有测试，Radix 替换是纯 churn，记录待议）。可改善：Radix 测试知识（pointerdown/宏任务/aria-hidden 背景）应沉淀为测试工具或文档注释，散在各测试文件里下次还得重新发现；happy-dom 提速可单独做基准对比后再定（当前 9 秒主要花在 worker 隔离，vitest 自身建议 isolate:false）。

- 播放器规格与实现轮：先定 `docs/specs/player.md`（14 节：队列/暂停/切歌/收尾/进度/音量/关闭/自动播放/错误/状态可见/不做/选型/缺口/验收），再 TDD 落地缺口——Provider 新增音量状态机（静音独立态 + 上次非零恢复 + 越界钳制 + localStorage 持久化）、进度状态（timeupdate/loadedmetadata）、`seekTo`、`error` 降级；播放条补双 Slider + 时间 + 静音按钮（音量组窄屏收起）。160 测试全绿 + 构建过。做得好的：选型时被追问 headless 库，搜证后把 ElevenLabs audio-player 与 react-use-audio-player 的否决理由写进 §12（前者替换已验证队列核心得不偿失，后者不拥有队列），结论有据；复查轮抓到两个真 bug（同文件重播进度不复位、clear 不复位时长）并先红后绿。教训：① Radix Slider 的 aria-label 落根节点、手柄继承不到——无障碍名只能挂 `role="group"` 包裹，vendor 文件不动；② jsdom 无 ResizeObserver，Radix Slider 用例需打桩；③ vitest worker 池偶发启动超时，重跑即过（环境抖动，非代码问题）。可改善：timeupdate 全局 4Hz 重渲染整棵 Provider 树（含 BackToTop/专辑卡），现规模可接受，若加歌词等高频 UI 再拆分 context；player.md §13 缺口清单已同步为完成态，规格与实现一致。

- 搜索规格轮：`docs/specs/search.md`（13 节）锁定现状——逐字检索 + 竞态守卫 + 四关闭 + 焦点返回 + 搜索态保留 + 四空态，选型维持 Pagefind（否决自建 fuse：首屏膨胀 + 中文分词成本）。唯一缺口是 §6.3 缺断言，补测试一次绿（行为早已存在）。161 测试全绿 + 构建过。教训：连续两轮 edit 误替换下一起始行（oldString 边界贪小），JSX/测试文件插入一律带上下文锚点——这条之前反思过又犯，需形成肌肉记忆。

- 内容模型规格轮：`docs/specs/content-model.md`（10 节）锁定字段/聚合/分类与标签职责/SOP，附带抓到真缺口——示例专辑的 `tags: [demo]` 无着陆页（标签页只聚合 posts）。修复：`content.ts` 新增 `getAllTags`/`getEntriesByTag`（5 用例先红后绿），标签页改聚合 `posts` + `music`，构建验证 `/tags/demo` 生成（13→14 页）；AGENTS SOP 四步补为五步（+tags 登记）。166 测试全绿 + 构建过。至此 specs 四分篇齐（ui-ux/player/search/content-model），规范驱动闭环。

- 技能包类型轮：调研三家 skill 规范（Claude/Codex/agentskills.io 收敛：SKILL.md 的 name+description frontmatter + H1>H2 正文 + 包目录形态），按用户决策不做预处理拆分、页面直接以目录形式展示。实现：`skillSchema`（name 必填 kebab + version/author 可选）+ 包 loader（`listSkillSlugs`/`getSkillPackage`/`getSkillEntries`，7 用例）+ 纯服务端 `SkillPackageView`（返回链/元信息/常显目录/入口正文/附属分节，5 用例，零客户端 JS）+ 示例包 tdd-basics；徽标/tags/首页/分类自动入流。179 测试全绿 + 17 页构建。教训：构建复查抓到包形态漏网——`getAllTags` 走单文件集合漏掉 skills，`/tags/testing` 缺失，补 `getTaggedEntries` 统一数据源后构建验证；单文件假设藏在聚合函数里，新形态类型加入时要逐个审计聚合入口（getAllEntries/getAllTags/getEntriesByTag 三处，缺一即漏）。

- dev worker 农场死亡排查（用户报"点击 skill 一直编译"）：先复现拿到 500（Jest worker child exceptions）而非真循环编译；对照实验 `/tags/testing`（无 Shiki 普通页）同 500 → 非 skill 特有；生产构建绿 → 非内容问题；结论是 dev 静态预渲染 worker 全局已死、缓存页 200 掩盖了故障。重启 dev 后 skill/tags 均 200。教训：① EPIPE 日志风暴是结果不是原因，9MB 日志无首错时别在日志里刨；② "缓存正常 + 新鲜路由全灭" 就是农场死亡特征，先做新路由对照再二分代码；③ 实验性改动（附属降级渲染）及时用备份恢复，保持工作树干净；④ 用户常驻的 dev 进程动手前先确认归属（PID/端口）。

- 顶栏与技能侧边栏轮：技能进导航（4 链接）；顶栏改全宽 between（品牌左、工具右，不随内容收窄），窄屏右侧组换行不断功能；技能详情改文档式双栏（目录 aside、桌面 sticky、窄屏叠上）。180 测试全绿 + 17 页构建。教训：layout 层至今零测试，顶栏改动只能靠构建 + 人眼，真机/肉眼验收不可省；双栏宽度直接复用文章页 5xl 档，未发明新宽度。

- Keep 优质特性迁移与工程知识库导入轮：完成 4 个阶段迁移（移动端 TOC 抽屉 + 标题锚点复制 + 滚动无障碍 + 相关推荐与上下篇 + TanStack Hotkeys 驱动的命令面板与帮助弹窗 + 64 篇 Keep 软件工程原则/定律知识库迁移）。30 测试套件、221 项测试全绿 + 261 页静态构建与 Pagefind 索引生成通过。做得好的：① TanStack Hotkeys 成功在 React 19 下通过序列按键（g c / g a / g s / g h）与快捷键平替原有底层 DOM 监听；② 迁移知识库时严格遵循 zod schema，利用 Node 脚本清洗重复 H1 并标准化 category 与 slug，零手动搬运差错；③ 发现 60+ 篇文章并发渲染导致测试超时后，迅速识别根本原因，在 content.ts 为 getCollection 引入内存缓存，测试耗时从 5000ms+ 骤降至 200ms。可改善：TanStack Hotkeys 强类型对按键字符区分大小写（单字母必须大写如 'G', 'C'），提前查阅类型定义可避免一次编译类型错误。

- 长列表体验与侧栏吸顶轮：针对 66+ 篇文章的长列表交互，评估否决虚拟列表方案（避免破坏浏览器原生 Ctrl+F 与无障碍），采用 Incremental Loading（首屏 15 篇 + IntersectionObserver 触底自动追加 + 兜底按钮）兼顾 DOM 极致轻量与原地查找能力；重构 PostsExplorer 与 SkillsExplorer，桌面端左侧分类栏升级为 `sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto` 独立吸顶自滚动，移动端分类栏升级为 `sticky top-14` 横向吸顶胶囊栏（下滚浏览时随时可切换分类）。30 测试套件、224 项测试全绿 + 261 页构建与 Pagefind 索引生成通过。做得好的：严格遵循 TDD 红绿循环，针对分页初始切片、点击追加、分类切换重置分别编写完整单元测试，并保持全语义 Token；可改善：移动端吸顶分类栏横向滚动条在部分 Webkit 下默认可见，通过 scrollbar-none/样式微调进一步消除了多余滚动条视觉干扰。

- 顶栏路由激活、返回隔离与中英文字体升级轮：① 顶栏导航升级客户端组件 HeaderNav，联动当前路由自动显示高亮激活态（`aria-current="page"` 与 `text-primary`）；② 修复 BackButton 跨集合穿透 bug，增加集合隔离测试与校验守卫，杜绝从 /skills 来源污染文章返回路径；③ 引入 Vercel `geist` 离线字体体系（GeistSans 西文现代几何无衬线 + GeistMono 编程等宽代码字体，零外部网络依赖，构建期自托管）与现代中文系统字体栈（苹方/思源黑体/微软雅黑/霞鹜文楷/冬青黑体），优化 CJK 混排断行（`text-wrap: pretty`）与行高节奏（`leading: 1.85`）。31 测试套件、229 项测试全绿 + 261 页构建与 Pagefind 索引生成通过。做得好的：安装字体包时敏锐察觉 npm 全局索引较慢，及时切换回与 lockfile 一致的 pnpm（3.6s 瞬间完成），保证工具链一致性；可改善：中西文混排还可结合 CSS 标点挤压与字符间距进一步打磨。

- 路由滚动复位与 HarmonyOS Sans 线上切片接入轮：针对底部切文章时因全局 smooth-scroll 打断导致滚动未到顶、标题被 sticky header 遮挡的真机体验 bug，移除根级全局强制 smooth，开发并挂载 RouteScrollReset 客户端监听组件（TDD 2 用例），并在 AdjacentNav 添加 instant 点击复位；同时接入 HarmonyOS Sans SC 线上全字重 Unicode 切片 WebFont。32 测试套件、231 项测试全绿 + 261 页静态构建通过。教训：RelatedEntries 为服务端组件，Link 属性不得混入客户端事件函数 onClick，软导航由顶层 RouteScrollReset 统一收敛即可。



