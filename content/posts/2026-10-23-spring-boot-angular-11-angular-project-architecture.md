---
title: Spring Boot & Angular 全栈实战（十一）：Angular 22 现代脚手架与独立组件架构
date: 2026-10-23T00:11:00Z
description: 双栏独立滚动对照：深入 Angular 22 现代工程体系，落地纯 Standalone 架构、基于 Signals 的输入输出、Smart/Dumb 组件分层与 Vitest 现代测试框架。
category: fullstack
column: spring-boot-angular
tags:
  - Angular
  - Standalone
  - TypeScript
  - 前端架构
  - Vitest
---

> 💡 **双栏独立滚动工作台导读**：本文采用双栏对照架构。**左栏**为核心技术决策矩阵、生产级代码范式与避坑清单；**右栏**为技术实现演化参考，并提供关键段落的英文原文展开与难词解析。左右两栏可独立滚动，并支持顶栏自定义宽度比例（7:3 / 5:5 / 3:7）与拖拽调节。

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

# 原著完整参考：Angular 22 现代脚手架与独立组件架构

在现代全栈架构中，前端工程承担着交互编排、视图渲染与用户体验保障的职责。伴随 Angular 框架演进至 **Angular 22**，前端工程体系实现了重大范式转变：

1. `NgModule` 模式退居为兼容性机制，**纯粹的独立组件（Standalone Components）** 成为绝对默认标准；
2. 传统的结构型指令（`*ngIf`、`*ngFor`、`*ngSwitch`）被更优雅、更符合编译器语义且类型安全的**原生控制流语法（`@if`、`@for`、`@switch`）** 全面替代；
3. 组件间通信全面拥抱细粒度响应式体系，以 **`input()` 和 `output()` 信号函数** 代替老旧的属性装饰器；
4. 单元测试生态淘汰了 Karma/Jasmine 方案，全面转向基于 Vite 生态的极致高效单测工具 **Vitest**，并深度整合无 Zone.js（Zoneless）的现代异步变更检测。

本文系统拆解 Angular 22 现代前端工程的核心要素，落地 Feature-First 目录分层、Smart/Dumb 模式与 Vitest 单测矩阵。

:::en
> **Original**: Angular has evolved towards a streamlined, modern developer experience characterized by standalone components by default, built-in control flow syntax, signal-based reactivity, and first-class Vitest integration.

**📌 核心术语与语境解析**：
- **Standalone Components** [ˈstændəloʊn kəmˈpoʊnənts]：*独立组件*。无需在 NgModule 中声明即可自包含依赖项并直接引导或导入的组件范式。
- **Developer Experience (DX)** [dɪˈveləpər ɪkˈspɪriəns]：*开发者体验*。工具链、编译反馈速度以及框架语法设计的易用性与一致性。
:::

## 1. 现代化工程脚手架创建与配置

前端脚手架不仅是代码生成工具，更是工程化规范（TypeScript 编译选项、代码风格、路由策略与 SSR 支持）的基底。

### 1.1 环境准备与 Angular CLI v22

本地开发环境要求安装 **Node.js 24 LTS**（或 22.22.3+ / 26+），随后全局安装最新的 Angular CLI：

```bash
npm install -g @angular/cli
```

验证安装版本：

```bash
ng --version
```

终端输出 Angular CLI 22 及其绑定的 Node.js 与 OS 环境信息：

![Angular CLI v22 版本验证](/media/posts/spring-boot-angular/img-09047.png)

### 1.2 创建生产级工程 `ng-bookstore`

在工作空间中执行项目初始化：

```bash
ng new ng-bookstore
```

脚手架在交互式初始化过程中提供一系列架构选项：
- **Stylesheet format**：推荐选择 **Sass (SCSS)**，具备嵌套规则、变量与混入能力，便于后续深度定制 UI 主题；
- **Server-Side Rendering (SSR)**：选择 **Yes**，生成包含客户端与服务端双重运行时配置的高性能模板；
- **AI-assisted development configuration**：根据编辑器习惯勾选集成辅助配置。

![脚手架交互式工程配置](/media/posts/spring-boot-angular/img-09048.png)

初始化完成后，脚手架会自动完成依赖安装并生成现代工程结构：

![生成完成的工程目录树](/media/posts/spring-boot-angular/img-09050.png)

进入项目目录启动本地开发服务器：

```bash
cd ng-bookstore
npm run start # 等价于 ng serve
```

终端编译完成后将提示服务就绪：

![启动本地开发服务器](/media/posts/spring-boot-angular/img-09052.png)

打开浏览器访问 `http://localhost:4200`，即可看到 Angular 22 默认欢迎界面：

![Angular 默认欢迎界面](/media/posts/spring-boot-angular/img-09054.png)

## 2. Angular 22 现代核心特性演进

从传统 Angular 到 Angular 22，框架设计理念经历了由“配置驱动”向“纯净 TypeScript/函数式驱动”的范式转变。

### 2.1 告别 NgModule：纯粹的独立组件（Standalone Components）

在过去的架构中，任何组件、指令或管道都必须显式声明在某个 `@NgModule` 的 `declarations` 数组中，模块之间通过 `imports` 和 `exports` 相互暴露。这导致了冗长繁琐的脚手架样板代码，还经常导致隐式依赖污染与糟糕的 Tree-shaking 表现。

在 Angular 22 中，**所有组件默认均为 Standalone 独立组件**：

```typescript
// 传统 NgModule 模式（已废弃范式）
@NgModule({
  declarations: [BookListComponent],
  imports: [CommonModule],
  exports: [BookListComponent]
})
export class BooksModule {}

// 现代化 Standalone 独立组件（现代规范）
@Component({
  selector: 'app-book-list',
  templateUrl: './book-list.html',
  styleUrl: './book-list.scss',
  imports: [CommonModule], // 组件自包含管理依赖，开箱即用
})
export class BookList {
  // 业务逻辑
}
```

应用根引导由传统的 `platformBrowserDynamic().bootstrapModule(AppModule)` 彻底转变为直观的函数式引导：

```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// 直接引导根独立组件，解耦模块层
bootstrapApplication(App, appConfig)
  .catch(err => console.error(err));
```

:::en
> **Original**: Standalone components streamline the authoring experience by reducing boilerplate, removing the need for intermediary NgModules, and enabling precise per-component dependency graphs for optimal tree-shaking.

**📌 核心术语与语境解析**：
- **Tree-shaking** [triː ˈʃeɪkɪŋ]：*摇树优化/死码消除*。打包构建工具依据 ES 模块的静态引用分析，移除未使用导出代码的编译优化机制。
- **Bootstrap Application** [ˈbuːtstræp ˌæplɪˈkeɪʃn]：*应用根引导*。由平台层直接实例化根组件并挂载至宿主 DOM 的入口执行阶段。
:::

### 2.2 原生模板控制流语法（Built-in Control Flow）

过去 Angular 依赖微语法属性指令（如 `*ngIf`、`*ngFor`、`*ngSwitch`），开发者必须手动导入 `CommonModule`，且复杂条件下的模板嵌套往往产生大量冗余的 `<ng-container>`。

Angular 22 全面确立了**原生块级控制流语法**（Built-in Control Flow），这些语法在编译器层面直接支持，具备优良的类型推断与极速运行时性能：

#### 条件分支 `@if` / `@else`

```html
@if (book()) {
  <app-book-detail [book]="book()" />
} @else if (isLoading()) {
  <app-spinner />
} @else {
  <p class="empty-hint">暂未选中任何图书。</p>
}
```

#### 集合迭代与空状态治理 `@for` / `@empty`

```html
@for (book of books(); track book.isbn) {
  <app-book-card [book]="book" />
} @empty {
  <div class="no-records">
    <p>当前分类下暂无图书在售。</p>
  </div>
}
```

> [!IMPORTANT]
> 在原生 `@for` 语法中，`track` 表达式是**强制性要求的**（如 `track book.isbn`）。这迫使开发者显式提供对象标识键，使渲染器在数据变动时仅更新差异项，从根源上杜绝了列表全量重新渲染带来的性能损耗。

#### 多路条件匹配 `@switch`

```html
@switch (book().category) {
  @case ('TECH') {
    <span class="badge tech">计算机科学</span>
  }
  @case ('LITERATURE') {
    <span class="badge literature">经典文学</span>
  }
  @default {
    <span class="badge general">通用读物</span>
  }
}
```

:::en
> **Original**: Built-in control flow replaces structural directives with native compiler-level blocks, enforcing explicit identity tracking via `track` to minimize DOM reconciliation overhead.

**📌 核心术语与语境解析**：
- **Built-in Control Flow** [bɪlt ɪn kənˈtroʊl floʊ]：*原生控制流*。由 Angular 模板编译器在词法层支持的声明式逻辑块。
- **DOM Reconciliation** [diː oʊ em ˌrekənsɪliˈeɪʃn]：*DOM 协调比对*。虚拟节点或抽象状态模型与真实浏览器 DOM 之间进行差异更新的算法过程。
:::

### 2.3 属性指令 vs 结构型指令的边界再定

随着原生控制流全面取代旧版结构型指令，指令的职责变得极为纯粹：
- **属性指令（Attribute Directives）**：专注于修改现有宿主 DOM 元素的外观、行为或样式（例如 `ngClass`、`ngStyle` 或自定义悬浮提示指令）；
- **原生语法块**：负责所有 DOM 树节点的挂载、销毁与循环逻辑。

### 2.4 依赖注入的新范式：`inject()` 函数

除了传统的构造函数注入外，现代 Angular 大量采用轻量直观的 `inject()` 函数式注入，允许在字段初始化器中直接获取服务实例：

```typescript
@Injectable({
  providedIn: 'root'
})
export class BookService {
  private http = inject(HttpClient); // 函数式注入替代构造参数注入

  getAll() {
    return this.http.get<Book[]>('/api/books');
  }
}
```

## 3. 生产级 Feature-First 目录规范

面对具备数十个业务模块、复杂表单与全状态管理的大型全栈项目，清晰且松耦合的目录结构是架构可维护性的护城河。

我们采用 **Feature-First（按特性垂直切分）** 拓扑规范，将业务模块、单例核心服务与跨模块复用组件清晰分层：

```text
src/
├── app/
│   ├── features/               # 业务特性目录（垂直领域划分）
│   │   ├── books/              # 图书目录与详情特性
│   │   │   ├── pages/          # Smart / Page 容器组件
│   │   │   │   ├── list/       # 图书列表主页面
│   │   │   │   └── detail/     # 图书详情页面
│   │   │   ├── components/     # 特性专属的 Dumb / 展示型组件
│   │   │   │   └── book-list/  # 图书表格展示组件
│   │   │   └── books.routes.ts # 特性级子路由配置
│   │   ├── profile/            # 用户个人中心特性
│   │   └── orders/             # 订单与结算特性
│   ├── shared/                 # 跨特性通用层（纯 Dumb 组件、指令、管道、通用模型）
│   │   ├── layout/             # 应用级框架布局组件（Header、Footer、Sidebar）
│   │   └── models/             # 共享接口定义（对齐后端 DTO）
│   ├── core/                   # 全局单例基础设施（认证、拦截器、全局 Guards、Store）
│   │   └── services/           # 单例服务（AuthenticationService 等）
│   ├── app.ts                  # 根组件（独立组件）
│   ├── app.html                # 根视图模板（挂载 Header/Footer 与 router-outlet）
│   ├── app.scss                # 根全局样式
│   ├── app.routes.ts           # 顶层功能路由（声明懒加载）
│   ├── app.routes.server.ts    # 服务端渲染策略配置
│   └── app.config.ts           # 应用级 Providers 与全局环境配置
```

### 3.1 创建布局组件与核心单例服务

通过 CLI 生成应用框架布局组件：

```bash
ng generate component shared/layout/header
ng generate component shared/layout/footer
ng generate service core/services/authentication
```

生成的布局组件同样为自包含的 Standalone 组件，无需在任何模块中重复声明，需要引用的地方直接加入组件的 `imports: [...]` 即可。

## 4. Smart/Dumb 组件分层架构实战

在前端架构设计中，**容器/展示组件模式（Smart / Dumb Components Pattern）** 是保证 UI 稳定性与可测试性的经典法则：
- **Smart 组件（容器/页面组件，位于 `pages/`）**：负责监听路由参数、调用服务或 Signal Store 变更全局状态、协调数据流，并将处理好的数据分发给展示组件；
- **Dumb 组件（展示组件，位于 `components/`）**：不直接发起网络请求、不持有全局业务状态，只通过输入接收数据并通过输出向上传递用户交互事件，具备极高复用性与纯函数式的可测性。

### 4.1 契约驱动：定义与后端 DTO 精确对齐的 TypeScript 接口

生成前端 `Book` 接口：

```bash
ng generate interface shared/models/book
```

在 `src/app/shared/models/book.ts` 中定义与后端 Inventory 微服务 `BookResponse` / `BookRequest` 严格契合的强类型模型：

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

### 4.2 基于 Signal-based `input()` 与 `output()` 实现 Dumb 组件

在 Angular 22 中，全面采用信号驱动的 API 替代旧版 `@Input()` 与 `@Output()` 装饰器：

```bash
ng generate component features/books/components/book-list
```

编辑 `src/app/features/books/components/book-list/book-list.ts`：

```typescript
import { Component, input, output } from '@angular/core';
import { Book } from '../../../../shared/models/book';

@Component({
  selector: 'book-list',
  templateUrl: './book-list.html',
  styleUrl: './book-list.scss',
})
export class BookList {
  // 强类型 Signal-based Input：只读信号，自动追踪父级数据更新
  books = input<Book[]>([]);

  // 强类型 Signal-based Output：标准事件发射器
  book = output<Book>();

  selectBook(book: Book): void {
    this.book.emit(book);
  }
}
```

编写对应的原生控制流模板（`book-list.html`）：

```html
<table class="native-table">
  <thead>
    <tr>
      <th>书名</th>
      <th>作者</th>
      <th>流派分类</th>
      <th>定价</th>
      <th>出版日期</th>
    </tr>
  </thead>
  <tbody>
    @for (book of books(); track book.isbn) {
      <tr (click)="selectBook(book)">
        <td>{{ book.title }}</td>
        <td>{{ book.authorName }}</td>
        <td>{{ book.genre }}</td>
        <td>{{ book.price }}</td>
        <td>{{ book.published }}</td>
      </tr>
    } @empty {
      <tr>
        <td colspan="5" class="empty-cell">当前列表为空</td>
      </tr>
    }
  </tbody>
</table>
```

:::en
> **Original**: Signal-based inputs and outputs establish a deterministic, read-only reactive interface for presentational components, enabling effortless change detection and granular template updates.

**📌 核心术语与语境解析**：
- **Signal-based Inputs** [ˈsɪɡnəl beɪst ˈɪnpʊts]：*基于信号的输入属性*。以 `InputSignal<T>` 呈现的只读反应式状态源，在父级传值更新时自动激活依赖链路。
- **OutputEmitterRef** [ˈaʊtpʊt ɪˈmɪtər ref]：*输出发射器引用*。基于函数式 `output<T>()` 创建的现代事件发射句柄。
:::

### 4.3 构建 Smart 容器组件

生成图书列表的主页面：

```bash
ng generate component features/books/pages/list
```

在 `src/app/features/books/pages/list/list.ts` 中组装业务逻辑：

```typescript
import { Component } from '@angular/core';
import { Book } from '../../../../shared/models/book';
import { BookList } from '../../components/book-list/book-list';

@Component({
  selector: 'books-list-page',
  templateUrl: './list.html',
  imports: [BookList],
  styleUrl: './list.scss',
})
export class List {
  books: Book[] = [
    {
      title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
      authorName: 'Robert C. Martin',
      genre: 'Software Engineering',
      price: 39.99,
      published: '2008-08-01',
      isbn: '978-0132350884',
    },
    {
      title: 'Designing Data-Intensive Applications',
      authorName: 'Martin Kleppmann',
      genre: 'Distributed Systems',
      price: 49.99,
      published: '2017-03-16',
      isbn: '978-1449373320',
    }
  ];

  selectBook(book: Book): void {
    console.log('用户选中图书项:', book.isbn, book.title);
  }
}
```

页面模板 `list.html` 衔接 Dumb 组件：

```html
<section class="page-container">
  <h2>图书资源总览</h2>
  <book-list
    [books]="books"
    (book)="selectBook($event)">
  </book-list>
</section>
```

### 4.4 现代函数式路由与惰性加载（Lazy Loading）

创建特性路由文件 `src/app/features/books/books.routes.ts`：

```typescript
import { Routes } from '@angular/router';
import { List } from './pages/list/list';

export const routes: Routes = [
  { path: '', component: List },
];
```

在根路由 `src/app/app.routes.ts` 中采用动态导入（Dynamic Import）实现细粒度代码分割与懒加载：

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
      import('./features/books/books.routes').then(m => m.routes),
  },
];
```

配合根组件 `app.ts` 与视图 `app.html`：

```typescript
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './shared/layout/header/header';
import { Footer } from './shared/layout/footer/footer';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
```

```html
<app-header />

<main class="main-content">
  <router-outlet />
</main>

<app-footer />
```

更新后的目录拓扑与渲染效果：

![更新后的目录拓扑](/media/posts/spring-boot-angular/img-09055.png)

![原生表格初步渲染效果](/media/posts/spring-boot-angular/img-09059.png)

:::en
> **Original**: Smart/Container components encapsulate business logic and route transitions, delegating pure visual representation to Dumb/Presentational components via unidirectional data binding.

**📌 核心术语与语境解析**：
- **Smart / Dumb Components** [smɑːrt dʌm kəmˈpoʊnənts]：*智能与哑组件模式*。容器负责状态编排，展示组件负责输入渲染与意图发射的经典分层架构。
- **Lazy Loading** [ˈleɪzi ˈloʊdɪŋ]：*惰性加载/按需加载*。基于动态路由声明在用户导航至特定路径时才异步拉取对应 JS Chunk 的性能优化机制。
:::

## 5. Angular Material 现代化集成与列表重构

为了赋予应用符合工业标准的无障碍支持（A11y）、响应式排版与一致的视觉体验，我们引入官方 **Angular Material**。

### 5.1 安装与主题配置

通过 CLI Schematic 引入 Material 核心组件与 CDK：

```bash
ng add @angular/material
```

在交互提示中选择预置主题，CLI 将在 `package.json` 中注入 `@angular/material` 与 `@angular/cdk`，并在 `index.html` 中引入 Roboto 字体与 Material 矢量图标集。

![配置 Angular Material 主题](/media/posts/spring-boot-angular/img-09061.png)

在全局样式 `styles.scss` 中引入预置主题规范：

```scss
@import "../node_modules/@angular/material/prebuilt-themes/indigo-pink.css";

html, body {
  height: 100%;
}

body {
  margin: 0;
  font-family: Roboto, "Helvetica Neue", sans-serif;
  background-color: #f8f9fa;
}
```

### 5.2 Standalone 模式下的精准按需引入

在 Standalone 架构中，严禁建立囊括所有 Material 组件的巨型 `MaterialModule`。正确的做法是**在各个独立组件中仅按需引入所需的具体 Material Directive/Component**，最大限度发挥编译器 Tree-shaking 优化效果。

#### 重构 Header 导航组件（`header.ts`）

```typescript
import { Component } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbar } from '@angular/material/toolbar';

@Component({
  selector: 'app-header',
  imports: [MatToolbar, MatButtonModule, MatIcon],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {}
```

模板（`header.html`）：

```html
<header>
  <mat-toolbar color="primary" class="main-toolbar">
    <button mat-icon-button aria-label="菜单导航">
      <mat-icon>menu</mat-icon>
    </button>
    <span class="brand-title">Bookstore 全栈实战平台</span>
    <span class="spacer"></span>
    <button mat-icon-button aria-label="收藏清单" color="accent">
      <mat-icon>favorite</mat-icon>
    </button>
  </mat-toolbar>
</header>
```

#### 重构 Footer 底部组件（`footer.ts`）

```typescript
import { Component } from '@angular/core';
import { MatToolbar } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-footer',
  imports: [MatToolbar, MatButtonModule],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class Footer {}
```

模板（`footer.html`）：

```html
<footer class="app-footer">
  <mat-toolbar color="primary" class="footer-bar">
    <span class="footer-copy">© 2026 Bookstore Microservices Architecture. All Rights Reserved.</span>
    <span class="spacer"></span>
    <a mat-button href="/privacy">隐私政策</a>
    <a mat-button href="/terms">服务条款</a>
  </mat-toolbar>
</footer>
```

### 5.3 基于 `mat-table` 升级图书展示列表

在 `BookList` 组件中引入 Material 数据表格：

`book-list.ts`：

```typescript
import { Component, input, output } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CurrencyPipe } from '@angular/common';
import { Book } from '../../../../shared/models/book';

@Component({
  selector: 'book-list',
  templateUrl: './book-list.html',
  styleUrl: './book-list.scss',
  imports: [CurrencyPipe, MatTableModule, MatIconModule, MatButtonModule],
})
export class BookList {
  books = input<Book[]>([]);
  book = output<Book>();

  displayedColumns: string[] = ['title', 'authorName', 'genre', 'price', 'published', 'actions'];

  selectBook(book: Book): void {
    this.book.emit(book);
  }

  editBook(book: Book, event: MouseEvent): void {
    event.stopPropagation();
    console.log('触发编辑动作:', book);
  }

  deleteBook(book: Book, event: MouseEvent): void {
    event.stopPropagation();
    console.log('触发删除动作:', book);
  }
}
```

`book-list.html`：

```html
<table mat-table [dataSource]="books()" class="mat-elevation-z4 full-width-table">
  <ng-container matColumnDef="title">
    <th mat-header-cell *matHeaderCellDef> 书名 </th>
    <td mat-cell *matCellDef="let book"> {{ book.title }} </td>
  </ng-container>

  <ng-container matColumnDef="authorName">
    <th mat-header-cell *matHeaderCellDef> 作者 </th>
    <td mat-cell *matCellDef="let book"> {{ book.authorName }} </td>
  </ng-container>

  <ng-container matColumnDef="genre">
    <th mat-header-cell *matHeaderCellDef> 类别 </th>
    <td mat-cell *matCellDef="let book"> {{ book.genre }} </td>
  </ng-container>

  <ng-container matColumnDef="price">
    <th mat-header-cell *matHeaderCellDef> 定价 </th>
    <td mat-cell *matCellDef="let book"> {{ book.price | currency:'USD':'symbol':'1.2-2' }} </td>
  </ng-container>

  <ng-container matColumnDef="published">
    <th mat-header-cell *matHeaderCellDef> 出版时间 </th>
    <td mat-cell *matCellDef="let book"> {{ book.published }} </td>
  </ng-container>

  <ng-container matColumnDef="actions">
    <th mat-header-cell *matHeaderCellDef class="actions-header"> 操作 </th>
    <td mat-cell *matCellDef="let book">
      <button mat-icon-button color="primary" (click)="editBook(book, $event)" aria-label="编辑">
        <mat-icon>edit</mat-icon>
      </button>
      <button mat-icon-button color="warn" (click)="deleteBook(book, $event)" aria-label="删除">
        <mat-icon>delete</mat-icon>
      </button>
    </td>
  </ng-container>

  <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
  <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="clickable-row" (click)="selectBook(row)"></tr>
</table>
```

![集成 Material 后的整体布局与表格呈现](/media/posts/spring-boot-angular/img-09065.png)

## 6. 现代单元测试：拥抱 Vitest 与 Zoneless 异步断言

大型前端工程的健康迭代依赖高速稳定的单元测试套件。

### 6.1 为什么是 Vitest？

Angular 22 默认推荐并内置了基于 **Vitest** 的单元测试体系：
- **原生 ESM 支持**：直接解析 ES 模块，无需漫长的二次全量 Bundle；
- **毫秒级极速反馈**：借助 Vite 的 HMR 与按需转换能力，测试启动与执行速度提升 5~10 倍；
- **现代 API 对齐**：天然兼容主流现代断言库与快照测试。

构建器配置：

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

### 6.2 解密 Zoneless 测试环境：`await fixture.whenStable()`

在 Angular 22 中，项目迈入 **Zoneless（无 Zone.js）** 时代，变更检测不再依赖全局拦截异步 API 的 `zone.js`，而是完全依赖细粒度 Signals 与内部微任务调度器。

测试断言编写方式也随之演进：
- 传统模式：每次设置变量后必须手工调用 `fixture.detectChanges()` 轮询；
- **现代模式**：通过 `await fixture.whenStable()` 等待所有响应式信号求值与异步渲染微任务完全稳定，确保断言在真实渲染结果上执行。

:::en
> **Original**: Zoneless testing eliminates manual change detection cycles by utilizing `fixture.whenStable()` to await the convergence of asynchronous signal evaluation and microtask queues.

**📌 核心术语与语境解析**：
- **Zoneless Change Detection** [ˈzoʊnləs tʃeɪndʒ dɪˈtekʃn]：*无 Zone 变更检测*。解耦全局拦截器，通过响应式原语通知调度器执行精准局部更新的高性能渲染模型。
- **Asynchronous Stabilization** [eɪˈsɪŋkrənəs ˌsteɪbələˈzeɪʃn]：*异步收敛稳定*。等待组件树中所有微任务与信号依赖图计算收敛至终态的过程。
:::

### 6.3 编写 App 根组件布局测试

在 `src/app/app.spec.ts` 中编写根组件结构测试：

```typescript
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { App } from './app';

describe('App Root Layout', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideLocationMocks(),
      ],
    }).compileComponents();
  });

  it('应该成功实例化根组件', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('应该正确渲染框架布局（Header、Footer 与 RouterOutlet）', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('app-header')).toBeTruthy();
    expect(compiled.querySelector('main.main-content')).toBeTruthy();
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
    expect(compiled.querySelector('app-footer')).toBeTruthy();
  });
});
```

### 6.4 编写 Dumb 组件响应式信号单测

编辑 `src/app/features/books/components/book-list/book-list.spec.ts`：

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BookList } from './book-list';
import { Book } from '../../../../shared/models/book';

describe('BookList Component (Dumb)', () => {
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
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BookList],
    }).compileComponents();

    fixture = TestBed.createComponent(BookList);
    component = fixture.componentInstance;
  });

  it('用例 1：组件在包含 Material 依赖时应成功创建', async () => {
    await fixture.whenStable();
    expect(component).toBeTruthy();
  });

  it('用例 2：应正确响应 Signal Input 注入的数据变更', async () => {
    fixture.componentRef.setInput('books', mockBooks);
    await fixture.whenStable();

    expect(component.books()).toEqual(mockBooks);
    expect(component.books().length).toBe(1);
  });

  it('用例 3：触发行点击应通过 Output 正确发射选中图书', async () => {
    let emittedBook: Book | undefined;

    component.book.subscribe((book: Book) => {
      emittedBook = book;
    });

    component.selectBook(mockBooks[0]);
    await fixture.whenStable();

    expect(emittedBook).toEqual(mockBooks[0]);
    expect(emittedBook?.isbn).toBe('978-0132350884');
  });
});
```

在终端执行测试：

```bash
# 启动 Vitest 极速热重载监听模式
npm run test

# CI/CD 场景：单次运行
npm run test:run

# 打开交互式可视化仪表盘
npm run test:ui
```

所有用例秒级通过：

![Vitest 极速单元测试通过](/media/posts/spring-boot-angular/img-09067.png)
