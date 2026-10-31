---
title: Spring Boot & Angular 全栈实战（十五）：利用 Signals 与 NgRx SignalStore 治理应用状态
date: 2026-10-23T00:15:00Z
description: 告别复杂样板代码，使用轻量级 NgRx SignalStore 搭配 Events 插件，以 AuthStore 为例落地清晰、类型安全且事件驱动的状态流。
category: fullstack
column: spring-boot-angular
tags:
  - Angular
  - Signals
  - NgRx
  - SignalStore
  - 状态管理
---

## 1. 前端状态治理选型决策矩阵

| 技术维度 | NgRx SignalStore + Events | 传统 NgRx Redux Store | Service + BehaviorSubject | 组件本地 Signals |
| :--- | :--- | :--- | :--- | :--- |
| **底层响应模型** | **Angular Signals 原生** | RxJS Observable 异步流 | RxJS Subject 事件多播 | 细粒度 `signal()` / `computed()` |
| **样板代码开销** | **极简**：函数式可插拔组合切片 | 繁重：分立 Actions/Reducers/Effects | 较低：但缺乏规范易演化为大泥球 | 无额外开销 |
| **单向流与溯源** | **强契约**：依托 `eventGroup` 追踪事实 | 强：严格遵循 Redux 调度链路 | 弱：随意调用 `next()` 导致竞态失控 | 仅局限于当前组件内部拓扑 |
| **异步副作用控制** | **清晰**：`withEventHandlers` 串联 RxJS | 复杂：通过 `@Injectable()` Effects 拦截 | 手动混杂在服务方法内部 | 容易在 `effect()` 中误触发异步请求 |
| **局部渲染性能** | **微任务精准刷新**：无 Zone.js 开销 | 依赖 OnPush 与异步管道触发标记 | 需手动管理取消订阅与脏检查 | 模板节点级别更新 |
| **首选应用场景** | 全局共享状态（Auth、Cart、Preferences） | 大型多团队协作的存量 Redux 系统 | 极简跨组件通信临时过渡方案 | 单个组件专属的视图控制开关 |

## 2. NgRx SignalStore + Events 生产级状态中枢范式

### 事件契约与状态定义 (`auth.events.ts` & `auth.state.ts`)

```typescript
import { eventGroup, type } from '@ngrx/signals/events';
import { SigninRequest, SignupRequest, UserInfo } from '../../../shared/models/auth';

export const authPageEvents = eventGroup({
  source: 'Auth Page',
  events: {
    signinSubmitted: type<SigninRequest>(),
    signupSubmitted: type<SignupRequest>(),
    logoutClicked: type<void>()
  }
});

export const authApiEvents = eventGroup({
  source: 'Auth API',
  events: {
    signinSuccess: type<{ user: UserInfo; accessToken: string; refreshToken: string }>(),
    signinFailure: type<{ error: string }>(),
    signupSuccess: type<void>(),
    signupFailure: type<{ error: string }>()
  }
});

export interface AuthState {
  user: UserInfo | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  error: string | null;
}

export const initialAuthState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  loading: false,
  error: null
};
```

### 核心状态中枢实现 (`auth.store.ts`)

```typescript
import { inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, exhaustMap, map, of } from 'rxjs';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { Events, withEventHandlers, withReducer, on } from '@ngrx/signals/events';
import { initialAuthState } from './auth.state';
import { authPageEvents, authApiEvents } from './auth.events';
import { AuthService } from '../services/auth.service';

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialAuthState),

  // 1. 纯函数状态转移（Reducers）
  withReducer(
    on(authPageEvents.signinSubmitted, authPageEvents.signupSubmitted, () => ({
      loading: true,
      error: null
    })),
    on(authApiEvents.signinSuccess, (event) => ({
      user: event.payload.user,
      accessToken: event.payload.accessToken,
      refreshToken: event.payload.refreshToken,
      loading: false,
      error: null
    })),
    on(authApiEvents.signinFailure, authApiEvents.signupFailure, (event) => ({
      loading: false,
      error: event.payload.error
    })),
    on(authPageEvents.logoutClicked, () => ({
      ...initialAuthState
    }))
  ),

  // 2. 派生计算信号（Computed）
  withComputed((store) => ({
    isAuthenticated: computed(() => store.accessToken() !== null),
    currentUser: computed(() => store.user()),
    userDisplayName: computed(() => {
      const u = store.user();
      return u ? `${u.firstName} ${u.lastName}` : '';
    })
  })),

  // 3. 异步副作用编排（Event Handlers）
  withEventHandlers((store, events = inject(Events), authService = inject(AuthService)) => ({
    signin$: events.on(authPageEvents.signinSubmitted).pipe(
      exhaustMap((event) =>
        authService.signin(event.payload).pipe(
          map((res) => authApiEvents.signinSuccess(res)),
          catchError((err: { message: string }) =>
            of(authApiEvents.signinFailure({ error: err.message || 'Authentication failed' }))
          )
        )
      )
    )
  })),

  // 4. 路由跳转与指令式方法
  withMethods((store, events = inject(Events), router = inject(Router)) => {
    events.on(authApiEvents.signinSuccess).pipe(takeUntilDestroyed()).subscribe(() => {
      router.navigate(['/books']);
    });

    return {
      clearError: () => patchState(store, { error: null })
    };
  })
);
```

## 3. 组件层消费 SignalStore 生产范式

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { injectDispatch } from '@ngrx/signals/events';
import { AuthStore } from '../../store/auth.store';
import { authPageEvents } from '../../store/auth.events';
import { SigninRequest } from '../../../../shared/models/auth';
import { SigninForm } from '../../components/signin-form/signin-form';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-signin-page',
  standalone: true,
  imports: [SigninForm, MatProgressSpinnerModule],
  template: `
    <div class="signin-container p-6 max-w-md mx-auto">
      <h1 class="text-2xl font-bold mb-4">用户登录</h1>

      @if (store.error()) {
        <div class="error-banner p-3 mb-4 bg-red-100 text-red-700 rounded">
          {{ store.error() }}
        </div>
      }

      <app-signin-form (signinComplete)="onSignin($event)" />

      @if (store.loading()) {
        <div class="spinner-overlay flex justify-center mt-4">
          <mat-spinner diameter="32" />
        </div>
      }
    </div>
  `
})
export class SigninPage implements OnInit {
  protected readonly store = inject(AuthStore);
  protected readonly dispatch = injectDispatch(authPageEvents);

  ngOnInit(): void {
    this.store.clearError();
  }

  onSignin(credentials: SigninRequest): void {
    // 组件不处理任何 HTTP 请求或路由跳转，纯粹派发意图事件
    this.dispatch.signinSubmitted(credentials);
  }
}
```

## 4. Signals 状态治理避坑清单 (Do's & Don'ts)

| 错误实践 (Don't) | 正确实践 (Do) |
| :--- | :--- |
| 在 `effect()` 内部直接触发异步 HTTP 请求并等待返回。 | 使用 `toObservable` 将 Signal 转换为 RxJS 数据流，配合 `exhaustMap` 或 `switchMap` 管理异步并发与竞态。 |
| 在 Reducer 或 `patchState` 中直接修改嵌套对象属性（破坏不可变性）。 | 遵循不可变原则，返回新的 Partial State 字典，或使用展开运算符 `{ ...state, user: { ...state.user, role } }`。 |
| 在 Reducer 或 EventHandler 内部直接调用 `router.navigate()` 产生路由副作用。 | 将路由跳转声明在 `withMethods` 中对事件流的独立订阅管道中，保持 Reducer 与 EventHandler 纯粹。 |
| 为每个组件私有状态都建立全局 SignalStore。 | 区分全局应用级状态（如认证、购物车）与组件内部私有状态（本地 `signal()` 控制显隐）。 |
| 在模板中反复直接调用无缓存的高开销计算函数。 | 使用 `computed()` 封装派生逻辑，享有惰性求值与依赖项变动前结果缓存的红利。 |

<!-- split -->

# 原著完整参考：第 15 章 使用 Signals 与 Store 管理状态（Managing State with Signals and Stores）

在上一章中，我们重点构建了用于支持认证和图书管理业务流程的高级响应式表单。我们建立了可复用的表单模式，实现了高级校验，集成了 Angular Material 以打造精致的 UI，甚至借助 AI 辅助开发简化了重复的表单创建任务。

在本章中，我们将把注意力转向一个全新的挑战：随着书店应用复杂度的攀升，如何高效管理应用程序状态。我们将从 Angular 的信号原语（Signal primitives）讲起，接着探讨当状态规模超出组件间直接传递的承载能力时，为什么引入 Store（状态仓库）会成为必然选择。

随后，我们将探索 Angular 现代基于信号的响应式模型，并学习 NgRx SignalStore 如何基于这些原语构建出可预测、易测试的状态容器。在此基础上，我们将深入剖析 Events 插件（`@ngrx/signals/events`），它在无需传统 Redux 模式繁琐样板代码的前提下，引入了事件驱动的 Flux 风格架构。最后，我们将使用 Events 插件实现一个完整的 `AuthStore`（认证状态仓库），确立后续章节在图书和作者 CRUD 操作中可直接复用的状态架构模式。

学完本章后，你将掌握如何利用 Angular 信号与 NgRx SignalStore 构建结构清晰、易于维护且事件驱动的状态仓库，为应用的持续扩展打下坚实的基础。

本章核心涵盖以下主题：

- 理解开发思路与方案（Understanding our development approach）
- 深入理解 Angular 信号（Understanding Angular signals）
- NgRx SignalStore 简介（Introducing NgRx SignalStore）
- 构建认证状态仓库（Building the authentication store）
- 测试 AuthStore（Testing the AuthStore）
- 将 Store 与 UI 组件集成（Integrating the store with UI components）

## 技术准备工作（Technical requirements）

本章的完整源代码可在此处获取：

`https://github.com/PacktPublishing/Spring-Boot-and-Angular-2E_Frontend/tree/main/chapter-15/`

## 理解开发思路与方案（Understanding our development approach）

延续第 14 章的成功模式，本章我们将通过聚焦且动手实战的方式来实现状态管理。我们将使用 Events 插件手动构建认证仓库（AuthStore），涵盖事件定义（Event definition）、纯函数事件处理器（Pure event handlers）、用于派生状态的计算信号（Computed signals）、异步操作处理、组件集成以及全方位的单元测试。这将确立一套架构模式与最佳实践，后续章节在实现图书和作者的 CRUD 状态仓库时将再次复用这套模式。

在我们深入学习 Events 插件与动手实现之前，先来扎实掌握 Angular 信号与 NgRx SignalStore 的核心基础知识。我们将从探索信号原语、计算属性以及副作用（Effects）开始。

## 深入理解 Angular 信号（Understanding Angular signals）

**Angular 信号（Angular signals）**代表了我们在 Angular 应用中处理响应式与状态管理方式的根本性变革。信号最初在 Angular 16 中引入，并在后续版本中不断打磨完善，它提供了一种比基于 Zone.js 的传统变更检测模式更高性能、更直观的替代方案。在深入研究 SignalStore 之前，透彻理解信号至关重要，因为整个架构都建立在这些信号原语之上。

### 信号基础（Signal fundamentals）

从本质上讲，信号是一个响应式的值容器（reactive value container），当其内部的值发生变化时，它会主动通知依赖该值的消费者。与传统的基于 Observable 的模式不同（在后者中你需要订阅数据流），信号提供了对其当前值的同步读取访问，同时能自动追踪依赖关系以实现响应式更新。

让我们从一个基础示例开始：

```typescript
import { signal } from '@angular/core';

export class BookList {
  // 创建一个带有初始值的信号
  bookCount = signal<number>(0);

  // 读取信号的值
  getCount() {
    return this.bookCount(); // 像调用函数一样调用信号
  }

  // 更新信号的值
  addBook() {
    this.bookCount.update(count => count + 1);
  }

  // 设置特定值
  resetCount() {
    this.bookCount.set(0);
  }
}
```

信号提供了三种主要操作：

- **读取（Reading）**：将信号作为函数调用（如 `bookCount()`）即可访问其当前值
- **写入（Writing）**：使用 `set()` 彻底替换当前值
- **更新（Updating）**：使用 `update()` 根据当前值计算并推导出新值

### 计算信号（Computed signals）

**计算信号（Computed signals）**的值派生自其他信号，当其依赖的信号发生变化时会自动重新计算。它们具有惰性求值（lazy）的特性——只有在被读取时才会重新计算，并且在依赖项发生变化之前会将计算结果缓存下来。让我们看看如何应用它们：

```typescript
import { signal, computed } from '@angular/core';

export class BookCatalog {
  books = signal<Book[]>([]);
  searchTerm = signal<string>('');

  // 计算信号会自动追踪其依赖项
  filteredBooks = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.books().filter(book =>
      book.title.toLowerCase().includes(term)
    );
  });

  // 串联多个计算信号
  bookCount = computed(() => this.filteredBooks().length);
}
```

计算信号的优势包括：

- **自动更新（Automatic updates）**：修改 `searchTerm` 或 `books`，`filteredBooks` 就会自动更新
- **高效缓存（Efficient caching）**：仅在依赖项发生改变时才重新计算，而不是每次读取时都重新计算
- **易于组合（Composable）**：允许我们通过串联多个计算信号来构建复杂的派生数据逻辑
- **类型安全（Type-safe）**：在整个计算调用链上享有完整的 TypeScript 类型推导

### 副作用与响应式（Effects and reactivity）

**副作用（Effects）**会在信号值发生变化时执行相应的副作用逻辑，从而在 Angular 的响应式信号系统与命令式代码（如 API 调用或 DOM 操作）之间架起桥梁。我们可以这样使用它们：

```typescript
import { signal, effect } from '@angular/core';

export class BookSearch {
  searchTerm = signal<string>('');

  constructor(private bookService: BookService) {
    // 只要 searchTerm 发生改变，effect 就会执行
    effect(() => {
      const term = this.searchTerm();
      console.log('Search term changed:', term);
    });
  }
}
```

在这个示例中，我们创建了一个 `searchTerm` 信号，并在构造函数中注册了一个 `effect`。在 `effect` 内部读取该信号会建立一个响应式依赖关系；因此，每当 `searchTerm` 发生变化时，该 `effect` 就会重新运行并执行其副作用（此处为打印新值）。副作用最适合用于将信号状态镜像同步到外部世界，例如日志记录、埋点分析或同步到 `localStorage`。

> **注意**
>
> `effect` 并不是编排 HTTP 搜索请求的首选位置。一种常见的反模式是在每次 `searchTerm` 改变时都在 `effect` 内部启动一个新的订阅。这可能导致并发的在途请求相互重叠，并在较新的输入到达后出现陈旧过时的响应。对于请求管道，推荐将信号转换为数据流，并利用 RxJS 操作符来进行防抖、去重、取消和资源清理：

```typescript
// 从 '@angular/core/rxjs-interop' 导入 toObservable 和 takeUntilDestroyed
// 从 'rxjs' 导入操作符
toObservable(this.searchTerm)
  .pipe(
    map(term => term.trim()),
    filter(term => term.length > 2),
    debounceTime(300),
    distinctUntilChanged(),
    switchMap(term => this.bookService.search(term)),
    takeUntilDestroyed(),
  )
  .subscribe(results => {
    console.log(results);
  });
```

> **注意**
>
> 在本书后续将搜索流程连接到后端 API 时，我们就会采用这种基于数据流的方案。

副作用具有以下显著特征：

- 当其依赖的信号发生改变时会自动运行
- 在 Angular 的依赖注入上下文（Injection Context）中执行
- 当组件被销毁时会自动进行清理
- 对于派生状态，应优先使用计算信号（computed signals）而非副作用（effects）

副作用的常见使用场景包括：

- 当状态变化时记录日志或上报埋点数据
- 与 `localStorage` 或外部 API 进行状态同步
- 触发动画或 DOM 更新
- 在开发过程中调试信号的变化

在掌握了这些信号基础知识后，我们就可以探索 NgRx SignalStore 如何基于这一响应式基石来创建可伸缩的状态管理解决方案了。

## NgRx SignalStore 简介（Introducing NgRx SignalStore）

NgRx SignalStore 是一个轻量级、信号原生的状态管理库，专为 Angular 现代响应式原语设计。与拥有 action/reducer/effect 架构的传统 NgRx Store 不同，SignalStore 崇尚极简主义，同时保留了企业级应用所期望的可预测性与可测试性。作为 NgRx 团队独立开发的轻量级库，它为利用 Angular 信号管理应用状态提供了规范的模式。它的目的并非要完全取代全功能的 NgRx Store，而是为那些希望拥有集中式、响应式状态管理，同时期望大幅减少样板代码并获得更清晰心智模型的研发团队提供一个针对性方案。

以下是 NgRx SignalStore 区别于传统 NgRx 的几大核心差异：

- **信号优先（Signal-first）**：原生构建于 Angular 信号之上，而非 RxJS Observable
- **更少样板代码（Less boilerplate）**：无需拆分独立的 action、reducer 和 effect 文件
- **更简明的心智模型（Simpler mental model）**：支持直接进行状态更新，而无需繁琐地派发 action
- **更优越的性能（Better performance）**：充分利用信号的细粒度响应特性
- **渐进式采用（Gradual adoption）**：既可与传统 NgRx 并存使用，也可完全独立使用

### 安装与配置（Installation and setup）

让我们来安装 NgRx SignalStore。在项目根目录下打开终端并运行：

```bash
npm install @ngrx/signals@22
```

注意我们指定了版本号 `22`，以确保与 Angular 22 的兼容性。NgRx 遵循 Angular 的版本号策略，因此其主版本号应与你的 Angular 版本保持一致。无需进行任何额外配置。与传统 NgRx 不同，SignalStore 不需要根级别的 Provider 配置或模块导入。每个 Store 都是一个独立的 Service，可以根据需要在组件级别或应用根级别提供。

### Store 基础结构（Basic store structure）

在深入探索 Events 插件之前，我们先通过一个简单的示例来理解 SignalStore 的基本组成单元。这有助于我们在下一节引入事件驱动架构之前，彻底吃透其核心概念。

我们将创建一个管理图书列表和加载状态的极简图书仓库（BookStore）。该 Store 将展示 SignalStore 的核心特性而暂不引入事件的复杂性，让我们能够聚焦于 `withState()` 和 `withMethods()` 如何协同工作来创建响应式状态容器。

具体而言，我们将重点关注：

1. **状态定义（State definition）**：了解如何使用 TypeScript 接口定义 Store 的状态结构
2. **初始状态（Initial state）**：在 Store 创建时设置默认值
3. **状态组合（State composition）**：使用 `withState()` 将状态属性转变为响应式信号
4. **方法定义（Methods）**：使用 `withMethods()` 定义能够读取和更新状态的函数
5. **直接变更（Direct mutations）**：理解 `patchState()` 如何以不可变方式更新状态

每个 SignalStore 都是通过使用类似 `withState()`、`withMethods()` 和 `withComputed()` 等特性函数组合构建而成的。这些组合函数会被传入 `signalStore()` 中，后者将它们拼装为一个可注入的服务（Injectable Service）。每个特性函数都会赋予 Store 相应的能力：`state` 增加了响应式属性，`methods` 增加了更新方法，而 `computed` 则增加了派生计算值。

现在让我们看看实际代码：

```typescript
import { signalStore, withState, withMethods, patchState }
  from '@ngrx/signals';

// 定义状态结构
interface BookState {
  books: Book[];
  loading: boolean;
}

// 初始状态
const initialState: BookState = {
  books: [],
  loading: false
};

// 创建 Store
export const BookStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => ({
    addBook(book: Book) {
      // 使用 patchState 进行直接状态更新
      patchState(store, (state) => ({
        books: [...state.books, book]
      }));
    },
    setLoading(loading: boolean) {
      patchState(store, { loading });
    }
  }))
);
```

让我们剖析一下这里发生的细节：

- **状态定义（`withState`）**：调用 `withState(initialState)` 会将 `initialState` 中的每个属性都转换为一个信号。经过此组合后，`store.books()` 和 `store.loading()` 就变成了可读信号，组件可以以响应式方式消费它们。
- **方法定义（`withMethods`）**：`withMethods()` 函数接收 Store 实例并返回一个包含各方法的对象。这些方法可以访问 Store 的状态，并能调用 `patchState()` 进行更新。注意 `addBook` 是如何使用展开运算符（Spread Operator）创建新数组的；这种不可变性对于信号变更检测至关重要。
- **不可变更新（`patchState()`）**：`patchState()` 函数既可以接收一个包含新属性值的对象（如 `{ loading }`），也可以接收一个接收当前状态并返回更新对象的函数（如 `(state) => ({ books: [...state.books, book] })`）。这两种方式都会创建全新的状态对象，而不是直接修改现有的状态。
- **Provider 配置（`{ providedIn: 'root' }`）**：`{ providedIn: 'root' }` 选项将该 Store 声明为在整个应用中可用的单例服务，其工作机制与带有 `@Injectable({ providedIn: 'root' })` 的常规服务完全一致。

以下是在组件中使用该 Store 的方式：

```typescript
import { Component, inject } from '@angular/core';
import { BookStore } from './book.store';

@Component({
  selector: 'book-list-demo',
  template: `
    <div>
      <p>Total books: {{ store.books().length }}</p>
      <p>Loading: {{ store.loading() }}</p>

      @for (book of store.books(); track book.id) {
        <div>{{ book.title }}</div>
      }
    </div>
  `
})
export class BookListDemo {
  protected readonly store = inject(BookStore);

  addNewBook() {
    this.store.addBook({
      id: 1,
      title: 'Clean Code',
      authorName: 'Robert C. Martin',
      genre: 'Software Engineering',
      price: 29.99,
      published: '2008-08-01',
      isbn: '978-0132350884'
    });
  }
}
```

Store 将所有的状态属性都暴露为信号，使得组件能够以响应式方式读取其值。通过 `withMethods()` 定义的方法提供了受控的状态更新途径，从而确保了状态变更的可预测性。

#### 这里缺失了什么？（What's missing here?）

这种基础方案在简单场景下运作良好，但随着 Store 的规模逐渐膨胀，我们将会面临以下挑战：

- 方法将“发生了什么”（业务逻辑）与“如何响应”（状态更新）混杂在了一起
- 编写测试时必须同时调用方法并验证状态变化
- 用户行为操作与状态流转之间缺乏清晰的解耦与界限
- 越来越难以追踪导致当前状态的一系列操作序列

这些局限性正是 Events 插件要解决的问题。在下一节中，我们将看到事件驱动架构如何在保持 SignalStore 简洁性的同时，逐一攻克这些痛点。

> **注意**
>
> 在我们构建 Store 之前，先来建立 Events 插件（`@ngrx/signals/events`）背后的心智模型。在基础的 SignalStore 中，状态是通过方法直接变更的；而 Events 插件则引入了借鉴自事件驱动架构的精炼且明确的词汇表：**事件（Event）**是对发生的事情的纯粹描述（如 `signinSubmitted`、`signinSuccess`），使用 `eventGroup` 和 `type()` 进行创建；**Reducer**（位于 `withReducer` 内部的 `on()`）是一个纯函数，它将当前状态与事件映射为下一个新状态，绝不包含任何副作用；**事件处理器（Event handler）**（通过 `withEventHandlers` 定义）则响应事件并执行副作用操作（如 HTTP 请求），并将其执行结果作为后续事件派发出去。组件绝不直接触碰状态，它们只需通过 `injectDispatch` 派发事件，由 Store 统筹决定后续动作。在阅读后续实现代码时，请时刻牢记这一闭环流程：**派发事件（dispatch） → Reducer 更新状态 → 事件处理器执行副作用 → 派发下一个事件**。

## 构建认证状态仓库（Building the authentication store）

既然我们已经掌握了 SignalStore 的基础知识并了解了事件驱动架构的优势，现在正是使用 Events 插件构建我们第一个生产级 Store 的时候了。我们之所以从认证（Authentication）而非图书开始，是因为认证状态更加紧凑直接：它仅包含用户信息、令牌以及一个加载标志位。这使我们能够将精力集中在事件驱动模式的核心机制上，而不会受到数组、数据过滤与排序等附加复杂度的干扰。一旦我们在此处确立了这些模式，在第 17 章将其推广复用到图书和作者的 CRUD 状态管理中就会水到渠成。我们的认证仓库将负责处理：

- 使用邮箱和密码登录
- 注册新用户
- 追踪当前认证用户与令牌（Tokens）
- 管理加载中（Loading）与错误（Error）状态
- 用户登出与清理会话数据

### 组织 Store 目录结构（Organizing the store directory）

在动手编写代码之前，先为我们的 Store 建立清晰的目录规范。在 `auth` 功能模块下，我们将创建一个专门的 `store` 文件夹：

```
src/app/features/auth/
├── components/
│   ├── signup-form/
│   └── signin-form/
├── pages/
│   ├── signup/
│   └── signin/
├── services/
│   └── auth.service.ts
└── store/                # 新增的 store 目录
    ├── auth.events.ts    # 事件定义
    ├── auth.state.ts     # 状态接口与初始状态
    └── auth.store.ts     # Store 核心实现
```

### 何时创建 Store（When to create a store）

请牢记，并非所有功能特性都需要创建 Store。在以下场景中，创建 Store 是最佳选择：

- **多个组件需要消费同一份数据**（在当前场景下，登录页、注册页以及应用顶栏 Header 都需要获取认证状态）
- **状态需要在页面路由跳转之间保持持久**（用户的登录认证状态应当在所有页面跳转间始终保持）
- **复杂的状态流转逻辑需要集中进行单元测试**（包含多步错误处理的登录流）
- **状态的变更来自多个源头**（用户的直接交互操作以及定时令牌刷新任务）

### Provider 作用域（Provider scope）

我们将为 AuthStore 配置 `{ providedIn: 'root' }`，使其成为在整个应用生命周期中全局可用的单例服务。认证状态本质上是全局性的——任何组件都可能需要检查用户是否处于登录状态，或者访问当前登录用户的姓名。

### 认证响应接口（Auth response interfaces）

在定义 Store 的状态之前，我们先在 `shared/models/auth.ts` 中扩展 Store 所需的响应类型定义。我们在第 14 章中定义的请求 DTO 直接映射到了后端 Java DTO 类，而这些响应类型则代表了认证成功后 API 所返回的数据契约。其结构由第 8 章构建的安全配置所决定，在那一章中后端的 Keycloak 集成定义了 JWT 令牌响应与用户信息 Payload 的具体形态。`AuthResponse` 描述了 API 返回的完整数据负载。我们的 Store 只需要用户信息与两个令牌，因此服务层将其精简为这三个字段；在第 16 章我们将 Mock 服务替换为真实的 HTTP 请求时，会直接使用这个完整的接口：

```typescript
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserInfo;
}

export interface UserInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}
```

### 定义认证事件与状态结构（Defining auth events and state shapes）

首先，我们来定义代表认证业务流程中各种行为的事件。在 `src/app/features/auth/store/auth.events.ts` 中创建新文件：

```typescript
import { eventGroup, type } from '@ngrx/signals/events';
import { SigninRequest, SignupRequest, UserInfo }
  from '../../../shared/models/auth';

export const authPageEvents = eventGroup({
  source: 'Auth Page',
  events: {
    signinSubmitted: type<SigninRequest>(),
    signupSubmitted: type<SignupRequest>(),
    logoutClicked: type<void>(),
  },
});

export const authApiEvents = eventGroup({
  source: 'Auth API',
  events: {
    signinSuccess: type<{
      user: UserInfo;
      accessToken: string;
      refreshToken: string;
    }>(),
    signinFailure: type<{ error: string }>(),
    signupSuccess: type<void>(),
    signupFailure: type<{ error: string }>(),
  },
});
```

这里有几项关键的事件组织原则需要注意：

- **按数据源分组（Group by source）**：我们使用 `authPageEvents` 表示 UI 层的用户交互，使用 `authApiEvents` 表示异步 API 的执行结果。
- **描述性命名（Descriptive names）**：页面事件使用过去式命名（如 `signinSubmitted`、`logoutClicked`），因为它们代表用户已经完成的操作事实。API 事件则根据其报告的结果命名：`signinSuccess`、`signinFailure`。
- **强类型载荷（Typed payloads）**：`signinSubmitted` 携带了来自第 14 章的 `SigninRequest` 接口，确保全应用范围内的类型一致性。
- **无载荷使用 void（Void for no payload）**：`logoutClicked` 和 `signupSuccess` 不需要携带任何数据，因此我们将它们标记为 `void`。

现在让我们在 `src/app/features/auth/store/auth.state.ts` 中定义状态的结构：

```typescript
import { UserInfo } from '../../../shared/models/auth';

export interface AuthState {
  // 用户数据
  user: UserInfo | null;
  accessToken: string | null;
  refreshToken: string | null;

  // UI 状态
  loading: boolean;
  error: string | null;
}

export const initialAuthState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  loading: false,
  error: null,
};
```

认证状态天然非常紧凑：我们追踪当前登录用户、一对 JWT 令牌，以及用于 UI 反馈的 `loading` 和 `error` 标志位。这种精炼的结构使其成为我们的第一个 Store 的理想选择。我们可以在后续章节处理包含数组、数据过滤与排序的更复杂业务域之前，先专注于吃透事件流、Reducers、事件处理器以及计算信号等事件驱动核心机制。

### 实现认证服务（Implementing the auth service）

Store 的事件处理器将调用认证服务来执行 API 操作。目前，我们将使用一个模拟真实 API 行为的 Mock 服务。你可以在 GitHub 仓库的 `chapter-15/src/app/features/auth/services/auth.service.ts` 中找到该服务的完整实现代码。

该服务提供了两个方法：

```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  signin(credentials: SigninRequest): Observable<{
    user: UserInfo;
    accessToken: string;
    refreshToken: string;
  }> {
    // 模拟 POST /users/signin
    // 经过一定延迟后返回用户信息和 JWT 令牌
  }

  signup(data: SignupRequest): Observable<void> {
    // 模拟 POST /users/signup
    // 经过一定延迟后在成功时返回 void
  }
}
```

该 Mock 服务的设计细节精准复刻了真实 API 集成的形态：

- **模拟网络延迟（Simulated latency）**：使用 `delay()` 模拟真实 API 的响应时间，使我们能够充分测试 UI 的 loading 加载状态。
- **相同的接口签名（Same interface）**：方法签名与我们在第 16 章使用 `HttpClient` 时的签名完全保持一致。
- **错误处理（Error handling）**：无效凭据会返回一个带有错误的 Observable，就如同真实的 401 响应一样。
- **模拟令牌生成（Token simulation）**：返回模拟的 JWT 令牌，以便我们能够构建完整的认证业务流程。

在第 16 章中，我们将把 Mock 实现无缝替换为真实的 HTTP 请求。由于方法签名完全不变，届时 Store 的代码不需要进行任何改动。

#### 为什么不使用 OAuth 第三方类库？（Why not use an OAuth library?）

你可能会好奇，为什么我们要手动实现认证逻辑，而不是使用诸如 `angular-oauth2-oidc` 之类的成熟类库？我们的后端虽然采用 Keycloak 作为身份提供商（Identity Provider），但它将 Keycloak 封装在自定义 REST 端点（`/users/signin`、`/users/signup`、`/users/refresh-token`、`/users/logout`）之后，而没有将标准 OAuth2/OIDC 流程直接暴露给前端。这意味着前端从不需要跳转重定向到授权服务器，也不需要执行授权码交换流程；前端仅需向我们的后端 API 发送凭据，并在响应中获取 JWT 令牌。而此类 OAuth 类库通常期望对接标准的 OIDC 端点（如 `/authorize`、`/token`、`/.well-known/openid-configuration`）并实现带有 PKCE 的授权码流（Authorization Code Flow with PKCE）。由于后端已经将这些底层细节全部抽象封装，强行使用该类类库只会与其设计机制产生冲突，反而徒增障碍。更重要的是，手动管理令牌能让我们深入理解 JWT 认证在实战中的完整工作机理，包括令牌存储、通过 HTTP 拦截器附加令牌、处理令牌无感刷新流以及登出时清理状态。无论底层对接何种身份提供商，这些概念与技能在任何企业级 Angular 生产应用中都是完全相通且必不可少的。

### 实现 Reducer 与状态变更（Implementing reducers and state changes）

在定义好事件与状态结构后，我们就可以将它们组合成一个运行中的 Store 了。在 `src/app/features/auth/store/auth.store.ts` 中创建主 Store 文件：

```typescript
// .. 导入相关模块
export const AuthStore = signalStore(
  { providedIn: 'root' },

  // 初始化状态
  withState(initialAuthState),
```

我们在该 Store 中管理的认证状态被拆分为几个鲜明的功能切片：

- **`withReducer` 包含返回局部状态的 Reducer**：每个 `on()` 处理器只返回发生变化的属性。SignalStore 会自动将这些属性与现有状态进行合并。注意 `signinSuccess` 是如何同时设置全部五个属性的，而 `signinFailure` 仅修改了 `loading` 和 `error`：

```typescript
withReducer(
  on(authPageEvents.signinSubmitted, () => ({
    loading: true,
    error: null,
  })),

  on(authApiEvents.signinSuccess, (event) => ({
    user: event.payload.user,
    accessToken: event.payload.accessToken,
    refreshToken: event.payload.refreshToken,
    loading: false,
    error: null,
  })),

  on(authApiEvents.signinFailure, (event) => ({
    loading: false,
    error: event.payload.error,
  })),

  // .. 更多 on 处理器
),
```

- **`withComputed` 声明派生自状态的计算信号**：

`isAuthenticated` 检查令牌是否存在且不为 null，`userDisplayName` 将用户的姓和名拼接在一起。当底层状态发生变化时，这些计算信号会自动更新：

```typescript
withComputed((store) => ({
  isAuthenticated: computed(() => store.accessToken() !== null),
  currentUser: computed(() => store.user()),
  userDisplayName: computed(() => {
    const user = store.user();
    return user ? `${user.firstName} ${user.lastName}` : '';
  }),
})),
```

> **注意**
>
> 这里的 `isAuthenticated()` 仅仅是一个**存在性检查（presence check）**：它只确认令牌是否存在，并不保证令牌仍然处于有效期内。访问令牌（Access tokens）通常生命周期较短（后端签发的访问令牌有效期为 5 分钟），因此存储的令牌虽然存在但可能已经过期，此时发起 API 请求将会返回 `401`。在本章中我们让 Store 专注于状态结构本身；**令牌刷新流程（Token refresh flow）**、触发该流程的 HTTP 错误处理机制，以及第 14 章中暂缓实现的 `rememberMe` 选项，都将在第 16 章中我们将 Store 对接真实认证 API 时完整落地。

- **`withEventHandlers` 声明返回后续事件的事件处理器**：`signin$` 事件处理器监听 `signinSubmitted` 事件，调用服务，并根据执行结果返回 `signinSuccess` 或 `signinFailure`。这些返回的事件会被自动派发并流向对应的 Reducer；无需手动触发派发：

```typescript
withEventHandlers(
  (
    store,
    events = inject(Events),
    authService = inject(AuthService),
    router = inject(Router),
  ) => ({
    signin$: events.on(authPageEvents.signinSubmitted).pipe(
      // exhaustMap 防止重复请求：当登录请求处于进行中时，后续的 signinSubmitted 事件将被忽略。
      // 这可以防止用户快速连击按钮导致的表单重复提交
      exhaustMap((event) =>
        authService.signin(event.payload).pipe(
          map((response) =>
            authApiEvents.signinSuccess(response)),
          catchError((error: { message: string }) =>
            of(authApiEvents.signinFailure({
              error: error.message }))
          )
        )
      ),

    signup$: events.on(authPageEvents.signupSubmitted).pipe(
      exhaustMap((event) =>
        authService.signup(event.payload).pipe(
          map(() => authApiEvents.signupSuccess()),
          catchError((error: { message: string }) =>
            of(authApiEvents.signupFailure({
              error: error.message }))
          )
        )
      ),
    })
  ),
```

- **在 `withMethods` 中处理路由导航**：我们通过订阅成功事件来触发路由导航。

将导航逻辑放在独立的订阅中，而不是放在 Reducer 或事件处理器内部，保持了至关重要的架构分工：Reducer 保持纯粹，事件处理器专注于返回后续事件而非直接执行路由导航。每个订阅都通过 `takeUntilDestroyed()` 进行了管道绑定，因此会随 Store 的销毁而自动注销。虽然该 Store 在根级别提供并在应用的整个生命周期中存活，但现在就将清理逻辑连接好，意味着如果未来该 Store 被作用域限定在某个特性模块或特定路由下，它依然能够正确销毁释放。该代码块还返回了 `clearError()`，登录页和注册页在挂载时会调用该方法，以清除上一次尝试所遗留的陈旧错误信息，避免错误状态跨页面残留：

```typescript
withMethods(
    (store, events = inject(Events), router = inject(Router)) => {
      // 登录成功后导航跳转到图书列表
      events
        .on(authApiEvents.signinSuccess)
        .pipe(takeUntilDestroyed())
        .subscribe(() => router.navigate(['/books']));

      // 注册成功后导航跳转到登录页
      events
        .on(authApiEvents.signupSuccess)
        .pipe(takeUntilDestroyed())
        .subscribe(() => router.navigate(['/auth/signin']));
      return {
        clearError: () => patchState(store, { error: null }),
      };
    }
  ),
);
```

### 事件流动链路（The event flow）

为了直观理解这些环节如何协同工作，我们来完整追踪一次用户登录时的事件流转历程：

1. **用户（User）**在表单组件中点击 **Sign in** 按钮，组件随后派发 `authPageEvents.signinSubmitted({ email, password })`。
2. **Reducer** 处理 `signinSubmitted` 事件：将 `loading` 置为 `true`，并清空 `error`。
3. **事件处理器（Event handler）** `signin$` 捕获该事件，调用 `authService.signin()` 发起认证。
4. 后端服务返回响应 → 事件处理器返回 `authApiEvents.signinSuccess({ user, accessToken, refreshToken })`。
5. **Reducer** 处理 `signinSuccess` 事件：保存用户信息和令牌，并将 `loading` 置为 `false`。
6. **计算信号（Computed）** `isAuthenticated` 自动重新求值并翻转为 `true`。
7. **导航订阅者（Navigation subscriber）** 捕获 `signinSuccess` 事件，路由跳转至 `/books`。

这种单向数据流——**事件（Event） → Reducer → 状态（State） → 计算信号（Computed） → UI**——正是事件驱动架构的核心价值所在。每一处状态的变更都可以精准追溯到某个具体的触发事件。既然 Store 已经掌管了完整的认证生命周期，我们就可以对各个环节进行独立的单元测试了。

## 测试 AuthStore（Testing the AuthStore）

对事件驱动的 Store 进行测试非常简便直观，因为这种架构模式天然实现了关注点分离：派发一个事件，然后验证最终的状态结果即可。在本节中，我们将使用 Vitest 的 `vi.fn()` 进行 Mock 模拟，并使用 Dispatcher 服务在测试用例中直接派发事件。我们的测试套件涵盖五个测试维度：初始状态、登录流（成功与失败）、注册流、登出流以及计算信号。

让我们创建 `src/app/features/auth/store/auth.store.spec.ts` 文件：

```typescript
// .. 导入测试依赖
describe('AuthStore', () => {
  // .. 测试环境初始化与 Mock 数据

  describe('Initial State', () => {
    it('should have no authenticated user', () => {
      expect(store.user()).toBeNull();
      expect(store.accessToken()).toBeNull();
      expect(store.isAuthenticated()).toBe(false);
      expect(store.loading()).toBe(false);
      expect(store.error()).toBeNull();
    });
  });

  describe('Signin Flow', () => {
    it('should set loading when signin is submitted', () => {
      authService.signin.mockReturnValue(
        of(mockAuthResponse).pipe(delay(50))
      );

      dispatcher.dispatch(
        authPageEvents.signinSubmitted({
          email: 'test@bookstore.com',
          password: 'password123',
        })
      );

      expect(store.loading()).toBe(true);
      expect(store.error()).toBeNull();
    });

    it('should store user and tokens on signin success', () => {
      dispatcher.dispatch(
        authApiEvents.signinSuccess(mockAuthResponse)
      );

      expect(store.user()).toEqual(mockUser);
      expect(store.accessToken()).toBe('mock-access-token');
      expect(store.refreshToken()).toBe('mock-refresh-token');
      expect(store.loading()).toBe(false);
      expect(store.isAuthenticated()).toBe(true);
    });

    it('should set error on signin failure', () => {
      dispatcher.dispatch(
        authApiEvents.signinFailure({
          error: 'Invalid credentials',
        })
      );

      expect(store.error()).toBe('Invalid credentials');
      expect(store.loading()).toBe(false);
      expect(store.isAuthenticated()).toBe(false);
    });

    it('should call auth service when signin submitted',
      async () => {
        authService.signin.mockReturnValue(of(mockAuthResponse));

        dispatcher.dispatch(
          authPageEvents.signinSubmitted({
            email: 'test@bookstore.com',
            password: 'password123',
          })
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(authService.signin).toHaveBeenCalledWith({
          email: 'test@bookstore.com',
          password: 'password123',
        });
        expect(store.isAuthenticated()).toBe(true);
        expect(store.user()).toEqual(mockUser);
      }
    );

    it('should handle service errors', async () => {
      const error = new Error('Network error');
      authService.signin.mockReturnValue(
        throwError(() => error)
      );

      dispatcher.dispatch(
        authPageEvents.signinSubmitted({
          email: 'test@bookstore.com',
          password: 'wrong',
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(store.error()).toBe('Network error');
      expect(store.isAuthenticated()).toBe(false);
    });

    it('should navigate to /books on signin success',
      async () => {
        authService.signin.mockReturnValue(of(mockAuthResponse));

        dispatcher.dispatch(
          authPageEvents.signinSubmitted({
            email: 'test@bookstore.com',
            password: 'password123',
          })
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(router.navigate).toHaveBeenCalledWith(['/books']);
      }
    );
  });

  describe('Signup Flow', () => {
    // .. 注册流程测试用例，与登录流程类似
  });

  describe('Logout', () => {
    it('should clear all auth state', () => {
      // 首先，模拟一个已登录的状态
      dispatcher.dispatch(
        authApiEvents.signinSuccess(mockAuthResponse)
      );
      expect(store.isAuthenticated()).toBe(true);

      // 现在执行登出
      dispatcher.dispatch(authPageEvents.logoutClicked());

      expect(store.user()).toBeNull();
      expect(store.accessToken()).toBeNull();
      expect(store.refreshToken()).toBeNull();
      expect(store.isAuthenticated()).toBe(false);
      expect(store.loading()).toBe(false);
      expect(store.error()).toBeNull();
    });
  });

  describe('Computed Signals', () => {
    it('should compute userDisplayName', () => {
      expect(store.userDisplayName()).toBe('');

      dispatcher.dispatch(
        authApiEvents.signinSuccess(mockAuthResponse)
      );

      expect(store.userDisplayName()).toBe('Alice Johnson');
    });

    it('should compute isAuthenticated from token', () => {
      expect(store.isAuthenticated()).toBe(false);

      dispatcher.dispatch(
        authApiEvents.signinSuccess(mockAuthResponse)
      );

      expect(store.isAuthenticated()).toBe(true);
    });
  });
});
```

该测试套件展示了几个关键的测试模式：

- **直接事件派发（Direct event dispatch）**：我们使用 `dispatcher.dispatch()` 直接向 Store 发送事件，完全跳过了 UI 层。这使得 Store 的状态逻辑与具体的组件表现彻底解耦隔离。
- **同步与异步测试区分（Sync vs async testing）**：Reducer 测试（例如 `signinSuccess`）是同步执行的：派发事件后，立即断言状态结果。而事件处理器测试（例如“应当调用 auth service”）则是异步的：我们派发事件，通过 `setTimeout` 等待事件处理器执行完毕，然后再进行断言。
- **Mock 服务配置（Mock service setup）**：每个测试都可以使用期望的响应数据来配置 `authService.signin.mockReturnValue()`。这让我们可以无需真实后端即可全面测试成功和失败的分支链路。
- **状态生命周期测试（State lifecycle tests）**：登出测试首先通过 `signinSuccess` 建立认证状态，随后派发 `logoutClicked` 并验证所有状态被彻底重置清空。这种“准备前置条件，随后测试目标行为”的模式对于有状态系统的测试至关重要。
- **导航行为验证（Navigation verification）**：我们 Mock 了 Router 路由服务，并验证在成功事件发生后是否以正确的路径调用了 `navigate()`。

在 Reducers 和事件处理器就绪后，我们来看看页面组件如何将它们串联整合。

## 将 Store 与 UI 组件集成（Integrating the store with UI components）

在 Store 完整实现并经过全面测试后，现在是将其与 UI 视图连接起来的时候了。我们将把第 14 章构建的登录表单接入进来，通过 Store 派发事件，并更新应用的顶部导航栏（Header）以展示当前的认证状态。

### 组装登录页面（Wiring the signin page）

第 14 章中的登录表单组件已经具备了发射包含 `SigninRequest` 载荷的 `signinComplete` 输出事件的能力。现在的登录页面（智能组件 Smart Component）将负责处理该输出事件：通过 Store 派发事件，而不再只是简单地向控制台打印日志。更新 `src/app/features/auth/pages/signin/signin.ts`：

```typescript
// .. 原有导入
import { MatProgressSpinnerModule }
  from '@angular/material/progress-spinner';
import { injectDispatch } from '@ngrx/signals/events';
import { AuthStore } from '../../store/auth.store';
import { authPageEvents } from '../../store/auth.events';

@Component({
  selector: 'app-signin',
  templateUrl: './signin.html',
  styleUrl: './signin.scss',
  imports: [
    SigninForm,
    RouterLink,
    MatCardModule,
    MatProgressSpinnerModule,
  ],
})
export class Signin implements OnInit {
  protected readonly store = inject(AuthStore);
  protected readonly dispatch = injectDispatch(authPageEvents);

  ngOnInit() { this.store.clearError(); }

  handleSigninComplete(credentials: SigninRequest) {
    this.dispatch.signinSubmitted(credentials);
  }
}
```

该 `page` 页面组件保持了极度的轻薄。它注入 Store 以便读取 `loading` 和 `error` 等状态，并使用 `injectDispatch` 来派发事件。当表单组件发射完成的数据时，页面组件仅仅是简单地派发对应的事件。组件中没有任何 HTTP 请求调用、没有令牌处理逻辑，也没有路由导航代码。Store 的 Reducers、事件处理器以及订阅机制负责处理所有的底层细节。这种轻薄设计中唯一的一个显式行为是：`ngOnInit` 调用了 `store.clearError()`。如果不做这一步处理，由于登录页和注册页共享同一个 Store，如果用户在登录失败后未重新提交便直接导航跳转至注册页，先前的错误提示信息依然会残留绑定在页面上。

现在来更新 `signin.html` 中的模板：

```html
<div class="page-container">
  <div class="page-header">
    <h1>Sign In</h1>
    <p>Access your Packt Bookstore account</p>
  </div>
  @if (store.error()) {
    <div class="error-message">{{ store.error() }}</div>
  }

  <signin-form (signinComplete)="handleSigninComplete($event)" />

  @if (store.loading()) {
    <mat-spinner diameter="24" />
  }
</div>
```

模板直接从 Store 中读取响应式状态：

- **错误展示（Error display）**：`store.error()` 展示认证错误信息（如 *Invalid credentials*）
- **加载状态微调器（Loading spinner）**：当 API 请求在途执行时，`store.loading()` 控制展示旋转指示器

这就是智能/木偶组件模式（Smart/Dumb Component Pattern）的生动实践：登录表单（木偶组件）仅负责表单 UI 展示与输入校验，而登录页面（智能组件）则负责将其与全局 Store 连接。

### 组装注册页面（Wiring the signup page）

注册页面遵循完全相同的设计模式。

更新 `src/app/features/auth/pages/signup/signup.ts`：

```typescript
@Component({
  selector: 'app-signup',
  templateUrl: './signup.html',
  styleUrl: './signup.scss',
  imports: [
    SignupForm,
    RouterLink,
    MatCardModule,
    MatProgressSpinnerModule,
  ],
})
export class Signup implements OnInit {
  protected readonly store = inject(AuthStore);
  protected readonly dispatch = injectDispatch(authPageEvents);

  ngOnInit() { this.store.clearError(); }

  handleSignupComplete(data: SignupRequest) {
    this.dispatch.signupSubmitted(data);
  }
}
```

模板同样镜像了登录页面的设计，具备错误信息展示与加载指示器。你可以在 GitHub 仓库的 `chapter-15/src/app/features/auth/pages/signup/` 中获取该模板的完整代码。

### 更新应用顶部导航栏（Updating the app header）

在认证状态交由全局集中管理之后，应用中的任何组件都可以对登录状态作出即时响应。现在我们来更新顶部导航栏（Header）组件，根据用户当前是否已登录来动态渲染不同的内容。更新 `src/app/shared/layout/header/header.ts`：

```typescript
@Component({
  selector: 'app-header',
  templateUrl: './header.html',
  styleUrl: './header.scss',
  imports: [
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
  ],
})
export class Header {
  protected readonly store = inject(AuthStore);
  protected readonly dispatch = injectDispatch(authPageEvents);

  onLogout() {
    this.dispatch.logoutClicked();
  }
}
```

接着更新 `header.html` 中的模板：

```html
<header>
  <mat-toolbar color="primary">
    <button matIconButton class="menu-icon"
      aria-label="Icon-button with menu icon">
      <mat-icon class="white-icon">menu</mat-icon>
    </button>
    <a routerLink="/books">Packt Bookstore</a>
    <span class="spacer"></span>
    @if (store.isAuthenticated()) {
      ...
    }
  </mat-toolbar>
</header>
```

这充分展示了集中式状态管理的关键优势：Header 组件根本不需要关心认证的具体实现机制。它只需直接读取 `store.isAuthenticated()` 与 `store.userDisplayName()` 计算信号，只要底层的认证状态发生变更，这些信号就会自动触发视图更新。当用户在登录页面成功登录时，Header 组件无需与登录页面进行任何显式通信即可实现即时响应刷新。下图展示了 Header 最终呈现的形态。

![显示登录按钮的应用顶栏](/media/posts/spring-boot-angular/img-09103.png)

*图 15.1：显示登录按钮的应用顶部导航栏（Header）*

### 各部件如何协同运转（How the pieces connect）

让我们完整回顾一遍从用户提交表单、到 Store 更新状态并完成页面导航跳转的完整端到端链路：

1. 用户导航访问 `/auth/signin`，看到登录表单。
2. 用户输入凭据并提交表单。
3. `SigninForm`（木偶组件）进行数据校验，并向外发射 `signinComplete` 事件。
4. `Signin` 页面（智能组件）派发 `authPageEvents.signinSubmitted` 事件。
5. Store 的 Reducer 将状态设置为 `loading: true`，表单被禁用并展示旋转指示器（Spinner）。
6. Store 的事件处理器携带凭据调用 `AuthService.signin()`。
7. 请求成功后，事件处理器返回 `authApiEvents.signinSuccess`，Reducer 随后存储用户信息与令牌。
8. `isAuthenticated` 计算信号自动重新求值并翻转为 `true`。
9. Header 组件以响应式方式更新，展示用户姓名与登出按钮。
10. 导航订阅者捕获成功事件，将页面路由重定向至 `/books`。

所有这一切都源于那一次单向派发的初始事件。Store 统一编排调度了服务调用、状态更新、页面导航与 UI 变化的整个流程，而各个组件则始终坚守自身单一职责，实现了高度的高内聚与低耦合。

## 本章小结（Summary）

在整整一章中，我们使用 NgRx Events 插件从零构建了一套完整的认证状态仓库，确立了事件驱动状态管理的清晰模式。我们按照数据来源对事件进行了规范切分（页面事件 vs API 事件），使用搭配 `on` 函数的 Reducers 完成纯粹的状态流转，实现了用于处理异步操作的事件处理器，并创建了用于计算派生状态的计算信号。我们通过 `injectDispatch` 与信号机制将 Store 与 UI 组件深度集成。同时，基于 Vitest 构建的完备测试套件展示了如何对事件驱动 Store 的各个维度进行严格测试——从初始状态一直到复杂的异步流转。有了这些扎实稳固的架构模式作为基石，我们在后续章节中为整个应用的其他模块构建业务 Store 就拥有了一套可直接复用的黄金蓝图。在下一章中，我们将把当前的认证 Store 正式对接至真实的后端 API。我们将引入 HTTP 拦截器以便在向外发出的请求头中自动附加 JWT 令牌、实现路由守卫（Route Guards）以保护受限页面、攻坚令牌自动刷新机制，并构建用户个人资料页面——所有这些都将直接建立在本章确立的状态管理基石之上。
