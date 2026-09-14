---
title: Arbor — 层次化 Markdown 计划树引擎
date: '2025-05-30'
tags:
  - TypeScript
  - Markdown
  - 架构
  - Parser
  - Pi
  - OpenCode
category: engineering
description: 用普通 Markdown 文件存储结构化计划树，支持 CRUD、查询、AI 代理集成
---
## 问题

AI 编程代理需要一种**结构化的计划表达方式**：任务分解、子任务、跟踪状态。但既有的方案各有缺陷：

- **纯 Markdown** — 人类友好，但无法程序化查询和修改
- **JSON/YAML** — 机器友好，但人类无法直接编辑
- **Issue tracker** — 太重，需要网络和账号

Arbor 的方案：**用普通 `.md` 文件同时满足人类和机器**——Markdown heading 层级表达树结构，`#tag` 语法表达元数据，程序可解析、可查询、可修改。

## 核心设计：Markdown 即数据

一个 Arbor 文档就是一个普通的 Markdown 文件：

```markdown
# Sprint 26 #type:plan

## Issue-104: 支持 OAuth 登录 #type:issue #priority:high

### Task-1: 创建 OAuth 客户端表 #type:task #status:done

建表 SQL 已执行。

### Task-2: 实现 OAuth 回调接口 #type:task #status:wip

实现中...

## 迁移计划 #type:task #status:pending

旧版本兼容方案待确定。
```

解析后变成树结构：

```text
Sprint 26                                 (type: plan)
├── Issue-104: 支持 OAuth 登录            (type: issue)
│   ├── Task-1: 创建 OAuth 客户端表        (type: task, status: done)
│   └── Task-2: 实现 OAuth 回调接口        (type: task, status: wip)
└── 迁移计划                              (type: task, status: pending)
```

## 架构：三层

```
┌────────────────────────────────┐
│     Pi Extension               │  ← 适配层
│   + OpenCode Plugin            │     5 个工具 + 配置管理
├────────────────────────────────┤
│        ArborEngine             │  ← 引擎层
│   CRUD + 搜索 + 移动 + 快照    │     文件系统持久化
├────────────────────────────────┤
│        Parser                  │  ← 解析层
│   Markdown ↔ ArborNode 树      │     纯函数，无 I/O
└────────────────────────────────┘
```

## Parser — 纯函数解析层

### 解析过程

使用 `unified` + `remark-parse` + `remark-stringify` 处理 Markdown AST：

```
输入 Markdown 文本
    ↓
remark-parse → mdast AST
    ↓
线性遍历 AST 子节点：
  - Heading → 创建新 ArborNode，匹配 parent
  - 非 Heading → 累积为当前节点的 content
    ↓
ArborNode 树
```

### Heading 解析

```typescript
parseHeaderTags("# Task-1: 实现接口 #type:task #status:done #high")
// → {
//     title: "Task-1: 实现接口",
//     tags: ["type:task", "status:done", "high"],
//     type: "task",
//   }
```

类型默认规则：
- 有 `#type:xxx` 标签 → 使用该值
- 无 `#type:` → 默认为 `"doc"`

### 层级匹配：智能祖先查找

Markdown 允许跳级（如 `#` 后直接 `###`），解析器需要把 `###` 挂到最近的前一个 `##` 下：

```typescript
function findParent(stack: ArborNode[], depth: number): ArborNode {
  // 从栈顶往下找，直到找到 depth < 当前 depth 的节点
  while (stack.length > 1 && stack[stack.length - 1].depth >= depth) {
    stack.pop();
  }
  return stack[stack.length - 1];
}
```

### ID 生成

节点 ID 是层级式 slug 路径，可在文件路径中直接定位节点：

- 根节点 ID = 文件名（不含 `.md`）
- 子节点 ID = `父ID/标题-slug`

```typescript
function generateNodeId(parentId: string, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${parentId}/${slug || 'node'}`;
}
```

### 序列化保证：完美往返

```typescript
serializeTreeToMarkdown(parseMarkdownToTree(md)) === md
```

经过 remark 标准化的文本可完全还原，意味着 Arbor 不会破坏手写的 Markdown 格式。

## ArborEngine — 文件 CRUD 引擎

### 存储模型

每个 tree = 一个 `.md` 文件：

```
<baseDir>/
├── sprint-26.md
├── architecture-review.md
└── oncall-rotation.md
```

### 核心接口

```typescript
interface IArborEngine {
  listTrees(): Promise<string[]>;
  loadTree(treeId: string): Promise<ArborNode>;
  saveTree(treeId: string, node: ArborNode): Promise<void>;
  getSkeleton(treeId: string): Promise<ArborNode>;
  getNode(nodeId: string, opts?: { loadContent: boolean }): Promise<ArborNode>;
  addNode(parentId: string, node: ArborNodeInput): Promise<string>;
  patchNode(nodeId: string, patch: ArborNodePatch): Promise<void>;
  deleteNode(nodeId: string): Promise<void>;
  moveNode(nodeId: string, newParentId: string): Promise<void>;
  queryNodes(filter: NodeFilter): Promise<ArborNode[]>;
}
```

### 关键操作实现

**patchNode**：加载 → 解析 → 修改 → 序列化 → 覆写

```typescript
async patchNode(nodeId: string, patch: ArborNodePatch): Promise<void> {
  const [treeId] = nodeId.split('/');
  const tree = await this.loadTree(treeId);
  const node = findNode(tree, nodeId);
  if (!node) throw new Error(`Node ${nodeId} not found`);

  if (patch.title !== undefined) node.title = patch.title;
  if (patch.type !== undefined) node.type = patch.type;
  if (patch.tags !== undefined) node.tags = patch.tags;
  if (patch.content !== undefined) node.content = patch.content;

  await this.saveTree(treeId, tree);
}
```

**moveNode**：断开 → 重新生成所有后代 ID → 重新挂接

```typescript
async moveNode(nodeId: string, newParentId: string): Promise<void> {
  const [treeId] = nodeId.split('/');
  const tree = await this.loadTree(treeId);
  const parent = findNode(tree, newParentId);
  const node = removeFromParent(tree, nodeId);

  // 递归更新所有后代的 ID
  relabelNodeIds(node, parent.id);
  parent.children.push(node);
  await this.saveTree(treeId, tree);
}
```

**queryNodes**：扁平化 → 过滤

```typescript
async queryNodes(filter: NodeFilter): Promise<ArborNode[]> {
  const allTrees = await this.listTrees();
  const results: ArborNode[] = [];

  for (const treeId of allTrees) {
    const skeleton = await this.getSkeleton(treeId);
    flattenTree(skeleton, (node) => {
      if (matchesFilter(node, filter)) results.push(node);
    });
  }
  return results;
}
```

## Pi 集成

### 配置系统：双层合并

```typescript
interface ArborConfig {
  dbDir: string;
  isolation: 'hash' | 'name' | 'none';
}

// 加载顺序：全局默认值
//            ← 全局文件 ~/.pi/agent/arbor.config.json
//            ← 项目文件 .pi/arbor.config.json
//            ← 环境变量 ARBOR_DB_DIR
```

隔离策略解决多项目数据冲突：

| 策略 | DB 路径 |
|------|---------|
| `hash` | `~/.pi/arbor/<sha256(cwd)[:8]>/` |
| `name` | `~/.pi/arbor/<目录名>/` |
| `none` | `~/.pi/arbor/` |

### 路径信息清理

错误信息中会暴露用户目录和数据库路径。`formatError()` 函数在返回给 AI 前替换敏感路径：

```typescript
function formatError(err: Error, cwd: string, dbDir: string): string {
  return err.message
    .replaceAll(cwd, '.')
    .replaceAll(os.homedir(), '~')
    .replaceAll(dbDir, '[arbor-db]');
}
```

### snapshot 工具：文件快照

`arbor_snapshot` 是 Arbor 中独特的工具——它扫描节点 content 中的 `file://` 链接，读取这些文件，打包为紧凑的代码上下文：

```typescript
async function snapshotNode(nodeId: string): Promise<string> {
  const node = await engine.getNode(nodeId);
  const fileUrls = extractFileUrls(node.content);

  const parts: string[] = [];
  for (const url of fileUrls) {
    const filePath = urlToPath(url);
    const stat = await fs.stat(filePath);
    if (stat.size > 500_000) {
      parts.push(`> ${url} (SKIPPED: >500KB)`);
      continue;
    }
    parts.push(`// file: ${url}\n${await fs.readFile(filePath, 'utf-8')}`);
  }
  return parts.join('\n\n---\n\n');
}
```

## OpenCode 集成

OpenCode 插件提供相同的 5 个工具，但 DB 默认指向项目本地：

```typescript
const dbDir = process.env.ARBOR_DB_DIR ?? path.join(worktree, '.arbor');
```

## 测试策略

| 文件 | 覆盖内容 |
|------|----------|
| `parser.test.ts` | header 解析、tag 提取、多层树解析、完美往返（双向一致） |
| `engine.test.ts` | 文件生命周期、skeleton vs full、增量 patch、增删查、query 过滤 |
| `pi-adapter.test.ts` | 工具注册、snapshot 端到端、错误路径清理、大文件跳过、malformed URL |

## 设计要点

- **Markdown 即数据**：文件同时是人类可读的文档和机器可解析的数据结构
- **类型即标签**：`#type:xxx` 是唯一的元数据注入点，无需 YAML frontmatter
- **ID 即路径**：层级化 slug ID 让人一眼知道节点在树中的位置
- **完美往返**：序列化保证不破坏手写 Markdown
- **路径清理**：错误信息脱敏，避免向 AI 泄露本地目录结构
- **外部快照**：`file://` 链接机制将相关源码嵌入计划上下文
