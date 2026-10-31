---
title: Spring Boot & Angular 全栈实战（十七）：状态管理驱动的完整 CRUD 交互闭环
date: 2026-10-23T00:17:00Z
description: 结合 AuthorStore 与 BookStore，实战分页列表契约适配、动态防抖检索、模态框创建编辑与级联下拉关联的生产级 CRUD 治理闭环。
category: fullstack
column: spring-boot-angular
tags:
  - Angular
  - CRUD
  - SignalStore
  - 分页检索
  - 业务实战
---

## 1. CRUD 状态流与并发治理决策矩阵

| 技术维度 | 选型方案 | 替代方案 | 决策依据 |
| :--- | :--- | :--- | :--- |
| **分页契约适配** | `PaginatedResponse<T>` 映射模型 | 扁平数组 + 前端切片计算 | 对齐 Spring Data `Page<T>` 元数据（总条数/页数/当前页），降低客户端内存占用。 |
| **读写不对称性** | `Book`（含嵌套对象）与 `BookRequest`（标量外键）分离 | 前后端共用单一宽松类型 | 杜绝提交包含循环引用或冗余实体的大对象，契约语义清晰明确。 |
| **并发流线控制** | 读操作 `switchMap` / 写操作 `exhaustMap` | 统一使用 `mergeMap` 或 `concatMap` | 检索与分页自动取消在途旧请求；写操作在提交完成前忽略重复触发，天然防重。 |
| **变更新鲜度保证** | 声明式事件流水线 `reloadAfterMutation$` | 本地 Reducer 手动拼接追加数组 | 确保排序规则、分页总条数与关联统计完全由数据库计算裁决，杜绝数据撕裂。 |
| **跨域级联选择** | 视图层直接注入 `AuthorStore` 活信号 | 局部组件各自分立拉取作者数据 | 消除重复 HTTP 请求，利用全局 SignalStore 缓存实现多模态框状态实时同步。 |

## 2. 生产级 SignalStore：完整 CRUD 与自动刷新管线

```typescript
import { computed, inject } from '@angular/core';
import { signalStore, withState, withComputed } from '@ngrx/signals';
import { withReducer, withEventHandlers, Events, on } from '@ngrx/signals/events';
import { switchMap, map, catchError, of, exhaustMap } from 'rxjs';
import { normalizeApiErrorMessage } from '../../../../shared/utils/error-message';
import { AuthorService } from '../../services/author.service';
import { authorPageEvents, authorApiEvents } from './author.events';
import { initialAuthorState } from './author.state';

export const AuthorStore = signalStore(
  { providedIn: 'root' },
  withState(initialAuthorState),

  withReducer(
    // 分页加载与检索
    on(authorPageEvents.loadAuthors, (event) => ({
      loading: true,
      error: null,
      searchTerm: '',
      currentPage: event.payload.page,
      pageSize: event.payload.size,
    })),
    on(authorApiEvents.loadSuccess, (event) => ({
      authors: event.payload.authors,
      totalElements: event.payload.totalElements,
      totalPages: event.payload.totalPages,
      loading: false,
      error: null,
    })),
    on(authorApiEvents.loadFailure, (event) => ({
      loading: false,
      error: event.payload.error,
    })),

    // 变动过渡态
    on(authorPageEvents.createSubmitted, () => ({ loading: true, error: null })),
    on(authorApiEvents.createSuccess, () => ({ loading: false, error: null })),
    on(authorApiEvents.createFailure, (event) => ({ loading: false, error: event.payload.error })),

    on(authorPageEvents.updateSubmitted, () => ({ loading: true, error: null })),
    on(authorApiEvents.updateSuccess, () => ({ loading: false, error: null })),
    on(authorApiEvents.updateFailure, (event) => ({ loading: false, error: event.payload.error })),

    on(authorPageEvents.deleteConfirmed, () => ({ loading: true, error: null })),
    on(authorApiEvents.deleteSuccess, () => ({ loading: false, error: null })),
    on(authorApiEvents.deleteFailure, (event) => ({ loading: false, error: event.payload.error }))
  ),

  withComputed((store) => ({
    hasAuthors: computed(() => store.authors().length > 0),
    isSearching: computed(() => store.searchTerm().length > 0),
    authorCount: computed(() => store.totalElements()),
  })),

  withEventHandlers((store, events = inject(Events), authorService = inject(AuthorService)) => ({
    // 读操作：switchMap 自动取消在途旧请求
    load$: events.on(authorPageEvents.loadAuthors).pipe(
      switchMap((event) =>
        authorService.getPaged(event.payload.page, event.payload.size).pipe(
          map((res) =>
            authorApiEvents.loadSuccess({
              authors: res.content,
              totalElements: res.totalElements,
              totalPages: res.totalPages,
            })
          ),
          catchError((err) =>
            of(authorApiEvents.loadFailure({ error: normalizeApiErrorMessage(err, 'Failed to load authors') }))
          )
        )
      )
    ),

    // 写操作：exhaustMap 阻止并发重复提交
    create$: events.on(authorPageEvents.createSubmitted).pipe(
      exhaustMap((event) =>
        authorService.create(event.payload).pipe(
          map((author) => authorApiEvents.createSuccess({ author })),
          catchError((err) =>
            of(authorApiEvents.createFailure({ error: normalizeApiErrorMessage(err, 'Failed to create author') }))
          )
        )
      )
    ),

    update$: events.on(authorPageEvents.updateSubmitted).pipe(
      exhaustMap((event) => {
        const { id, ...data } = event.payload;
        return authorService.update(id, data).pipe(
          map((author) => authorApiEvents.updateSuccess({ author })),
          catchError((err) =>
            of(authorApiEvents.updateFailure({ error: normalizeApiErrorMessage(err, 'Failed to update author') }))
          )
        );
      })
    ),

    delete$: events.on(authorPageEvents.deleteConfirmed).pipe(
      exhaustMap((event) =>
        authorService.delete(event.payload.id).pipe(
          map(() => authorApiEvents.deleteSuccess({ id: event.payload.id })),
          catchError((err) =>
            of(authorApiEvents.deleteFailure({ error: normalizeApiErrorMessage(err, 'Failed to delete author') }))
          )
        )
      )
    ),

    // 变更新鲜度管线：成功后自动重载当前分页，保持多端数据精确一致
    reloadAfterCreate$: events.on(authorApiEvents.createSuccess).pipe(
      map(() => authorPageEvents.loadAuthors({ page: store.currentPage(), size: store.pageSize() }))
    ),
    reloadAfterUpdate$: events.on(authorApiEvents.updateSuccess).pipe(
      map(() => authorPageEvents.loadAuthors({ page: store.currentPage(), size: store.pageSize() }))
    ),
    reloadAfterDelete$: events.on(authorApiEvents.deleteSuccess).pipe(
      map(() => authorPageEvents.loadAuthors({ page: store.currentPage(), size: store.pageSize() }))
    ),
  }))
);
```

## 3. 跨 Store 响应式级联选择与不对称契约适配

```typescript
import { Component, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { injectDispatch } from '@ngrx/signals/events';
import { AuthorStore } from '../../store/author-store/author.store';
import { authorPageEvents } from '../../store/author-store/author.events';
import { Book, BookRequest } from '../../../shared/models/book';

export class BookForm {
  private fb = inject(FormBuilder);
  readonly authorStore = inject(AuthorStore);
  private readonly dispatch = injectDispatch(authorPageEvents);

  // 表单仅持有标量外键 authorId
  bookForm = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    isbn: ['', [Validators.required]],
    authorId: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
    price: [0, [Validators.required, Validators.min(0)]],
    genre: ['', [Validators.required]],
    published: this.fb.control<Date | null>(null, [Validators.required]),
  });

  initForm(data?: Book) {
    // 预加载作者选项（活信号）
    this.dispatch.loadAuthors({ page: 0, size: 100 });

    // 读写不对称性适配：读数据包含嵌套 author 对象，回填时解构取 author.id
    if (data) {
      this.bookForm.patchValue({
        title: data.title,
        isbn: data.isbn,
        authorId: data.author.id ?? null,
        price: data.price,
        genre: data.genre,
        published: data.published ? new Date(data.published) : null,
      });
    }
  }

  toPayload(): BookRequest {
    const raw = this.bookForm.getRawValue();
    return {
      title: raw.title,
      isbn: raw.isbn,
      authorId: raw.authorId!,
      price: raw.price,
      genre: raw.genre,
      published: raw.published ? raw.published.toISOString().split('T')[0] : '',
    };
  }
}
```

## 4. CRUD 状态跃迁与变更新鲜度管线拓扑

```mermaid
flowchart TD
    UI["用户界面 (UI / Dialog)"] -->|提交事件 createSubmitted| E_MAP["exhaustMap (防止并发重发)"]
    E_MAP -->|POST /inventory/api/authors| SVR["后端库存微服务"]
    SVR -->|201 Created| SUCCESS["派发 createSuccess"]
    
    SUCCESS -->|触发状态跃迁| REDUCER["withReducer (loading: false)"]
    SUCCESS -->|触发自动重载流水线| RELOAD["reloadAfterCreate$ 流"]
    
    RELOAD -->|派发 loadAuthors(当前页码, 页大小)| S_MAP["switchMap (自动取消过时读)"]
    S_MAP -->|GET /inventory/api/authors/paged| SVR
    SVR -->|200 OK PaginatedResponse| LOAD_SUCC["派发 loadSuccess"]
    LOAD_SUCC -->|更新 SignalStore 数据| SIGNALS["authors() / totalElements() 活信号"]
    SIGNALS -->|局部刷新 DOM 依赖节点| UI
```

## 5. CRUD 治理避坑清单 (Do's & Don'ts)

| 错误实践 (Don't) | 正确实践 (Do) |
| :--- | :--- |
| 在写操作成功后，手动将新对象 append 到本地数组。 | 触发声明式重新加载管线（`reloadAfterMutation$`），让数据库统一仲裁排序与总数。 |
| 在搜索输入和快速分页时使用 `mergeMap` 或 `concatMap`。 | 使用 `switchMap` 处理读查询，自动废弃过时的在途请求，防止网络乱序污染视图。 |
| 在提交和删除操作中使用普通处理函数，导致按钮多次连击产生重复写入。 | 使用 `exhaustMap` 拦截重复事件，在上一次异步网络请求终结前抑制新的动作。 |
| 前端创建实体时将整个嵌套的关联对象整体向后端提交。 | 实行读写不对称性契约：查询读取展示对象，创建更新仅传递标量外键 `authorId`。 |
| 跨组件级联选择时每个弹窗内部独立发起全量数据请求。 | 直接复用全局 `AuthorStore` 的活信号状态，实现跨弹窗跨组件的低开销实时感知。 |

<!-- split -->
# 原著完整参考：第 17 章 使用状态管理执行 CRUD 操作（Performing CRUD Operations with State Management）

在上一章中，我们将认证表单与后端 API 进行了对接，借助 HTTP 拦截器实现了 JWT 令牌的管理与静默刷新，利用认证守卫保护了核心路由，并构建了一个用户个人资料页面。我们在第 15 章构建的 `AuthStore` 凭借干净的事件驱动架构，在编排登录、注册、令牌刷新与注销等复杂的异步流程中充分展现了其巨大价值。

在本章中，我们将把重心转移到应用的核心业务领域：管理图书（Books）与作者（Authors）。我们在第 14 章中已经完成了相关表单的构建，在第 15 章中也确立了成熟的状态管理模式。现在的任务是编写服务层（Services）和状态仓库（Stores），将这些表单与后端 API 紧密连接，打通完整的 CRUD 交互体验。

我们将继续贯彻贯穿全书的“先手动实践、后 AI 辅助”的研发策略。首先，我们将纯手工打造完整的作者 CRUD 业务流：包括 `AuthorService`、`AuthorStore` 以及一个可从图书列表页面弹出的对话框式作者管理面板。由于在我们的业务模型中，作者是依附并服务于图书目录的支撑实体，而非一个孤立的大特性，因此我们不会为其单独设立一个路由页面。相反，图书列表页面上的“Authors”按钮会弹出一个包含完整作者列表、搜索及全部增删改查操作的对话框。随后，我们将利用 GitHub Copilot 基于我们手动确立的作者模式，一键生成对应的 `BookStore` 和 `BookService`，将图书表单原有的文本输入框重构为从 `AuthorStore` 动态拉取数据的作者下拉选择框，并将图书列表页面与状态仓库全面绑定。

本章我们将涵盖以下主题：

- 理解我们的开发演进策略
- API 端点概览
- 共享接口与请求模型定义
- 构建 AuthorService
- 基于 Events 插件构建 AuthorStore
- 构建作者管理对话框
- 编写 AuthorStore 单元测试
- 编写 AuthorService 单元测试
- AI 辅助生成图书 CRUD 业务流

## 技术要求

本章的完整源码可在此处获取：

`https://github.com/PacktPublishing/Spring-Boot-and-Angular-2E_Frontend/tree/main/chapter-17/`

请确保你在第 10 章配置的 Docker Compose 环境已正常运行，因为本章中我们将持续对库存微服务（Inventory Microservice）发起真实的 API 请求。我们在第 16 章构建的 HTTP 拦截器会自动为每个发出的请求注入 `Authorization` 请求头（携带 JWT Access Token），API 网关会从该令牌中解析调用者身份并向后传递，因此我们即将编写的新服务无需编写任何手动的请求头管理逻辑。

## 理解我们的开发演进策略

本章遵循两阶段推进策略，这一设计与业务模型本身的复杂度递进完美契合。每个阶段都有着明确的分工：第一阶段在相对简单的模型上从零手工打磨全套 CRUD 闭环；第二阶段则借助 AI 辅助将这些范式快速且大规模地推广复用到复杂模型中。

### 阶段一：作者 CRUD（纯手工构建）

在第一阶段，我们将完全手工编写 `AuthorService`、`AuthorStore` 以及作者管理对话框。作者实体仅包含姓名（name）与国籍（nationality）两个字段，这种精简的模型非常适合用来掌握完整的 CRUD（即创建 Create、读取 Read、更新 Update、删除 Delete）状态流转闭环，而不会被过于庞杂的表单逻辑分散注意力。由于作者实体的存在是为了支撑图书目录而非独立存在，我们将作者列表容纳在一个 `MatDialog` 对话框中，用户点击图书列表页面上的 **Authors** 按钮即可呼出。这使得所有库存管理操作都收敛在同一个页面内，同时依然提供了包含搜索、分页、新增、修改与删除在内的全功能体验。

### 阶段二：图书 CRUD（AI 辅助生成）

在牢牢掌握了作者维度的各项设计范式之后，在第二阶段中，我们将启用 Copilot 的 Agent Mode 来生成 `BookService`、`BookStore`，以及将图书列表页面与真实 API 操作联动所需的全部编排代码。此外，我们还将对图书表单进行一次重大升级：用基于 `AuthorStore` 数据源的 `<mat-select>` 下拉选择框替换第 14 章中的 `authorName` 纯文本输入框，向下游准确传递后端所要求的 `authorId` 外键。

这两个阶段都依赖相同的后端，因此在编写 Angular 代码之前，我们需要确切掌握将要调用的各个端点以及它们的数据结构。

## API 端点概览

在编写代码之前，先来系统梳理我们将要调用的库存微服务端点。所有外部请求均以 `/packt/` 为前缀经由 API 网关转发。正如我们在第 16 章中所确立的，认证拦截器会自动从 `TokenService` 读取 Access Token 并将其设置为 `Authorization` 请求头。网关随后验证该令牌，并亲自向下游注入调用者的 Keycloak ID，因此我们的前端服务只需要发起纯粹的 `HttpClient` 调用，无需操心任何请求头。

以下是作者相关的 API 端点：

| 请求方法 | 端点路径 | 功能描述 |
| --- | --- | --- |
| GET | /inventory/api/authors | 获取所有作者全量列表 |
| GET | /inventory/api/authors/paged?<br>page=0&size=10 | 获取分页作者列表 |
| GET | /inventory/api/authors/<br>by-name-ignore-case?name=dimitrios | 根据姓名模糊搜索作者（忽略大小写） |
| GET | /inventory/api/authors/{id} | 根据 ID 获取单个作者详情 |
| POST | /inventory/api/authors | 创建新作者 |
| PUT | /inventory/api/authors/{id} | 更新指定作者信息 |
| DELETE | /inventory/api/authors/{id} | 删除指定作者 |

*表 17.1：作者端点列表*

以下是图书相关的 API 端点：

| 请求方法 | 端点路径 | 功能描述 |
| --- | --- | --- |
| GET | /inventory/api/books | 获取所有图书全量列表 |
| GET | /inventory/api/books/paged?<br>page=0&size=10 | 获取分页图书列表 |
| GET | /inventory/api/books/<br>by-title-ignore-case?title=spring | 根据书名模糊搜索图书（忽略大小写） |
| GET | /inventory/api/books/{id} | 根据 ID 获取单本图书详情 |
| POST | /inventory/api/books | 创建新图书 |
| PUT | /inventory/api/books/{id} | 更新指定图书信息 |
| DELETE | /inventory/api/books/{id} | 删除指定图书 |

*表 17.2：图书端点列表*

理清了完整的端点定义后，我们就掌握了设计服务层所需的一切输入。不过在编写服务实现之前，我们必须先对第 14 章中定义的数据模型进行扩展，以精确匹配这些端点接收和返回的数据结构。

## 共享接口与请求模型定义

在第 11 章中我们定义了 `Book` 接口，在第 14 章中我们补充了 `Author` 接口并为 `Book` 添加了用于编辑模式的可选 `id`。现在我们需要扩展这些模型以满足实际的 API 契约要求。最关键的区别在于：GET 请求返回的是一个嵌套的 `author` 对象（包含 `id`、`name` 和 `nationality`），而 POST/PUT 请求发送的则是作为作者实体引用的数值型 `authorId`。

第 14 章中的 `Author` 接口已经完全符合我们的需求：

```typescript
export interface Author {
  id?: number;
  name: string;
  nationality: string;
  books?: string[];
}
```

然而对于 `Book` 接口，我们需要对第 11 章的定义做出修改，因为后端网关返回的实际响应是一个嵌套的 `author` 对象，而非扁平的 `authorName` 字符串。因此，我们在 `src/app/shared/models/book.ts` 中更新该接口：

```typescript
import { Author } from './author';

export interface Book {
  id?: number;
  title: string;
  isbn: string;
  author: Author;
  price: number;
  genre: string;
  published: string;
  description?: string;
  pageCount?: number;
  coverImageUrl?: string;
}
```

我们还需要在同一个文件 `shared/models/book.ts` 中增加一个专门的图书请求接口，以支持强类型的 POST/PUT 提交操作：

```typescript
export interface BookRequest {
  title: string;
  isbn: string;
  authorId: number;
  price: number;
  genre: string;
  published: string;
  description?: string;
  pageCount?: number;
  coverImageUrl?: string;
}
```

最后，为了承接来自后端的带分页响应，我们在 `src/app/shared/models/paginated.ts` 中新增一个通用的分页响应接口，对应于我们在前几章中介绍的 Spring Boot `Page<T>` 响应结构：

```typescript
export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;   // 当前页码（从 0 开始）
  first: boolean;
  last: boolean;
  empty: boolean;
}
```

请仔细对比 `BookRequest` 与 `Book` 接口：`BookRequest` 包含的是 `authorId`（数值），而 `Book` 接口包含的是嵌套的 `author` 对象。`Book` 接口代表 API 在 GET 请求中返回的数据形态，而 `BookRequest` 代表我们在 POST/PUT 操作中提交的数据载荷。这种读写不对称性是由后端的 DTO 结构决定的：服务端持久化时只需要一个外键引用将图书与作者关联，而在查询时为了前端展示便利直接返回了完整的作者对象。模型与契约对齐后，我们可以着手编写消费它们的服务层了。

## 构建 AuthorService

我们首先创建与作者 API 端点通信的 Angular 服务。我们使用在第 16 章配置的 `environment.apiUrl`，它指向统一的 API 网关。

通过 CLI 生成该服务：

```bash
ng generate service features/books/services/author.service
```

这会在 `features/books/services/` 下生成空的 `author.service.ts` 及其配套的 `author.service.spec.ts`。我们现在先实现服务本身，测试文件留待本章后文专门补充。

更新 `src/app/features/books/services/author.service.ts`：

```typescript
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Author } from '../../../shared/models/author';
import { PaginatedResponse } from '../../../shared/models/paginated';

@Injectable({ providedIn: 'root' })
export class AuthorService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/inventory/api/authors`;

  getAll(): Observable<Author[]> {
    return this.http.get<Author[]>(this.baseUrl);
  }

  getPaged(
    page: number, size: number
  ): Observable<PaginatedResponse<Author>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<PaginatedResponse<Author>>(
      `${this.baseUrl}/paged`, { params }
    );
  }

  searchByName(name: string): Observable<Author[]> {
    const params = new HttpParams().set('name', name);
    return this.http.get<Author[]>(
      `${this.baseUrl}/by-name-ignore-case`, { params }
    );
  }

  getById(id: number): Observable<Author> {
    return this.http.get<Author>(`${this.baseUrl}/${id}`);
  }

  create(author: Omit<Author, 'id'>): Observable<Author> {
    return this.http.post<Author>(this.baseUrl, author);
  }

  update(id: number, author: Omit<Author, 'id'>): Observable<Author> {
    return this.http.put<Author>(`${this.baseUrl}/${id}`, author);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
```

这里有几个值得强调的技术要点：

- 我们在 `create()` 方法中使用 `Omit<Author, 'id'>`，因为新实体的 ID 是由服务端自增分配的。而在 `update()` 中，实体的 ID 存在于 URL 路径中，而不需要放在请求体中。
- `searchByName()` 方法映射到后端的 `by-name-ignore-case` 端点，该端点会返回所有符合名称模糊匹配的作者列表，且不区分大小写。后端还存在一个返回单条精确匹配的 `by-name` 端点，我们在前端搜索中并不采用它。

> **注意**
>
> `getPaged()` 方法返回 `PaginatedResponse<Author>`，与 Spring Boot 的 `Page<T>` 响应契约严格对应。后端的 page 分页参数是从 0 开始计数的。

- 这里的每一个方法都是极为干净的 `HttpClient` 调用。我们在第 16 章构建的认证拦截器会在底层静默附加 `Authorization` 令牌，因此业务服务中完全不需要夹杂任何鉴权细节。

服务层构建就绪后，我们接着编写驱动它的状态仓库（Store）。

## 基于 Events 插件构建 AuthorStore

现在我们完全遵循第 15 章构建 `AuthStore` 时确立的事件驱动范式，来编写 `AuthorStore`。我们将 Store 文件组织在 books 特性目录下，因为作者在业务领域中隶属于库存上下文，主要用于辅助图书目录：

```
src/app/features/books/
├── components/
│   ├── author-form/          # 来自第 14 章
│   ├── author-list-dialog/   # 新增：容纳作者列表的对话框组件
│   └── book-form/            # 来自第 14 章
├── pages/
│   └── list/                 # 图书列表页（来自第 11 章）
├── services/
│   ├── author.service.ts     # 本节新增
│   └── book.service.ts       # 将在阶段二中加入
├── store/
    └── author-store              # 新增
        ├── author.events.ts      # 新增
        ├── author.state.ts       # 新增
        └── author.store.ts       # 新增
```

### 定义作者领域事件

首先，创建 `src/app/features/books/store/author-store/author.events.ts`：

```typescript
import { eventGroup } from '@ngrx/signals/events';
import { type } from '@ngrx/signals';
import { Author } from '../../../../shared/models/author';

export const authorPageEvents = eventGroup({
  source: 'Author Page',
  events: {
    loadAuthors: type<{
      page: number; size: number
    }>(),
    searchByName: type<{ name: string }>(),
    createSubmitted: type<Omit<Author, 'id'>>(),
    updateSubmitted: type<
      { id: number } & Omit<Author, 'id'>
    >(),
    deleteConfirmed: type<{ id: number }>(),
  },
});

export const authorApiEvents = eventGroup({
  source: 'Author API',
  events: {
    loadSuccess: type<{
      authors: Author[];
      totalElements: number;
      totalPages: number;
    }>(),
    loadFailure: type<{ error: string }>(),
    searchSuccess: type<{ authors: Author[] }>(),
    searchFailure: type<{ error: string }>(),
    createSuccess: type<{ author: Author }>(),
    createFailure: type<{ error: string }>(),
    updateSuccess: type<{ author: Author }>(),
    updateFailure: type<{ error: string }>(),
    deleteSuccess: type<{ id: number }>(),
    deleteFailure: type<{ error: string }>(),
  },
});
```

将这些事件与第 15 章的 `AuthStore` 事件进行对比，你会发现其骨架完全一致：根据来源（Page 与 API）对指令事件进行解耦分组、采用过去时态语义化命名，以及严格的强类型载荷。区别仅仅在于业务领域本身：由原先的 `signin/signup/logout` 变成了现在的 `load/search/create/update/delete`。这种高度的一致性正是前期确立规范带来的设计红利。

### 定义作者状态模型

接着创建 `src/app/features/books/store/author-store/author.state.ts`：

```typescript
import { Author } from '../../../../shared/models/author';

export interface AuthorState {
  authors: Author[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  searchTerm: string;
  loading: boolean;
  error: string | null;
}

export const initialAuthorState: AuthorState = {
  authors: [],
  totalElements: 0,
  totalPages: 0,
  currentPage: 0,
  pageSize: 10,
  searchTerm: '',
  loading: false,
  error: null,
};
```

该状态结构围绕服务端分页而设计。Store 不会一次性拉取所有作者数据，而是持续跟踪 `currentPage`、`pageSize`、`totalElements` 和 `totalPages`，与后端的响应保持严格同步。同时维护一个 `searchTerm` 字段，以在不破坏当前分页结构的前提下支持按名过滤查询。

### 实现作者状态仓库 AuthorStore

现在我们将各个积木拼装在一起，完整实现作者 Store。我们分段剖析其构成。

创建 `src/app/features/books/store/author-store/author.store.ts`：

```typescript
import { computed, inject } from '@angular/core';
import { signalStore, withState, withComputed } from '@ngrx/signals';
import { withReducer, withEventHandlers, Events, on }
  from '@ngrx/signals/events';
import { switchMap, map, catchError, of, exhaustMap } from 'rxjs';
import { normalizeApiErrorMessage }
  from '../../../../shared/utils/error-message';
import { AuthorService } from '../../services/author.service';
import { authorPageEvents, authorApiEvents } from './author.events';
import { initialAuthorState } from './author.state';

export const AuthorStore = signalStore(
  { providedIn: 'root' },

  withState(initialAuthorState),
```

接下来是 `withReducer` 块，负责处理所有同步的状态迁移。每个 `on()` 处理器仅返回变更的属性切片。注意，`loadAuthors` 显式清空了 `searchTerm`，这确保了当用户切回分页列表时能够自动退出搜索状态：

```typescript
  withReducer(
    // 加载分页数据
    on(authorPageEvents.loadAuthors, (event) => ({
      loading: true,
      error: null,
      searchTerm: '',
      currentPage: event.payload.page,
      pageSize: event.payload.size,
    })),
    on(authorApiEvents.loadSuccess, (event) => ({
      authors: event.payload.authors,
      totalElements: event.payload.totalElements,
      totalPages: event.payload.totalPages,
      loading: false,
      error: null,
    })),
    on(authorApiEvents.loadFailure, (event) => ({
      loading: false,
      error: event.payload.error,
    })),

    // 搜索
    on(authorPageEvents.searchByName, (event) => ({
      loading: true,
      error: null,
      searchTerm: event.payload.name,
    })),
    on(authorApiEvents.searchSuccess, (event) => ({
      authors: event.payload.authors,
      loading: false,
      error: null,
    })),
    on(authorApiEvents.searchFailure, (event) => ({
      loading: false,
      error: event.payload.error,
    })),

    // 创建 / 更新 / 删除
    on(authorPageEvents.createSubmitted, () => ({
      loading: true,
      error: null,
    })),
    on(authorApiEvents.createSuccess, () => ({
      loading: false,
      error: null,
    })),
    on(authorApiEvents.createFailure, (event) => ({
      loading: false,
      error: event.payload.error,
    })),
    on(authorPageEvents.updateSubmitted, () => ({
      loading: true,
      error: null,
    })),
    on(authorApiEvents.updateSuccess, () => ({
      loading: false,
      error: null,
    })),
    on(authorApiEvents.updateFailure, (event) => ({
      loading: false,
      error: event.payload.error,
    })),
    on(authorPageEvents.deleteConfirmed, () => ({
      loading: true,
      error: null,
    })),
    on(authorApiEvents.deleteSuccess, () => ({
      loading: false,
      error: null,
    })),
    on(authorApiEvents.deleteFailure, (event) => ({
      loading: false,
      error: event.payload.error,
    })),
  ),
```

紧接着在 `withComputed` 块中声明派生信号：

```typescript
  withComputed((store) => ({
    hasAuthors: computed(() => store.authors().length > 0),
    isSearching: computed(() => store.searchTerm().length > 0),
    authorCount: computed(() => store.totalElements()),
  })),
```

现在来到核心的事件处理器（Event Handlers）。请注意与 `AuthStore` 之间的一个关键技术差异：对于数据加载（Load）与搜索（Search）操作，我们选用 `switchMap`，因为一旦发出新的查询请求（例如用户快速翻页或键入新关键字），前一个未决的旧请求应当被果断取消。而对于创建（Create）、更新（Update）和删除（Delete）等写操作，我们则选用 `exhaustMap`，这能有效防止用户因快速连击按钮而向服务端发出重复的写操作。所有 `catchError` 块均调用第 16 章引入的 `normalizeApiErrorMessage()`，无论后端返回何种错误结构都能产出易读的用户提示：

```typescript
  withEventHandlers((
    store,
    events = inject(Events),
    authorService = inject(AuthorService),
  ) => ({
    load$: events.on(authorPageEvents.loadAuthors).pipe(
      switchMap((event) =>
        authorService.getPaged(
          event.payload.page,
          event.payload.size
        ).pipe(
          map((response) =>
            authorApiEvents.loadSuccess({
              authors: response.content,
              totalElements: response.totalElements,
              totalPages: response.totalPages,
            })
          ),
          catchError((error: unknown) =>
            of(authorApiEvents.loadFailure({
              error: normalizeApiErrorMessage(
                error, 'Failed to load authors'
              ),
            }))
          )
        )
      )
    ),

    search$: events.on(authorPageEvents.searchByName).pipe(
      switchMap((event) => {
        if (event.payload.name.trim() === '') {
          return of(authorApiEvents.searchSuccess({ authors: [] }));
        }
        return authorService.searchByName(event.payload.name).pipe(
          map((authors) => authorApiEvents.searchSuccess({ authors })),
          catchError((error: unknown) =>
            of(authorApiEvents.searchFailure({
              error: normalizeApiErrorMessage(
                error, 'Search failed'
              ),
            }))
          )
        );
      })
    ),

    create$: events.on(authorPageEvents.createSubmitted).pipe(
      exhaustMap((event) =>
        authorService.create(event.payload).pipe(
          map((author) => authorApiEvents.createSuccess({ author })),
          catchError((error: unknown) =>
            of(authorApiEvents.createFailure({
              error: normalizeApiErrorMessage(
                error, 'Failed to create author'
              ),
            }))
          )
        )
      )
    ),

    update$: events.on(authorPageEvents.updateSubmitted).pipe(
      exhaustMap((event) => {
        const { id, ...data } = event.payload;
        return authorService.update(id, data).pipe(
          map((author) => authorApiEvents.updateSuccess({ author })),
          catchError((error: unknown) =>
            of(authorApiEvents.updateFailure({
              error: normalizeApiErrorMessage(
                error, 'Failed to update author'
              ),
            }))
          )
        );
      })
    ),

    delete$: events.on(authorPageEvents.deleteConfirmed).pipe(
      exhaustMap((event) =>
        authorService.delete(event.payload.id).pipe(
          map(() => authorApiEvents.deleteSuccess({ id: event.payload.id })),
          catchError((error: unknown) =>
            of(authorApiEvents.deleteFailure({
              error: normalizeApiErrorMessage(
                error, 'Failed to delete author'
              ),
            }))
          )
        )
      )
    ),
```

最后，`withEventHandlers` 块还展示了一种全新的模式。在此之前，`AuthStore` 中的事件处理器主要负责两件事：要么调用服务并将结果转化为成功/失败事件（第 15 章的 `signin$` 与 `signup$`），要么将一个事件转换为另一个事件（第 16 章将刷新失败转换为登出的 `refreshToken$`）。而在 CRUD 业务场景中存在一种刚性需求：在成功创建、更新或删除实体后，列表必须立即重新拉取以呈现最新数据。在此，我们直接在 `withEventHandlers` 内部注册专属的自动重载处理器，将每个变更成功事件重新映射为 `loadAuthors` 事件，全量复用现有的加载流水线：

```typescript
    reloadAfterCreate$: events.on(authorApiEvents.createSuccess).pipe(
      map(() => authorPageEvents.loadAuthors({
        page: store.currentPage(),
        size: store.pageSize(),
      }))
    ),

    reloadAfterUpdate$: events.on(authorApiEvents.updateSuccess).pipe(
      map(() => authorPageEvents.loadAuthors({
        page: store.currentPage(),
        size: store.pageSize(),
      }))
    ),

    reloadAfterDelete$: events.on(authorApiEvents.deleteSuccess).pipe(
      map(() => authorPageEvents.loadAuthors({
        page: store.currentPage(),
        size: store.pageSize(),
      }))
    ),
  })),
);
```

这种“数据变更后自动重载”（Reload-after-mutation）模式确保了前端列表始终与数据库状态严格同步，避免了在 Reducer 中繁琐且容易出错的手动数组拼接与索引替换。每个重载处理器都会读取 `store.currentPage()` 和 `store.pageSize()`，保证用户在操作完成后依然停留在当前正在浏览的页码上。至此 Store 全部就绪，我们可以着手开发面向用户的 UI 层了。

## 构建作者管理对话框

与其为作者开辟专门的独立页面，不如将作者列表安放在一个由图书列表页弹出的 `MatDialog` 中。作者属于图书目录的辅助实体，不需要独立的路由地址。这种设计让所有的库存维护操作都聚焦在 `/books` 页面上，并通过弹窗堆叠（Dialog Stacking）带来流畅的作者 CRUD 体验：用户在图书列表上唤起作者管理弹窗，而在该弹窗中点击新增或编辑时，又会弹起第 14 章编写的作者表单弹窗。

### 作者列表对话框组件

使用 CLI 生成该组件：

```bash
ng generate component features/books/components/author-list-dialog
```

打开 `features/books/components/author-list-dialog/author-list-dialog.ts`。我们使用强类型的 `injectDispatch(authorPageEvents)`，沿用第 15 章登录与注册页面确立的派发规范：

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { injectDispatch } from '@ngrx/signals/events';
import { AuthorStore } from '../../store/author-store/author.store';
import { authorPageEvents } from '../../store/author-store/author.events';
import { Author } from '../../../../shared/models/author';
import { AuthorForm } from '../author-form/author-form';

@Component({
  selector: 'author-list-dialog',
  templateUrl: './author-list-dialog.html',
  styleUrl: './author-list-dialog.scss',
  imports: [
    MatTableModule, MatPaginatorModule,
    MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule,
    MatProgressSpinnerModule, FormsModule,
    MatDialogModule,
  ],
})
export class AuthorListDialog implements OnInit {
  protected readonly store = inject(AuthorStore);
  private dialogRef = inject(MatDialogRef<AuthorListDialog>);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  protected readonly dispatch = injectDispatch(authorPageEvents);

  displayedColumns = ['name', 'nationality', 'books', 'actions'];
  searchTerm = '';

  ngOnInit() {
    this.dispatch.loadAuthors({ page: 0, size: 10 });
  }

  onPageChange(event: PageEvent) {
    this.dispatch.loadAuthors({
      page: event.pageIndex,
      size: event.pageSize,
    });
  }

  onSearch() {
    if (this.searchTerm.trim()) {
      this.dispatch.searchByName({ name: this.searchTerm });
    } else {
      this.dispatch.loadAuthors({ page: 0, size: 10 });
    }
  }

  clearSearch() {
    this.searchTerm = '';
    this.dispatch.loadAuthors({ page: 0, size: 10 });
  }

  openCreateDialog() {
    const dialogRef = this.dialog.open(AuthorForm, {
      width: '560px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.dispatch.createSubmitted(result);
        this.snackBar.open(
          'Author created successfully',
          'Close', { duration: 3000 }
        );
      }
    });
  }

  openEditDialog(author: Author) {
    const dialogRef = this.dialog.open(AuthorForm, {
      width: '560px',
      data: author,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.dispatch.updateSubmitted(result);
        this.snackBar.open(
          'Author updated successfully',
          'Close', { duration: 3000 }
        );
      }
    });
  }

  confirmDelete(author: Author) {
    if (confirm(`Delete ${author.name}?`)) {
      this.dispatch.deleteConfirmed({ id: author.id! });
      this.snackBar.open(
        'Author deleted successfully',
        'Close', { duration: 3000 }
      );
    }
  }

  close() {
    this.dialogRef.close();
  }
}
```

该组件在执行创建与编辑时会弹出第 14 章完成的 `AuthorForm` 对话框；值得注意的是，Angular Material 的 `MatDialog` 服务对弹窗堆叠提供了天然支持，每个弹窗都会独立渲染在各自的顶层浮动遮罩（Overlay）中。

> **注意**
>
> 这里的轻量提示条（SnackBar）是在弹窗一关闭时就立即弹出的，此时后端 API 尚在异步响应中。这意味着即使 POST 请求失败，界面上可能也会短暂闪烁“创建成功”。我们在教程中做此简化是为了保持组件的纯粹，免于在组件中额外订阅 Store 状态，而且 Store 的错误信号会直接渲染在表格上方，错误绝不会被静默吞没。在实际生产工程中，你应当通过监听 API 对应的 Success 事件来精确触发这些成功提示。

### 作者列表对话框模板

在 `features/books/components/author-list-dialog/author-list-dialog.html` 中编写组件模板：

```html
<h2 mat-dialog-title>Manage Authors</h2>
<mat-dialog-content class="app-modal-content-static">
  <div class="app-modal-toolbar">
    <mat-form-field appearance="outline" class="full-width">
      <mat-label>Search by name</mat-label>
      <input
        matInput
        [(ngModel)]="searchTerm"
        (keyup.enter)="onSearch()"
        placeholder="Enter author name..."
      />
      @if (searchTerm) {
        <button matSuffix mat-icon-button (click)="clearSearch()">
          <mat-icon>close</mat-icon>
        </button>
      }
    </mat-form-field>
  </div>

  @if (store.loading()) {
    <div class="app-modal-loading">
      <mat-spinner diameter="40"></mat-spinner>
    </div>
  }

  @if (store.error()) {
    <div class="app-modal-error">
      <mat-icon>error</mat-icon>
      {{ store.error() }}
    </div>
  }

  @if (store.hasAuthors() && !store.loading()) {
    <div class="app-modal-scroll-x">
      <table mat-table [dataSource]="store.authors()"
        class="authors-table app-table">
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Name</th>
          <td mat-cell *matCellDef="let author">{{ author.name }}</td>
        </ng-container>

        <ng-container matColumnDef="nationality">
          <th mat-header-cell *matHeaderCellDef>Nationality</th>
          <td mat-cell *matCellDef="let author">{{ author.nationality }}</td>
        </ng-container>

        <ng-container matColumnDef="books">
          <th mat-header-cell *matHeaderCellDef>Books</th>
          <td mat-cell *matCellDef="let author">{{ author.books?.length ?? 0 }}</td>
        </ng-container>

        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef class="actions-col">Actions</th>
          <td mat-cell *matCellDef="let author" class="actions-col">
            <button
              mat-icon-button
              class="edit-btn"
              aria-label="Edit author"
              (click)="openEditDialog(author)"
            >
              <mat-icon>edit</mat-icon>
            </button>
            <button
              mat-icon-button
              class="delete-btn"
              aria-label="Delete author"
              (click)="confirmDelete(author)"
            >
              <mat-icon>delete</mat-icon>
            </button>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
      </table>
    </div>

    @if (!store.isSearching()) {
      <mat-paginator
        [length]="store.totalElements()"
        [pageSize]="store.pageSize()"
        [pageIndex]="store.currentPage()"
        [pageSizeOptions]="[5, 10, 25]"
        (page)="onPageChange($event)"
      >
      </mat-paginator>
    }
  }

  @if (!store.hasAuthors() && !store.loading()) {
    <div class="app-modal-empty">
      <mat-icon>person_off</mat-icon>
      <p>No authors found. Click "Add Author" to create one.</p>
    </div>
  }
</mat-dialog-content>

<mat-dialog-actions class="app-modal-actions-end">
  <button mat-button (click)="close()">Close</button>
  <button mat-raised-button color="primary" (click)="openCreateDialog()">
    <mat-icon>add</mat-icon>
    Add Author
  </button>
</mat-dialog-actions>
```

模板直接绑定 Store 暴露的信号：`store.loading()`、`store.hasAuthors()`、`store.authors()` 和 `store.error()`。在搜索模式下分页器会被自动隐藏，因为模糊搜索结果属于非分页形态。在样式方面，考虑到当前系统中已有多个模态框共享大量共通样式，我们将它们抽象为可复用的公共类并放到了全局 `styles.scss` 中。这也是为什么你在模板中会看到诸如 `.app-modal-content-static` 和 `.app-modal-actions-end` 之类的新类名。

这些通用样式同样被运用在 `author-form.html` 和 `book-form.html` 中。至于该弹窗私有的微小样式，可以在 GitHub 仓库的 `features/books/components/author-list-dialog/author-list-dialog.scss` 中查阅。

### 在图书列表页添加入口按钮

完成了 `AuthorListDialog` 组件后，我们需要为其提供一个触发入口。我们更新图书列表页面（`features/books/pages/list/list.ts`），添加一个唤起作者管理对话框的 **Authors** 按钮。目前我们只添加该按钮（完整的 `BookStore` 绑定留给**阶段二**）：

```typescript
@Component({
  selector: 'book-list-page',
  templateUrl: './list.html',
  styleUrl: './list.scss',
  imports: [MatButtonModule, MatIconModule,
    /* .. 其他模块 */],
})
export class List {
  private dialog = inject(MatDialog);
  // .. 保留第 11 章已有的 Mock 数据

  openAuthorManagement() {
    this.dialog.open(AuthorListDialog, {
      width: '800px',
      maxHeight: '80vh',
    });
  }

  // .. 保留组件现有的其余逻辑
}
```

接着在图书列表模板 `features/books/pages/list/list.html` 的头部操作区加入该按钮：

```html
<div class="page-header-full">
  <h1>Book Catalog</h1>
  <div class="header-actions">
    <button mat-stroked-button
            (click)="openAuthorManagement()">
      <mat-icon>people</mat-icon>
      Authors
    </button>
    <button mat-raised-button color="primary"
            (click)="openCreateDialog()">
      <mat-icon>add</mat-icon>
      Add New Book
    </button>
  </div>
</div>

<!-- .. 图书列表模板的其余部分 -->
```

现在访问 `/books` 路径并点击 **Authors** 按钮，就能看到我们亲手打造的作者管理弹窗：

![图 17.1：运行中的作者管理对话框](/media/posts/spring-boot-angular/img-09117.png)

*Figure 17.1: The author dialog we created in action*

你可以在弹窗堆叠中完成作者的新增、修改与删除，所有交互均由底层的 `AuthorStore` 驱动运转。

界面虽然运行起来了，但能跑和经过充分验证是两码事。在我们把这一范式全权交付给 Copilot 进行批量扩展之前，先用单元测试把 Store 的行为严格锁定下来。

## 编写 AuthorStore 单元测试

在 `features/books/store/author-store/author.store.spec.ts` 中添加单元测试（完整源码可参考随书仓库）：

```typescript
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Dispatcher } from '@ngrx/signals/events';
import { AuthorStore } from './author.store';
import { AuthorService } from '../../services/author.service';
import { authorPageEvents } from './author.events';

describe('AuthorStore', () => {
  // .. 初始化 mock 数据、store、services

  describe('Initial State', () => {
    it('should start with empty authors', () => {
      expect(store.authors()).toEqual([]);
      expect(store.loading()).toBe(false);
      expect(store.error()).toBeNull();
      expect(store.hasAuthors()).toBe(false);
    });
  });

  describe('Load Authors', () => {
    it('should load on event', async () => {
      authorService.getPaged.mockReturnValue(of(mockPagedResponse));

      dispatcher.dispatch(
        authorPageEvents.loadAuthors({ page: 0, size: 10 })
      );

      await new Promise((r) => setTimeout(r, 100));

      expect(authorService.getPaged).toHaveBeenCalledWith(0, 10);
      expect(store.authors()).toEqual(mockAuthors);
      expect(store.totalElements()).toBe(2);
      expect(store.loading()).toBe(false);
    });

    it('should handle failure', async () => {
      authorService.getPaged.mockReturnValue(
        throwError(() => new Error('Network error'))
      );

      dispatcher.dispatch(
        authorPageEvents.loadAuthors({ page: 0, size: 10 })
      );

      await new Promise((r) => setTimeout(r, 100));

      expect(store.error()).toContain('Network error');
      expect(store.loading()).toBe(false);
    });
  });

  describe('Create Author', () => {
    // .. 编写针对创建作者的测试用例
  });

  describe('Delete Author', () => {
    // .. 编写针对删除作者的测试用例
  });
});
```

Store 测试套件通过 `Dispatcher` 派发事件并针对结果状态进行断言，延续了我们在第 15 章针对 `AuthStore` 确立的标准模式。每个测试分组覆盖事件流的特定环节：初始状态校验默认属性，加载测试覆盖成功与网络失败两条路径，创建与删除测试则对完整的数据突变流程进行闭环断言。

特别需要指出的是，在测试创建和删除时我们同时 Mock 了 `getPaged`：这是为了严密验证 `withEventHandlers` 中的 `reloadAfterCreate$` 与 `reloadAfterDelete$` 自动重载监听器是否准确生效。当实体变更成功后，该处理器会将成功事件转化为新的 `loadAuthors` 事件，进而重新触发分页数据查询。如果自动重载监听器被漏写或失效，`expect(authorService.getPaged).toHaveBeenCalled()` 的断言就会立刻报错。

Store 已牢牢覆盖完毕。接下来我们为底层的 HTTP 服务层补充单测。

## 编写 AuthorService 单元测试

打开此前生成的 `features/books/services/author.service.spec.ts`。我们按照第 16 章中 `AuthService` 的 `HttpTestingController` 测试规范编写单测，使用 URL 谓词断言（`r => r.url.includes(…)`）来规避绝对路径匹配的脆弱性：

```typescript
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthorService } from './author.service';

describe('AuthorService', () => {
  let service: AuthorService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthorService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should fetch paginated authors', () => {
    service.getPaged(0, 10).subscribe((res) => {
      expect(res.content.length).toBe(2);
    });

    const req = httpMock.expectOne(
      r => r.url.includes('/authors/paged')
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      content: [
        { id: 1, name: 'Author 1', nationality: 'USA', books: [] },
        { id: 2, name: 'Author 2', nationality: 'UK', books: [] },
      ],
      totalElements: 2,
      totalPages: 1,
    });
  });

  it('should create an author', () => {
    const author = {
      name: 'New Author',
      nationality: 'Greece',
    };
    service.create(author).subscribe((res) => {
      expect(res.id).toBe(5);
    });

    const req = httpMock.expectOne(
      r => r.url.includes('/authors') && !r.url.includes('/paged')
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(author);
    req.flush({ id: 5, ...author, books: null });
  });

  it('should delete an author', () => {
    service.delete(1).subscribe();

    const req = httpMock.expectOne(
      r => r.url.includes('/authors/1')
    );
    expect(req.request.method).toBe('DELETE');
    req.flush(null, {
      status: 204,
      statusText: 'No Content',
    });
  });
});
```

### 运行测试

使用在第 11 章配置的 Vitest 命令执行测试套件：

```bash
npm run test:run
```

手工编写的作者 CRUD 全流程已经在端到端维度上得到了严格验证，现在我们手中握有了一份极具说服力的设计范式。接下来我们可以放心地将其托付给 Copilot，检验它的代码生成能力。

## AI 辅助生成图书 CRUD 业务流

既然作者 CRUD 流程已经完全实现且通过了所有测试，我们就建立了一套高度可复制的标准范式。现在我们借助 Copilot 快速生成对应的图书管理业务代码：图书拥有 9 个字段的复杂模型、书名搜索支持，以及关键的 `authorId` 实体引用。

### 使用 Copilot 生成 BookService 与 BookStore

打开 VS Code 命令面板（Windows 按 `Ctrl + Shift + P`，macOS 按 `Cmd + Shift + P`），激活 Copilot 的 Agent Mode，引用刚才编写的所有作者代码文件作为上下文，并输入以下 Prompt：

```
Using the AuthorService in
features/books/services/author.service.ts
and the AuthorStore in features/books/store/author-store
(author.events.ts, author.state.ts,
author.store.ts) as reference patterns, generate:

1. BookService in
   features/books/services/book.service.ts
   - Same CRUD pattern: getAll, getPaged,
     getById, create, update, delete
   - create() and update() accept BookRequest
     (with authorId)
   - GET methods return Book[] (with nested author object)
   - searchByTitleIgnoreCase(title) calls
     /by-title-ignore-case and returns Book[]
   - Base URL:
     ${environment.apiUrl}/inventory/api/books

2. Book events in
   features/books/store/book-store/book.events.ts
   - Same source grouping
     (Book Page / Book API)
   - createSubmitted and updateSubmitted
     use BookRequest type

3. Book state in
   features/books/store/book-store/book.state.ts
   - Same pagination fields as AuthorState
   - Include searchTerm, like AuthorState

4. BookStore in
   features/books/store/book-store/book.store.ts
   - Same event-driven pattern
   - Use normalizeApiErrorMessage() in all
     catchError blocks
   - Reload current page after mutations
   - Use switchMap for loads,
     exhaustMap for mutations
```

> **注意**
>
> 最终生成的代码形态可能会根据你所使用的大模型及其具体版本而略有不同，文件内容不一定能做到与随书仓库逐行一致。下方的核对清单才是评估生成质量的核心标准，切勿仅凭文本 Diff。如果你希望跳过 AI 生成步骤，完整的实现文件已经存放在仓库的 `features/books/services/book.service.ts` 和 `features/books/store/book-store/` 中——直接查阅现有源码同样能达到学习目的。

仔细审查生成的代码，重点核对以下几个技术核心：

- `BookService` 的 `create()` 和 `update()` 方法必须接收 `BookRequest` 接口，而不能是 `Book` 接口。带有嵌套 `author` 对象的 `Book` 接口只适用于 GET 响应。
- 图书事件使用了正确的载荷类型：`createSubmitted` 必须携带 `BookRequest` 类型而非 `Book`。
- 错误处理是否在所有 `catchError` 块中均调用了 `normalizeApiErrorMessage()`，杜绝使用裸露的 `error.message` 类型断言。
- `BookStore` 在查询加载与写操作变更之间是否分别采用了 `switchMap` 与 `exhaustMap`，并且在 `withEventHandlers` 中配置了变更后刷新列表的自动重载处理器。

如果生成结果存在偏差（这在复杂场景下很常见），直接手动修改调整。这种“审查并微调”的工作流正是我们在第 3 章强调的“信赖但必须验证”（Trust but verify）开发原则的最佳实操体现。

### 将图书列表页与 BookStore 联动

拿到就绪的 `BookStore` 之后，我们更新图书列表页面（`features/books/pages/list/list.ts`），将其原有的 Mock 数据替换为真正的 `BookStore`。其逻辑与作者对话框完全一致。`injectDispatch(bookPageEvents)` 会返回一个方法名与事件组完全镜像的强类型派发器——包括 `loadBooks()`、`createSubmitted()`、`updateSubmitted()` 和 `deleteConfirmed()`，每一个都受到载荷类型的编译级约束，如果传错载荷会在编译期直接报错，绝不会变成运行时的隐形炸弹。

同时，我们还需要在渲染表格的 `book-list.ts` 组件中，将展示列数组中的 `authorName` 更新为 `author`。并在该页面的顶部加入书名搜索输入框，模式与作者管理弹窗保持一致。最后，打开 `features/books/components/book-list/book-list.ts`，开启 `editBook` 和 `deleteBook` 方法向外发射 Output 事件的能力。你可以在随书 GitHub 仓库中查阅这些更新后的文件细节。

### 在图书表单中集成作者动态下拉列表

在第 14 章中，图书表单对 `authorName` 使用了一个简单的文本输入框，因为当时仅仅是为了验证 UI，未连接后端 API。现在我们的 `AuthorStore` 中已经有了真实的作者数据，是时候把这个文本输入框替换为 `<mat-select>` 下拉选择器了，并向下游传递后端真正期望的数值型 `authorId`。

#### 更新图书表单组件

打开 `features/books/components/book-form/book-form.ts` 并做如下修改：

```typescript
export class BookForm {
  // .. 已有的依赖注入

  // 注入 AuthorStore 和强类型事件派发器
  readonly authorStore = inject(AuthorStore);
  private readonly dispatch = injectDispatch(authorPageEvents);

  // 用 authorId 替换原本的 authorName
  bookForm = this.fb.nonNullable.group({
    // .. 其余字段保持不变
    authorId: this.fb.control<number | null>(
      null, [Validators.required, Validators.min(1)]
    ),
  });

  constructor() {
    // 触发加载作者数据以填满下拉列表
    this.dispatch.loadAuthors({
      page: 0, size: 100
    });

    if (this.data) {
      this.bookForm.patchValue({
        title: this.data.title,
        isbn: this.data.isbn,
        // 从嵌套的 author 对象中提取 authorId
        authorId: this.data.author.id ?? null,
        price: this.data.price,
        genre: this.data.genre,
        published: this.data.published
          ? new Date(this.data.published)
          : null,
        description: this.data.description ?? '',
        pageCount: this.data.pageCount ?? null,
        coverImageUrl: this.data.coverImageUrl ?? '',
      });
    }
  }
  // onSubmit() 现在会构建 BookRequest 对象；详见随书仓库
}
```

> **注意**
>
> 这里的下拉菜单一次性拉取了第一页共 100 名作者。如果作者总数超过 100，第 101 位之后的作者将不会出现在下拉列表中，且控制台不会报错。对于大型真实业务系统，当下拉选项规模较大时，应改用基于 `by-name-ignore-case` 端点的带防抖自动补全组件 `mat-autocomplete`，而非一次性预加载全量的 `mat-select`。

请注意在组件的 `imports` 数组中添加 `MatSelectModule`；上面的代码片段省略了装饰器部分，但在仓库中的完整代码里包含了该引入。

#### 更新图书表单模板

随后在 `features/books/components/book-form/book-form.html` 中，用 `<mat-select>` 替换原本的 `authorName` 输入框：

```html
<!-- 使用以下代码替换原先的 authorName 字段： -->
<mat-form-field appearance="outline">
  <mat-label>Author</mat-label>
  <mat-select formControlName="authorId">
    @for (author of authorStore.authors();
          track author.id) {
      <mat-option [value]="author.id">
        {{ author.name }}
      </mat-option>
    }
  </mat-select>
  @if (bookForm.get('authorId')?.touched &&
       bookForm.get('authorId')?.hasError('required')) {
    <mat-error>
      Author is required.
    </mat-error>
  }
  @if (bookForm.get('authorId')?.touched &&
       bookForm.get('authorId')?.hasError('min')) {
    <mat-error>
      Please select an author.
    </mat-error>
  }
</mat-form-field>
```

这里是作者领域与图书领域的核心交汇点。下拉菜单由 `authorStore.authors()` 响应式信号提供数据支持；只要应用中的其他部分新增或更新了作者，下拉列表就会全自动感知并实时刷新：

![图 17.2：带有动态作者下拉选择列表的图书表单](/media/posts/spring-boot-angular/img-09119.png)

*Figure 17.2: The book form with the dynamic authors dropdown*

当表单提交时，`onSubmit()` 会从表单的当前值构建出一个 `BookRequest` 实例，传递数值型的 `authorId` 而非字符串型的 `authorName`。此前定义的 `BookRequest` 强类型接口为我们提供了端到端的类型安全保障：发出的载荷与后端 `POST /inventory/api/books` 端点的要求严格吻合。

### 妥善处理编辑模式下的读写不对称性

在为编辑模式配置图书表单时，必须妥善处理读写不对称性。表单内部使用数值型 `authorId` 维护状态，但 API 返回的却是嵌套的 `author` 对象。由于该对象本身就携带了自身的 `id`，我们可以在表单数据回显时直接读取 `this.data.author.id` 填入 `authorId` 控件中，而无需为了解析图书所属的作者而额外去 `AuthorStore` 中做低效的反向查找。此时注入 `AuthorStore` 的唯一目的，仅仅是为了给下拉选项提供展示列表，无论在新增还是编辑模式下都需要它。

### 测试图书 CRUD 业务流

最后，我们再次使用 Copilot 为 `BookStore` 和 `BookService` 生成对应的测试用例：

```
Using the AuthorStore tests in
features/books/store/author-store/author.store.spec.ts
and the AuthorService tests in
features/books/services/author.service.spec.ts
as reference patterns, create comprehensive
unit tests for the BookStore and BookService.
Use Vitest tooling.

The tests should cover:
1. Initial state verification
2. Load books (success and failure)
3. Create book with BookRequest payload
4. Update book
5. Delete book and reload
6. Service HTTP calls with correct endpoints
7. Use URL predicates in httpMock.expectOne()
```

审查生成的测试用例，确保写操作断言使用的是 `BookRequest`，而 GET 查询断言使用的是 `Book`。服务层测试应当遵循第 16 章的规范，在 `httpMock.expectOne()` 中使用 URL 谓词（`r => r.url.includes(…)`）而非硬编码绝对字符串。最后，运行全量测试套件进行终极验收：

```bash
npm run test:run
```

控制台全部飘绿，这标志着本章的所有功能与测试完备交付。

## 本章小结

在本章中，我们为作者与图书两个实体实现了完整的 CRUD 业务闭环，通过事件驱动的状态仓库将第 14 章构建的表单全面接入了真实的后端 API。作者管理特性完全由手工打造，在一个简洁的模型上跑通了“服务 → 事件 → 状态 → Store → 组件”的全套生命周期。我们没有为作者建立独立的路由页面，而是把作者列表置于一个从图书页弹出的对话框中，通过优雅的弹窗堆叠在单个路由内实现了全功能的作者 CRUD 交互。

随后，我们借助生成式 AI 辅助，将确立好的 Store 与 Service 设计范式快速推广到更加复杂的图书管理特性中，证明了清晰的设计规范能够让 AI 产出更加可控且易于审查的代码。最核心的技术升级在于把图书表单中的 `authorName` 文本框重构成由 `AuthorStore` 驱动的响应式 `<mat-select>` 下拉列表。为此我们引入了 `BookRequest` 接口来妥善应对 GET 响应（嵌套 `author` 对象）与 POST/PUT 请求（传递 `authorId` 外键）之间的读写不对称性，这是对接关系型数据库后端时极具实战意义的经典设计。

随着认证机制（第 16 章）与 CRUD 业务（本章）的完全打通，我们的书店系统在功能上已经彻底闭环。在接下来的章节中，我们将深入探索 Angular 的现代服务端渲染（SSR）与水合优化，显著提升应用的首屏加载性能与 SEO 表现，为生产环境部署做好最后冲刺。
