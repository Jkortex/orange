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

> 💡 **专栏导读**：本文收录于专栏 [《Spring Boot 4 & Angular 22 全栈微服务实战》](/columns/spring-boot-angular)。全专栏共 22 篇，深度覆盖 Java 26 微服务拆分、Spring Cloud 网关与安全鉴权、Angular 22 Signals 状态治理以及端到端容器化交付的全链路工程实践。

---

在上一章中，我们通过多阶段构建与 Docker Compose 编排，完成了 Bookstore 后端微服务集群、数据库与网关可观测性设施的容器化交付。后端已经具备了标准化、可预测的 API 输出能力。从本文开始，我们将正式进入全栈体系的另一核心支柱——现代前端工程的建设。

伴随 Angular 近几个大版本的革新，特别是演进到 **Angular 22**，整个框架的研发体验与底层架构发生了翻天覆地的跃迁：
- 曾经统治框架多年的 `NgModule` 模式已被彻底弱化为历史遗产，**纯粹的独立组件（Standalone Components）** 成为绝对默认标准；
- 传统的结构型指令（`*ngIf`、`*ngFor`、`*ngSwitch`）被更优雅、更符合编译器语义且类型安全的**原生控制流语法（`@if`、`@for`、`@switch`）** 取代；
- 组件间通信全面拥抱细粒度响应式体系，以 **`input()` 和 `output()` 信号函数** 代替老旧的属性装饰器；
- 单元测试生态彻底淘汰了厚重缓慢的 Karma/Jasmine，全面转向基于 Vite 生态的极致高效单测工具 **Vitest**，并深度整合了无 Zone.js（Zoneless）的现代异步变更检测。

本文将带领大家从零构建一个生产级的 Angular 22 前端项目，深入解析现代核心特性的演进，搭建清晰健壮的 Feature-First 目录规范，实战 Smart/Dumb 组件架构与 Angular Material 现代化集成，并编写第一批基于 Vitest 的高覆盖率响应式单测。

---

## 1. 现代化工程脚手架创建与配置

在现代全栈工程中，前端脚手架不仅是一个代码生成器，更是工程化规范（TypeScript 编译选项、代码风格、路由策略、SSR 支持等）的基底。

### 1.1 环境准备与 Angular CLI v22

确保本地开发环境安装了 **Node.js 24 LTS**（或 22.22.3+ / 26+），随后全局安装最新的 Angular CLI：

```bash
npm install -g @angular/cli
```

验证安装版本：

```bash
ng --version
```

终端将输出 Angular CLI 22 及其绑定的 Node.js 与 OS 环境信息：

![Angular CLI v22 版本验证](/media/posts/spring-boot-angular/img-09047.png)

### 1.2 创建生产级工程 `ng-bookstore`

在工作空间中执行项目初始化：

```bash
ng new ng-bookstore
```

脚手架在交互式初始化过程中会提供一系列架构选项：
- **Stylesheet format**：推荐选择 **Sass (SCSS)**，具备嵌套规则、变量与混入能力，便于后续深度定制 UI 主题；
- **Server-Side Rendering (SSR)**：选择 **Yes**，生成包含客户端与服务端双重运行时配置的高性能模板（后续章节将深入 SSR 与 Hydration 水合机制）；
- **AI-assisted development configuration**：可根据自身编辑器习惯勾选集成辅助配置。

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

---

## 2. Angular 22 现代核心特性演进

从传统 Angular 到 Angular 22，框架设计理念经历了由“配置驱动”向“纯净 TypeScript/函数式驱动”的范式转变。理解这些特性是编写高质量前端代码的前提。

### 2.1 告别 NgModule：纯粹的独立组件（Standalone Components）

在过去的架构中，任何组件、指令或管道都必须显式声明在某个 `@NgModule` 的 `declarations` 数组中，模块之间通过 `imports` 和 `exports` 相互暴露。这不仅带来了冗长繁琐的脚手架样板代码，还经常导致隐式依赖污染与糟糕的 Tree-shaking 表现。

在 Angular 22 中，**所有组件默认均为 Standalone 独立组件**（无需手动显式声明 `standalone: true`）：

```typescript
// 传统 NgModule 模式（已过时）
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

应用根引导也由繁琐的 `platformBrowserDynamic().bootstrapModule(AppModule)` 彻底转变为直观的函数式引导：

```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// 直接引导根独立组件，解耦模块层
bootstrapApplication(App, appConfig)
  .catch(err => console.error(err));
```

### 2.2 原生模板控制流语法（Built-in Control Flow）

过去 Angular 依赖于微语法属性指令（Micro-syntax Directives，如 `*ngIf`、`*ngFor`、`*ngSwitch`），开发者必须手动导入 `CommonModule`，且复杂条件下的模板嵌套往往产生大量冗余的 `<ng-container>`。

Angular 22 全面确立了**原生块级控制流语法**（Built-in Control Flow），这些语法在编译器层面直接支持，具备极佳的类型推断与极速运行时性能：

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
> 在原生 `@for` 语法中，`track` 表达式是**强制性要求的**（如 `track book.isbn`）。这迫使开发者必须显式提供对象标识键，使虚拟 DOM 与渲染器在数据变动时仅更新差异项，从根源上杜绝了列表全量重新渲染带来的性能损耗。

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

### 2.3 属性指令 vs 结构型指令的边界再定

随着原生控制流全面取代旧版结构型指令，指令的职责变得极为纯粹：
- **属性指令（Attribute Directives）**：专注于修改现有宿主 DOM 元素的外观、行为或样式（例如 `ngClass`、`ngStyle` 或自定义悬浮提示指令）；
- **原生语法块**：负责所有 DOM 树节点的挂载、销毁与循环逻辑。

### 2.4 依赖注入的新范式：`inject()` 函数

除了传统的构造函数注入外，现代 Angular 大量采用轻量直观的 `inject()` 函数式注入，允许在字段初始化器中直接获取服务实例：

```typescript
@Injectable({
  providedIn: 'root' // 全局单例
})
export class BookService {
  private http = inject(HttpClient); // 函数式注入替代构造参数注入

  getAll() {
    return this.http.get<Book[]>('/api/books');
  }
}
```

---

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

---

## 4. Smart/Dumb 组件分层架构实战

在前端架构设计中，**容器/展示组件模式（Smart / Dumb Components Pattern）** 是保证 UI 稳定性与可测试性的经典法则：
- **Smart 组件（容器/页面组件，位于 `pages/`）**：负责监听路由参数、调用服务或 Signal Store 变更全局状态、协调数据流，并将处理好的数据分发给展示组件；
- **Dumb 组件（展示组件，位于 `components/`）**：不直接发起网络请求、不持有全局业务状态，只通过输入接收数据并通过输出向上传递用户交互事件，具备极高复用性与纯函数式的可测性。

### 4.1 契约驱动：定义与后端 DTO 精确对齐的 TypeScript 接口

全栈开发的核心优势在于前后端契约的一致性。生成前端 `Book` 接口：

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

在 Angular 22 中，彻底摒弃旧版 `@Input()` 与 `@Output()` 装饰器，全面采用信号驱动的 API：

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
  // 模拟业务数据（后续对接微服务 API）
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
    // 处理导航跳转或调起侧拉抽屉详情
  }
}
```

页面模板 `list.html` 只需极简地衔接 Dumb 组件：

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

此时的目录层次结构与初步渲染效果如下：

![更新后的目录拓扑](/media/posts/spring-boot-angular/img-09055.png)

![原生表格初步渲染效果](/media/posts/spring-boot-angular/img-09059.png)

---

## 5. Angular Material 现代化集成与列表重构

为了赋予应用符合现代工业标准的无障碍支持（A11y）、响应式排版与一致的视觉体验，我们将引入 Google 官方的 **Angular Material**。

### 5.1 安装与主题配置

通过 CLI Schematic 自动引入 Material 核心组件与 CDK：

```bash
ng add @angular/material
```

在交互提示中选择预置主题（如 `azure-blue` 或经典预置色板），CLI 将自动在 `package.json` 中注入 `@angular/material` 与 `@angular/cdk`，并在 `index.html` 中引入 Roboto 字体与 Material 矢量图标集。

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

在 Standalone 架构中，严禁建立一个囊括所有 Material 组件的巨型 `MaterialModule`！正确的做法是**在各个独立组件中仅按需引入所需的具体 Material Directive/Component**，以最大限度发挥编译器 Tree-shaking 优化效果。

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

样式（`header.scss`）：

```scss
.main-toolbar {
  display: flex;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.brand-title {
  font-weight: 500;
  margin-left: 0.5rem;
}

.spacer {
  flex: 1 1 auto;
}
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

在 `BookList` 组件中引入 Material 数据表格，提供更丰富的主题色彩、货币管道格式化以及操作按钮插槽：

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
  <!-- 书名列 -->
  <ng-container matColumnDef="title">
    <th mat-header-cell *matHeaderCellDef> 书名 </th>
    <td mat-cell *matCellDef="let book"> {{ book.title }} </td>
  </ng-container>

  <!-- 作者列 -->
  <ng-container matColumnDef="authorName">
    <th mat-header-cell *matHeaderCellDef> 作者 </th>
    <td mat-cell *matCellDef="let book"> {{ book.authorName }} </td>
  </ng-container>

  <!-- 分类列 -->
  <ng-container matColumnDef="genre">
    <th mat-header-cell *matHeaderCellDef> 类别 </th>
    <td mat-cell *matCellDef="let book"> {{ book.genre }} </td>
  </ng-container>

  <!-- 定价列（管道货币化） -->
  <ng-container matColumnDef="price">
    <th mat-header-cell *matHeaderCellDef> 定价 </th>
    <td mat-cell *matCellDef="let book"> {{ book.price | currency:'USD':'symbol':'1.2-2' }} </td>
  </ng-container>

  <!-- 出版日期列 -->
  <ng-container matColumnDef="published">
    <th mat-header-cell *matHeaderCellDef> 出版时间 </th>
    <td mat-cell *matCellDef="let book"> {{ book.published }} </td>
  </ng-container>

  <!-- 操作按钮插槽 -->
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

经过 Material 现代化改造后的完整视图呈现出高水准的工业质感：

![集成 Material 后的整体布局与表格呈现](/media/posts/spring-boot-angular/img-09065.png)

---

## 6. 现代单元测试：拥抱 Vitest 与 Zoneless 异步断言

过去数年，Angular 默认采用基于 Webpack、Karma 与 Jasmine 的单测套件。随着工程规模扩张，Karma 启动庞大真实浏览器以及复杂打包流水线导致单测执行极其缓慢。

### 6.1 为什么是 Vitest？

Angular 22 默认推荐并内置了基于 **Vitest** 的单元测试体系。
- **原生 ESM 支持**：直接解析 ES 模块，无需漫长的二次全量 Bundle；
- **毫秒级极速反馈**：借助 Vite 卓越的 HMR 与按需转换能力，测试启动与执行速度提升 5~10 倍；
- **现代 API 对齐**：天然兼容主流现代断言库与快照测试。

构建器在 `angular.json` 中极为纯粹：

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

在 Angular 22 中，项目已迈向 **Zoneless（无 Zone.js）** 时代，变更检测不再依赖全局拦截异步 API（如 `setTimeout`、`Promise`）的 `zone.js`，而是完全依赖细粒度 Signals 与内部调度器。

这一演进深刻改变了测试的编写方式：
- 传统模式：每次设置变量后必须手工调用 `fixture.detectChanges()`；
- **现代模式**：通过 `await fixture.whenStable()` 等待所有响应式信号求值与异步渲染微任务完全稳定，确保断言在真实渲染结果上执行。

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

针对 `BookList` 组件编写全覆盖测试，验证组件实例化、Signal Input 赋值、表格渲染以及 Output 信号向上传递：

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
      imports: [BookList], // 独立组件直接导入
    }).compileComponents();

    fixture = TestBed.createComponent(BookList);
    component = fixture.componentInstance;
  });

  it('用例 1：组件在包含 Material 依赖时应成功创建', async () => {
    await fixture.whenStable();
    expect(component).toBeTruthy();
  });

  it('用例 2：应正确响应 Signal Input 注入的数据变更', async () => {
    // 现代方式：使用 componentRef.setInput 设置响应式输入信号
    fixture.componentRef.setInput('books', mockBooks);
    await fixture.whenStable();

    expect(component.books()).toEqual(mockBooks);
    expect(component.books().length).toBe(1);
  });

  it('用例 3：触发行点击应通过 Output 正确发射选中图书', async () => {
    let emittedBook: Book | undefined;

    // 订阅 Output 实例返回的 OutputEmitterRef
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

测试执行以秒级完成，所有用例全部绿灯通过：

![Vitest 极速单元测试通过](/media/posts/spring-boot-angular/img-09067.png)

---

## 7. 本章总结与后续演进

本文系统完成了从 Spring Boot 后端向现代 Angular 22 前端工程的跃迁：
1. **拥抱现代范式**：全面废弃 NgModule，以自包含的 Standalone 独立组件与 `bootstrapApplication` 作为工程新基底；
2. **掌握原生控制流**：掌握了编译期强类型推断的 `@if`、`@for (track item.id)` 与 `@switch` 语法，淘汰了旧版结构型指令；
3. **架构清晰分层**：确立了 Feature-First 目录规范，并实战了基于 `input()` 和 `output()` 响应式信号的 Smart/Dumb 架构模式；
4. **精细化按需引入**：在保持极致 Tree-shaking 的前提下，借助 Angular Material 与 `mat-table` 打造出生产级 UI；
5. **构筑测试基石**：搭建了基于 Vitest 的无 Zone.js（Zoneless）单测流水线，利用 `await fixture.whenStable()` 实现了可靠的响应式异步断言。

前端脚手架与基础架构现已稳固就绪。在下一篇中，我们将深入探讨 **AI 辅助全栈开发工作流**，并在此基础上系统攻克 **Angular 响应式表单（Reactive Forms）** 的深度实战！
