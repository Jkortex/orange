---
title: Spring Boot & Angular 全栈实战（十七）：状态管理驱动的完整 CRUD 交互闭环
date: 2026-10-23T00:17:00Z
description: 结合 AuthorStore 与 BookStore，实战分页列表、动态防抖检索、模态框创建/编辑与级联下拉关联的生产级 CRUD 完整流程。
category: fullstack
column: spring-boot-angular
tags:
  - Angular
  - CRUD
  - SignalStore
  - 分页检索
  - 业务实战
---

> 💡 **专栏导读**：本文收录于专栏 [《Spring Boot 4 & Angular 22 全栈微服务实战》](/columns/spring-boot-angular)。全专栏共 22 篇，深度覆盖 Java 26 微服务拆分、Spring Cloud 网关与安全鉴权、Angular 22 Signals 状态治理以及端到端容器化交付的全链路工程实践。

---

在上一章中，我们打通了客户端与后端微服务的安全通道，实现了基于函数式 HTTP 拦截器的 JWT 自动装配、高并发无感刷新以及基于 Signals 的路由守卫。前端不仅具备了完整的鉴权能力，还确立了“面向接口契约、通过全局拦截器解耦认证逻辑”的标准通信范式。

在本章中，我们将聚焦于系统最核心的业务领域：**图书（Book）与作者（Author）的完整 CRUD 数据流转闭环**。

在实际工业级研发中，CRUD 绝不仅是简单的 GET/POST。我们将系统化解决一系列生产级难点：
1. **Spring Data 分页契约适配**：如何在客户端状态模型中无缝对齐 Spring Boot 的 `Page<T>` 结构；
2. **读写不对称性契约治理**：查询时后端返回嵌套的 `Author` 关联对象，变更（POST/PUT）时前端仅传递标量外键 `authorId`；
3. **并发安全与请求取消**：使用 RxJS `switchMap` 治理读操作（快速翻页或输入检索时自动取消在途请求），使用 `exhaustMap` 治理写操作（创建/更新/删除时天然防重复点击）；
4. **变更新鲜度保证**：通过声明式事件重载流水线（`reloadAfterMutation$`），在写操作成功后自动按当前分页参数刷新表格，杜绝手写数组拼接引发的数据不一致；
5. **跨域数据级联绑定**：在图书创建/编辑表单中，直接注入 `AuthorStore` 的响应式 Signals，实现级联动态下拉选择。

---

## 一、微服务后端 API 契约一览

所有业务请求均经由统一的 API 网关（基准路径为 `/packt`）转发至底层的库存微服务（`inventory-service`）。得益于上一章构建的 `authInterceptor`，所有 HTTP 请求都会自动附带 `Authorization: Bearer <JWT>` 报头，微服务各端点定义如下：

### 1.1 作者管理端点（Author Endpoints）

| HTTP 方法 | 请求路径 | 功能说明 |
| :--- | :--- | :--- |
| `GET` | `/inventory/api/authors` | 获取全量作者列表 |
| `GET` | `/inventory/api/authors/paged?page=0&size=10` | 服务端分页查询（0 索引） |
| `GET` | `/inventory/api/authors/by-name-ignore-case?name=xxx` | 忽略大小写的模糊检索 |
| `GET` | `/inventory/api/authors/{id}` | 根据 ID 获取作者详情 |
| `POST` | `/inventory/api/authors` | 新增作者 |
| `PUT` | `/inventory/api/authors/{id}` | 更新作者信息 |
| `DELETE` | `/inventory/api/authors/{id}` | 删除指定作者 |

### 1.2 图书管理端点（Book Endpoints）

| HTTP 方法 | 请求路径 | 功能说明 |
| :--- | :--- | :--- |
| `GET` | `/inventory/api/books` | 获取全量图书列表 |
| `GET` | `/inventory/api/books/paged?page=0&size=10` | 服务端分页查询（0 索引） |
| `GET` | `/inventory/api/books/by-title-ignore-case?title=xxx` | 忽略大小写的书名检索 |
| `GET` | `/inventory/api/books/{id}` | 根据 ID 获取图书详情 |
| `POST` | `/inventory/api/books` | 新增图书（需传递 `authorId`） |
| `PUT` | `/inventory/api/books/{id}` | 更新图书信息 |
| `DELETE` | `/inventory/api/books/{id}` | 删除指定图书 |

---

## 二、共享接口与请求模型定义

### 2.1 分页契约模型：PaginatedResponse

Spring Data JPA 的分页返回对象包含丰富的元数据（总元素数、总页数、当前页码、分页大小等）。我们创建 `src/app/shared/models/paginated.ts`：

```typescript
export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number; // 当前页码（从 0 开始）
  first: boolean;
  last: boolean;
  empty: boolean;
}
```

### 2.2 读写模型不对称性：Book 与 BookRequest

更新 `src/app/shared/models/author.ts`：

```typescript
export interface Author {
  id?: number;
  name: string;
  nationality: string;
  books?: string[];
}
```

更新 `src/app/shared/models/book.ts`。这里体现了典型的领域模型不对称性：
- `Book` 用于 **读展示**：包含完整的 `Author` 嵌套对象；
- `BookRequest` 用于 **写提交**：只包含后端外键所必需的 `authorId: number`。

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

---

## 三、第一阶段：手动构建 Author 领域闭环

我们先以字段结构相对简单、但 CRUD 流程完整的作者模块作为标杆范式。

### 3.1 编写 AuthorService

创建 `src/app/features/books/services/author.service.ts`：

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

  getPaged(page: number, size: number): Observable<PaginatedResponse<Author>> {
    const params = new HttpParams().set('page', page.toString()).set('size', size.toString());
    return this.http.get<PaginatedResponse<Author>>(`${this.baseUrl}/paged`, { params });
  }

  searchByName(name: string): Observable<Author[]> {
    const params = new HttpParams().set('name', name);
    return this.http.get<Author[]>(`${this.baseUrl}/by-name-ignore-case`, { params });
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

> **设计细节**：新增作者时 ID 由数据库自增分配，因此入参类型使用 TypeScript 工具类型 `Omit<Author, 'id'>` 严格约束前端不可传递空 ID。

### 3.2 定义领域事件：Author Events

在 `src/app/features/books/store/author-store/author.events.ts` 中遵循源头驱动的分组契约：

```typescript
import { eventGroup } from '@ngrx/signals/events';
import { type } from '@ngrx/signals';
import { Author } from '../../../../shared/models/author';

export const authorPageEvents = eventGroup({
  source: 'Author Page',
  events: {
    loadAuthors: type<{ page: number; size: number }>(),
    searchByName: type<{ name: string }>(),
    createSubmitted: type<Omit<Author, 'id'>>(),
    updateSubmitted: type<{ id: number } & Omit<Author, 'id'>>(),
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

### 3.3 定义状态模型：AuthorState

创建 `src/app/features/books/store/author-store/author.state.ts`：

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

### 3.4 核心实现：AuthorStore 与自动化刷新机制

创建 `src/app/features/books/store/author-store/author.store.ts`。

在此 Store 中，我们应用了两项高级 RxJS 状态治理模式：
1. **区分操作特性的操作符调度**：
   - 数据加载与检索采用 `switchMap`：若用户在输入框连续键入检索或连续点击翻页，旧请求会被自动 abort 取消，防止乱序返回；
   - 增删改采用 `exhaustMap`：在当前提交请求完成前，忽略用户的重复点击，天然构建防重防护。
2. **变更新鲜度管线（Reload-after-mutation）**：
   - 监听 `createSuccess`、`updateSuccess`、`deleteSuccess`，直接映射派发 `authorPageEvents.loadAuthors`。
   - 重新拉取当前页码（`store.currentPage()`）和条数（`store.pageSize()`），服务端返回最新排序和计算结果，完全避免客户端手动拼接数组带来的数据撕裂。

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
    // 列表分页加载
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

    // 增、改、删过渡态
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

  withEventHandlers(
    (store, events = inject(Events), authorService = inject(AuthorService)) => ({
      // 分页查询：switchMap 取消过时请求
      load$: events.on(authorPageEvents.loadAuthors).pipe(
        switchMap((event) =>
          authorService.getPaged(event.payload.page, event.payload.size).pipe(
            map((response) =>
              authorApiEvents.loadSuccess({
                authors: response.content,
                totalElements: response.totalElements,
                totalPages: response.totalPages,
              })
            ),
            catchError((error: unknown) =>
              of(
                authorApiEvents.loadFailure({
                  error: normalizeApiErrorMessage(error, 'Failed to load authors'),
                })
              )
            )
          )
        )
      ),

      // 关键词检索
      search$: events.on(authorPageEvents.searchByName).pipe(
        switchMap((event) => {
          if (event.payload.name.trim() === '') {
            return of(authorApiEvents.searchSuccess({ authors: [] }));
          }
          return authorService.searchByName(event.payload.name).pipe(
            map((authors) => authorApiEvents.searchSuccess({ authors })),
            catchError((error: unknown) =>
              of(
                authorApiEvents.searchFailure({
                  error: normalizeApiErrorMessage(error, 'Search failed'),
                })
              )
            )
          );
        })
      ),

      // 新增：exhaustMap 防止重复提交
      create$: events.on(authorPageEvents.createSubmitted).pipe(
        exhaustMap((event) =>
          authorService.create(event.payload).pipe(
            map((author) => authorApiEvents.createSuccess({ author })),
            catchError((error: unknown) =>
              of(
                authorApiEvents.createFailure({
                  error: normalizeApiErrorMessage(error, 'Failed to create author'),
                })
              )
            )
          )
        )
      ),

      // 更新
      update$: events.on(authorPageEvents.updateSubmitted).pipe(
        exhaustMap((event) => {
          const { id, ...data } = event.payload;
          return authorService.update(id, data).pipe(
            map((author) => authorApiEvents.updateSuccess({ author })),
            catchError((error: unknown) =>
              of(
                authorApiEvents.updateFailure({
                  error: normalizeApiErrorMessage(error, 'Failed to update author'),
                })
              )
            )
          );
        })
      ),

      // 删除
      delete$: events.on(authorPageEvents.deleteConfirmed).pipe(
        exhaustMap((event) =>
          authorService.delete(event.payload.id).pipe(
            map(() => authorApiEvents.deleteSuccess({ id: event.payload.id })),
            catchError((error: unknown) =>
              of(
                authorApiEvents.deleteFailure({
                  error: normalizeApiErrorMessage(error, 'Failed to delete author'),
                })
              )
            )
          )
        )
      ),

      // 变更后自动触发列表刷新流水线
      reloadAfterCreate$: events.on(authorApiEvents.createSuccess).pipe(
        map(() =>
          authorPageEvents.loadAuthors({
            page: store.currentPage(),
            size: store.pageSize(),
          })
        )
      ),

      reloadAfterUpdate$: events.on(authorApiEvents.updateSuccess).pipe(
        map(() =>
          authorPageEvents.loadAuthors({
            page: store.currentPage(),
            size: store.pageSize(),
          })
        )
      ),

      reloadAfterDelete$: events.on(authorApiEvents.deleteSuccess).pipe(
        map(() =>
          authorPageEvents.loadAuthors({
            page: store.currentPage(),
            size: store.pageSize(),
          })
        )
      ),
    })
  )
);
```

### 3.5 模态框交互：AuthorListDialog 与多层弹窗嵌套

作者本身属于图书的辅助支撑域，不需要开辟专属页面路由。我们将其收敛在 `MatDialog` 模态框中，并在其中进一步弹窗调起 `AuthorForm`（模态框嵌套 Dialog Stacking）。

创建 `src/app/features/books/components/author-list-dialog/author-list-dialog.ts`：

```typescript
import { Component, OnInit, inject } from '@angular/core';
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
import { Author } from '../../../../shared/models/author';
import { authorPageEvents } from '../../store/author-store/author.events';
import { AuthorStore } from '../../store/author-store/author.store';
import { AuthorForm } from '../author-form/author-form';

@Component({
  selector: 'author-list-dialog',
  templateUrl: './author-list-dialog.html',
  styleUrl: './author-list-dialog.scss',
  imports: [
    MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    FormsModule,
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
    const dialogRef = this.dialog.open(AuthorForm, { width: '560px' });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.dispatch.createSubmitted(result);
        this.snackBar.open('Author created successfully', 'Close', { duration: 3000 });
      }
    });
  }

  openEditDialog(author: Author) {
    const dialogRef = this.dialog.open(AuthorForm, { width: '560px', data: author });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.dispatch.updateSubmitted(result);
        this.snackBar.open('Author updated successfully', 'Close', { duration: 3000 });
      }
    });
  }

  confirmDelete(author: Author) {
    if (confirm(`Delete ${author.name}?`)) {
      this.dispatch.deleteConfirmed({ id: author.id! });
      this.snackBar.open('Author deleted successfully', 'Close', { duration: 3000 });
    }
  }

  close() {
    this.dialogRef.close();
  }
}
```

在模态框模板 `author-list-dialog.html` 中绑定响应式 Signals：

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
      <table mat-table [dataSource]="store.authors()" class="authors-table app-table">
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

在图书列表页顶部工具栏中加入入口按钮：

```html
<button mat-stroked-button (click)="openAuthorManagement()">
  <mat-icon>people</mat-icon>
  Authors
</button>
```

运行效果如图所示，在同一路由下即可完成作者列表查看、动态分页、增删改查全流程：

![作者管理弹窗与嵌套 CRUD 交互](/media/posts/spring-boot-angular/img-09117.png)

---

## 四、第二阶段：图书领域 CRUD 闭环与跨 Store 联动

掌握了标准范式后，图书模块（Book）的构建遵循完全相同的状态驱动体系。本节重点攻克其与作者模块的**级联选择交互**。

### 4.1 级联下拉重构：从文本输入到响应式 `<mat-select>`

在早期的静态原型中，图书表单中的作者字段为手动输入的字符串 `authorName`。而在生产接口中，后端持久化需要关联真实的 `authorId`。

修改 `src/app/features/books/components/book-form/book-form.ts`，直接注入 `AuthorStore`：

```typescript
import { Component, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { injectDispatch } from '@ngrx/signals/events';
import { AuthorStore } from '../../store/author-store/author.store';
import { authorPageEvents } from '../../store/author-store/author.events';

export class BookForm {
  private fb = inject(FormBuilder);
  readonly authorStore = inject(AuthorStore);
  private readonly dispatch = injectDispatch(authorPageEvents);

  // 表单控件调整为 authorId
  bookForm = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    isbn: ['', [Validators.required]],
    authorId: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
    price: [0, [Validators.required, Validators.min(0)]],
    genre: ['', [Validators.required]],
    published: this.fb.control<Date | null>(null, [Validators.required]),
    description: [''],
    pageCount: this.fb.control<number | null>(null),
    coverImageUrl: [''],
  });

  constructor() {
    // 弹窗开启时，按需预加载备选作者（支持前 100 条）
    this.dispatch.loadAuthors({ page: 0, size: 100 });

    // 编辑模式下的不对称性适配：从嵌套的 author 对象中提取 id 填入控件
    if (this.data) {
      this.bookForm.patchValue({
        title: this.data.title,
        isbn: this.data.isbn,
        authorId: this.data.author.id ?? null,
        price: this.data.price,
        genre: this.data.genre,
        published: this.data.published ? new Date(this.data.published) : null,
        description: this.data.description ?? '',
        pageCount: this.data.pageCount ?? null,
        coverImageUrl: this.data.coverImageUrl ?? '',
      });
    }
  }
}
```

在模板 `book-form.html` 中，使用 Angular 22 的新版 `@for` 流程控制直接遍历 `authorStore.authors()`：

```html
<mat-form-field appearance="outline">
  <mat-label>Author</mat-label>
  <mat-select formControlName="authorId">
    @for (author of authorStore.authors(); track author.id) {
      <mat-option [value]="author.id">
        {{ author.name }}
      </mat-option>
    }
  </mat-select>
  @if (bookForm.get('authorId')?.touched && bookForm.get('authorId')?.hasError('required')) {
    <mat-error>Author is required.</mat-error>
  }
  @if (bookForm.get('authorId')?.touched && bookForm.get('authorId')?.hasError('min')) {
    <mat-error>Please select an author.</mat-error>
  }
</mat-form-field>
```

当表单提交时，调用 `bookForm.getRawValue()` 并转换为 `BookRequest` 格式。由于 `authorStore.authors()` 是响应式的活 Signal（Live Signal），即便用户刚刚在作者管理弹窗中新增了一位作者，在打开图书弹窗时也能立刻看到最新选项。

实际运行效果如图所示：

![图书创建表单中的响应式作者下拉选择](/media/posts/spring-boot-angular/img-09119.png)

---

## 五、架构级进阶剖析与性能优化

### 5.1 为什么采用「声明式重新加载」而非「本地 Reducer 数组剪裁」？

传统 Redux / NgRx 开发者习惯在 `createSuccess` 时将新对象 `[...state.items, newItem]` 追加到本地状态。但这在服务端分页与复杂检索场景下存在致命缺陷：
1. **排序断裂**：后端通常按 `updated_at DESC` 或 `id DESC` 排序，前端本地 append 无法保证多端一致的排序逻辑；
2. **总计数脱节**：前端本地数组改变后，`totalElements` 和 `totalPages` 无法精确推算（尤其包含服务端过滤时）；
3. **关联聚合失效**：作者关联的 `books.length` 统计必须由数据库聚合得出。

因此，我们在 `withEventHandlers` 中采用 `reloadAfterCreate$` 触发 `loadAuthors`。虽然多消耗一次轻量分页网络请求，却能确保客户端视图与数据库具备绝对的一致性。

### 5.2 大数据量级联的性能考量

在当前实现中，我们在图书表单初始化时拉取了 `size: 100` 的作者列表。如果企业级业务中作者数量达到数万条：
- 静态 `<mat-select>` 渲染会导致 DOM 节点爆炸；
- 生产级优化方案是将 `<mat-select>` 演进为 `<mat-autocomplete>`，并依托 `searchByName(name)` 配合 RxJS `debounceTime(300)` 实现服务端防抖模糊联想。

---

## 六、总结与下篇展望

在本文中，我们彻底打通了 Spring Boot 4 + Angular 22 在核心业务领域的完整交互闭环：
- **规范契约落地**：通过 `PaginatedResponse<T>` 与 `BookRequest` 完美解决了服务端分页和读写不对称性设计；
- **响应式状态管理**：依托 NgRx SignalStore 与 Events 插件，实现了读操作自动取消（`switchMap`）、写操作防重（`exhaustMap`）以及突变后自动重载（`reloadAfterMutation$`）；
- **跨组件协同**：在图书表单中直接桥接 `AuthorStore`，实现了优雅的响应式级联选择与模态框嵌套交互。

至此，我们的图书管理系统在客户端与服务端之间已具备了完整的鉴权体系和生产级 CRUD 治理能力。

在下一篇中，我们将进入现代 Web 架构的高阶领域——**Angular 22 混合渲染（SSR/SSG）与性能优化实战**。我们将重新激活服务端预渲染，深入解析鉴权页面与公开首屏的隔离策略，为企业级上线做好最后的性能与 SEO 冲刺。
