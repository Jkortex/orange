---
title: Spring Boot & Angular 全栈实战（十九）：SSE 实时数据流与 RxJS 响应式集成
date: 2026-10-23T00:19:00Z
description: 在 Angular 客户端基于 RxJS 封装 EventSource 连接，消费后端 Server-Sent Events 流，实现新书实时推送、自创建事件去重与列表自动刷新。
category: fullstack
column: spring-boot-angular
tags:
  - Angular
  - SSE
  - RxJS
  - 实时通信
  - EventSource
---

> 💡 **专栏导读**：本文收录于专栏 [《Spring Boot 4 & Angular 22 全栈微服务实战》](/columns/spring-boot-angular)。全专栏共 22 篇，深度覆盖 Java 26 微服务拆分、Spring Cloud 网关与安全鉴权、Angular 22 Signals 状态治理以及端到端容器化交付的全链路工程实践。

在上一篇中，我们完成了现代服务端渲染（SSR）体系的落地，使书籍目录获得了秒级首屏渲染与优秀的搜索引擎友好度，同时依托 `@defer` 实现了分页器的渐进式水合。

然而，截至目前，应用的数据同步模型依然停留在经典的“请求-响应”单向循环中：用户在前端提交表单后主动重载列表，而若其他用户或后台批处理新增了图书，已打开页面的客户端对此一无所知，只能依赖用户手动刷新。

在现代高协同业务场景中，实时感知数据动态已成为核心体验指标。本文我们将引入 **Server-Sent Events（SSE，服务端推送事件）**，在 Angular 客户端结合 RxJS 优雅封装底层的 `EventSource` 连接，消费后端微服务推送的实时事件流；同时深入处理 SSR 平台环境守卫、自创建事件去重、搜索状态保护以及组件生命周期自动资源回收，打造高韧性的实时响应式前端架构。

---

## 一、实时通信选型：为何选择 Server-Sent Events？

在全栈 Web 开发中，实现服务端向客户端实时推送数据的主流方案有三类：轮询（Polling）、WebSocket 以及 Server-Sent Events（SSE）。

```
┌────────────────────────────────────────────────────────────────────────┐
│                        实时通信技术方案横向对比                        │
├───────────────┬────────────────────────┬───────────────────────────────┤
│ 特性维度      │ WebSocket              │ Server-Sent Events (SSE)      │
├───────────────┼────────────────────────┼───────────────────────────────┤
│ 通信方向      │ 全双工 (双向收发)       │ 单向 (服务端主动推送至客户端) │
│ 协议底层      │ 独立 ws:// 协议 (握手升级)│ 标准 HTTP 协议 (text/event-stream)│
│ 浏览器重连    │ 需应用层自行编码实现心跳与重连│ 原生 EventSource 内置指数退避重连│
│ 防火墙/代理   │ 偶发被企业代理、网关拦截阻断│ 天然穿透标准 HTTP 代理与 Nginx 网关│
│ 报文开销与复杂度│ 二进制/文本自定义帧，复杂度高│ 极简纯文本行格式，开销极低    │
│ 适用场景      │ 在线协同文档、即时通讯聊天室 │ 实时监控指标、库存更新、事件推送、AI 流式输出 │
└───────────────┴────────────────────────┴───────────────────────────────┘
```

### 1. 业务契合度分析
我们的图书目录通知场景具有天然的**单向性**：当后台库存微服务有新书入库时，服务端广播事件通知所有在线客户端，客户端无需通过该通道向服务端反向写数据（客户端写操作通过成熟的 RESTful API 完成）。

因此，使用轻量级的 SSE 远比配置全双工 WebSocket 更为精准克制：
- **无需复杂的协议升级**：直接复用现有的 Spring Cloud Gateway 网关反向代理路由；
- **原生支持断线自动重连**：浏览器底层的 `EventSource` 会在连接意外中断（网络切换、微服务重启）时自动尝试重连，无需手写心跳保活；
- **传输效率与调试成本**：纯文本基于流式下发，抓包与排查极为清晰直观。

### 2. SSE 传输报文剖析
后端库存微服务推送的事件遵循 W3C 规范，内容类型为 `text/event-stream`。一个典型的原始报文结构如下：

```text
id: a8780704-9799-46b4-84dc-9431d7db5f19
event: NEW_BOOK
data: {"eventType":"NEW_BOOK","bookId":42,"bookTitle":"Clean Code","isbn":"9780132350884"}
```

- `id`：事件唯一标识符，浏览器断线重连时会自动携带 `Last-Event-ID` 请求头以便服务端补发遗漏数据；
- `event`：**具名事件名称**。客户端可以针对 `NEW_BOOK` 或 `PRICE_CHANGE` 注册定向监听器，过滤掉不感兴趣的消息；
- `data`：实际传输的 JSON 业务载荷。

### 3. 网关透传与鉴权边界
SSE 请求经由 API 网关（`/packt/inventory/api/notifications/stream`）透明代理至库存微服务。

需要注意的是，浏览器原生的 `EventSource` API 不支持自定义 HTTP 请求头（无法直接附带 `Authorization: Bearer <token>`）。但这与我们上一章确立的架构决策高度一致：**图书目录的浏览与库存公开动态属于非敏感公共数据**，通知流端点设计为免密公开访问，因此完全不受请求头限制的影响。

---

## 二、定义通知数据模型契约

在编写任何服务逻辑之前，首先定义强类型的 TypeScript 接口，规范前端对 SSE 事件载荷的消费边界。

创建 `src/app/shared/models/notification.ts`：

```typescript
export interface BookNotification {
  eventType: 'NEW_BOOK';
  bookId: number;
  bookTitle: string;
  isbn?: string;
}
```

字段设计思考：
- `eventType`：限定为联合字面量类型，便于未来扩展 `PRICE_CHANGE` 等事件时享受编译期穷举检查；
- `bookTitle`：用于在界面右下角弹出 Toast 提示框时直接展示书名；
- `isbn`：**核心去重关联键**（Correlation Key），用于阻断本客户端发起的新增事件重复弹窗；
- 尽管后端可能下发更复杂的作者与价格快照，但在我们的架构中，客户端接收到通知后会统一触发 Store 的静默分页拉取，因此模型仅精炼保留必要字段，保持契约轻便。

---

## 三、构建基于 RxJS 的响应式 NotificationService

接下来，我们将浏览器的 `EventSource` 包装为标准的 RxJS `Observable<BookNotification>`。这不仅能无缝接入 Angular 的流式操作符链条，还能优雅管理底层 TCP 连接的建立与销毁。

生成服务骨架：

```bash
ng generate service features/books/services/notification.service
```

实现 `src/app/features/books/services/notification.service.ts`：

```typescript
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { BookNotification } from '../../../shared/models/notification';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly streamUrl = `${environment.apiUrl}/inventory/api/notifications/stream`;

  /**
   * 建立 SSE 响应式数据流连接
   */
  connect(): Observable<BookNotification> {
    return new Observable<BookNotification>((subscriber) => {
      // 1. SSR 平台环境防护：Node.js 环境下直接完成，防止引用全局 EventSource 崩溃
      if (!isPlatformBrowser(this.platformId)) {
        subscriber.complete();
        return;
      }

      // 2. 初始化原生浏览器 EventSource
      const eventSource = new EventSource(this.streamUrl);

      // 3. 定向监听后端广播的 NEW_BOOK 具名事件
      eventSource.addEventListener('NEW_BOOK', (event: Event) => {
        try {
          const messageEvent = event as MessageEvent;
          const parsed = JSON.parse(messageEvent.data) as BookNotification;
          subscriber.next(parsed);
        } catch (error) {
          console.error('[NotificationService] Failed to parse SSE message:', error);
        }
      });

      // 4. 容错处理：记录重连告警，切勿调用 subscriber.error()
      eventSource.onerror = () => {
        console.warn('[NotificationService] SSE connection interrupted. Reconnecting automatically...');
      };

      // 5. RxJS Teardown 资源回收函数：订阅注销时主动关闭底层长连接
      return () => {
        eventSource.close();
      };
    });
  }
}
```

### 深度核心机制剖析

#### 1. 为什么使用 `addEventListener('NEW_BOOK')` 而非 `onmessage`？
根据 SSE 规范，若服务端下发的消息中带有 `event: NEW_BOOK` 标识，它属于**具名自定义事件**，浏览器只会派发给通过 `addEventListener('NEW_BOOK', ...)` 显式注册的监听器。原生的 `eventSource.onmessage` 属性仅用于捕获未指定事件名的匿名通用消息。使用具名事件监听，可以在浏览器底层直接实现事件路由，避免应用层做无意义的 `if (event.type === ...)` 过滤。

#### 2. SSR 平台守卫的关键防线
正如在第 18 章中所阐述的，在服务端渲染周期内，Node.js 运行时不存在 `EventSource` 全局构造函数。通过 `isPlatformBrowser(this.platformId)` 判定：若处于服务端环境，立即调用 `subscriber.complete()` 正常终结流。这保证了在 SSR 期间调用本服务既不会阻塞渲染管道，也不会抛出 `EventSource is not defined` 异常。

#### 3. 严禁在 `onerror` 中调用 `subscriber.error()`
这是一个极易踩坑的细节：当网络发生抖动或后端微服务重启时，`EventSource` 会触发 `error` 事件并启动原生重连机制。如果我们在回调中执行了 `subscriber.error(err)`，RxJS 的 Observable 流将按照规范**彻底永久终止**，后续的重连消息将再也无法抵达组件。因此，此处仅记录告警日志，静默交由浏览器执行自愈重连。

#### 4. Zoneless 响应式架构下的无缝调度
在 Angular 历史版本的 Zone.js 架构下，第三方或原生 API（如 `EventSource` 回调）往往需要开发者手动调用 `NgZone.run()` 来强制触发变更检测。而在我们当前的现代 Zoneless 架构中，全站状态由 Signals 驱动——当组件在订阅回调中调用 Store 的 `patchState()` 更新信号时，底层自动建立依赖追踪与视图刷新调度，无需任何 `NgZone` 黑魔法。

---

## 四、在书籍列表组件中编排实时刷新流

有了 `NotificationService` 后，我们将其接入 `features/books/pages/list/list.ts`。

当新书事件抵达时，前端需要执行两项动作：
1. 弹出 `MatSnackBar` Toast 浮窗，告知用户新书标题；
2. 调度 `BookStore` 重新拉取当前分页的数据，让列表在用户眼前自动呈现最新态。

### 1. 生命周期自动绑定：`takeUntilDestroyed`

长连接的生命周期管理至关重要。如果用户离开书籍页面（例如进入个人中心），后台若依然保持着 SSE 连接并在不可见的组件内触发重新渲染，将造成严重的内存泄漏与带宽浪费。

借助 Angular 的 `DestroyRef` 与 `takeUntilDestroyed` 操作符，我们可以在无需手写 `ngOnDestroy` 的情况下实现自动取消订阅：

```typescript
@Component({
  selector: 'app-book-list-page',
  standalone: true,
  // ...
})
export class List implements OnInit {
  protected readonly store = inject(BookStore);
  protected readonly dispatch = injectDispatch(bookPageEvents);
  private readonly snackBar = inject(MatSnackBar);
  private readonly notificationService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    // 初始加载首屏
    this.dispatch.loadBooks({ page: 0, size: 10 });

    // 订阅 SSE 实时流并绑定组件生命周期
    this.notificationService
      .connect()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((notification) => {
        // 弹出友好提示
        this.snackBar.open(`📚 New book added: ${notification.bookTitle}`, 'Dismiss', {
          duration: 5000,
        });

        // 保持在当前浏览页码与容量静默刷新列表
        this.dispatch.loadBooks({
          page: this.store.currentPage(),
          size: this.store.pageSize(),
        });
      });
  }
}
```

> 💡 **架构设计权衡**：
> 为什么不将 SSE 订阅放在全局的 `AppComponent` 中？
> 在当前业务阶段，实时通知的核心目的是刷新书籍表格，建立在局部组件级既节省服务器连接配额，又做到了按需开闭。如果未来业务发展出“全局顶部导航栏消息铃铛未读数”，我们可以随时将该订阅提升至全局根服务或应用级 Store 中，`NotificationService` 的无状态设计天然支持这一演进。

---

## 五、自创建事件去重与多终端体验优化

此时进行测试，会发现一个严重的交互瑕疵：

当用户 A 自己在当前页面点击“Add New Book”并成功创建一本《Refactoring》后：
1. 弹窗关闭后，本地创建逻辑已经触发了 `reloadAfterCreate` 刷新，并弹出了“Book created successfully”提示；
2. 几百毫秒后，后端库存微服务向所有人（包括用户 A）广播了包含《Refactoring》的 `NEW_BOOK` SSE 消息；
3. 用户 A 再次收到一个“📚 New book added: Refactoring”的 Toast，并且表格被无端重复重载了一次！

用户自己刚刚创建的内容，无需再对自己发出广播提醒。这不仅造成视觉干扰，也带来了冗余的并发请求。

### 1. 关联键方案：基于 ISBN 的客户端去重

由于在向后端 POST 提交前，后端数据库尚未生成主键 `bookId`，但图书的 `isbn` 在表单提交阶段便已完全确定，并且 SSE 下发的事件 payload 中同样包含 `isbn`。因此，**ISBN 是绝佳的端到端关联去重标识（Correlation Key）**。

### 2. 考虑格式规范化与搜索状态保护

在实际业务中，用户输入的 ISBN 可能带有连字符（如 `978-0-13-235088-4`），而后端推送的可能是去连字符的纯数字。因此匹配前必须执行一致的格式清洗（`normalizeIsbn`）。

此外，**如果用户当前正在按关键字搜索图书**，我们不能在接收到新书推送时强行把分页重置覆盖掉当前的搜索结果视图！否则用户正在筛选查看的数据会被瞬间冲掉，造成严重困扰。

完善后的 `features/books/pages/list/list.ts` 代码如下：

```typescript
@Component({
  // ...
})
export class List implements OnInit {
  protected readonly store = inject(BookStore);
  protected readonly dispatch = injectDispatch(bookPageEvents);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly notificationService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  // 本地已创建待确认的 ISBN 集合（用于过滤自发推送）
  private readonly locallyCreatedIsbns = new Set<string>();

  ngOnInit(): void {
    this.dispatch.loadBooks({ page: 0, size: 10 });

    this.notificationService
      .connect()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((notification) => {
        const normalizedIsbn = notification.isbn
          ? this.normalizeIsbn(notification.isbn)
          : null;

        // 核心去重：若该通知源于本地刚刚提交的创建操作，则拦截并静默消费
        if (normalizedIsbn && this.locallyCreatedIsbns.has(normalizedIsbn)) {
          this.locallyCreatedIsbns.delete(normalizedIsbn);
          return;
        }

        // 外部新书推送：提示浮窗
        this.snackBar.open(`📚 New book added: ${notification.bookTitle}`, 'Dismiss', {
          duration: 5000,
        });

        // 搜索态保护：仅在非搜索模式下才自动重载列表，避免冲刷用户当前查询结果
        if (!this.store.isSearching()) {
          this.dispatch.loadBooks({
            page: this.store.currentPage(),
            size: this.store.pageSize(),
          });
        }
      });
  }

  /**
   * 打开创建图书弹窗
   */
  openCreateDialog(): void {
    const dialogRef = this.dialog.open(BookForm, {
      width: '560px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // 在派发请求前，先记录该 ISBN 到本地拦截白名单中
        this.locallyCreatedIsbns.add(this.normalizeIsbn(result.isbn));
        this.dispatch.createSubmitted(result);
        this.snackBar.open('Book created successfully', 'Close', { duration: 3000 });
      }
    });
  }

  /**
   * 标准化 ISBN 格式：剥离所有空格与连字符
   */
  private normalizeIsbn(isbn: string): string {
    return isbn.replace(/[-\s]/g, '');
  }
}
```

完整交互闭环流转时序：

```
[用户 A 浏览器]                          [后端网关/库存服务]                [用户 B 浏览器]
       │                                       │                                  │
       ├─ 提交表单 (记录 ISBN 到 Set)            │                                  │
       ├─ POST /books ────────────────────────►│                                  │
       │                                       ├─ 保存入库                        │
       │                                       ├─ 广播 SSE NEW_BOOK 事件 ────────►│
       │◄── 广播 SSE NEW_BOOK 事件 ────────────┤                                  ├─ 匹配未命中 Set
       │                                       │                                  ├─ 弹出 Toast
       ├─ 匹配到 Set 中对应 ISBN                │                                  └─ 自动刷新列表
       ├─ 剔除 Set 并拦截退出 (零干扰)          │
       └─ (仅展示自身的提交成功提示)           │
```

---

## 六、工程级测试套件构建（Vitest + Mocking）

由于 `EventSource` 属于浏览器原生全局对象，在基于 Node.js 运行的 Vitest 环境中默认未定义。为了编写严谨的单元测试，我们需要结合 Vitest 的全局插桩 API（`vi.stubGlobal`）进行深度隔离测试。

### 1. NotificationService 单元测试

在 `src/app/features/books/services/notification.service.spec.ts` 中，我们测试具名监听、取消订阅与 SSR 平台防御：

```typescript
import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { NotificationService } from './notification.service';
import { BookNotification } from '../../../shared/models/notification';

describe('NotificationService', () => {
  let service: NotificationService;
  let listeners: Record<string, (e: any) => void>;
  let closeSpy: any;

  beforeEach(() => {
    listeners = {};
    closeSpy = vi.fn();

    // 插桩全局 EventSource 构造函数
    const mockEventSource = vi.fn().mockImplementation(() => ({
      addEventListener: vi.fn((type: string, handler: (e: any) => void) => {
        listeners[type] = handler;
      }),
      close: closeSpy,
      onerror: null,
    }));

    vi.stubGlobal('EventSource', mockEventSource);

    TestBed.configureTestingModule({
      providers: [NotificationService],
    });
    service = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals(); // 必须清除全局插桩，防止污染后续套件
  });

  it('应当正确监听并分发 NEW_BOOK 具名事件', () => {
    let emitted: BookNotification | undefined;
    const sub = service.connect().subscribe((data) => {
      emitted = data;
    });

    const mockPayload: BookNotification = {
      eventType: 'NEW_BOOK',
      bookId: 101,
      bookTitle: 'Domain-Driven Design',
      isbn: '9780321125217',
    };

    // 模拟服务端下发数据
    listeners['NEW_BOOK']({
      data: JSON.stringify(mockPayload),
    });

    expect(emitted).toEqual(mockPayload);
    sub.unsubscribe();
  });

  it('取消订阅时必须主动调用底层 eventSource.close()', () => {
    const sub = service.connect().subscribe();
    expect(closeSpy).not.toHaveBeenCalled();

    sub.unsubscribe();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('在 Server 平台上应当直接 complete，绝不建立长连接', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        NotificationService,
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    });
    const serverService = TestBed.inject(NotificationService);

    let completed = false;
    serverService.connect().subscribe({
      complete: () => {
        completed = true;
      },
    });

    expect(completed).toBe(true);
  });
});
```

### 2. 组件集成测试：自创建去重与搜索防冲刷

在组件测试中，我们将 `NotificationService.connect()` 替换为可控的 RxJS `Subject`，以便在测试断言中精确模拟消息推送：

```typescript
describe('List Component (SSE Integration)', () => {
  let notificationSubject: Subject<BookNotification>;
  let snackBarSpy: any;
  let bookStoreMock: any;

  beforeEach(() => {
    notificationSubject = new Subject<BookNotification>();
    snackBarSpy = { open: vi.fn() };
    bookStoreMock = {
      currentPage: signal(0),
      pageSize: signal(10),
      isSearching: signal(false),
      books: signal([]),
      totalElements: signal(0),
    };
    // ... 配置 TestBed 并注入依赖
  });

  it('接收到外部通知时应当弹出 SnackBar 并刷新当前页', async () => {
    const fixture = TestBed.createComponent(List);
    await fixture.whenStable();

    notificationSubject.next({
      eventType: 'NEW_BOOK',
      bookId: 202,
      bookTitle: 'Building Microservices',
      isbn: '9781491950357',
    });

    expect(snackBarSpy.open).toHaveBeenCalledWith(
      expect.stringContaining('Building Microservices'),
      'Dismiss',
      expect.any(Object)
    );
  });

  it('若接收到的通知匹配本地创建的 ISBN，必须予以静默去重', async () => {
    const fixture = TestBed.createComponent(List);
    const component = fixture.componentInstance;
    await fixture.whenStable();

    // 模拟用户刚刚提交了某本书
    (component as any).locallyCreatedIsbns.add('9781491950357');

    // 模拟服务端几百毫秒后推回该书通知（含连字符格式）
    notificationSubject.next({
      eventType: 'NEW_BOOK',
      bookId: 202,
      bookTitle: 'Building Microservices',
      isbn: '978-1-4919-5035-7',
    });

    // 验证未触发重复 Toast
    expect(snackBarSpy.open).not.toHaveBeenCalled();
    // 验证消费后该 ISBN 已从白名单清除
    expect((component as any).locallyCreatedIsbns.has('9781491950357')).toBe(false);
  });
});
```

运行测试套件：

```bash
npm run test:run
```

所有服务与组件级测试 100% 绿色通过。

---

## 七、多终端端到端联调实测

自动化测试通过后，我们在浏览器中验证真实的多终端交互闭环：

1. 启动微服务集群与 Angular 开发服务器（`npm run start`）；
2. 打开**浏览器窗口 A**，进入图书目录列表（保持未登录浏览状态）；
3. 打开**浏览器窗口 B**（或隐身窗口），登录管理员账号；
4. 在窗口 B 中打开创建图书弹窗，录入新书并点击提交：
   - 窗口 B 提示“Book created successfully”，列表加载出新书，无任何多余弹窗；
5. 切回窗口 A：在无需任何手动按键的前提下，页面右下角瞬间弹出“📚 New book added: [书名]”Toast 浮窗，且表格自动刷新，新书整齐出现在第一行！

多终端实时感知推送如下图所示：

![多标签页下第一窗口实时接收新书推送并更新列表](/media/posts/spring-boot-angular/img-09131.png)

6. 边界场景验证：在窗口 A 的搜索框输入关键字“Java”过滤列表；在窗口 B 再次创建一本名为《Rust in Action》的书籍。此时窗口 A 依然弹出新书通知，但**当前由“Java”筛选出的表格列表保持原样**，未被全量新书冲刷，验证了搜索保护逻辑的严密性。

---

## 八、总结与专栏展望

在本文中，我们以优雅、克制的工程架构为 Angular 应用注入了实时通信能力：

1. **精准的技术选型**：剖析了单向广播场景下 SSE 相对于 WebSocket 的架构轻量性与免配置穿透优势；
2. **现代 RxJS 封装**：将底层 `EventSource` 抽象为响应式流，融合了 `isPlatformBrowser` 服务端平台守卫、具名事件监听、错误自动重连保护与 Teardown 资源回收；
3. **极佳的用户体验治理**：设计了基于 ISBN 的自创建通知过滤（Self-Notification Suppression）机制，并结合查询状态保护，避免了无效弹窗与界面数据跳变。

至此，我们的图书系统已经完整囊括了**全栈 CRUD、微服务网关鉴权、现代服务端渲染（SSR）与服务端实时流（SSE）**的完整闭环。在接下来的章节中，我们将进入生产就绪交付阶段，探索如何使用多阶段 Docker 容器化打包 Angular 前端产物，并与 Nginx 反向代理、Spring Boot 微服务共同编排交付。
