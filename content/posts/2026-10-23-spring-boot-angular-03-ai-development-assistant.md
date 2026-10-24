---
title: Spring Boot & Angular 全栈实战（三）：工程级 AI 辅助研发工作流与规则指令集
date: 2026-10-23T00:03:00Z
description: 双栏独立滚动对照：探索大模型在全栈微服务研发中的工程化落地，配置专属 Copilot 规范指令集与防御性代码约束，建立可信可验的代码生成与重构工作流。
category: fullstack
column: spring-boot-angular
tags:
  - AI辅助开发
  - Spring Boot
  - GitHub Copilot
  - 工程提效
---

> 💡 **双栏独立滚动工作台导读**：本文采用双栏对照架构。**左栏**为核心技术决策矩阵、生产级代码范式与避坑清单；**右栏**为技术实现演化参考，并提供关键段落的英文原文展开与难词解析。左右两栏可独立滚动，并支持顶栏自定义宽度比例（7:3 / 5:5 / 3:7）与拖拽调节。

## 1. 架构选型与工具对比矩阵

| 特性维度 | Cursor IDE | Claude / Claude Code | GitHub Copilot |
| :--- | :--- | :--- | :--- |
| **上下文感知能力** | 全工程代码索引与 `@` 跨文件关联 | 超长上下文窗口（支持 200K+ tokens） | 当前文件、激活 Tab 标签及 Workspace 依赖元数据 |
| **内联代码补全** | 完整支持 | 不支持（纯对话/CLI 模式） | **原生毫秒级幽灵文本（Ghost Text）流** |
| **架构推演与深层排障** | 良好 | **顶级逻辑推理与跨系统死锁排查** | 依赖明确的提示词与局部代码边界 |
| **单元测试与模板脚手架** | 优秀 | 良好 | **极佳（深度适配 Spring/JUnit/MockMvc 范式）** |
| **IDE 集成形态** | 专属独立 IDE 客户端 | 独立客户端 / 终端 CLI | **无缝融入 VS Code 等主流宿主编辑器** |
| **微服务研发工程定位** | 大规模跨文件协同重构与接盘分析 | 架构方案推演、SQL 调优与疑难故障复盘 | **日常核心编码、DTO 样板生成与单元测试补全** |

## 2. 生产级 AI 驱动代码范式

### 2.1 结构化提示词驱动的 REST 控制器端点生成

```java
package com.packt.bookstore.inventory.controller;

import com.packt.bookstore.inventory.dto.BookDTO;
import com.packt.bookstore.inventory.service.BookService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/books")
public class BookController {

    private final BookService bookService;

    public BookController(BookService bookService) {
        this.bookService = bookService;
    }

    // 意图输入：分页查询图书列表，默认第 0 页、每页 10 条
    @GetMapping
    public ResponseEntity<Page<BookDTO>> getAllBooks(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(bookService.getAllBooks(pageable));
    }

    // 意图输入：根据作者姓名检索图书列表并返回 200 OK
    @GetMapping("/author/{name}")
    public ResponseEntity<List<BookDTO>> getBooksByAuthor(@PathVariable String name) {
        return ResponseEntity.ok(bookService.findBooksByAuthor(name));
    }
}
```

### 2.2 防御性代码规范：AI 快乐路径 vs 生产级校验范式

```java
// ❌ 脆弱的反模式（AI 默认生成的 Happy Path，缺乏空值与越界防护）：
public User findUser(String username) {
    return userRepository.findByUsername(username);
}

// ✅ 生产级防御范式（人工介入增强：前置空值拦截、长度校验与领域异常断言）：
public User findUser(String username) {
    if (username == null || username.isBlank() || username.length() > 50) {
        throw new InvalidParameterException("Username parameter is invalid");
    }
    return userRepository.findByUsername(username)
        .orElseThrow(() -> new UserNotFoundException("User not found: " + username));
}
```

### 2.3 单元测试脚手架生产代码（`@WebMvcTest` + Mockito）

```java
package com.packt.bookstore.inventory.controller;

import com.packt.bookstore.inventory.dto.BookDTO;
import com.packt.bookstore.inventory.service.BookService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(BookController.class)
public class BookControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private BookService bookService;

    @Test
    void shouldReturnAllBooksSuccessfully() throws Exception {
        var mockBooks = List.of(
            new BookDTO(1L, "Clean Architecture", "Robert Martin", new BigDecimal("39.99")),
            new BookDTO(2L, "Spring Boot in Action", "Craig Walls", new BigDecimal("29.99"))
        );

        when(bookService.getAllBooks()).thenReturn(mockBooks);

        mockMvc.perform(get("/api/books"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(2)))
            .andExpect(jsonPath("$[0].title").value("Clean Architecture"))
            .andExpect(jsonPath("$[0].author").value("Robert Martin"));
    }
}
```

## 3. 开发者主导的 AI 协同工程拓扑流图

```text
┌────────────────────────────────────────────────────────┐
│           开发者主导的 AI 结对研发工程闭环             │
└───────────────────────────┬────────────────────────────┘
                            │
       ┌────────────────────┴────────────────────┐
       ▼                                         ▼
[ 开发者主导层 ]                           [ AI 结对执行层 ]
├── 制定业务领域边界与实体契约                ├── 快速生成样板 Record DTO
├── 编写带约束的上下文提示词 (Prompt) ──────> ├── 联想 Spring Data JPA 衍生方法
├── 审查防御性校验与空指针拦截                ├── 生成 MockMvc 测试骨架与打桩代码
└── 判定最终合并 (Junior Developer Rule) <── └── 推荐局部重构与语法降级方案
```

## 4. AI 辅助研发避坑清单 (Do's & Don'ts)

| 错误实践 (Don't) | 正确实践 (Do) |
| :--- | :--- |
| 将 AI 生成的代码视作绝对可靠的真理直接合并提交。 | 恪守“初级开发者法则（Junior Developer Rule）”，所有生成代码必须经过人工审查与测试验证。 |
| 使用“写个图书接口”等模糊、无边界的自然语言 Prompt。 | 明确动词、输入参数、返回类型与异常约束（如“返回 `Page<BookDTO>` 并处理非空校验”）。 |
| 放任 AI 给出全通配 `@RequestMapping("/*")` 或无序的 CORS 放行配置。 | 严格遵循最小权限暴露原则，显式限制 HTTP 路径与跨域域名白名单。 |
| 在 Spring Boot 4 / Java 26 项目中盲目采纳过时或已标记废弃的注解。 | 以当前项目编译通过与最新官方文档为准，剔除过时 API 幻觉。 |

<!-- split -->

# 原著完整参考：工程级 AI 辅助研发工作流与规则指令集

在现代化工程研发中，生成式人工智能（GenAI）正在深刻重构开发者的日常编码模式。AI 助手早已脱离了单纯代码补全工具的范畴，演变为全天候随行的结对编程伙伴（Pair Programmer）——从辅助架构思考、安全重构代码、快速生成单元测试，到生成 Spring 表现层控制器、自动化编写 Angular 状态服务。

在模型广泛普及的背景下，确保 AI 在遵循工业级规范、保障代码安全可信的前提下为工程服务，是每一位严谨软件工程师的核心功底。本文系统拆解主流 AI 编码工具的技术定位，配置 VS Code 与 GitHub Copilot 的工程化环境，并通过实战总结可信、可控、高产出的提示词与规则指令集工作流。

:::en
> **Original**: Generative AI tools serve as collaborative pair programmers, augmenting software engineering workflows while demanding strict verification of generated code against enterprise safety standards.

**📌 核心术语与语境解析**：
- **Pair Programming** [peə ˈprəʊɡræmɪŋ]：*结对编程*。两名工程师（或工程师与智能体）协同进行系统设计、编码与审查的敏捷工程实践。
- **Generative AI (GenAI)** [ˈdʒenərətɪv ˌeɪ ˈaɪ]：*生成式人工智能*。基于深层神经网络与海量代码库训练，能够依据自然语言提示生成程序逻辑与文本的大模型系统。
:::

## 1. 从语法补全到智能生成：AI 研发工具的技术跃迁

回顾集成开发环境（IDE）的演进历史，开发者与机器的协同方式经历了四个鲜明的发展阶段：

| 发展阶段 | 代表性能力与形态 | 核心工程特征 |
| :--- | :--- | :--- |
| **2010–2015** | IntelliSense / 静态词法提示 | 基于 AST 语法树解析，补全类名、方法签名与局部变量 |
| **2015–2020** | 代码模板（Snippet Generators） | 展开预设的 Live Templates，快速生成标准样板循环或结构体 |
| **2020–2023** | 传统机器学习补全 | 基于局部上下文统计预测单行或短代码块 |
| **2023+** | **生成式 AI 结对伙伴（GenAI）** | 感知多文件仓库上下文、理解自然语言意图、解释代码、自动生成高覆盖率测试、协同重构 |

### 1.1 开发者思维模型的关键转变

拥抱 AI 辅助研发，最重要的转变在于**研发文化与思维视角的迁移**：
- **传统开发逻辑**：手动编写实体、编写 DTO、编写 Repository 接口、再编写 Controller，逐行编写样板映射；
- **现代 AI 协同逻辑**：明确定义业务领域契约与边界约束，通过精确的提示词与意图描述引导 AI 快速生成标准骨架，开发者专注于领域规则校验、边界异常审查与架构设计把控。

```text
                   ┌────────────────────────────────────────┐
                   │        开发者与 AI 的工程协同闭环       │
                   └───────────────────┬────────────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
┌───────────────────────┐                             ┌───────────────────────┐
│     开发者主导决策    │                             │       AI 结对执行     │
├───────────────────────┤                             ├───────────────────────┤
│ • 划定业务领域边界    │     意图输入 / 规则指令      │ • 快速生成样板 DTO    │
│ • 制定 API 契约协议   │ ──────────────────────────> │ • 联想 JPA 仓储查询   │
│ • 审查安全性与边界值  │                             │ • 骨架化 WebMvc 单元测试│
│ • 裁决最终代码合并    │ <────────────────────────── │ • 自动化代码重构建议  │
└───────────────────────┘     生成代码 / 补全反馈      └───────────────────────┘
```

这种协作方式将工程师从重复冗长的样板编码中解放出来，缓解了 Java 后端与 TypeScript 前端全栈切换时的上下文断层。

---

## 2. 主流 AI 编程工具深度横评：Cursor、Claude 与 Copilot

在当前开发工具链中，**Cursor**、**Claude** 与 **GitHub Copilot** 是三种具有代表性的 AI 辅助工具，具备不同的核心侧重与应用场景：

### 2.1 Cursor IDE：全仓库感知的交互工作流

Cursor 是一款深度集成 AI 原生交互的现代编辑器，基于 VS Code 内核二次开发：

![Cursor IDE 聊天与代码协作视图](/media/posts/spring-boot-angular/img-08921.png)

- **核心特性**：原生支持全工程文件索引（Full-repo indexing），能够通过 `@` 符号精准引用跨文件上下文，支持直接对当前工程多个文件发起协同编辑与重构；
- **最佳场景**：快速通读接手未知的大型遗留项目、跨多模块进行大规模逻辑重构、快速定位复杂的跨文件调用链路；
- **考量因素**：需要迁移至独立的 IDE 客户端，部分企业对于代码外发索引有严格的安全审计限制。

### 2.2 Claude / Claude Code：逻辑推理与架构设计参谋

由 Anthropic 开发的 Claude 模型以强大的上下文窗口（最高支持 200K+ tokens）和长文本严密推理能力著称：

![Claude Desktop 桌面端交互界面](/media/posts/spring-boot-angular/img-08923.png)

- **核心特性**：擅长处理高复杂度的长文本输入，在分析复杂的领域模型设计、重构方案推演、底层框架源码机制剖析以及分布式网络死锁排障方面具备出色表现；
- **最佳场景**：架构方案头脑风暴、深度性能瓶颈咨询、复杂 SQL 优化以及跨服务一致性方案论证；
- **考量因素**：网页版或桌面端与编辑器相对隔离，无法就地提供 IDE 毫秒级的实时内联补全。

### 2.3 GitHub Copilot：扎根 IDE 内部的沉浸式副驾驶

GitHub Copilot 是目前工业级项目中应用广泛、对日常编码干扰极小的 AI 编程助手：

![VS Code 中集成 GitHub Copilot 插件](/media/posts/spring-boot-angular/img-08925.png)

- **核心特性**：作为插件融入 VS Code 等主流编辑器中，提供即敲即现的幽灵文本（Ghost Text）行级与块级内联补全，配合 Copilot Chat 侧边栏，形成流畅的沉浸式体验；
- **最佳场景**：Spring Boot 与 Angular 日常 CRUD、DTO/Mapper 样板代码生成、自动化编写单元测试脚手架、快速行内答疑；
- **考量因素**：对超大工程的全局语义把控相对偏弱，需要通过良好规范的注释与上下文提示来进行引导。

### 2.4 三者综合技术能力对比矩阵

| 特性维度 | Cursor IDE | Claude / Claude Code | GitHub Copilot |
| :--- | :--- | :--- | :--- |
| **代码上下文感知** | 全仓库代码索引 | 巨量 Token（支持 200K+ 上下文） | 当前文件、相邻激活 Tab 及工作区元数据 |
| **自然语言问答** | 编辑器内置 Chat | 逻辑推理与架构推演 | 内置 Copilot Chat 对话框 |
| **内联代码补全** | 完整支持 | 不支持（纯对话/CLI） | **原生毫秒级 Ghost Text 补全** |
| **跨文件批量重构** | 极强 | 需人工粘贴或 CLI 授权驱动 | 建议单文件精细化重构 |
| **单元测试生成** | 优秀 | 良好 | **极佳（擅长 Spring/JUnit 模板）** |
| **IDE 无缝集成** | 专有 IDE | 独立客户端 / 终端 CLI | **融入 VS Code、JetBrains 等主流平台** |

工程团队的高效做法是**组合策略**：日常沉浸式开发以 **VS Code + GitHub Copilot** 为主干，遇到疑难架构决策或性能瓶颈时借助 **Claude** 深入推演，大型模块重构阶段由 **Cursor** 或工程级智能体协同执行。

:::en
> **Original**: GitHub Copilot delivers low-latency inline completions via Ghost Text, while large context models like Claude excel at multi-hop architectural reasoning and complex root-cause analysis.

**📌 核心术语与语境解析**：
- **Ghost Text** [ɡəʊst tekst]：*幽灵文本*。IDE 内以淡灰色虚影形式预先呈现的代码建议，按 Tab 键即可采纳。
- **Context Window** [ˈkɒntekst ˈwɪndəʊ]：*上下文窗口*。大模型单次前向推理所能容纳的最大 Token 容量上限。
:::

---

## 3. 为什么选择 GitHub Copilot + VS Code 作为全栈主战场？

GitHub 与 Visual Studio Code 在底层协议（LSP、Inline Completion API）上的深度整合为全栈开发者带来了顺畅体验：

1. **原生幽灵文本流（Ghost Text Flow）**：Copilot 在开发者敲击代码的间隙以淡灰色文字呈现预测代码，轻敲一次 `Tab` 键即可采纳；
2. **多语言与框架双向协同**：在全栈项目中，Copilot 能同时感知 Java 后端的 `@RestController` 契约和 Angular 前端的 `HttpClient` 请求，在后端定义完 `BookDTO` 后，能快速在前端 `.ts` 文件中补全对应的 TypeScript `interface`；
3. **理解项目工程结构**：Copilot 会主动扫描 `pom.xml` 中的依赖项（如发现已引入 Spring Data JPA 和 Mockito），其补全建议会自动采用项目已声明的库与注解。

例如在 `BookService.java` 中声明如下注释：

```java
// Add a method to get books by genre and return as a DTO
```

Copilot 会扫描当前类持有的 `BookRepository` 依赖以及包结构下的 `BookDTO`，推断出实现逻辑：

```java
public List<BookDTO> getBooksByGenre(String genre) {
    return bookRepository.findByGenre(genre).stream()
        .map(book -> new BookDTO(book.getId(), book.getTitle(), book.getAuthor(), book.getPrice()))
        .toList();
}
```

:::en
> **Original**: Seamless integration with the Language Server Protocol enables the AI to inspect type declarations, build manifests, and active editor tabs for contextually grounded suggestions.

**📌 核心术语与语境解析**：
- **Language Server Protocol (LSP)** [ˈlæŋɡwɪdʒ ˈsɜːvə ˈprəʊtəkɒl]：*语言服务器协议*。解耦 IDE 编辑器与编程语言语法分析器的标准化 JSON-RPC 规范。
- **Context Awareness** [ˈkɒntekst əˈweənəs]：*上下文感知*。编码助手提取工程依赖、临近文件及光标位置信息以生成精准代码的能力。
:::

---

## 4. 在 VS Code 中配置与调优 GitHub Copilot

为了让 GitHub Copilot 在微服务工程中发挥最大效能，需要进行针对性的环境配置。

### 4.1 安装扩展与授权登录

1. 打开 VS Code 插件市场（快捷键 `Ctrl` + `Shift` + `X` / `Cmd` + `Shift` + `X`）；
2. 搜索并安装 **GitHub Copilot** 官方插件（通常自动包含 **GitHub Copilot Chat**）：

![安装 GitHub Copilot 插件套件](/media/posts/spring-boot-angular/img-08927.png)

3. 点击状态栏或使用快捷键 `Ctrl` + `Shift` + `P` 执行 `> Copilot: Sign In`，通过浏览器完成 GitHub 账号鉴权。授权成功后，VS Code 底部状态栏常驻显示 Copilot 图标。

### 4.2 优化关键设置与快捷键

进入 VS Code 设置（`Ctrl` + `,`），搜索 `github.copilot` 进行配置调优：

- **启用内联智能补全**：勾选 `github.copilot.editor.enableAutoCompletions`；
- **全格式支持配置**：确保除了 `.java`、`.ts` 外，针对 `.md`、`.sql`、`.yml` 均开启补全支持：
  ```json
  "github.copilot.enable": {
      "*": true,
      "plaintext": false,
      "markdown": true,
      "yaml": true
  }
  ```
- **核心快捷键速查**：
  - 采纳当前建议：`Tab`
  - 逐词采纳部分建议：`Ctrl` + `→`（macOS 为 `Cmd` + `→`）
  - 查看下一个备选建议：`Alt` + `]`（macOS 为 `Option` + `]`）
  - 呼出内联 Copilot 对话窗：`Ctrl` + `I`（macOS 为 `Cmd` + `I`）

---

## 5. Spring Boot 实战：让 AI 深度协同各层编码

在 `inventory-ms` 工程中检验 GitHub Copilot 在各核心分层中的辅助生成效果。

### 5.1 生成 REST 控制器端点

在 `BookController.java` 中，定义好类头和依赖注入后，写下意图注释：

```java
@RestController
@RequestMapping("/api/books")
public class BookController {

    private final BookService bookService;

    public BookController(BookService bookService) {
        this.bookService = bookService;
    }

    // Get all books with pagination
```

回车后，Copilot 结合 Spring Web 标准，推断出包含分页参数的 REST 接口：

```java
    @GetMapping
    public ResponseEntity<Page<BookDTO>> getAllBooks(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(bookService.getAllBooks(pageable));
    }
```

键入路由注释：

```java
    // Get books by author name
```

Copilot 自动补全出带有路径变量的路由实现：

```java
    @GetMapping("/author/{name}")
    public ResponseEntity<List<BookDTO>> getBooksByAuthor(@PathVariable String name) {
        return ResponseEntity.ok(bookService.findBooksByAuthor(name));
    }
}
```

### 5.2 推断 Spring Data JPA 仓储衍生查询

在 `BookRepository.java` 中，利用规范的方法名前缀提示：

```java
public interface BookRepository extends JpaRepository<Book, Long> {

    // Find books by title containing string, ignoring case
    List<Book> findByTitleContainingIgnoreCase(String title);

    // Find books with price between min and max
    List<Book> findByPriceBetween(BigDecimal min, BigDecimal max);
}
```

Copilot 对 Spring Data 的方法命名派生机制（Method Query Derivation）具备较高理解准确度，能直接产出合乎规范的方法签名。

### 5.3 自动化构建 MockMvc 单元测试用例

在 `BookControllerTest.java` 中，利用注释驱动测试骨架：

```java
@WebMvcTest(BookController.class)
public class BookControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private BookService bookService;

    // Test for getAllBooks endpoint returning 200 OK and expected json
    @Test
    void shouldReturnAllBooksSuccessfully() throws Exception {
        var mockBooks = List.of(
            new BookDTO(1L, "Clean Architecture", "Robert Martin", new BigDecimal("39.99")),
            new BookDTO(2L, "Spring Boot in Action", "Craig Walls", new BigDecimal("29.99"))
        );

        when(bookService.getAllBooks()).thenReturn(mockBooks);

        mockMvc.perform(get("/api/books"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(2)))
            .andExpect(jsonPath("$[0].title").value("Clean Architecture"))
            .andExpect(jsonPath("$[0].author").value("Robert Martin"));
    }
}
```

Mockito 打桩、MockMvc 发起 GET 请求以及针对 JSON 路径字段的断言校验均可快速生成。

:::en
> **Original**: Spring Data repository derivations and mock-driven controller slice tests follow strict idiomatic patterns that AI models synthesize with high structural fidelity.

**📌 核心术语与语境解析**：
- **Method Query Derivation** [ˈmeθəd ˈkwɪəri ˌderɪˈveɪʃn]：*方法名查询派生*。Spring Data 根据方法命名规则（如 `findByTitle...`）在运行时自动翻译为底层 SQL 查询的技术。
- **Test Double / Stubbing** [test ˈdʌbl / ˈstʌbɪŋ]：*测试替身 / 打桩*。在单元测试中用虚拟对象替代外部真实组件并预先编排固定返回值的测试技术。
:::

---

## 6. 面向开发者的提示词工程（Prompt Engineering）

提示词输入过于宽泛模糊会导致 AI 产出代码不可用或产生错误。**软件工程中需求决定实现，提示词工程中输入质量决定代码产出**。

### 6.1 高效提示词的设计法则

| 原则 | 正确示范 (Do) | 错误示范 (Don't) |
| :--- | :--- | :--- |
| **动词清晰，明确输入输出** | `// Create a GET endpoint returning Page<BookDTO> with Pageable` | `// Write some book api` |
| **携带领域限制与边界** | `// Method to find books by price less than given threshold, sorted by title asc` | `// Find books` |
| **保持单次意图聚焦** | 先让 AI 编写核心逻辑，再要求补充安全校验 | 一口气输入“写个既安全又快速支持所有支付且有容错的代码” |
| **善用局部代码作为锚点** | 给出入参和返回类型的空方法签名，让 AI 填空方法体 | 在空无一物的文件里漫无目的尝试 |

### 6.2 常用 Copilot Chat 提示词模板

#### 1. 复杂异常定向排查
> “我在对 `OrderDTO` 进行反序列化时抛出 `Cannot deserialize value of type java.time.LocalDate from String` 异常。请分析根因，并给出符合 ISO-8601 标准的 Jackson 注解修复方案。”

#### 2. 代码防御性重构
> “请对当前选中的 `updateInventoryStock` 方法进行重构，增加严格的 Null 校验与负库存越界判断，并在遇到并发扣减时抛出具有明确业务含义的自定义异常。”

#### 3. 规范化生产级 JavaDoc
> “为选中的 Service 接口方法生成严格符合规范的 JavaDoc 注释，包含业务行为描述、所有 `@param` 的物理含义及 `@throws` 业务异常场景。”

:::en
> **Original**: Effective prompt engineering grounds generative LLMs by anchoring explicit input/output constraints, boundary conditions, and domain types within localized prompts.

**📌 核心术语与语境解析**：
- **Prompt Engineering** [prɒmpt ˌendʒɪˈnɪərɪŋ]：*提示词工程*。通过系统化组织上下文、限定条件与指令引导模型输出高质量确定性结果的技巧。
- **Boundary Condition** [ˈbaʊndri kənˈdɪʃn]：*边界条件*。数据结构或业务逻辑运行在极值（如 null、空集合、负数、越界）时的状态约束。
:::

---

## 7. 工程级安全防线：AI 结对编程的信任边界与风控

生成式 AI 展现出高生产力，但软件工程师必须恪守核心红线：**永远将 AI 视为一名初级开发者（The Junior Developer Rule）**。

### 7.1 初级开发者法则（The Junior Developer Rule）

AI 产出的代码本质上是基于代码标记预测的“概率最大串”，缺乏对系统底层真实业务状态与企业安全红线的自主感知。在采纳或合并 AI 代码之前，反问自己三个问题：
1. 这段代码的逻辑是否完全符合业务预期？
2. 它是否遵循了微服务架构的分层契约与统一异常处理规范？
3. 如果这是团队初级实习生提交的 Pull Request，能在 Code Review 中确认合并吗？

### 7.2 信任边界矩阵

```text
                ┌─────────────────────────────────────────┐
                │          AI 生成代码的工程信任矩阵       │
                └────────────────────┬────────────────────┘
                                     │
         ┌───────────────────────────┴───────────────────────────┐
         ▼                                                       ▼
┌──────────────────────────────┐        ┌──────────────────────────────┐
│     可高置信度托管给 AI      │        │       必须人工严格把关       │
├──────────────────────────────┤        ├──────────────────────────────┤
│ • 标准 DTO / Record 声明     │        │ • 用户鉴权与角色权限判定    │
│ • 通用 Getter / Setter / 构造│        │ • 密码加盐哈希与脱敏防泄漏  │
│ • 标准 JPA 衍生方法名声明    │        │ • 核心金融结算与库存扣减并发│
│ • 单元测试用例结构骨架       │        │ • 跨服务分布式事务与补偿机制│
│ • Swagger / OpenAPI 文档注释 │        │ • 输入参数全量校验与 SQL 注入│
└──────────────────────────────┘        └──────────────────────────────┘
```

### 7.3 常见安全反模式（Red Flags）及拦截

必须警惕 AI 在安全和边界处理上的盲区：

1. **缺失防御性输入校验**：
   AI 常生成快乐路径（Happy Path）代码：
   ```java
   public User findUser(String username) {
       return userRepository.findByUsername(username);
   }
   ```
   **人工审查必须补充**：严格拦截空串、非法控制字符与长度超限：
   ```java
   public User findUser(String username) {
       if (username == null || username.isBlank() || username.length() > 50) {
           throw new InvalidParameterException("Username parameter is invalid");
       }
       return userRepository.findByUsername(username)
           .orElseThrow(() -> new UserNotFoundException("User not found: " + username));
   }
   ```

2. **过于宽松的请求匹配**：
   AI 有时会建议 `@RequestMapping("/*")` 或无序的 CORS 放行，这类隐患必须在代码审查中消除。

3. **幻觉与过时 API**：
   在大版本跃迁时（例如从 Spring Security 5 跃迁至 6/7，或 Spring Boot 3 升级至 4），AI 可能给出已被标记废弃（`@Deprecated`）的方法甚至不存在的配置项。必须以官方最新文档与本地编译器检查为准。

:::en
> **Original**: Treating AI assistants under the 'Junior Developer Rule' enforces mandatory human-in-the-loop verification, mitigating hallucinated APIs, overly permissive security scopes, and unhandled edge cases.

**📌 核心术语与语境解析**：
- **Junior Developer Rule** [ˈdʒuːniə dɪˈveləpə ruːl]：*初级开发者法则*。工程治理原则：将模型输出视同初级工程师提交的未测试代码，施加严格的代码审查与静态分析。
- **Hallucination** [həˌluːsɪˈneɪʃn]：*幻觉*。大模型生成表面语法自洽但实际不存在的类库、方法签名或配置参数的现象。
:::
