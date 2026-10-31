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

# 原著完整参考：状态管理驱动的完整 CRUD 交互闭环

在企业级全栈开发中，数据管理与交互闭环并非简单的 RESTful 接口调用，而是涵盖数据契约对齐、不对称实体治理、异步并发流控制以及状态时效性保障的综合工程体系。

本文基于 Spring Data JPA 服务端分页契约，通过 NgRx SignalStore 与 Events 插件构建工业级图书与作者 CRUD 响应式闭环，攻克复杂搜索防抖、读写不对称性及级联模态框交互难点。

:::en
> **Original**: Production-grade CRUD workflows demand rigorous synchronization between backend pagination contracts and fine-grained frontend reactive state, guaranteeing consistency across mutations.

**📌 核心术语与语境解析**：
- **CRUD Operations** [krʌd ˌɑːpəˈreɪʃnz]：*增删改查操作*。创建（Create）、读取（Read）、更新（Update）与删除（Delete）四种核心持久化操作的总称。
- **Contract Alignment** [ˈkɑːntrækt əˈlaɪnmənt]：*契约对齐*。前后端数据载荷、请求参数与状态码严格符合预定义 Schema 约定的设计规范。
:::

## 1. 微服务后端 API 契约与分页对齐

业务请求统一经由 Spring Cloud Gateway 反向代理（前缀 `/packt`）转发至库存微服务（`inventory-service`）。所有请求已由 `authInterceptor` 自动挂载 Bearer JWT。

### 1.1 服务端分页契约模型：PaginatedResponse

Spring Data JPA 的分页返回对象包含丰富的元数据。前端需构建对等契约接口 `src/app/shared/models/paginated.ts`：

```typescript
export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number; // 当前页码（0 索引）
  first: boolean;
  last: boolean;
  empty: boolean;
}
```

:::en
> **Original**: Spring Data's `Page<T>` representation supplies essential structural pagination metadata, allowing frontend controls to configure total element indices seamlessly.

**📌 核心术语与语境解析**：
- **Pagination Metadata** [ˌpædʒɪˈneɪʃn ˈmetədeɪtə]：*分页元数据*。描述分页列表整体结构的信息（如总记录数、总页数、当前页索引），而非具体业务条目本身。
- **Zero-indexed Pagination** [ˈzɪroʊ ˈɪndekst ˌpædʒɪˈneɪʃn]：*从零开始的分页索引*。Spring Boot 默认页码计数从 0 起始，前端展示层需进行 +1 映射转换。
:::

### 1.2 读写模型不对称性：Book 与 BookRequest

在领域驱动与关系存储中，数据的展示与提交流程存在固有不对称性：
- `Book` 用于 **读取展示**：包含完整的 `Author` 嵌套对象，满足视图层富文本呈现；
- `BookRequest` 用于 **写提交**：仅包含后端外键所需的标量字段 `authorId: number`，避免网络冗余与实体持久化级联风险。

```typescript
export interface Book {
  id?: number;
  title: string;
  isbn: string;
  author: Author;
  price: number;
  genre: string;
  published: string;
}

export interface BookRequest {
  title: string;
  isbn: string;
  authorId: number;
  price: number;
  genre: string;
  published: string;
}
```

:::en
> **Original**: Read-write model asymmetry distinguishes presentation payloads containing nested objects from mutation payloads carrying scalar foreign keys, preserving relational boundaries.

**📌 核心术语与语境解析**：
- **Read-Write Asymmetry** [riːd raɪt eɪˈsɪmətri]：*读写不对称性*。查询视图所用数据契约与命令修改所用输入契约在字段结构上的差异化设计。
- **Scalar Foreign Key** [ˈskeɪlər ˈfɔːrən kiː]：*标量外键*。仅使用单一数值型或字符串 ID 表示关联对象身份，而非传递完整嵌套对象。
:::

## 2. Author 领域闭环与状态机跃迁

### 2.1 服务层抽象与 TypeScript 严格约束

在 `AuthorService` 中，新增操作的实体 ID 由数据库序列自增分配，入参严格约束为 `Omit<Author, 'id'>`，杜绝未持久化对象携带空 ID 提交：

```typescript
@Injectable({ providedIn: 'root' })
export class AuthorService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/inventory/api/authors`;

  getPaged(page: number, size: number): Observable<PaginatedResponse<Author>> {
    const params = new HttpParams().set('page', page.toString()).set('size', size.toString());
    return this.http.get<PaginatedResponse<Author>>(`${this.baseUrl}/paged`, { params });
  }

  create(author: Omit<Author, 'id'>): Observable<Author> {
    return this.http.post<Author>(this.baseUrl, author);
  }
}
```

:::en
> **Original**: TypeScript utility types like `Omit<T, K>` enforce compile-time validation, guaranteeing that auto-generated identifiers are omitted from creation payloads.

**📌 核心术语与语境解析**：
- **Utility Type** [juːˈtɪləti taɪp]：*实用工具类型*。TypeScript 提供的用于对既有类型进行属性摘取、排除或标记可选的高阶类型转换算子。
- **Auto-generated Identifier** [ˈɔːtoʊ ˈdʒenəreɪtɪd aɪˈdentɪfaɪər]：*自增唯一标识符*。由数据库自增主键序列或分布式发号器生成的持久化唯一键。
:::

### 2.2 事件编排与操作符调度

在 SignalStore 状态编排中，依据操作语义严格区分调度操作符：
- **读操作（`switchMap`）**：自动取消上一轮在途查询。当用户连续翻页或快速键入检索字符时，较早发出的网络请求立即被 abort 取消，避免乱序响应覆写最新状态；
- **写操作（`exhaustMap`）**：在当前网络调用完成前，抑制新产生的重复事件，杜绝用户连击提交表单引发的多重写入；
- **变更新鲜度管线（`reloadAfterMutation$`）**：监听写成功事件，自动派发当前分页参数的重载指令，确保多端并发场景下排序与关联统计的绝对准确。

:::en
> **Original**: Differentiating operator semantics between `switchMap` for query cancellations and `exhaustMap` for mutation idempotence prevents UI race conditions and duplicate submissions.

**📌 核心术语与语境解析**：
- **Idempotence** [aɪˈdempətəns]：*幂等性*。多次执行同一操作对系统产生的业务副作用与单次执行完全一致的特性。
- **Stale Request Cancellation** [steɪl rɪˈkwest ˌkænsəˈleɪʃn]：*过时请求取消*。当新的查询条件就绪时，主动中断已无意义的旧异步请求以释放系统与网络资源。
:::

## 3. 模态框嵌套交互与 Dialog Stacking

作者管理属于图书领域的辅助支撑域，将其内嵌于 `MatDialog` 模态框中，并在其中进一步嵌套 `AuthorForm`（模态框堆叠），在单一页面路由下完整收敛作者的查阅、检索与维护流程。

模板通过绑定 `store.authors()`、`store.loading()` 与 `store.totalElements()` 活信号，结合 `@if` 和 `@for` 流程控制，实现无死角的状态骨架与空态展示。

:::en
> **Original**: Dialog stacking isolates auxiliary domain workflows within modular overlays, avoiding route sprawl while maintaining localized state management.

**📌 核心术语与语境解析**：
- **Dialog Stacking** [ˈdaɪəlɔːɡ ˈstækɪŋ]：*对话框/模态框堆叠*。在上层模态框内部进一步调起子模态框的分层交互模式。
- **Route Sprawl** [ruːt sprɔːl]：*路由蔓延*。将次要或辅助功能过度拆分为独立顶级路由导致应用导航结构松散臃肿的现象。
:::

## 4. 图书 CRUD 闭环与跨 Store 响应式级联

在图书表单组件（`BookForm`）中，直接注入 `AuthorStore`：
- 初始化阶段调用 `loadAuthors({ page: 0, size: 100 })` 预拉取候选作者数据；
- 模板利用 Angular 22 的 `@for (author of authorStore.authors(); track author.id)` 渲染 `<mat-select>` 选项；
- 由于消费的是响应式活信号（Live Signal），用户在作者弹窗中新增或修改作者后，图书表单下拉菜单无需刷新整页即可即时感知最新选项。

:::en
> **Original**: Injecting cross-domain stores directly into form components allows live signal streams to populate cascading selectors without redundant network traffic.

**📌 核心术语与语境解析**：
- **Cascading Selector** [kæˈskeɪdɪŋ sɪˈlektər]：*级联下拉选择器*。下一级可选范围由上一级选定值或关联领域模型动态约束的联动选择控件。
- **Live Signal** [laɪv ˈsɪɡnəl]：*响应式活信号*。与依赖图绑定的反应式节点，其值变更时能够即刻自动触发依赖组件局部重绘。
:::

## 5. 声明式重载流水线 vs 本地数组剪裁的权衡

传统状态管理常采用在客户端本地数组直接 push/splice 的做法。但在服务端分页与复杂检索场景下，这一做法存在严重缺陷：
1. **排序断裂**：无法还原数据库的多字段混合排序规则；
2. **总数脱节**：前端本地修改无法准确推算服务端真实 `totalElements`；
3. **关联聚合失效**：关联实体的聚合统计字段无法本地推演。

声明式重载管线以一次极轻量的网络请求为代价，换取了客户端与数据库全量状态的强一致性。

:::en
> **Original**: Declarative reload pipelines trade a lightweight network roundtrip for absolute state consistency, eliminating client-side sorting drift and aggregate miscalculations.

**📌 核心术语与语境解析**：
- **State Consistency** [steɪt kənˈsɪstənsi]：*状态一致性*。客户端视图呈现与底层数据库存储状态在业务语义与数据细节上保持高度吻合。
- **Sorting Drift** [ˈsɔːrtɪŋ drɪft]：*排序漂移*。客户端本地插入新元素时无法准确契合服务端复杂排序逻辑而产生的位置错乱。
:::
