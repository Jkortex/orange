---
title: Spring Boot & Angular 全栈实战（十一）：Angular 22 现代脚手架与独立组件架构
date: 2026-10-23T00:11:00Z
description: 深入 Angular 22 现代工程体系，落地纯 Standalone 架构、基于 Signals 的输入输出、Smart/Dumb 组件分层与 Vitest 现代测试框架。
category: fullstack
column: spring-boot-angular
tags:
  - Angular
  - Standalone
  - TypeScript
  - 前端架构
  - Vitest
---

## 1. 前端工程选型决策矩阵

| 技术维度 | 选型方案 | 传统/替代方案 | 决策依据与工程收益 |
| :--- | :--- | :--- | :--- |
| **组件组织范式** | **Standalone 独立组件** | NgModule 模块封装 | 消除中间层样板配置，实现细粒度组件自治与极致 Tree-shaking 剪枝 |
| **模板控制流** | **原生块级控制流 (`@if`, `@for`, `@switch`)** | 结构型指令 (`*ngIf`, `*ngFor`) | 编译器原生语法支持，严格类型推导，强制显式 `track` 优化 DOM 重排 |
| **组件通信机制** | **Signal-based `input()` / `output()`** | 装饰器 `@Input()` / `@Output()` | 细粒度响应式信号模型，只读类型安全，解耦 Zone.js 变更检测生命周期 |
| **依赖注入方式** | **函数式 `inject()` 注入** | 构造函数参数注入 | 允许在字段声明处即时初始化，简化派生类 `super()` 参数传递 |
| **单元测试体系** | **Vitest 现代测试套件** | Karma + Jasmine | 原生 ESM 解析与 Vite 极速 HMR，测试执行与冷启动速度提升 5~10 倍 |
| **变更检测模型** | **Zoneless (无 Zone.js) 调度** | Zone.js 全局事件拦截 | 依托 Signals 精确派发局部 DOM 刷新，消除不可预测的全局脏检查开销 |

## 2. Feature-First 生产级工程拓扑

大型企业级前端项目遵循按业务特性垂直切分（Feature-First）原则，保持业务域高内聚与跨层级单向依赖：

```text
src/
├── app/
│   ├── features/               # 业务特性层（按垂直领域边界划分）
│   │   ├── books/              # 图书目录与管理特性
│   │   │   ├── pages/          # Smart 容器页面（协调路由与服务状态）
│   │   │   ├── components/     # 特性专属 Dumb 展示组件（纯输入输出驱动）
│   │   │   └── books.routes.ts # 特性专属子路由配置
│   │   ├── auth/               # 认证与用户特性
│   │   └── orders/             # 订单特性
│   ├── shared/                 # 跨特性通用层（纯 Dumb 组件、通用模型、管道）
│   │   ├── layout/             # 布局骨架（Header, Footer, Navigation）
│   │   └── models/             # 契约模型（严格对齐后端 DTO 接口）
│   ├── core/                   # 全局单例基础设施（HTTP 拦截器、Guard、Store）
│   │   └── services/           # 全局单例服务
│   ├── app.ts                  # 根组件（自包含 Standalone）
│   ├── app.routes.ts           # 顶层懒加载路由配置
│   └── app.config.ts           # 全局 Providers 与运行时配置
```

## 3. Smart/Dumb 响应式组件生产范式

### 契约模型定义 (`shared/models/book.ts`)

```typescript
export interface Book {
  title: string;
  authorName: string;
  genre: string;
  price: number;
  published: string;
  isbn: string;
  description?: string;
  pageCount?: number;
  coverImageUrl?: string;
}
```

### Dumb 展示组件 (`book-list.ts`)

```typescript
import { Component, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Book } from '../../../../shared/models/book';

@Component({
  selector: 'book-list',
  standalone: true,
  imports: [CurrencyPipe, MatTableModule, MatIconModule, MatButtonModule],
  template: `
    <table mat-table [dataSource]="books()" class="mat-elevation-z2 full-width-table">
      <ng-container matColumnDef="title">
        <th mat-header-cell *matHeaderCellDef>书名</th>
        <td mat-cell *matCellDef="let book">{{ book.title }}</td>
      </ng-container>

      <ng-container matColumnDef="authorName">
        <th mat-header-cell *matHeaderCellDef>作者</th>
        <td mat-cell *matCellDef="let book">{{ book.authorName }}</td>
      </ng-container>

      <ng-container matColumnDef="genre">
        <th mat-header-cell *matHeaderCellDef>分类</th>
        <td mat-cell *matCellDef="let book">{{ book.genre }}</td>
      </ng-container>

      <ng-container matColumnDef="price">
        <th mat-header-cell *matHeaderCellDef>定价</th>
        <td mat-cell *matCellDef="let book">{{ book.price | currency:'USD':'symbol':'1.2-2' }}</td>
      </ng-container>

      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef>操作</th>
        <td mat-cell *matCellDef="let book">
          <button mat-icon-button color="primary" (click)="onSelect(book, $event)" aria-label="选择图书">
            <mat-icon>visibility</mat-icon>
          </button>
        </td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
      <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="clickable-row"></tr>
    </table>
  `,
  styles: [`
    .full-width-table { width: 100%; }
    .clickable-row:hover { background-color: rgba(0, 0, 0, 0.04); cursor: pointer; }
  `]
})
export class BookList {
  // 强类型 Signal-based Input 与 Output
  readonly books = input<Book[]>([]);
  readonly bookSelected = output<Book>();

  readonly displayedColumns: string[] = ['title', 'authorName', 'genre', 'price', 'actions'];

  onSelect(book: Book, event: MouseEvent): void {
    event.stopPropagation();
    this.bookSelected.emit(book);
  }
}
```

### Smart 容器组件 (`list.ts`)

```typescript
import { Component, signal } from '@angular/core';
import { Book } from '../../../../shared/models/book';
import { BookList } from '../../components/book-list/book-list';

@Component({
  selector: 'books-list-page',
  standalone: true,
  imports: [BookList],
  template: `
    <section class="page-container p-4">
      <h2 class="text-xl font-bold mb-4">图书资源总览</h2>
      <book-list
        [books]="books()"
        (bookSelected)="handleBookSelection($event)"
      />
    </section>
  `
})
export class BooksListPage {
  readonly books = signal<Book[]>([
    {
      title: 'Designing Data-Intensive Applications',
      authorName: 'Martin Kleppmann',
      genre: 'Distributed Systems',
      price: 49.99,
      published: '2017-03-16',
      isbn: '978-1449373320'
    }
  ]);

  handleBookSelection(book: Book): void {
    console.log('[Audit] 用户选中图书:', book.isbn, book.title);
  }
}
```

## 4. Vitest 与 Zoneless 自动化测试范式

在 Zoneless 架构下，变更检测基于微任务调度，测试通过 `await fixture.whenStable()` 确保状态稳定收敛：

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BookList } from './book-list';
import { Book } from '../../../../shared/models/book';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('BookList Component (Dumb)', () => {
  let component: BookList;
  let fixture: ComponentFixture<BookList>;

  const mockBooks: Book[] = [
    {
      title: 'Clean Architecture',
      authorName: 'Robert C. Martin',
      genre: 'Architecture',
      price: 34.99,
      published: '2017-09-20',
      isbn: '978-0134494166'
    }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BookList]
    }).compileComponents();

    fixture = TestBed.createComponent(BookList);
    component = fixture.componentInstance;
  });

  it('应该成功实例化组件并在无数据时稳定渲染', async () => {
    await fixture.whenStable();
    expect(component).toBeTruthy();
  });

  it('设置 Signal Input 后能够驱动视图刷新并同步信号状态', async () => {
    // 使用 componentRef.setInput 设置响应式输入信号
    fixture.componentRef.setInput('books', mockBooks);
    await fixture.whenStable();

    expect(component.books()).toEqual(mockBooks);
    expect(component.books().length).toBe(1);
  });

  it('触发操作按钮点击应通过 Output 信号正确发射目标对象', async () => {
    const selectSpy = vi.fn();
    component.bookSelected.subscribe(selectSpy);

    fixture.componentRef.setInput('books', mockBooks);
    await fixture.whenStable();

    component.onSelect(mockBooks[0], new MouseEvent('click'));
    await fixture.whenStable();

    expect(selectSpy).toHaveBeenCalledWith(mockBooks[0]);
  });
});
```

## 5. 前端架构避坑清单 (Do's & Don'ts)

| 错误实践 (Don't) | 正确实践 (Do) |
| :--- | :--- |
| 创建集中式的 `SharedModule` 或 `MaterialModule` 全量打包所有组件。 | 在每个独立组件中仅按需引入模板直接消费的 Material 模块或组件，保障 Tree-shaking 最小产物。 |
| 在原生 `@for` 循环中使用易变的 `$index` 作为强制 `track` 标识。 | 强制使用稳定的领域唯一主键（如 `track book.isbn`），避免列表变更时的全量 DOM 销毁重建。 |
| 在 Zoneless 测试中依旧频繁手动调用 `fixture.detectChanges()` 轮询脏检查。 | 使用 `await fixture.whenStable()` 挂起断言，等待 Signals 响应式调度器微任务自然收敛。 |
| 在 Dumb 展示组件内部通过注入服务直接发起 HTTP 请求或改变全局 Store。 | 严格保持展示组件无状态：仅通过 `input()` 获取展示数据，通过 `output()` 发射交互事件由 Smart 容器处理。 |
| 使用传统属性装饰器 `@Input()`、`@Output()` 编写混杂类型。 | 全面迁移至类型安全、基于 Signals 的 `input()`、`output()` 现代原生 API。 |

<!-- split -->

# 原著完整参考：第 11 章 搭建 Angular 项目与架构体系（Setting Up Our Angular Project and Architecture）

在上一章中，我们对 Spring Boot 后端进行了打包以用于生产部署。你了解了可执行 JAR 与容器镜像之间的区别、如何为微服务构建镜像，以及如何将它们推送到镜像仓库以便在各环境中保持一致运行。现在，是时候将注意力转向前端了。

在本章中，我们将使用 Angular 22 开始构建前端应用程序。我们将逐步完成项目创建、目录结构组织，并构建一个兼具可伸缩性与可维护性的架构体系。你还将亲自动手实践组件和路由等核心 Angular 概念，并充分利用 Angular 22 提供的现代增强特性，包括基于信号（Signals）的响应式体系，以及使用 `@if` 和 `@for` 的模板控制流语法。

无论你是从其他前端框架转向 Angular，还是复习巩固 Angular 技能，本章都将帮助你为前端架构打下良好规范的基础。

在本章中，我们将涵盖以下主题：

- 创建并配置 Angular 项目（Creating and configuring an Angular project）
- 探索我们将要使用的 Angular 特性（Exploring Angular features that we are going to use）
- 创建 Angular 目录结构（Creating the Angular folder structure）
- 添加 Angular Material 实现一致的 UI 设计（Adding Angular Material for consistent UI design）
- 使用 Vitest 搭建现代单元测试（Setting up modern unit testing with Vitest）
- 编写我们的第一个单元测试（Writing our first unit tests）

> **注意**
>
> 书中本章的部分插图在印刷版中可能略显紧凑。我们保留这些图片是因为它们反映了真实的软件界面，方便你在自己的屏幕上对照操作。你也可以在配套的 *Graphics Bundle*（图像包）中查看并放大所有插图，其下载链接已在*前言（Preface）*中提供。

## 技术要求（Technical requirements）

你需要在计算机上安装以下环境与工具：

- Node.js 24 LTS（版本 24.15.0 或更高版本）；同时也支持 Node 22.22.3+ 和 26+
- Angular CLI v22
- Git（可选，但推荐安装）
- 安装了 GitHub Copilot 扩展的 Visual Studio Code

本章源代码链接如下：

`https://github.com/PacktPublishing/Spring-Boot-and-Angular-2E_Frontend/tree/main/chapter-11`

## 创建并配置 Angular 项目（Creating and configuring an Angular project）

Angular 提供了一个强大的**命令行界面**（**CLI**），能够简化搭建流程并有助于保持一致的代码质量。在 Angular v22 中，CLI 变得对开发者更加友好，提供了更优的默认设置，并开箱即用地支持各种现代特性。以下步骤将指导你安装 Angular CLI，并在本地配置与启动你的 Angular 应用程序：

1. 要安装 Angular CLI，首先应确保计算机上已安装 Node.js（>= v24.15.0），然后执行 `npm install -g @angular/cli` 命令。
2. 命令执行完毕后，我们可以验证 Angular CLI 是否已成功安装。此时系统将拥有一个全局的 `ng` 命令，可用于检查已安装 CLI 的版本。

要检查版本，我们执行 `ng --version` 命令，将得到如下输出：

![图 11.1：安装的 Angular CLI 版本](/media/posts/spring-boot-angular/img-09047.png)

*图 11.1：安装的 Angular CLI 版本*

在上述输出中，执行 `ng --version` 命令后显示了我们机器上安装的 Angular CLI 版本。目前我们安装的是 Angular CLI 版本 22，这意味着一旦我们生成 Angular 项目脚手架，它就将基于版本 22。

3. 成功安装 Angular CLI 之后，我们就可以为项目执行多条命令了。以下是可以在 Angular CLI 中使用的一些常用命令：

- `ng new <project name> [options]`：创建或生成一个新的 Angular 项目脚手架。
- `ng serve <project> [options]`：构建并在本地服务器上运行 Angular 应用程序。
- `ng build <project> [options]`：将 Angular 应用程序编译输出到名为 `dist` 的输出目录中，用于生产环境部署。
- `ng test <project> [options]`：运行 Angular 项目中的单元测试。
- `ng generate <schematic> [options]`：使用特定的原理图（schematic，基于模板的代码生成器）生成并修改文件。

我们可以生成的部分常用原理图如下：

- Component（组件）
- Directive（指令）
- Guard（路由守卫）
- Interceptor（HTTP 拦截器）
- Service（服务）

> **提示**
>
> 以上仅是 Angular CLI 中最常用的一部分命令。关于完整的命令列表与选项，可查阅 Angular 官方文档：`https://angular.dev/tools/cli`。

现在我们了解了可以在 Angular CLI 中使用的命令。

4. 接下来，让我们在目标路径下执行 `ng new ng-bookstore` 命令来生成 Angular 项目。CLI 会提出几个配置问题，例如 *Which stylesheet format would you like to use?*（你想使用哪种样式表格式？）、*Do you want to enable Server-Side Rendering (SSR)?*（是否启用服务端渲染 SSR？）以及 *Which AI tools do you want to configure with Angular best practices?*（你想配置哪种遵循 Angular 最佳实践的 AI 工具？）。对于这些问题，我们分别选择 **Sass (SCSS)**、**Yes** 以及 **GitHub Copilot**，因为我们希望使用 SCSS 编写样式，启用**服务端渲染**（**SSR**），并在后续的开发过程中借助 **GitHub Copilot** 提供辅助。

![图 11.2：项目配置](/media/posts/spring-boot-angular/img-09048.png)

*图 11.2：项目配置*

完成此步后，CLI 将生成一个名为 `ng-bookstore` 的全新 Angular 项目脚手架，自动配置脚本、创建必要设置并下载项目的依赖包。脚手架生成完成后，我们可以在 VS Code 或你喜欢的任何 IDE 中打开 `ng-bookstore` 项目。我们将看到 Angular 应用已经配置就绪，随时可以在本地服务器上运行。

![图 11.3：脚手架生成后的目录结构与已安装依赖](/media/posts/spring-boot-angular/img-09050.png)

*图 11.3：脚手架生成后的目录结构与已安装依赖*

5. 要运行我们的项目，可以使用快捷键 *Ctrl* + *`* 打开 VS Code 终端并执行 `ng serve` 命令。我们也可以使用 `package.json` 文件中定义的脚本。在这种情况下，我们可以使用 `npm run start` 来运行应用。我们将在终端中看到 Angular 是否已在本地服务器上成功运行，如下图所示：

![图 11.4：npm run start 命令输出](/media/posts/spring-boot-angular/img-09052.png)

*图 11.4：npm run start 命令输出*

6. 成功启动 Angular 应用程序后，我们可以在浏览器中打开默认 URL（`http://localhost:4200`），此时将看到 Angular 项目的默认页面：

![图 11.5：Angular 默认页面](/media/posts/spring-boot-angular/img-09054.png)

*图 11.5：Angular 默认页面*

至此，我们已经在本地成功配置并启动了 Angular 应用程序。现在，让我们讨论构建和组织应用所需的核心概念。

## 探索我们将要使用的 Angular 特性（Exploring the Angular features we are going to use）

Angular 框架是一个基于组件的框架，允许我们开发可复用组件，以提升代码的复用性与可维护性。借助 Angular，组织前端应用程序的结构变得更加清晰、可预测且更具可扩展性。Angular 默认采用**独立组件**（**standalone components**），支持**基于信号的响应式体系**（**signal-based reactivity**），并引入了如 `@if` 和 `@for` 这样现代化的**控制流语法**（**control flow syntax**），这极大地改善了开发者体验与运行时性能。

在本节中，我们将全面介绍在后续代码库中将要使用的 Angular 核心基础特性。请牢记，本章的重点在于**客户端渲染**（**client-side rendering**）。我们将在*第 18 章*深入探讨**服务端渲染**（**SSR**）与**水合**（**hydration**）。

### 组件（Components）

**组件**（**Components**）是 Angular 中的主要构建块。它们负责定义视图的行为以及外观呈现。组件使用 `@Component` 装饰器进行注解，该装饰器指定了描述组件 HTML 模板、CSS 样式和选择器（selector）的多种元数据。

以下是生成组件的 CLI 命令：

```bash
ng generate component <component-name>
ng g c <component-name>
```

以下是一个组件的代码示例：

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class AppComponent {
  title = 'superheroes';
}
```

组件具备一项称为**数据绑定**（**data binding**）的特性，允许我们将数据传递至视图中。数据绑定可用于向用户显示数值、响应用户事件以及动态修改样式。Angular 的数据绑定分为两大类：

- 单向数据绑定（One-way binding）
- 双向数据绑定（Two-way binding）

### 单向数据绑定（One-way binding）

顾名思义，在单向绑定中数据仅朝单一方向流动。它可以从组件流向视图，也可以反过来从视图流向组件。

在 Angular 中实现单向绑定的方式有多种，其中最常见的两种是使用插值表达式（interpolation）和属性绑定（property binding）。

#### 插值表达式（Interpolation）

**插值表达式**（**Interpolation**）是一种单向绑定技术，允许我们在 HTML 中将表达式计算结果渲染为字符串字面量。插值在 HTML 代码中使用双花括号 `{{}}` 来包裹表达式。

让我们看一看下面的代码示例：

```html
// app.component.ts
export class AppComponent {
  title = 'ng-bookstore';
}
<!-- app.component.html -->
<!-- 插值渲染标题 -->
<span> Title:  {{ title }} </span>
```

在上述示例中，我们使用插值表达式在视图中显示了 `title` 变量的值。在插值语法中，我们也可以在模板表达式里使用各种运算符。

#### 属性绑定（Property binding）

**属性绑定**（**Property binding**）允许我们将组件中的数据绑定到 HTML 元素的属性上。由于绑定的是 HTML 元素属性，当绑定的数值发生改变时，视图也会相应更新。我们可以绑定到诸如 `class`、`href`、`disabled` 和 `src` 等 HTML 元素属性。

让我们看一下如何使用属性绑定的示例代码：

```html
// app.component.ts
export class AppComponent {
  isDisabled = true;
}
<!-- app.component.html -->
<button [disabled]="isDisabled">Can't be clicked</button>
```

在上面的示例中，我们将 `isDisabled` 变量绑定到了按钮的 `disabled` 属性上。因为我们将 `isDisabled` 的值设为了 `true`，所以该按钮将处于禁用状态。

### 双向数据绑定（Two-way binding）

双向数据绑定能保持组件状态与其对应视图之间的双向实时同步：当代码中的数据模型发生变化时，视图会自动更新；当用户在视图中进行编辑修改时，模型也会立即接收到新值。这在表单输入场景中尤为实用，因为渲染值与底层状态无需手动编写繁琐的同步逻辑即可保持一致。在模板驱动表单（template-driven forms）中，双向绑定是通过 `ngModel` 指令配合 `[(ngModel)]` 语法实现的。这是 Angular 提供的两种表单处理方案之一；另一种是响应式表单（reactive forms），其中表单值由组件类中的 `FormControl` 实例持有，视图通过 `formControl` 或 `formControlName` 绑定与之连接，而非使用 `[(...)]`。我们将在*第 13 章*深入讲解响应式表单。

`ngModel` 位于 `@angular/forms` 的 `FormsModule` 中。一旦将其绑定到输入框或其他表单元素上，它就会为该元素同时赋予属性绑定与事件绑定。

让我们看一看以下示例代码：

```html
// app.component.ts
export class AppComponent {
  model = 'seiji';
}
<!-- app.component.html -->
<input [(ngModel)]="model"/>
```

在上面的示例代码中，我们使用 `ngModel` 指令将 model 值绑定到了一个 input 元素上。在 Angular 模板中，方括号 `[ ]` 表示属性绑定，使数据能够从组件类流向模板。圆括号 `( )` 表示事件绑定，使组件能够监听模板发射的事件。将二者结合就形成了 `[( )]` 语法，也就是通称的“盒子里的香蕉”（banana in a box），它为我们提供了双向绑定：`ngModel` 通过属性绑定将模型的值写入输入框，并通过 `ngModelChange` 监听变化。尽管这是一种你应该了解的便捷模式，但我们在本书中将明确且全面地采用响应式表单。

### 模板语法：控制流（Template syntax: Control flow）

在近期的 Angular 版本中，结构型指令被更加富有表现力且类型安全的**现代控制流语法**（**control flow syntax**）所重塑。

这些新的块级结构 `@if`、`@for` 和 `@switch` 提供了更加清晰的模板表达、更优秀的变量作用域范围以及更好的 IDE 支持。它们现已成为条件渲染或遍历集合的首选方式。

这些结构不再是指令，而是 **Angular 原生语法**，旨在提高可读性并消除过去误用结构型指令带来的常见缺陷：

- `@if`：用于根据条件在**文档对象模型**（**DOM**）中添加或移除元素：

```html
@if (book()) {
  <app-book-detail [book]="book()" />
} @else {
  <p>No book selected.</p>
}
```

- `@for`：允许我们遍历集合，并强制通过追踪项优化渲染性能：

```html
@for (book of books(); track book.id) {
  <app-book-card [book]="book" />
} @empty {
  <p>No books available.</p>
}
```

- `@switch`：允许直接在模板中以更清晰的语法实现分支匹配渲染逻辑：

```html
@switch (book().category) {
  @case ('fiction') {
    <p>This is a fiction book.</p>
  }
  @case ('non-fiction') {
    <p>This is a non-fiction book.</p>
  }
  @default {
    <p>Category unknown.</p>
  }
}
```

这些全新的控制流原语具有以下优势：

- 与**信号（Signals）**以及响应式模式无缝协作
- 避免了因深层嵌套结构型指令导致的模板冗长杂乱
- 显著提升了 IDE 中的**类型推导**与**可调试性**

虽然传统的结构型指令如 `*ngIf` 和 `*ngFor` 仍受向后兼容支持，但强烈建议在所有新建的 Angular 应用中全面使用 `@if`、`@for` 和 `@switch`。

### 指令（Directives）

**指令**（**Directives**）是 Angular 中另一项用于操作模板的重要特性。我们可以利用指令修改元素的布局、行为和视图。指令分为三大类：**组件**是其中一种分类，另外两类则是**属性型指令**（attribute directives）与**结构型指令**（structural directives）。

在 Angular 中，指令用于增强 DOM 元素的外观或行为。除组件之外，其余两类为：

- **属性型指令**：修改现有元素的外观或行为
- **结构型指令**：传统上通过添加或移除 DOM 元素来控制布局

Angular 的内置控制流语法（`@if`、`@for`、`@switch`）现已成为在模板中表达此类逻辑的标准方式，取代了较旧的结构型指令（如 `*ngIf`、`*ngFor` 和 `*ngSwitch`）；因此，我们不会对旧结构型指令做深入展开。全新原生控制流语法更具可读性、类型更安全，且与 Angular 的响应式模型高度契合。

#### 属性型指令（Attribute directives）

随着结构型指令逐渐让位于全新控制流语法，属性型指令依然是操控元素行为和样式不可或缺且强大的工具。如前所述，**属性型指令**用于改变或修饰元素的外观与行为。与结构型指令相比，属性型指令不能在 DOM 中添加或销毁元素。

以下是 Angular 中一些常见的内置属性型指令：

- `ngClass`：用于向 HTML 元素添加或移除 CSS 类，使我们能够动态改变元素外观：

```html
<!-- 当控件值无效时向 input 元素添加 error 类 -->
<input type="text" [ngClass]="control.invalid ? 'error': ''" />
```

- `ngStyle`：允许我们动态修改 HTML 元素的内联样式：

```html
<!-- 元素的颜色将取决于 color 变量的值 -->
<div [ngStyle]="{'color': color}"> Angular Framework </div>
```

正如 Angular 革新了其指令与控制流的处理范式一样，该框架也从根本上改变了我们组织和架构组件的方式。

### 从模块走向独立组件（From modules to standalone components）

在 Angular 的历史版本中，模块（NgModule）一直扮演着核心角色。它们曾用于声明和组织组件、导入依赖、提供服务以及引导启动整个应用。随着独立组件（Standalone Components）成为默认选项，这种以模块为中心的架构已不再必需。我们现在完全可以构建一个不需要编写任何 NgModule 的纯粹 Angular 应用程序。

独立组件是自包含的，能够通过自身的 `imports` 属性直接声明其所需依赖。这意味着过去需要通过模块管理的一切（包括组件、指令、管道和提供者），现在都可以在**组件级别**直接处理。以下代码对比展示了过去基于 NgModule 的声明方式与现代独立组件方式的差异：

旧模式（基于 NgModule）：

```typescript
@NgModule({
  declarations: [],
  imports: [],
  providers: [],
  exports: [],
  bootstrap: [],
})
```

新模式（基于独立组件）：

```typescript
@Component({
  standalone: true, // 现在为可选项，默认值即为 true
  selector: 'app-book-list',
  templateUrl: './book-list.html',
  imports: [],
  providers: [],
})
export class BookList {
  // 业务逻辑
}
```

现在让我们讨论各个属性的功能：

- **Providers**：在此处配置服务，使其可用于依赖注入。
- **Imports**：在此处引入应用中所需的其他模块或独立组件、指令与管道。一旦导入了特定实体，该组件模板中就可以直接使用它们。

以下属性仅在过去基于 NgModule 的旧语法中才有意义：

- **Declarations**：声明属于该模块的组件、指令和管道。记住，每个组件、指令或管道只能在一个模块中声明。
- **Exports**：导出组件、指令和管道，以便在其他模块导入该模块时对外可用。
- **Bootstrap**：声明模块的主入口根组件。Bootstrap 属性主要用于 Angular 应用的根模块（`AppModule`），其职责是在应用启动时加载第一个主视图。
- **Entry components**：声明需要在应用中动态加载的组件。

此外，现代 Angular 不再需要引导模块，而是全面支持通过 `bootstrapApplication()` 进行**独立引导**（**standalone bootstrap**）：

```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';

bootstrapApplication(App, {
  providers: [provideRouter(routes), provideHttpClient()]
});
```

### 服务与依赖注入（Services and dependency injection）

**服务**（**Services**）也是 Angular 最具价值的核心特性之一。即便框架向纯独立组件架构演进，服务依然是 Angular 的中流砥柱。Angular 服务有助于封装业务逻辑、抽象数据访问，并在 UI 与应用状态之间建立清晰的关注点分离。

服务的主要职责包括：

- 在不同组件之间复用业务逻辑
- 实现 API 通信与远程数据访问
- 促进单一职责原则，将通用功能与独立的视图组件彻底解耦

要在应用中创建服务，我们创建一个普通的类并使用 `@Injectable` 装饰器对其进行注解。要在应用的根级别注册该服务，我们在 `@Injectable` 装饰器中添加如下配置：

```typescript
@Injectable({
  providedIn: 'root',
})
export class BookService {
  private http = inject(HttpClient);
  getAll() {
    return this.http.get<Book[]>('/api/books');
  }
}
```

一旦在根级别将 `providedIn` 元数据配置为 `'root'`，Angular 就会在整个应用程序中为该服务创建唯一的共享单例实例。

如果我们希望将服务的作用域限定在某个特定组件内部，可以在该组件 `@Component` 的 `providers` 元数据中进行声明：

```typescript
@Component({
  selector: 'app-book-detail',
  templateUrl: './book-detail.html',
  providers: [BookService],
})
export class BookDetail {
  private bookService = inject(BookService);
}
```

讨论完 Angular 的若干核心特性后，接下来我们将重点关注如何规范地组织 Angular 应用程序的目录结构。

## 创建 Angular 目录结构（Creating the Angular folder structure）

我们的书店应用前端是一个使用 **Angular 22** 构建的响应式**单页应用**（**Single Page Application**, **SPA**），严格遵循现代化架构设计、响应式响应流与项目组织的最佳工程实践。它包含**图书目录**、**用户资料**与**订单管理**等功能，模拟了一个真实的电商业务场景。

为了支撑 **NgRx Signal Store**（*第 15 章*）、**响应式表单**（*第 14 章*）、**用户认证与 API 交互**（*第 16–17 章*）以及**服务端渲染**（*第 18 章*）等高级能力，我们必须从一开始就确立清晰且具备良好可扩展性的目录拓扑。

本节将阐述如何利用 Angular 22 的**独立组件**、**按特性划分的目录架构**（**feature-based folders**）以及现代引导体系来组织整个前端项目。

### 推荐的目录结构（Recommended folder structure）

我们的项目将遵循**特性优先布局**（**feature-first layout**），即与同一业务领域（例如图书或订单）相关的所有组件、服务和路由都聚拢组织在一起。以下是高层级目录结构示例：

```text
src/
├── app/
│   ├── features/
│   │   ├── books/              # 图书目录页面与图书专用 UI
│   │   │   ├── pages/
│   │   │   │   ├── list/       # 图书列表页面
│   │   │   │   └── detail/     # 图书详情页面
│   │   │   ├── components/     # BookCard、Rating 等展示组件
│   │   │   ├── books.routes.ts
│   │   ├── profile/            # 用户个人中心页面
│   │   └── orders/             # 历史订单与结算流
│   ├── shared/                 # 可复用 UI（如导航栏、页脚）
│   ├── core/                   # 单例服务、守卫、拦截器
│   ├── app.ts                  # 根独立组件
│   ├── app.html
│   ├── app.scss
│   ├── app.routes.ts           # 函数式客户端路由配置
│   ├── app.routes.server.ts    # SSR 渲染策略配置
│   └── app.config.ts           # 全局提供者与配置项
```

这种结构允许各个业务特性独立演进，同时将横切关注点（认证鉴权、页面骨架布局、全局错误拦截）集中收敛于 `core/` 和 `shared/` 中。

#### 共享与核心结构（Shared and core Structure）

`shared/` 目录用于存放跨多个业务特性复用的通用 UI 组件、指令和管道。这些元素**默认均为独立组件**，可以在任何需要的地方按需单独导入。

让我们创建布局相关的公共组件（默认均为独立组件）：

```bash
ng generate component shared/layout/header
ng generate component shared/layout/footer
```

每个组件都包含属于自身的 `.ts`、`.html` 和 `.scss` 文件。生成的结构如下：

```text
src/
├── app/
│   ├── shared/
│   │   ├── layout/
│   │   │   ├── header/
│   │   │   │   ├── header.ts
│   │   │   │   ├── header.html
│   │   │   │   └── header.scss
│   │   │   ├── footer/
│   │   │   │   ├── footer.ts
│   │   │   │   ├── footer.html
│   │   │   │   └── footer.scss
```

这些布局组件可以直接用于根布局（App）中，或根据实际设计嵌套在特定特性组件内。*无需在任何模块中导出或注册它们*，只需直接将它们加入目标独立组件的 `imports` 数组即可。

#### 核心服务与单例提供者（Core services and singleton providers）

`core/` 目录包含应用全局维度的核心服务，这些服务通过 `providedIn: 'root'` 语法在*根级别进行提供*。它们通常是具备全局单一实例的服务，负责认证鉴权、会话管理或全局运行时配置等系统级功能。

`core` 目录维护整个应用共享的核心基础能力。这些服务为单例模式，意味着在整个应用程序运行周期内仅存在一个实例，最典型的就是认证服务。

让我们创建第一个核心服务：

```bash
ng generate service core/services/authentication
```

生成的 `AuthenticationService` 位于：

```text
src/
├── app/
│   ├── core/
│   │   ├── services/
│   │   │   └── authentication.service.ts
```

它应该且仅拥有一个实例，其初始实现如下：

```typescript
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {}
```

如有需要，我们稍后还可以在 `core/models/` 目录下存放全局共享的模型接口或类型定义（例如 `User`、`AuthPayload` 等）。

### 实现智能组件与展示组件（Implementing smart and dumb components）

我们将遵循**智能组件与展示组件架构**（**smart/dumb component architecture**），亦称**容器与呈现组件模式**（**container/presentational components**）。这是一种在基于组件的 UI 开发中广泛采用的模式，按职责分离边界：**智能组件**（亦称**容器组件或页面组件**）存放在 `pages/` 目录下，负责管理状态数据流与服务通信；**展示组件**（或称**呈现组件**）存放在 `components/` 目录下，仅负责接收 inputs 输入并向外 emit outputs 事件。这种分层隔离将业务逻辑收敛在少量的容器中，避免了数据源变更在整个 UI 树上引发涟漪反应；同时也让展示组件能够在不同特性间高度复用，无需与具体服务强耦合，并允许我们在不必模拟状态存储或 HTTP 客户端的情况下轻松地对绝大多数 UI 进行单元测试。

例如，在 `books/` 业务特性中，我们将采用如下组件结构：

```text
features/
├── books/
│   ├── pages/
│   │   ├── list/
│   │   │   ├── list.ts         # 智能容器组件
│   │   ├── components/
│   │   │   ├── book-list/
│   │   │   │   ├── book-list.ts    # 展示组件
```

#### 展示组件与组件通信（Dumb components and component communication）

自 Angular 17 起，引入了基于信号（Signals）的全新 API，大幅增强了响应式表达能力与组件间通信方式。在**独立组件**中，我们现在全面使用 `input()` 与 `output()` 函数来取代传统的 `@Input()` 和 `@Output()` 装饰器。

这对于**展示组件**尤为契合。展示组件的核心使命是渲染呈现数据并把用户操作派发出去，它们不应该包含任何业务逻辑或直接发起后端服务调用。

让我们深入理解 `input()` 和 `output()`：

- `input()` 用于*从父组件接收数据*。可以将其视作组件所依赖的响应式信号值，类似于其他现代前端框架中的 props。当父组件更新该值时，子组件会自动反映出最新变更。
- `output()` 用于*向父组件发射事件*。这是子组件通知父组件用户交互或内部状态变更的机制（例如用户点击了表格中的某一行，或者从列表中选中了一项）。

两者协同配合，强化了清晰的**单向数据流**（**unidirectional data flow**），使应用程序更易于推理与维护。

让我们创建第一个展示组件：

```bash
ng generate component features/books/components/book-list
```

我们的第一个展示组件（`BookList` 组件）的 TypeScript 定义如下（注意修改后的选择器 selector）：

```typescript
import { Component, input, output } from '@angular/core';

@Component({
  selector: 'book-list',
  templateUrl: './book-list.html',
  styleUrl: './book-list.scss',
})
export class BookList {
  books = input<any[]>([]);
  book = output<any>();

  selectBook(book: any) {
    this.book.emit(book);
  }
}
```

通过应用这种基于信号的模式，我们实现了清晰的职责划分：

- `BookList` 组件仅仅负责渲染列表并派发用户交互事件；
- 它保持高度的可复用性与可测试性，完全不需要关心数据来自**何处**，也不需要关心发射出的事件在父层会触发**什么**后续逻辑。

接下来让我们同步更新其 HTML 模板，渲染传入的书籍列表：

```html
<table>
  <thead>
    <tr>
      <th>Title</th>
      <th>Author</th>
      <th>Genre</th>
      <th>Price</th>
      <th>Published</th>
    </tr>
  </thead>
  <tbody>
    @for (book of books(); track book.title) {
      <tr (click)="selectBook(book)">
        <td>{{ book.title }}</td>
        <td>{{ book.authorName }}</td>
        <td>{{ book.genre }}</td>
        <td>{{ book.price }}</td>
        <td>{{ book.published }}</td>
      </tr>
    }
  </tbody>
</table>
```

#### 智能组件（Smart components）

**智能组件**（**Smart components**），亦称**容器组件**（**container components**），负责管理状态、执行服务调用以及处理用户的业务交互。它们编排数据流动与业务行为，并将具体的 UI 渲染工作委托给下层的展示组件。在这一体系中，智能组件消费信号、调用服务，并通过 `input()` 和 `output()` 绑定与展示组件传递数据。该模式维持了清晰的关注点分离，极大地增强了代码的可测性与架构扩展性。

让我们创建第一个智能组件：

```bash
ng generate component features/books/pages/list
```

以下是我们的第一个智能组件（`List` 组件）的实现：

```typescript
import { Component } from '@angular/core';
import { BookList } from '../../components/book-list/book-list';

@Component({
  selector: 'books-list-page',
  templateUrl: './list.html',
  imports: [BookList],
  styleUrl: './list.scss'
})
export class List {
  books = []; // 稍后我们将从 API 获取数据

  selectBook(book: any) {
    // 稍后我们将在此处处理选中业务逻辑
  }
}
```

在此实现中，`List` 组件扮演了智能容器的角色。它具备以下职责：

- 为子级 `BookList` 组件提供样本图书数据
- 通过 `selectBook()` 方法处理图书选中的派发事件
- 在后续章节中可轻松扩展为调用 API 获取数据或集成 Signal Store 状态管理

对应的模板文件（`list.html`）负责连接这两个组件：

```html
<book-list
  [books]="books"
  (book)="selectBook($event)">
</book-list>
```

最后，让我们在 `features/books` 目录下手动创建 `books.routes.ts` 文件，以定义该特性的路由规则：

```typescript
import { Routes } from '@angular/router';
import { List } from './pages/list/list';

export const routes: Routes = [
  { path: '', component: List },
  // 后续将追加更多图书业务路由
];
```

成功规划并生成 `ng-bookstore` 的目录结构后，我们可以查看当前应用程序的整体文件拓扑：

![图 11.6：创建各文件夹后的目录结构](/media/posts/spring-boot-angular/img-09055.png)

*图 11.6：创建各文件夹后的目录结构*

### 在根路由中注册特性路由（Registering the feature routes in the root router）

在 `books.routes.ts` 内部定义了特性级路由之后，我们需要将它们挂载到应用的主路由体系中。在 Angular 中，路由使用**函数式方案**进行配置，路由定义保存在扁平的 `Routes[]` 数组中。我们在 `app.routes.ts` 中配置所有根级路由，并利用**懒加载**（**lazy loading**）机制在实际访问时按需加载特性路由。这种做法有效缩短了首屏加载耗时，使各个特性模块保持真正的松耦合：

```typescript
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'books',
    pathMatch: 'full',
  },
  {
    path: 'books',
    loadChildren: () =>
      import('./features/books/books.routes').then(m => m.routes)
  }
];
```

此项配置意味着 `/books` 路由及其所有子路由（例如 `/books/form`）仅在用户实际导航至该路径时才会动态下载加载，从而确保初始打包体积保持最小，显著优化了运行性能。

### 使用独立 API 引导应用程序（Bootstrapping the application with standalone APIs）

在现代 Angular 中，应用引导通过 `bootstrapApplication()` 函数完成，彻底取代了传统的 `AppModule`。这种现代方案更为精简，完美适用于单页应用（SPA）、微前端架构以及基于 SSR 的应用场景。

我们无需在模块中声明和导入组件，而是定义一个**独立根组件**作为应用的骨架外壳。该组件通常用于包裹共享的页面骨架（如 Header 和 Footer）并挂载核心的 RouterOutlet。

首先看一下入口文件（`main.ts`）：

```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch(err => console.error(err));
```

接着，让我们定义包含公共布局组件的根组件（`app.ts`）：

```typescript
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './shared/layout/header/header';
import { Footer } from './shared/layout/footer/footer';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {}
```

通过在此处直接导入 Header 与 Footer 组件，我们确保了页面骨架布局能够稳定包裹所有经由路由渲染的视图（例如 `/books` 或 `/profile`）。

现在让我们完善 `app.html` 中的主布局模板：

```html
<app-header />

<main class="content">
  <router-outlet />
</main>

<app-footer />
```

这为所有页面提供了高度一致的外观结构：

- `<app-header>` 展示品牌标识与全局导航链接
- `<router-outlet>` 承载当前路由匹配的页面组件（如图书列表或个人中心）
- `<app-footer>` 显示版权说明、全局辅助链接等信息

### 定义共享接口（Defining shared interfaces）

随着 Angular 应用程序不断演进与扩展，一致性与类型安全显得尤为重要。共享接口有助于我们为数据结构确立清晰明确的契约规范。无论是在渲染图书列表、编辑用户资料还是提交表单，这些接口都充当了数据对象外观与行为的“单一真实来源”（source of truth）。

使用共享接口能够带来诸多优势：

- 确保组件、服务以及表单之间的数据契约完全一致
- 显著增强 IDE 中的静态类型校验与 IntelliSense 智能感知提示
- 提升代码重构的安全性，所有使用处均受静态类型保护
- 极大改善团队协作效率，尤其在不同成员负责应用不同模块的大型团队中

例如，通过在共享目录下定义一个通用的 `Book` 接口，我们可以消除冗余重复，并在长远维护中简化代码。接下来让我们为书店应用创建第一个共享模型。

#### 创建图书接口（Creating the book interface）

让我们生成第一个模型接口：

```bash
ng generate interface shared/models/book
```

该命令将在 `shared/models` 目录下生成一个名为 `book.ts` 的文件。在现代全栈开发中，TypeScript 接口应该直接映射后端的**数据传输对象**（**DTO**），以确保全栈契约的一致性。这种前后端对齐保证了在前端与后端之间流动的数据遵守相同的数据结构与校验规则，有效消除集成隐患，并使系统更加易于维护。例如，我们在后端的 `BookRequest` DTO 定义可见于：
`https://github.com/PacktPublishing/Spring-Boot-and-Angular-2E_Backend/tree/main/chapter-06/inventory-ms/src/main/java/com/packt/bookstore/inventory/dto`

我们将其结构转换为 TypeScript 接口，同时严格保持相同的字段约束与必填/可选区分：

```typescript
export interface Book {
  title: string;
  authorName: string;
  genre: string;
  price: number;
  published: string;
  isbn: string;
  description?: string;
  pageCount?: number;
  coverImageUrl?: string;
}
```

#### 在列表页面组件中使用该接口（Using the interface in the list component）

现在让我们回到渲染图书列表的页面组件中，构造一些模拟数据，并使用刚刚创建的 `Book` 接口来强化类型安全：

```typescript
// list.ts

import { Component } from '@angular/core';
import { Book } from '../../../../shared/models/book';
import { BookList } from "../../components/book-list/book-list";

@Component({
  selector: 'books-list-page',
  templateUrl: './list.html',
  imports: [BookList],
  styleUrl: './list.scss',
})
export class List {
  books: Book[] = [
    {
      title: 'Clean Code',
      authorName: 'Robert C. Martin',
      genre: 'Software Engineering',
      price: 29.99,
      published: '2008-08-01',
      isbn: '978-0132350884'
    }
  ];

  headers: { headerName: string; fieldName: keyof Book }[] = [
    { headerName: 'Title', fieldName: 'title' },
    { headerName: 'Author', fieldName: 'authorName' },
    { headerName: 'Genre', fieldName: 'genre' },
    { headerName: 'Price', fieldName: 'price' },
    { headerName: 'Published', fieldName: 'published' },
  ];

  selectBook(book: Book): void {
    // 处理选中逻辑
  }
}
```

#### 在 BookList 组件中使用该接口（Using the interface in the BookList component）

在共享 `Book` 接口就绪后，我们现在可以重构 `BookList` 展示组件，充分发挥 Angular 基于信号的响应式体系以及强类型输入与输出的优势：

```typescript
import { Component, input, output } from '@angular/core';
import { Book } from '../../../../shared/models/book';

@Component({
  standalone: true,
  selector: 'book-list',
  templateUrl: './book-list.html',
})
export class BookList {
  books = input<Book[]>([]);
  book = output<Book>();

  selectBook(book: Book) {
    this.book.emit(book);
  }
}
```

请记住，`BookList` 组件是一个纯粹的展示（dumb）组件。它的职责是展示传递给它的图书列表，并在某本图书被选中时通知父组件。它绝不包含任何业务处理逻辑。

### 更新后的项目结构（Updated project structure）

在引入了共享模型并建立了清晰的智能/展示组件分层之后，我们 Angular 项目的相关目录结构如下所示：

![图 11.7：更新后的项目结构](/media/posts/spring-boot-angular/img-09057.png)

*图 11.7：更新后的项目结构*

通过 `ng serve` 运行应用后，在 `localhost:4200` 将呈现出如下运行结果：

![图 11.8：运行应用](/media/posts/spring-boot-angular/img-09059.png)

*图 11.8：运行应用*

至此，我们已经构建了第一组独立的智能组件与展示组件，并使用现代控制流语法成功渲染了图书列表。现在是时候进一步美化我们的 UI 了。为了在无需从零编写样式的同时提升界面的视觉美感与易用性，我们将引入 **Angular Material**——一个严格遵循 Material Design 设计规范的流行 UI 组件库。让我们看看如何将其集成到项目中，并利用其组件打造规范精致的用户界面。

## 添加 Angular Material 实现一致的 UI 设计（Adding Angular Material for consistent UI design）

**Angular Material** 是 Google 官方为 Angular 应用量身打造的一套高质量 UI 组件库，涵盖了表格、卡片、输入框、日期选择器等丰富的开箱即用组件。这意味着我们无需从头手写组件样式，直接调用 Material 库中的标准化组件即可。

Angular Material 底层包含丰富的构建基块。它们既可以作为独立组件按需单独导入，库本身也提供了聚合模块以便在导入后直接在特定应用中使用。这些组件不仅高度可复用，而且凭借内置的配置属性，能够非常轻松地定制外观与质感。

接下来让我们在 Angular 项目中配置 Angular Material。

### 安装 Angular Material（Installing Angular Material）

Angular Material 提供了一个强大的原理图（schematic），只需一条命令即可完成所有必要的初始化配置：

```bash
ng add @angular/material
```

执行该命令后，CLI 会通过交互式提示引导我们完成配置：

**选择预设主题或自定义主题（Choose a prebuilt theme or define a custom one）**：我们可以从预设主题中挑选（如 azure-blue、magenta-violet、cyan-orange），也可以选择稍后自定义调色板。在这里我们选择 **azure-blue**。

![图 11.9：配置 Angular Material](/media/posts/spring-boot-angular/img-09061.png)

*图 11.9：配置 Angular Material*

完成此配置交互后，Angular CLI 将自动执行以下操作：

> **注意**
>
> 将 `@angular/material` 与 `@angular/cdk` 依赖包追加到我们的 `package.json` 中。

- 在 `index.html` 中引入 Material 专用资源，如 Roboto 字体和 Material Icons 图标库：

```html
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
```

- 使用 Material 基础样式更新 `styles.scss`。虽然该原理图默认写入了 Material 3 预设主题，但我们将把它替换为 Material 2 的 `indigo-pink` 主题，因为本章后续在工具栏中使用的 `color="primary"` 与 `color="accent"` 属性属于 Material 2 主题体系 API。让我们将 `styles.scss` 简化为如下内容：

```scss
@import "../node_modules/@angular/material/prebuilt-themes/indigo-pink.css";

html, body { height: 100%; }
body { margin: 0; font-family: Roboto, "Helvetica Neue", sans-serif; }
```

### 在独立组件中导入 Angular Material（Importing Angular Material in standalone components）

正如你目前所了解的，独立组件让我们能够在脱离 NgModule 的前提下编写出更整洁、更模块化的代码。Angular Material 积极拥抱了这一重大变革，允许将其所有 UI 组件直接导入到各个独立组件中。

我们不再需要将所有 Material 模块全部打包堆砌在一个庞大的共享模块（如 `MaterialModule`）中，而是在每个组件的 `imports` 数组中仅引入当前组件实际所需的模块。这种做法带来了更优异的 Tree-shaking 摇树优化效果，使得大型前端工程的代码更易于维护。

接下来让我们通过一个实战示例，使用 Angular Material 来实现书店应用的**页头**（**header**）与**页脚**（**footer**）。我们将使用 `MatToolbarModule`、`MatIconModule` 和 `MatButtonModule` 来构建一个响应式页头，该页头包含：

- 左侧的菜单图标（menu icon）
- 中间的应用程序名称
- 右侧的收藏夹图标（favorite icon）

以下是页头的 HTML 模板文件（`header.html`）：

```html
<header>
  <mat-toolbar color="primary">
    <button matIconButton class="menu-icon"
      aria-label="Icon-button with menu icon">
      <mat-icon class="white-icon">menu</mat-icon>
    </button>
    <span>Packt Bookstore</span>
    <span class="spacer"></span>
    <button matIconButton class="favorite-icon"
      aria-label="Icon-button with heart icon" color="accent">
      <mat-icon>favorite</mat-icon>
    </button>
  </mat-toolbar>
</header>
```

以下是页头组件的 TypeScript 定义文件（`header.ts`）：

```typescript
import { Component } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbar } from '@angular/material/toolbar';

@Component({
  selector: 'app-header',
  imports: [MatToolbar, MatButtonModule, MatIcon],
  templateUrl: './header.html',
  styleUrl: './header.scss'
})
export class Header {}
```

以下是页头组件的样式表文件（`header.scss`）：

```scss
.spacer {
  flex: 1 1 auto;
}

.white-icon {
  color: white;
}
```

接下来是页脚组件，它固定在页面底部，使用相同的 `mat-toolbar` 结构，包含：

- 版权声明文本
- 指向隐私政策（Privacy）和使用条款（Terms）页面的快捷链接

以下是页脚的 HTML 模板文件（`footer.html`）：

```html
<footer>
  <mat-toolbar color="primary" class="footer">
    <span class="footer-text">© 2025 Packt Publishing</span>
    <span class="spacer"></span>
    <a matButton href="/privacy">Privacy</a>
    <a matButton href="/terms">Terms</a>
  </mat-toolbar>
</footer>
```

以下是页脚组件的 TypeScript 定义文件（`footer.ts`）：

```typescript
import { Component } from '@angular/core';
import { MatToolbar } from '@angular/material/toolbar';

@Component({
  selector: 'app-footer',
  imports: [MatToolbar],
  templateUrl: './footer.html',
  styleUrl: './footer.scss'
})
export class Footer {}
```

最后是页脚组件的样式表文件（`footer.scss`）：

```scss
.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3rem;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  font-size: 0.875rem;
  padding: 0 1rem;
}

.spacer {
  flex: 1 1 auto;
}

a[matButton] {
  color: white;
  text-decoration: none;
}
```

通过直接在每个独立组件中导入所需的 Material 组件，我们全面践行了现代 Angular 的架构设计原则，彻底告别了臃肿的 NgModule。这也使得每个组件高度自包含，不仅更易于单元测试，也更加清晰易懂。

此时，我们的整体页面布局呈现出如下效果：

![图 11.10：当前页面布局](/media/posts/spring-boot-angular/img-09063.png)

*图 11.10：当前页面布局*

### 使用 Angular Material 实现图书列表（Implementing the book list with Angular Material）

为了以更具视觉层次和交互感的方式展示图书列表，我们将使用 Angular Material 的 `mat-table` 组件替换掉原生的 `<table>` 实现。这不仅能赋予应用精致统一的外观，还直接带来了符合 Material Design 标准的无障碍支持（accessibility）与样式体系。

以下是使用 `mat-table` 重构后的 `book-list.html` 模板：

```html
<table mat-table [dataSource]="books()" class="mat-elevation-z8">
  <ng-container matColumnDef="title">
    <th mat-header-cell *matHeaderCellDef> Title </th>
    <td mat-cell *matCellDef="let book"> {{ book.title }} </td>
  </ng-container>

  <ng-container matColumnDef="authorName">
    <th mat-header-cell *matHeaderCellDef> Author </th>
    <td mat-cell *matCellDef="let book"> {{ book.authorName }} </td>
  </ng-container>

  <ng-container matColumnDef="genre">
    <th mat-header-cell *matHeaderCellDef> Genre </th>
    <td mat-cell *matCellDef="let book"> {{ book.genre }} </td>
  </ng-container>

  <ng-container matColumnDef="price">
    <th mat-header-cell *matHeaderCellDef> Price </th>
    <td mat-cell *matCellDef="let book"> {{ book.price | currency }} </td>
  </ng-container>

  <ng-container matColumnDef="published">
    <th mat-header-cell *matHeaderCellDef> Published </th>
    <td mat-cell *matCellDef="let book"> {{ book.published }} </td>
  </ng-container>

  <ng-container matColumnDef="actions">
    <th mat-header-cell *matHeaderCellDef> Actions </th>
    <td mat-cell *matCellDef="let book">
      <button matIconButton color="primary" (click)="editBook(book)">
        <mat-icon>edit</mat-icon>
      </button>
      <button matIconButton color="warn" (click)="deleteBook(book)">
        <mat-icon>delete</mat-icon>
      </button>
    </td>
  </ng-container>

  <tr mat-header-row *matHeaderRowDef="columns"></tr>
  <tr mat-row *matRowDef="let row; columns: columns;"></tr>

</table>
```

在上述代码中：

- `dataSource` 绑定到了 `books()` 信号数组；
- 每个 `<ng-container matColumnDef="…">` 定义一个表格数据列；
- `matHeaderCellDef` 与 `matCellDef` 分别处理表头与行数据的单元格渲染；
- `actions` 操作列中包含了用于编辑和删除图书等常见操作的图标按钮。

更新后的 `BookList` 组件引入了必需的逻辑与 Angular Material 模块：

```typescript
import { Component, input, output } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CurrencyPipe } from '@angular/common';
import { Book } from '../../../../shared/models/book';

@Component({
  standalone: true,
  selector: 'book-list',
  templateUrl: './book-list.html',
  styleUrls: ['./book-list.scss'],
  imports: [CurrencyPipe, MatTableModule, MatIconModule, MatButtonModule],
})
export class BookList {
  books = input<Book[]>([]);
  book = output<Book>();

  columns: string[] = ['title', 'authorName', 'genre',
    'price', 'published', 'actions'];

  selectBook(book: Book) {
    this.book.emit(book);
  }

  editBook(book: Book) {
    console.log('Edit book:', book);
  }

  deleteBook(book: Book) {
    console.log('Delete book:', book);
  }
}
```

全新的实现赋予了图书列表出色的交互体验与现代感十足的视觉风格，同时保持了代码逻辑的清晰隔离与高可复用性。

![图 11.11：包含新 BookList 的布局](/media/posts/spring-boot-angular/img-09065.png)

*图 11.11：包含新 BookList 的布局*

借助 Angular Material 和独立组件，我们构建了一个具备动态响应与丰富交互的图书列表，为现代 Angular 开发打下了坚实的技术基石。随着业务复杂度不断上升，保障代码质量变得愈发关键，一套健全的测试策略对于确保组件与服务在各种场景下的稳定运行至关重要。在继续推进更复杂的特性开发之前，让我们建立起现代化的单元测试环境，为全书后续的开发工作提供可靠护航。

## 使用 Vitest 搭建现代单元测试（Setting up modern unit testing with Vitest）

Angular CLI 在生成新项目时，默认将 Vitest 配置为测试运行器（test runner），彻底取代了以往陈旧的 Karma 与 Jasmine 组合。Vitest 是一款基于 Vite 构建的极速单元测试框架，原生支持 ES 模块（ESM）、开箱即用地支持 TypeScript，并且具备惊人的测试执行效率。这一重大升级与我们在本章自始至终所推行的独立组件架构完美契合。因为我们的项目由 Angular CLI 全新生成，Vitest 已经默认配置就绪。在本节中，我们将剖析自动生成的配置以帮助你理解其内部机制，随后我们将编写我们的第一个测试用例。

> **提示**
>
> 如果你正在将使用 Karma 的早期版本 Angular 项目进行升级，CLI 提供了专门的迁移原理图来帮助转换测试配置：
>
> ```bash
> ng generate refactor-jasmine-vitest
> ```
>
> 该原理图会自动将 Jasmine 特有的函数、类型、匹配器和导入项替换为 Vitest 等价物，但在迁移完成后你可能仍需手动微调少部分测试。

### 理解生成的 Vitest 配置（Understanding the generated Vitest configuration）

当我们通过 `ng new ng-bookstore` 生成项目脚手架时，CLI 会自动将 Vitest 配置为测试执行引擎。相关的测试配置位于 `angular.json` 的 `test` 构建目标（architect target）中。CLI 使用 Angular 内置的 `@angular/build:unit-test` 构建器，它原生集成了 Vitest，无需任何第三方插件：

```json
{
  "projects": {
    "ng-bookstore": {
      "architect": {
        "test": {
          "builder": "@angular/build:unit-test"
        }
      }
    }
  }
}
```

这一极简配置就是运行具备完整 Angular 特性支持的 Vitest 所需的全部内容。`@angular/build:unit-test` 构建器在底层全权负责了 TypeScript 编译、Angular 组件测试环境配置以及 DOM 运行时模拟。该构建器还直接通过 CLI 或 `angular.json` 支持丰富的配置选项，包括代码覆盖率设置、浏览器测试、自定义报告器、启动文件以及监听模式控制。目前我们保持默认配置即可，它完全能够满足我们的全部需求。

### 测试初始化配置（Test setup configuration）

Angular 应用程序**默认采用无 Zone（zoneless）模式**，这意味着在新项目中不再包含 Zone.js。这是一项重大的架构演进，极大简化了运行时变更检测机制与测试体系。CLI 自动生成了一个精简的 `src/test-setup.ts` 文件，在没有任何 `Zone.js` 依赖的情况下初始化 Angular 的测试环境：

```typescript
import '@angular/compiler';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';

getTestBed().initTestEnvironment(
  BrowserTestingModule,
  platformBrowserTesting(),
);
```

请注意，这里没有任何关于 `zone.js` 的导入。Angular 的无 Zone 变更检测依赖信号（Signals）和内部调度器来触发局部更新，这意味着我们的测试将使用 `await fixture.whenStable()` 模式，而不是传统的 `fixture.detectChanges()` 轮询机制。稍后在编写第一个单元测试时，我们就能亲眼见证它的运作方式。

### 可用的测试脚本（Available test scripts）

CLI 在 `package.json` 中配置了测试脚本，这些脚本通过 `ng test` 命令调用 Angular 内置的 Vitest 集成。我们可以对其进行扩充，以便支持不同的测试执行场景：

```json
{
  "scripts": {
    "test": "ng test",
    "test:run": "ng test --watch=false",
    "test:ui": "ng test --ui"
  }
}
```

`ng test` 默认开启监听模式，每当你修改源码或测试文件时，它都会自动重新执行受影响的测试用例；而附加 `--watch=false` 参数则表示单次执行测试（非常适合 CI/CD 流水线）。此外你还可以传递其他常用选项：

- `ng test --coverage`：生成详细的代码覆盖率报告
- `ng test --ui`：打开 Vitest 提供的可视化交互式 Dashboard 仪表盘
- `ng test --filter "BookList"`：仅执行名称匹配特定模式的测试用例

这些命令之所以能顺畅执行，是因为 `@angular/build:unit-test` 构建器在底层全权委托给了 Vitest，使你能够通过熟悉的 Angular `ng test` 命令行接口享受到 Vitest CLI 的全部强大威力。随着测试基础设施的搭建就绪，接下来让我们编写第一个单元测试，验证所有组件是否正常运作。

## 编写我们的第一个单元测试（Writing our first unit tests）

我们将首先更新 Angular CLI 自动生成的默认应用测试文件，然后再为自定义组件编写测试。这一渐进策略能够确保在进入后续章节更复杂的测试场景前，我们的测试底座坚实可靠。

### 更新 App 组件测试（Updating the app component test）

在生成 Angular 项目时，CLI 自动生成了一个默认的测试文件 `app.spec.ts`，但它断言的是我们应用中并不存在的初始模板内容。让我们更新该测试文件，以匹配真实的 `App` 根组件结构。

我们的 `App` 组件渲染了一个包含页头（header）、带有路由插槽（router outlet）的主内容区域以及页脚（footer）的页面骨架。测试应当验证这些核心骨架元素是否存在：

```typescript
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideLocationMocks(),
      ],
    }).compileComponents();
  });

  it('should create the app', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the layout structure', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    // 检查核心骨架元素是否存在
    expect(compiled.querySelector('app-header')).toBeTruthy();
    expect(compiled.querySelector('main.content')).toBeTruthy();
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
    expect(compiled.querySelector('app-footer')).toBeTruthy();
  });
});
```

以下是我们在该测试中所做的关键调整说明：

- 我们使用 `provideRouter([])` 和 `provideLocationMocks()` 来处理 `App` 模板中的 `<router-outlet>` 依赖。
- 我们使用 `await fixture.whenStable()` 代替了过去的 `fixture.detectChanges()`。由于 Angular 应用程序默认采用无 Zone 模式，`whenStable()` 是确保在执行断言之前所有信号更新和异步微任务均已收敛完成的规范方式。该方法会等待组件完成 DOM 渲染并进入稳定状态。
- 我们使用 `querySelector` 检查 DOM 元素，确认渲染出的产物中包含了页头、主内容区域、路由插槽以及页脚组件。

### 测试 BookList 组件（Testing the BookList component）

现在让我们为自定义组件编写第一个测试套件。在动手编写测试代码之前，先理清我们需要对 `BookList` 组件的哪些维度进行验证。`BookList` 组件是一个展示（dumb）组件，在应用架构中承担着明确的职责：它通过输入接收数据，以结构化的表格格式呈现数据，并通过输出将用户的交互操作反馈给父组件。

针对该组件的测试策略应集中在以下几个核心领域：

- **组件实例化（Component Instantiation）**：组件能否在其包含的所有 Angular Material 依赖项下顺利实例化？由于我们的组件导入了 `MatTableModule`、`MatIconModule` 和 `MatButtonModule`，我们需要确保这些依赖不会导致实例化失败。
- **输入信号处理（Input Signal Handling）**：组件是否能够正确接收并处理 `books` 输入信号？这验证了现代 Angular 基于信号的输入系统，并确保组件能够正确处理父组件传入的数据。
- **数据渲染（Data Rendering）**：当提供 `books` 数据时，组件能否在 Material 表格中正确渲染各列？这验证了我们的模板逻辑正常工作，且 Angular 的变更检测能够正确更新 DOM。
- **输出事件发射（Output Event Emission）**：当用户与组件交互时（例如调用 `selectBook` 方法），它能否向父组件正确发射事件？这验证了展示组件与智能父组件之间的通信契约。

现在让我们编写该组件的完整测试套件（位于 `book-list.spec.ts`）：

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BookList } from './book-list';
import { Book } from '../../../../shared/models/book';

describe('BookList', () => {
  let component: BookList;
  let fixture: ComponentFixture<BookList>;

  const mockBooks: Book[] = [
    {
      title: 'Clean Code',
      authorName: 'Robert C. Martin',
      genre: 'Software Engineering',
      price: 29.99,
      published: '2008-08-01',
      isbn: '978-0132350884',
    }
  ];

  beforeEach(async () => {
    // 为独立组件配置 TestBed
    await TestBed.configureTestingModule({
      imports: [BookList]
    }).compileComponents();

    fixture = TestBed.createComponent(BookList);
    component = fixture.componentInstance;
  });

  // 测试用例 1：组件创建
  // 验证组件可以在没有错误的情况下正常实例化
  it('should create', async () => {
    await fixture.whenStable();
    expect(component).toBeTruthy();
  });

  // 测试用例 2：基础输入处理
  // 验证组件能够接收输入数据
  it('should accept books input', async () => {
    fixture.componentRef.setInput('books', mockBooks);
    await fixture.whenStable();
    expect(component.books()).toEqual(mockBooks);
  });

  // 测试用例 3：输出事件发射
  // 验证 selectBook 能通过 output 正确发射所选图书
  it('should emit the selected book', async () => {
    let emittedBook: Book | undefined;
    component.book.subscribe((book) => (emittedBook = book));
    component.selectBook(mockBooks[0]);
    await fixture.whenStable();
    expect(emittedBook).toEqual(mockBooks[0]);
  });
});
```

让我们对测试中所使用的一些关键要素进行进一步解读：

- `mockBooks`：我们构造了符合 `Book` 接口契约的真实测试数据，以保证严格的类型安全。
- `fixture.componentRef.setInput()`：这是在单元测试中为基于信号的 input 设值的现代标准方式，彻底取代了过去的直接属性赋值操作。
- `await fixture.whenStable()`：它等待所有待处理的信号更新和异步微任务全部执行完毕，确保在进行断言之前组件的 DOM 已经彻底渲染稳定。
- `component.book.subscribe()`：`output()` 函数返回一个 `OutputEmitterRef` 引用，它在测试中暴露了 `subscribe()` 方法。我们捕获其发射出来的值，触发 `selectBook()`，并断言组件原样转发了图书对象，以此验证展示组件与其智能父组件之间的事件通信契约。

### 运行我们的单元测试（Running our unit tests）

现在，让我们使用前面配置的 `npm` 脚本来执行单元测试：

```bash
# 在监听模式下运行测试
npm run test
```

该命令将在**监听模式**（**watch mode**）下启动 Vitest，这意味着它会持续监控你的源文件和测试文件变动。当你修改任何组件、服务或测试文件时，Vitest 将自动重新运行受影响的测试，针对改动是否破坏既有功能提供即时反馈。这种监听模式在开发期间尤为好用，它在编写代码与运行测试之间建立了紧密的高速反馈循环。

![图 11.12：在监听模式下运行测试的输出](/media/posts/spring-boot-angular/img-09067.png)

*图 11.12：在监听模式下运行测试的输出*

> **注意**
>
> 请记住，当使用监听模式时，测试进程会持续驻留运行，随时准备在代码库发生变更时重新执行测试。

你也可以在其他模式下运行测试：

```bash
# 单次运行测试
npm run test:run

# 带有可视化 UI 仪表盘运行测试
npm run test:ui
```

在这些模式下，你同样应该看到所有测试顺利通过的输出，这证实了我们的 Vitest 测试基建能够与 Angular 的测试体系完美协同工作，并且我们的 `App` 组件与 `BookList` 组件均能毫无错误地完成实例化。

### 在后续章节中扩展测试覆盖率（Expanding test coverage in upcoming chapters）

这些基础测试充分验证了我们的测试基石坚实稳固。随着全书内容的不断深入，我们将逐步构建全方位的测试策略：

- *第 12 章*：我们将探索 AI 辅助开发工作流，这将在后续所有章节中大幅加速我们的测试与开发进程。
- *第 13 章至第 14 章*：我们将针对 Angular 表单和响应式表单编写细致的组件测试，包括校验规则测试与复杂的用户交互场景，并深度融合*第 12 章*介绍的 AI 辅助开发技术。
- *第 15 章*：在引入服务与状态管理时，我们将落地完善的服务测试模式，包括模拟外部依赖、测试异常错误处理逻辑以及验证复杂业务规则场景。

从项目初期就恪守严谨的测试规范，能够确保我们的应用在复杂度激增的过程中始终保持高可靠性与可维护性。我们基于 Vitest 搭建的测试体系将支撑未来的全部测试需求，并提供远比传统 Karma 方案更敏捷高效的反馈循环。

## 小结（Summary）

在本章中，你使用 Angular 22 成功搭建了 Packt Bookstore 前端应用的基础骨架。你探索了组件、指令与数据绑定等核心概念，并利用独立组件（standalone components）以及基于信号的输入和输出（signal-based inputs and outputs）等现代特性大幅简化了响应式架构。我们使用具备良好可扩展性的特性优先目录结构组织了项目，并创建了智能容器组件与展示组件，依托信号驱动的输入输出实现了优雅的单向数据流通信。我们引入了 Angular Material 来提升 UI 品质，并将图书列表重构成符合 Material Design 标准的高交互表格。

你还全面了解了 Angular CLI 开箱即用提供的基于 Vitest 的现代单元测试环境，并使用 Angular 无 Zone（zoneless）测试模型（配合 `await fixture.whenStable()`）编写了首批组件单元测试，验证了测试基础设施与 Angular 基于信号的组件系统之间的完美协同。

掌握了这些基石技能后，你的 Angular 应用程序现在结构清晰、视觉精致、测试严密，完全具备了迈向更复杂业务特性的开发条件。

在下一章中，我们将聚焦于准备开展 AI 辅助开发，你将学习如何运用现代 AI 工具与技术来大幅加速日常开发工作流。这将为在后续章节中高效构建复杂业务功能、持续保持卓越代码质量与架构最佳实践铺平道路。
