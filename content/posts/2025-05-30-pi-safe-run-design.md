---
title: pi-safe-run — AI 编程助手的命令确认与路径保护扩展
date: '2025-05-30'
tags:
  - TypeScript
  - 安全
  - 架构
  - Pi
  - LLM
category: engineering
description: 为 Pi 编码代理设计的安全防护层 — 危险命令检测、敏感路径保护、双层架构设计
---
## 问题

AI 编程代理（如 Pi）可以执行任意 shell 命令和文件操作。当 LLM 建议 `rm -rf /`、`sudo rm /etc`、`curl ... | bash` 这类操作时，需要一个**防护层**来拦截确认，避免灾难性后果。

## 设计目标

- 拦截 LLM 提出的危险命令，要求用户确认
- 保护敏感路径（`.env`、`.git/`、`*.pem` 等）不被随意写入
- 支持持久化规则（允许/拒绝/信任列表）
- 零外部运行时依赖，仅用 Node.js 内置模块
- 可测试 — 业务逻辑与平台 API 解耦

## 架构：双层分离

```
┌────────────────────────────────────┐
│           safe-run.ts              │  ← 集成层
│  Pi ExtensionAPI 事件/命令/UI      │     依赖 pi-coding-agent
├────────────────────────────────────┤
│         config-store.ts            │  ← 纯业务逻辑层
│  配置读写、路径匹配、命令检测       │     零外部依赖
└────────────────────────────────────┘
```

**集成层**（`extensions/safe-run.ts`）处理 Pi 框架的事件监听器、命令注册、UI 交互。**纯业务层**（`extensions/config-store.ts`）是独立可测试的 `ConfigStore` 类，没有任何 Pi 依赖。

## ConfigStore — 纯业务逻辑

### 数据模型

```typescript
interface SafeRunConfig {
  trustedPaths: string[];
  alwaysAllowCommands: string[];
  alwaysDenyCommands: string[];
  dangerousPatterns: string[];
  sensitivePatterns: string[];
}
```

配置存储为两个层级的 JSON 文件：
- **全局**: `~/.pi/agent/safe-run.json`
- **项目**: `.pi/safe-run.json`

### 默认危险命令模式

30 条正则，覆盖六类风险操作：

| 类别 | 模式 | 示例 |
|------|------|------|
| 删除 | `\brm\s+-rf?\b` | `rm -rf /` |
| 提权 | `\bsudo\b`, `\bchmod\b.*777` | `sudo rm ...` |
| 代码执行 | `\beval\b`, `\bexec\b` | `eval "$(curl ...)"` |
| 管道下载 | `\bcurl\b.*\|`, `\bwget\b.*-O\s*-\s*\|` | `curl ... \| bash` |
| Git 破坏 | `\bgit\s+push\s+--force` | force push |
| 包管理 | `\bapt\s+remove`, `\bpip\s+uninstall` | 卸载生产依赖 |

### 默认敏感路径

- `.env` / `.env.*` — 环境变量泄露
- `.git/` — Git 对象破坏
- `node_modules/` — 不可变依赖
- `*.pem` / `*.key` — 私钥覆盖
- `dist/` / `build/` / `.next/` — 构建产物
- 锁文件 — `package-lock.json`, `pnpm-lock.yaml`

### 命令解析：复合命令的安全检测

```typescript
splitCommand("rm -rf /tmp && echo done")
// → ["rm -rf /tmp", "echo done"]
```

`splitCommand()` 按 `&&`、`||`、`;`、`|`、`&` 拆分复合命令，同时尊重引号上下文：

- 单引号 `'...'` — 全部当做字面量
- 双引号 `"..."` — 不拆分
- 反引号 `` `...` `` — 不拆分

`stripQuoted()` 在正则匹配前去除引号内的内容，避免假阳性：

```typescript
stripQuoted(`echo "safe" && rm -rf /tmp`)
// → `echo "" && rm -rf /tmp`
```

对于元命令（`sh -c '...'`, `bash -c "..."`），`extractQuotedSegments()` 会提取引号内的字符串作为子命令重新检测。

### 路径匹配

```typescript
pathMatches("/home/user/.env.local", "*.env*")     // → true
pathMatches("/home/user/.git/config", ".git/")     // → true
pathMatches("/home/user/src/app.ts", "node_modules/") // → false
```

规则：
- `~` 展开为 `os.homedir()`
- `*.ext` 后缀匹配
- 末尾 `/` 为目录前缀匹配
- 否则 `startsWith(pattern + sep)` 或精确匹配

### 缓存策略：mtime 驱动的惰性加载

```typescript
class ConfigStore {
  private lastMtimes = new Map<string, number>();

  ensureFresh(): void {
    for (const [path, mtime] of this.lastMtimes) {
      const stat = fs.statSync(path);
      if (stat.mtimeMs > mtime) {
        this.reload(path); // 文件被修改，重新加载
      }
    }
  }
}
```

每次工具调用前只做 `stat` 检查 mtime，避免每次重新解析 JSON。配置写入后调用 `markDirty()` 使缓存失效。

## 集成层：Pi 事件驱动

### session_start：目录信任提示

```
Pi 启动 → session_start(reason="startup")
         ↓
    ctx.cwd 是否受信任？
         ↓               ↓
      是，跳过       否，有 UI？
                      ↓         ↓
                  SelectDialog  跳过
                  "信任此目录?"
```

### tool_call：命令路径拦截

```
LLM 提议执行命令或写入文件
         ↓
    tool_call 事件
         ↓
    ┌── 命令拦截 ──────────────────┐
    │ 是否 alwaysAllow？→ 放行      │
    │ 是否 alwaysDeny？ → 阻断      │
    │ 是否 dangerous？  → 询问用户  │
    │     Allow Once / Deny         │
    │     Always Allow / Always Deny│
    └──────────────────────────────┘
    ┌── 路径拦截 ──────────────────┐
    │ 是否 trusted？ → 放行          │
    │ 是否 sensitive？→ 询问用户    │
    └──────────────────────────────┘
```

非交互模式（`hasUI = false`）下直接阻断，返回阻断原因字符串。

## 持久化

规则通过 JSON 文件持久化，`/trust` 和 `/safe` 两个斜杠命令管理：

| 命令 | 操作 |
|------|------|
| `/trust add <path>` | 添加信任路径 |
| `/trust remove <path>` | 移除信任路径 |
| `/trust list` | 列出所有信任路径 |
| `/safe allow <cmd>` | 添加白名单命令 |
| `/safe deny <cmd>` | 添加黑名单命令 |
| `/safe danger <regex>` | 添加危险模式 |
| `/safe sensitive <pattern>` | 添加敏感路径 |

## 测试策略

| 文件 | 类型 | 覆盖内容 |
|------|------|----------|
| `config-store.test.ts` (390 行) | 纯单元测试 | 命令拆分、路径匹配、危险检测、持久化、mtime 缓存 |
| `safe-run.test.ts` (560 行) | 集成测试 | 事件注册、UI 交互、会话信任、命令拦截决策 |

集成测试通过 mock `ExtensionAPI` 和 mock `ui.select()` 返回值来模拟各种用户选择路径，验证持久化行为。

## 设计要点

- **双重保护**：命令和路径两路拦截，互不依赖
- **两层分离**：纯业务逻辑可脱离 Pi 框架独立测试和使用
- **惰性缓存**：stat + mtime 检查代替每次重新解析
- **智能解析**：复合命令拆分 + 引号识别 + 元命令提取，减少假阳性
- **双层配置**：全局作用域（用户级安全策略）+ 项目作用域（团队级安全策略）
