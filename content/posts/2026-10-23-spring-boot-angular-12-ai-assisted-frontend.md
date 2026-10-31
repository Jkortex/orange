---
title: Spring Boot & Angular 全栈实战（十二）：前端 AI 辅助开发规范与指令调优
date: 2026-10-23T00:12:00Z
description: 建立前端 AI 研发规范库，配置针对 Angular Material、Reactive Forms 与 Vitest 测试的专属 instruction 文件，实现可控可复用的代码生成。
category: fullstack
column: spring-boot-angular
tags:
  - AI辅助开发
  - Angular
  - GitHub Copilot
  - 前端工程化
---

## 1. 前端 AI 辅助开发模式决策矩阵

| 工作模式 | 核心定位 | 典型应用场景 | 交互界面与控制粒度 | 风险与架构防御策略 |
| :--- | :--- | :--- | :--- | :--- |
| **Ask 模式** | 技术顾问与概念答疑 | 框架特性版本验证、CLI 参数查询、A11y 准则咨询 | 侧边栏对话；无代码侵入，纯文本/代码块输出 | 校验生成代码的时效性，防止混入旧版 NgModule 模式 |
| **Edit 模式** | 行内定向重构与微调 | 模板 A11y 增强、表单校验规则微调、局部 CSS 优化 | `Cmd + I` 行内浮层；精确到行级 Diff 审查 | 严控选中代码上下文边界，禁止跨方法大面积重写 |
| **Agent 模式** | 跨文件脚手架与用例扩增 | 单元测试边界用例合成、复杂 Mock 数据生成、DTO 骨架 | 自动化任务面板；支持多文件遍历与编辑 | 禁止用于核心领域架构推演，必须配合强类型约束 |
| **持久化规范 (Instructions)** | 全局思维护栏与契约注入 | 团队代码风格对齐、框架弃用 API 屏蔽、测试模板锁定 | `.github/instructions/*.md` 文件自动检索 | 避免单文件过长，按领域解耦为独立指令模块 |

## 2. 持久化指令规范配置范式

通过分层 Markdown 规范文件将工程约束持久化注入到 IDE 的上下文中：

### 全局规范入口 (`.github/copilot-instructions.md`)

```markdown
# Bookstore 前端工程全局 AI 研发规范

## 1. 核心框架与语法基线
- 严格遵循 Angular 22 与 TypeScript 5.8+ 规范。
- 严禁生成任何 `@NgModule`、`*ngIf`、`*ngFor`、`*ngSwitch` 代码。
- 所有组件必须为 Standalone 独立组件。
- 模板必须使用原生块级控制流：`@if`、`@for (track item.id)`、`@switch`。
- 组件输入输出必须使用 `input()` 与 `output()` 信号函数，严禁使用 `@Input()` 与 `@Output()` 装饰器。
- 依赖注入统一使用函数式 `inject()`，禁止在构造函数中堆砌注入参数。

## 2. 测试规范
- 单元测试运行在 Vitest 体系下，严禁引入 Jasmine 或 Karma 依赖。
- 异步断言优先使用 `await fixture.whenStable()`。
- 依赖 Mock 统一采用 Vitest 原生 API（`vi.fn()` / `vi.spyOn()`）。
```

### 响应式表单指令 (`.github/instructions/forms.instructions.md`)

```markdown
# 响应式表单指令集 (Reactive Forms Instructions)

- 统一使用 `NonNullableFormBuilder`（`fb.nonNullable.group()`）。
- 控件默认必须设置 `nonNullable: true`，杜绝不必要的 `null` 类型污染。
- 提取完整提交载荷必须使用 `form.getRawValue()`，防止处于禁用状态的字段被遗漏。
- 异步校验器必须配置 `updateOn: 'blur'`，严禁在击键事件中直接发起网络请求。
```

## 3. Agent 模式测试生成生产范式

借助明确的指令规范，利用 Agent 模式自动合成覆盖数据渲染、用户交互、事件发射与空状态的 Vitest 测试用例：

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BookList } from './book-list';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('BookList Component - Integration Tests', () => {
  let component: BookList;
  let fixture: ComponentFixture<BookList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BookList], // Standalone 独立组件直接导入
    }).compileComponents();

    fixture = TestBed.createComponent(BookList);
    component = fixture.componentInstance;
  });

  it('表格行数应与注入的图书数据集长度严格一致', async () => {
    fixture.componentRef.setInput('books', [
      { id: 1, title: 'Clean Architecture', authorName: 'Robert C. Martin', price: 34.99, published: '2017-09-20', isbn: '978-0134494166', genre: 'Architecture' },
      { id: 2, title: 'Designing Data-Intensive Applications', authorName: 'Martin Kleppmann', price: 45.00, published: '2017-03-16', isbn: '978-1449373320', genre: 'Distributed Systems' }
    ]);
    await fixture.whenStable();

    const rows = fixture.debugElement.queryAll(By.css('tr.clickable-row'));
    expect(rows.length).toBe(2);
  });

  it('点击操作按钮应触发 Output 信号发射对应图书主键', async () => {
    const selectSpy = vi.fn();
    component.bookSelected.subscribe(selectSpy);

    const testBook = { id: 1, title: 'Refactoring', authorName: 'Martin Fowler', price: 39.99, published: '2018-11-20', isbn: '978-0134757599', genre: 'Software Engineering' };
    fixture.componentRef.setInput('books', [testBook]);
    await fixture.whenStable();

    const selectBtn = fixture.debugElement.query(By.css('button[aria-label="选择图书"]'));
    selectBtn.triggerEventHandler('click', new MouseEvent('click'));
    await fixture.whenStable();

    expect(selectSpy).toHaveBeenCalledWith(testBook);
  });

  it('当图书数据为空时能够稳定展示空占位区域', async () => {
    fixture.componentRef.setInput('books', []);
    await fixture.whenStable();

    const rows = fixture.debugElement.queryAll(By.css('tr.clickable-row'));
    expect(rows.length).toBe(0);
  });
});
```

## 4. 前端 AI 辅助工程避坑清单 (Do's & Don'ts)

| 错误实践 (Don't) | 正确实践 (Do) |
| :--- | :--- |
| 依赖无上下文的即兴提示词（ad-hoc prompts）让 AI 直接生成完整业务组件。 | 建立版本化的 `.github/instructions/*.md` 指令库，将架构决策固化为模型提示词上下文。 |
| 放任 AI 按照过时训练数据生成带有 `NgModule`、`*ngFor` 或混用 Zone.js 的代码。 | 在全局提示词中显式设置弃用黑名单，强制要求 Standalone、原生控制流与 Signals 原语。 |
| 盲目接受 Agent 模式一键生成的代码而不经过类型核验与断言审查。 | 严格限制 Agent 仅用于边界测试用例扩增与 Mock 数据构造，核心领域逻辑实施严格 Code Review。 |
| 使用模糊、情绪化或宽泛的提示词（如“请让这个表单看起来更现代更酷”）。 | 给出明确的技术维度（如“基于 `MatFormField` 补齐 `mat-error`，并在失焦时展示校验提示”）。 |

<!-- split -->

# 原著完整参考：第 12 章 准备 AI 辅助前端开发（Preparing for AI-Assisted Frontend Development）

在上一章中，我们为 Angular 应用程序搭建了具备高可扩展性的项目结构，利用 Angular Material 和基于 Signal 的响应式机制实现了核心组件，并使用 Vitest 配置了测试基础底座。现在，我们准备为应用程序引入更高级的特性和面向真实场景的功能。

在*第 3 章*中，我们全面探索了 AI 开发助手，对比了 Cursor、Claude 和 GitHub Copilot 等工具，并确立了跨越后端与前端语境的 AI 辅助开发最佳实践。我们在 VS Code 中配置了 GitHub Copilot，学习了提示词工程（Prompt Engineering）基础，并探讨了何时该信任 AI 生成的代码，何时又该进行批判性审查。现在，我们将在该基础之上，专门将这些原则应用到我们的 Angular 前端开发工作流中。

本章重点探讨如何在 Angular 应用程序架构的上下文中充分利用 GitHub Copilot 的各项能力。我们将创建专属于 Angular 的指令文件（instruction files），指导 Copilot 生成与既定规范契合的代码；探索 Copilot 的三种模式（Ask 模式、Edit 模式和 Agent 模式）分别如何适用于前端开发场景；并展示在维护精心设计的架构完整性的同时，扩充测试覆盖率的实用技巧。

在本章中，我们将涵盖以下主题：

- 建立 AI 辅助 Angular 开发的最佳实践
- 深入理解 Copilot 的三种主要操作模式

> **注意**
>
> 本章中的部分图片在书中可能略显不易阅读。我们保留了这些截图，因为它们反映了真实的软件界面，有助于你在自己的屏幕上对照操作。你也可以在随书附带的*图形包（Graphics Bundle）*中查看并放大所有图片，其下载链接已在*前言（Preface）*中提供。

## 技术要求

本章的完整源代码可在此处获取：`https://github.com/PacktPublishing/Spring-Boot-and-Angular-2E_Frontend/tree/main/chapter-12`

> **提示**
>
> 在深入研究具体的 AI 辅助技巧之前，必须认识到：高效的 AI 辅助开发始于清晰的沟通和恰当的上下文。再强大的 AI 工具，其有效性也完全取决于我们提出的问题以及我们对问题的定义。

## 建立 AI 辅助 Angular 开发的最佳实践

在 Angular 项目基石已经奠定且核心组件就位之后，现在是时候让代码库为 AI 辅助开发做好准备了，这可以极大加速我们工作流中的各项任务。正如在*第 3 章*中所讨论的，高效的 AI 辅助开发需要清晰的项目上下文和界定明确的规范指南。具体到 Angular 开发，这意味着需要创建**指令文件（instruction files）**，以确保 AI 辅助在增强我们工作效率的同时，绝不会破坏我们精心设计的响应式表单架构、组件范式和测试策略。

### 为 AI 工具配置项目上下文

基于*第 3 章*中介绍的指令文件概念，我们现在将创建专属于 Angular 的指令文件，为 GitHub Copilot 提供有关项目前端架构和编码规范的详细上下文。虽然*第 3 章*确立了使用指令文件引导 AI 工具的一般原则，但我们的 Angular 应用程序还需要针对响应式表单、Angular Material 实现、基于 Signal 的响应式机制以及 Vitest 测试范式的专属指导。这些指令文件扮演着持久化知识库的角色，指引 AI 工具生成符合项目特定约定的代码，而非依赖泛化的常见模板。

Angular 在这方面为我们提供了良好的开端。当我们在*第 11 章*生成项目时，CLI 已经自动创建了一个 `.github/copilot-instructions.md` 文件，其中包含合理的默认设置，覆盖了 TypeScript 最佳实践、Angular 规范和编码标准。我们将在此基础之上扩展，针对应用架构、表单、Material 组件以及测试范式添加项目专属的指令文件。

以下是我们即将搭建的完整指令文件结构：

```
├── .github/
│   ├── copilot-instructions.md
│   └── instructions/
│       ├── angular-material.instructions.md
│       ├── architecture.instructions.md
│       ├── forms.instructions.md
│       └── unit-testing.instructions.md
```

以下是这些指令文件的功能概览：

- `.github/copilot-instructions.md`：这个由 CLI 自动生成的文件已经覆盖了相当广泛的 Angular 规范：以独立组件（Standalone Components）为默认标准、基于 Signal 的状态管理、`OnPush` 变更检测策略、原生控制流语法以及 `inject()` 函数。我们无需重复或覆盖这些默认配置，而是通过项目专属的指令文件来对其进行补充，涵盖 CLI 生成文件未涉及的领域——即我们的架构决策、表单模式、Material 组件用法以及测试规范。

> **注意**
>
> `.github/instructions/angular-material.instructions.md`：在此我们定义了具体使用的 Angular Material 组件、它们的配置模式、常见 import 导入语句、样式处理方案以及无障碍（accessibility / a11y）要求。这确保了在所有表单和组件中都能保持一致的 Material Design 设计规范实现。

> **注意**
>
> `.github/instructions/architecture.instructions.md`：此文件包含详细的架构设计原则，包括组件结构模式、目录组织规则和文件命名约定。它明确界定了 Smart 组件（负责处理业务逻辑的页面级容器组件）与 Dumb 组件（纯展示型组件）之间的区别，以及功能特性模块（features）与共享工具库（shared utilities）的预期目录结构。

> **注意**
>
> `.github/instructions/forms.instructions.md`：提供有关响应式表单开发范式的全面指南，包括使用 FormBuilder 构建表单结构、内置与自定义校验器的验证模式、保证 HTML 结构一致性的模板规范、错误处理方案以及表单提交工作流。该文件可确保所有由 AI 生成的表单均严格遵循我们在注册表单中确立的规范。

> **注意**
>
> `.github/instructions/unit-testing.instructions.md`：确立了在 Angular 中基于 Vitest 进行单元测试的标准，涵盖带有 TestBed 配置的独立组件测试模式、利用现代 Angular API 进行基于 Signal 的 input/output 测试、带有兜底策略的 Angular Material 组件测试、基于 Vitest 语法的间谍函数（spy）实现、带有 HTTP 模拟的服务测试、空状态等边缘用例处理、事件发射验证、无障碍测试模式，以及常见测试疑难解答指南。

> **注意**
>
> 所有指令文件的完整内容均可在 GitHub 仓库中获取。这些文件提供了详细的规范说明和代码示例，指导 Copilot 生成符合我们项目既定范式的一致、高质量代码。虽然你可以直接将这些指令文件复制到自己的项目中快速起步，但*请将它们视为鲜活的演进文档，需要随你的开发实践以及更广泛的 Angular 生态系统共同演进*。例如，当 Vitest 中出现新的测试范式、Angular Material 发布了更新后的组件，或者你的团队摸索出了更高效的架构方案时，请相应更新这些指令文件，以确保 AI 生成的代码始终反映当前最新的最佳实践，而非过时的旧模式。
>
> 指令文件目录链接如下：
> `https://github.com/PacktPublishing/Spring-Boot-and-Angular-2E_Frontend/tree/main/.github`

### 将第 3 章的最佳实践应用于 Angular 开发

*第 3 章*中建立的代码质量指南与信任框架直接适用于我们的 Angular 开发。在处理 AI 生成的 Angular 代码时，需要重点关注以下几点：

- **类型安全（Type Safety）**：充分利用 TypeScript 接口以及 Angular 的严格模式（strict mode）来约束表单和服务。
- **响应式范式（Reactive Patterns）**：确保 AI 生成的代码正确使用 Signal、Observable 和响应式表单。
- **规范一致性（Pattern Consistency）**：以我们确立的组件架构和目录结构为基准参照。AI 生成的组件应当遵循相同的结构、命名约定与导入规范。
- **审查与精炼（Review and Refine）**：应将 AI 生成的代码视为起点而非终局方案。始终审查边缘场景、无障碍（a11y）考量以及性能优化空间。
- **增量式开发（Incremental Development）**：将复杂表单拆解为更小、更易管理的单元。例如，分块单独生成表单各小节，而不是一次性生成整个庞大复杂的表单。
- **测试质量（Test Quality）**：正如*第 3 章*测试指南所述，审查 AI 生成的测试用例是否包含除基础实例化断言之外的有意义断言。

正如在*第 3 章*中所强调的，AI 辅助开发取得成功的关键在于明确何时进行自动化生成，何时由人工审慎地制定架构决策。

现在我们已经确立了 Angular 项目的架构基础（组件结构、路由体系、测试基础设施），我们可以战略性地利用 AI 辅助来加速重复性的开发任务，同时保留定义应用程序结构的关键设计决策。GitHub Copilot 的三种操作模式——Ask 模式、Edit 模式和 Agent 模式——在这种权衡取舍的方法中各自发挥着独特的功用。

## 深入理解 Copilot 的三种主要操作模式

正如*第 3 章*所介绍的，GitHub Copilot 提供了三种各具特色的操作模式，用以满足不同的开发需求。虽然*第 3 章*已经对这些模式进行了演示，但本节将专门探讨每种模式如何增强 Angular 的开发工作流。我们将深入探索利用这些模式进行组件开发、表单实现和测试扩充的实际前端场景。

### 使用 Ask 模式理解命令

如*第 3 章*所述，**Ask 模式**就像内置于开发环境中的智能编程导师。具体到 Angular 开发，Ask 模式非常擅长阐释 Angular CLI 命令、解释框架特有概念（如 Signal 和响应式表单），以及提供有关 Angular Material 组件用法的指导。

例如，当开始接触 Angular CLI 时，你可能会遇到一些不熟悉的命令。Copilot 的 Ask 模式是快速弄清这些命令的绝佳途径。

不妨尝试以下操作：

1. 打开命令面板（⇧ + *⌘* + *P* 或 *Ctrl* + *Shift* + *P*）
2. 输入 `Ask` 并选择 **Chat: Open chat (Ask)**

> **注意**
>
> 提问：`What does ng generate component do?` 或 `Explain the Angular CLI command for generating a service.`

你将在编辑器内部直接获得自然语言解答，非常适合在开发过程中随时学习。

![利用 Copilot 的 Ask 模式](/media/posts/spring-boot-angular/img-09073.png)

*图 12.1：利用 Copilot 的 Ask 模式*

注意，此处 Copilot 给出的回答仍然使用了较旧的 `.component.ts` 文件命名方式。自 Angular v20 起，CLI 默认生成 `book-list.ts` 和 `book-list.html`，不再包含 `.component` 中缀。这是一个绝佳的例证，说明为何必须根据实际使用的框架版本对 AI 生成的回答进行核对。

### 使用 Edit 模式改进代码片段

正如*第 3 章*所介绍的，Edit 模式就像一把针对代码进行精准精炼的手术刀。在 Angular 开发中，该模式在优化组件模板、完善响应式表单验证逻辑以及增强 Material UI 实现的无障碍特性（accessibility）方面显得尤为宝贵。

对于我们的 Angular 应用程序而言，**Edit 模式**在结合所选前端代码上下文时表现最佳，它能够提供符合 Angular 最佳实践、TypeScript 规范以及现代开发范式的修改建议。其核心优势在于能够在不要求我们重写整个组件或重构既定模式的前提下，进行增量式的改进以提高代码质量。

例如，在开发 book-list 组件或为页头编写样式时，我们可能希望微调标记语言或 TypeScript 逻辑。只需高亮选中一段代码，按下 *Cmd* + *I* 或 *Ctrl* + *I*，然后输入类似 `Improve accessibility for this button`（提升该按钮的无障碍特性）的提示词。

Copilot 将根据你的提示词，直接在编辑器内部提供智能替换方案。

![利用 Copilot 的 Edit 模式](/media/posts/spring-boot-angular/img-09075.png)

*图 12.2：利用 Copilot 的 Edit 模式*

### 使用 Agent 模式扩充数据或添加特性

如*第 3 章*所述，Agent 模式代表了 Copilot 最强大的生成能力。在 Angular 开发中，我们将 Agent 模式主要用于扩充既有功能、生成 Mock 测试数据、搭建重复性的组件骨架以及扩增测试覆盖率。这种审慎克制的使用方式契合*第 3 章*的指导原则，即将 Agent 模式作为辅助手段，而非让其主导架构决策。

例如：

1. 打开命令面板（⇧ + *⌘* + *P* 或 *Ctrl* + *Shift* + *P*）
2. 输入 `Agent` 并选择 **Chat: Open chat (Agent)**
3. 选中 `List` 组件中的 `books` 数组

> **注意**
>
> 输入：`Add three more realistic books to this array using different genres and authors`

Copilot 将立即插入额外的数据，在节省时间的同时让你把精力集中在更关键的决策上。

![利用 Copilot 的 Agent 模式](/media/posts/spring-boot-angular/img-09077.png)

*图 12.3：利用 Copilot 的 Agent 模式*

> **注意**
>
> 在项目的这一早期阶段，我们建议*避免过度使用 Agent 模式*。最好先通过人工手动方式定义你的架构与结构，以便深入理解各个部分是如何紧密协同工作的。

### 使用 Agent 模式扩充测试覆盖率

在*第 11 章*中，我们建立了基于 Vitest 的测试基础，为 `App` 和 `BookList` 组件编写了基础的组件实例化测试。虽然这些测试验证了组件能够在无报错的情况下正常创建，但它们仅仅触及了完备测试所应覆盖内容的皮毛。既然我们已经探索了 GitHub Copilot 的 **Agent 模式**能力，现在是时候利用 AI 辅助来快速扩充我们的测试覆盖率，补充更有意义且更详尽的测试用例了。

一旦我们确立了架构基石，Agent 模式便在生成重复性测试模式方面表现优异。与其手动编写数十个类似的测试用例，不如借助 AI 生成能够覆盖各种业务场景、边界用例和用户交互的完备测试套件。这种策略使我们能够将人工精力聚焦于复杂业务逻辑的测试上，同时将标准组件行为测试的编写交由自动化完成。

让我们从扩充 `BookList` 组件的测试套件开始：

1. 选中既有的测试文件内容（`book-list.spec.ts`）
2. 打开命令面板（⇧ + *⌘* + *P* 或 *Ctrl* + *Shift* + *P*）
3. 输入 `Agent` 并选择 **Chat: Open chat (Agent)**
4. 输入以下提示词：

```text
Expand this test suite to include comprehensive tests for:
- Rendering book data in the mat-table
- Click interactions for edit and delete buttons
- Output event emission when methods are called
- Empty state handling when books array is empty
- Currency pipe formatting for price column
- Accessibility attributes for table elements

Use realistic test data and follow Angular testing best practices with
proper mocking and spy functions.
```

Agent 将分析现有的测试结构，并根据我们的提示词生成一个完备的测试套件，如下方截图所示。

![使用 Agent 模式扩充测试覆盖率](/media/posts/spring-boot-angular/img-09079.png)

*图 12.4：使用 Agent 模式扩充测试覆盖率*

在深入探索了 Copilot 的三种模式如何具体应用于 Angular 开发之后，我们可以清晰地看到*第 3 章*所确立的 AI 辅助开发原则的实用价值。我们创建的指令文件确保了规范的一致性，而对 Ask、Edit 和 Agent 模式克制而有纪律的使用，则印证了前文强调的权衡法则：利用 AI 处理重复范式和测试生成，同时牢牢保持人工对架构决策的掌控权。这套将*第 3 章*的通用准则与 Angular 专属规范融为一体的框架体系，使我们能够在不牺牲代码质量或长期可维护性的前提下，实现功能的快速迭代开发。

## 本章小结

在本章中，你将*第 3 章*中的 AI 辅助开发原则成功应用到了 Angular 前端工作流中。你创建了完备的 Angular 专属指令文件，指导 GitHub Copilot 生成契合响应式表单架构、组件范式和测试策略的代码。你学会了战略性地运用 Copilot 的三种模式：利用 Ask 模式进行 Angular CLI 命令和框架概念答疑，利用 Edit 模式精炼组件与模板代码，并有选择地利用 Agent 模式扩充测试覆盖率。最重要的是，你建立了一套严谨自律的 AI 辅助开发方法，在提升生产力与维护前几章精心构建的架构完整性之间取得了平衡，确保 AI 工具在放大开发能力的同时，绝不损害代码质量与长期可维护性。

随着 AI 辅助 Angular 开发工作流的确立，以及指导一致代码生成的指令文件就位，你已准备好迎接用户输入处理的挑战。在下一章中，我们将深入探索 Angular 表单系统，你将了解模板驱动表单与响应式表单之间的差异，掌握 `FormBuilder` 与校验器范式，并运用这些 AI 辅助技巧在恪守最佳实践的同时加速表单开发。
