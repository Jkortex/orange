---
title: Spring Boot & Angular 全栈实战（十八）：Angular 现代服务端渲染（SSR）与水合优化
date: 2026-10-23T00:18:00Z
description: 配置 RenderMode 细粒度路由渲染策略，结合 AngularNodeAppEngine、isPlatformBrowser 平台守卫与增量水合技术，实现高 SEO 与极速首屏加载。
category: fullstack
column: spring-boot-angular
tags:
  - Angular
  - SSR
  - 水合
  - SEO
  - 服务端渲染
---

> 💡 **专栏导读**：本文收录于专栏 [《Spring Boot 4 & Angular 22 全栈微服务实战》](/columns/spring-boot-angular)。全专栏共 22 篇，深度覆盖 Java 26 微服务拆分、Spring Cloud 网关与安全鉴权、Angular 22 Signals 状态治理以及端到端容器化交付的全链路工程实践。

在前几章中，我们完成了图书与作者管理模块的完整 CRUD 交互，基于 Signals 和事件驱动 Store 联通了后端微服务 API。然而，工程架构中一直保留着一项妥协：为了规避登录鉴权中对浏览器专有 API（如 `localStorage`）的直接依赖，我们在服务端路由配置中将所有路径粗暴地降级为全站客户端渲染（`RenderMode.Client`）。

全站 CSR 意味着浏览器首屏接收到的只是一个几乎为空的 `<app-root>` 壳文件，必须等待整个庞大的 JavaScript Bundle 下载、解析并执行完毕后，才能呈现出真实内容。对于需要被搜索引擎索引、社交媒体抓取预览且对首屏加载性能要求极高的公共图书目录而言，这无疑是重大的性能与 SEO 瓶颈。

在本文中，我们将彻底清偿这一技术债务。我们将引入 Angular 现代渲染体系，通过精细化的按路由渲染模式配置（SSR / SSG / CSR 混合部署），让公开的书籍目录获得服务端即时渲染能力；同时深入剖析 Angular 现代 DOM 水合（Hydration）机制、平台守卫（`isPlatformBrowser`）以及使用 `@defer` 实现的增量按需加载，全面提升 Web 核心指标（Core Web Vitals）。

---

## 一、Angular 现代渲染策略选型

在深入代码之前，我们首先需要理清 Angular 原生支持的三种核心渲染策略。渲染策略决定了页面的 HTML 在何处、何时被构建与交付：

```
                      ┌──────────────────────────────────────────────┐
                      │            Angular 现代渲染策略体系           │
                      └──────────────────────┬───────────────────────┘
                                             │
         ┌───────────────────────────────────┼───────────────────────────────────┐
         ▼                                   ▼                                   ▼
┌──────────────────┐               ┌──────────────────┐                ┌──────────────────┐
│   客户端渲染 (CSR) │               │   服务端渲染 (SSR) │                │   静态预渲染 (SSG) │
│ RenderMode.Client│               │ RenderMode.Server│                │RenderMode.Prerender│
├──────────────────┤               ├──────────────────┤                ├──────────────────┤
│• 运行时浏览器解析JS  │               │• 每次请求动态执行渲染 │                │• 构建期 (ng build) │
│• 初始响应为空壳 HTML│               │• 极速 FCP，SEO 友好 │                │  生成静态 HTML 文件  │
│• 适合用户私密/高交互 │               │• 客户端水合接管交互   │                │• 零计算开销，纯静态 │
│  页面（个人中心/表单）│               │• 适合高动态内容目录   │                │• 适合法律声明/落地页 │
└──────────────────┘               └──────────────────┘                └──────────────────┘
```

### 1. 客户端渲染（Client-Side Rendering, CSR）
- **运作机制**：服务器仅返回极简的 HTML 宿主骨架（空 `<app-root>`）。浏览器下载完整的 JavaScript 资产，启动 Angular 运行时并完成整个页面 DOM 的生成与渲染。
- **适用场景**：强交互、高度依赖用户身份的私密页面（如登录、注册、个人资料、表单编辑弹窗）。此类页面强依赖 `localStorage` 中的 JWT Token，且搜索引擎爬虫无需抓取登录表单，CSR 完全胜任。
- **代价与权衡**：首屏白屏时间较长，网络受限或低功耗设备上感知明显。

### 2. 服务端渲染（Server-Side Rendering, SSR）
- **运作机制**：当 HTTP 请求抵达 Node.js 运行时，服务端拉起 Angular 渲染引擎，执行组件逻辑并获取数据，直接生成包含完整内容的真实 HTML 返回给浏览器。用户在任何 JavaScript 加载完成之前，便可瞬间目睹完整渲染好的页面结构与文本。随后，当 JavaScript 包下载完成后，Angular 启动**水合（Hydration）**流程，将事件监听器绑定到现有 DOM 上，平滑激活交互。
- **适用场景**：高动态、强依赖 SEO 与首屏首字渲染速度的公共页面，例如商城书籍目录、文章详情页。

### 3. 静态预渲染（Static Site Generation, SSG / Prerender）
- **运作机制**：在执行 `ng build` 编译打包阶段，Angular 直接对配置好的路由执行离线渲染，为每个路由生成完全静态的 `.html` 文件。请求到达时直接由 Web 服务器作为静态文件分发，无任何动态计算开销。
- **适用场景**：部署后内容极少变动、无需按需查询实时数据库的页面，例如“服务条款”、“隐私政策”或纯展示型营销落地页。

### 4. 路由与渲染策略映射矩阵

现代前端工程的精髓在于**细粒度按需施策**，而非一刀切。针对我们的线上书店系统，各模块的职责边界清晰分明：

| 路由路径 | 呈现内容 | 渲染模式 (`RenderMode`) | 选型原因 |
| :--- | :--- | :--- | :--- |
| `/books` | 书籍目录（`mat-table`） | `Server` (SSR) | 公共页面、SEO 强需求、首屏性能指标优先、数据动态变化 |
| `/privacy` | 隐私政策条款 | `Prerender` (SSG) | 纯静态文本内容，无数据依赖，构建期预生成性能最高 |
| `/terms` | 用户服务条款 | `Prerender` (SSG) | 纯静态文本内容，零请求期算力损耗 |
| `/auth/signin` | 用户登录表单 | `Client` (CSR) | 依赖浏览器本地存储，无 SEO 诉求 |
| `/auth/signup` | 用户注册表单 | `Client` (CSR) | 私密操作交互，无需预渲染 |
| `/profile` | 个人资料中心 | `Client` (CSR) | 强鉴权保护、千人千面，天然属于客户端范畴 |

---

## 二、Angular 现代 SSR 架构体系

在项目初始化阶段，Angular CLI 为我们预置了服务端运行时的脚手架骨架。在深入调整策略之前，我们需要透彻理解其背后的协作网络。

### 1. 服务端入口：`AngularNodeAppEngine`

`src/server.ts` 是 SSR 服务的 Node.js 原生入口，基于 Express 框架搭配 `@angular/ssr/node` 提供的渲染引擎构建：

```typescript
import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');
const app = express();

const angularApp = new AngularNodeAppEngine({
  allowedHosts: ['localhost', '127.0.0.1'],
});

// 静态文件服务：长效缓存客户端 JS/CSS/图片资源，禁用默认 index.html 由 SSR 托管
app.use(express.static(browserDistFolder, {
  maxAge: '1y',
  index: false,
  redirect: false,
}));

// SSR 核心分发中间件：交由 Angular 引擎处理路由动态渲染
app.use((req, res, next) => {
  angularApp.handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next()
    )
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
```

关键配置与架构解析：
- **`AngularNodeAppEngine`**：Angular 服务端渲染总控中枢。它截获匹配的 HTTP 请求，依据路由规则启动组件生命周期管线，生成 HTML 字符串并以标准 Response 对象返回。
- **`allowedHosts`**：SSR 服务器的安全防线。Angular 对未授权的 Host Header 实施严格拦截，以彻底杜绝**服务端请求伪造（SSRF）**与主机头注入攻击。此处显式允许 `localhost` 与 `127.0.0.1` 确保开发与容器内通信顺畅。
- **`index: false`**：在 Express 静态托管中间件中关闭默认索引，保证所有非静态资源请求透传至下方的 `angularApp.handle()`，由 Angular 决定具体呈现策略。

### 2. 现代水合（Hydration）生命周期

当终端请求命中 SSR 路由时，现代水合机制经历了以下阶段：

```
客户端请求 ─────────► Node.js 服务端 ─────────► AngularNodeAppEngine
                          │                              │
                          │                              ▼ 执行组件逻辑与网络请求
                          │                        生成完整 HTML 响应
                          │                              │
                          ▼                              ▼
                 客户端接收完整 HTML (内容瞬间可视，首屏 FCP 极佳)
                          │
                          ▼ 后台下载 Angular JavaScript Bundle
                     启动水合流程 (Hydration)
                          │
                          ▼ 核心优势：复用服务端已渲染的真实 DOM 节点！
                     绑定事件监听器，激活 Signals 响应式闭环
                          │
                          ▼
                 应用平滑升级为完全交互的单页应用 (SPA)
```

在旧版 Angular Universal 时代，客户端拉起后会将服务端渲染出的 DOM 彻底销毁并重新生成一遍，造成明显的布局重排与页面白闪烁（Layout Thrashing）。

而在现代 Angular 水合引擎中，系统会**深度比对并复用已有的 DOM 结构**，仅仅将事件处理程序和变更检测图谱无缝附加其上。用户的滚动位置、输入焦点均得以原生保留。

### 3. 底层通信桥梁：`withFetch()` 的必要性

在 SSR 服务端环境下，浏览器专有的 `XMLHttpRequest` API 并不存在。此前在 `app.config.ts` 中配置的：

```typescript
provideHttpClient(
  withFetch(),
  withInterceptors([...])
)
```

其中 `withFetch()` 指示 Angular `HttpClient` 底层全面切换至标准的 `fetch` 实现。在 Node 运行时中，它直接调用 Node.js 内置的全局 `fetch` 发起网络调用。若遗漏该配置，SSR 服务在请求数据时将直接抛出致命异常。

---

## 三、重构应用路由与组件权限边界

要让书籍目录真正享受到 SSR 的红利，我们必须解决之前架构中的另一个问题：**路由级粗暴拦截**。

此前我们在 `/books` 父路由上直接挂载了 `authGuard`。导致无论是搜索引擎爬虫还是未登录的访客，一律被重定向到 `/auth/signin`，这使得服务端渲染完全无法发挥价值。

在电商或内容型架构中，**浏览公开资源应当零门槛，而敏感写操作（增删改）才实施严密鉴权**。

### 1. 新增静态协议预渲染页面

首先补齐页脚缺失的静态路由页面。利用 Angular CLI 生成轻量级内联组件：

```bash
ng generate component pages/privacy --inline-template --inline-style
ng generate component pages/terms --inline-template --inline-style
```

更新页脚模板 `src/app/shared/layout/footer/footer.html`，将原生超链接替换为 `routerLink`，使其遵循 SPA 客户端导航规则：

```html
<footer>
  <mat-toolbar color="primary" class="footer">
    <span class="footer-text">© 2026 Packt Publishing</span>
    <span class="spacer"></span>
    <a mat-button routerLink="/privacy" aria-label="View privacy policy">Privacy</a>
    <a mat-button routerLink="/terms" aria-label="View terms of service">Terms</a>
  </mat-toolbar>
</footer>
```

### 2. 重构前端路由清单（`app.routes.ts`）

移除 `/books` 路径上的 `authGuard`，并注册新增的静态法律页面：

```typescript
export const routes: Routes = [
  { path: '', redirectTo: 'books', pathMatch: 'full' },
  {
    path: 'books',
    // 移除 authGuard：开放公开访问，赋能 SSR 与 SEO
    loadChildren: () =>
      import('./features/books/books.routes').then(m => m.routes)
  },
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadChildren: () =>
      import('./features/auth/auth.routes').then(m => m.routes)
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/pages/profile/profile').then(m => m.Profile)
  },
  {
    path: 'privacy',
    loadComponent: () =>
      import('./pages/privacy/privacy').then(m => m.Privacy)
  },
  {
    path: 'terms',
    loadComponent: () =>
      import('./pages/terms/terms').then(m => m.Terms)
  },
];
```

> ⚠️ **权限架构提示**：
> 移除 `/books` 顶层的守卫后，该路径下的子路由默认均对外开放。如果在未来扩展了批量导入或管理后台等敏感子路由，必须在对应的子路由定义上显式声明 `canActivate: [authGuard]`。

### 3. 视图层鉴权降级与响应式表格列处理

书籍列表既然公开，管理操作按钮就必须依据用户实际登录态进行条件渲染。

修改 `features/books/pages/list/list.html`：

```html
<div class="page-header-full">
  <h1>Book Catalog</h1>
  @if (authStore.isAuthenticated()) {
    <div class="header-actions">
      <button mat-stroked-button (click)="openAuthorManagement()">
        <mat-icon>people</mat-icon>
        Authors
      </button>
      <button mat-raised-button color="primary" (click)="openCreateDialog()">
        <mat-icon>add</mat-icon>
        Add New Book
      </button>
    </div>
  }
</div>
```

在 `features/books/components/book-list/book-list.ts` 中，数据表格的操作列需要动态响应身份状态。我们借助 Angular 计算信号（Computed Signal）优雅实现：

```typescript
@Component({
  selector: 'app-book-list',
  standalone: true,
  // ...
})
export class BookList {
  protected readonly authStore = inject(AuthStore);
  
  private readonly baseColumns = ['title', 'author', 'genre', 'price', 'published'];
  
  // 依据登录态计算可见表格列
  protected readonly columns = computed(() =>
    this.authStore.isAuthenticated()
      ? [...this.baseColumns, 'actions']
      : this.baseColumns
  );
}
```

后端微服务的 `GET /inventory/api/books` 本身无需 Bearer Token 即可公开访问。如果当前未登录，拦截器跳过请求头注入，匿名访客仍能顺利拉取数据并完成服务端首屏渲染。

未登录访客与已登录用户在同一页面的渲染对比如下图所示：

![已登录用户与匿名访客的页面展示对比](/media/posts/spring-boot-angular/img-09125.png)

> 💡 **测试规范启示**：
> 将 `columns` 列信号设计为 `protected` 是良好的封装实践。编写组件单元测试时，不要通过破坏封装性去直接断言组件内部字段，而应当断言用户最终能感知到的 DOM 表现：
> ```typescript
> const headerCells = fixture.debugElement.queryAll(By.css('th[mat-header-cell]'));
> expect(headerCells.map(c => c.nativeElement.textContent.trim())).toEqual([
>   'Title', 'Author', 'Genre', 'Price', 'Published'
> ]);
> ```
> 这样即使组件底层实现发生重构，只要输出行为一致，测试套件便具备极高的韧性。

---

## 四、配置细粒度服务端路由渲染策略

现在进入核心环节：更新 `src/app/app.routes.server.ts`，为各路由精准指派渲染策略。

```typescript
import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // 1. 公开动态内容路由：使用 SSR，保障 SEO 与极限首屏响应
  {
    path: 'books',
    renderMode: RenderMode.Server,
  },
  // 2. 静态法律页面：构建期预渲染 (SSG)，瞬时下发零计算
  {
    path: 'privacy',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'terms',
    renderMode: RenderMode.Prerender,
  },
  // 3. 登录认证与用户中心：客户端渲染 (CSR)，避免 Node 平台报错
  {
    path: 'auth/**',
    renderMode: RenderMode.Client,
  },
  {
    path: 'profile',
    renderMode: RenderMode.Client,
  },
  // 4. 兜底匹配策略
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
```

规则匹配核心要点：
- **自顶向下优先匹配**：Angular 服务端路由引擎遵循自上而下的严格匹配顺序。一旦路径命中立即终止。因此通配符 `auth/**` 与全量兜底 `**` 必须沉淀在文件末尾。
- **Server vs Prerender**：书籍目录采用 `RenderMode.Server`，因为库存数据随写入实时变更，每次 HTTP 请求均需拉取数据库最新态；而法律条款直接编译固化至静态产物中，采用 `RenderMode.Prerender` 性能最优。

### 动态参数路由的构建期预渲染扩展（参数工厂）

虽然本文中的静态页面没有参数，但在真实企业级业务中，博客详情 `/articles/:slug` 或产品页同样需要 SSG。Angular 通过 `getPrerenderParams` 函数提供了强大的参数采集能力：

```typescript
{
  path: 'articles/:slug',
  renderMode: RenderMode.Prerender,
  async getPrerenderParams() {
    try {
      const articles = await fetchPublishedArticles();
      return articles.map((article) => ({ slug: article.slug }));
    } catch {
      // 容灾策略：降级返回空数组，避免网络瞬断导致构建整体瘫痪
      return [];
    }
  },
}
```
构建引擎在 `ng build` 期间会遍历执行该函数，为生成的每组 slug 输出对应的独立 HTML 文件。

---

## 五、水合安全：跨平台环境守卫与 TokenService 重构

当我们将 `/books` 设为 `RenderMode.Server` 后，启动服务可能立即遭遇经典报错：`ReferenceError: localStorage is not defined`。

原因是：SSR 渲染期间，组件通过 `BookService` 发送 HTTP 请求，触发了全局身份拦截器，拦截器内部调用了 `TokenService.getAccessToken()`，而该方法直接读取了 Node.js 运行时根本不存在的 `localStorage`。

### 1. Angular 双重环境守卫机制

Angular 针对非浏览器运行环境提供了两大核心机制：
1. **`afterNextRender` 生命周期钩子**：专为组件设计，仅在浏览器首次渲染完成之后执行，是安全挂载第三方图表、操作 DOM、读取本地存储的理想场所。
2. **`isPlatformBrowser` 守卫函数**：用于服务或底层工具类中，通过依赖注入的 `PLATFORM_ID` 动态判定当前宿主环境。

### 2. 重构 TokenService 实现平台无关性

修改 `src/app/core/services/token.service.ts`：

```typescript
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class TokenService {
  // 在依赖注入初始化时完成平台评估并缓存
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  saveTokens(accessToken: string, refreshToken: string): void {
    if (!this.isBrowser) return;
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  saveUser(user: UserInfo): void {
    if (!this.isBrowser) return;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  getAccessToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  getUser(): UserInfo | null {
    if (!this.isBrowser) return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserInfo;
    } catch {
      return null;
    }
  }

  clearAll(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}
```

深度原理解析：
- **缓存 `isBrowser` 是否会引发跨端数据污染？** 答案是绝对安全。服务端与浏览器分别运行在两个物理隔离的独立进程中，各自拥有完整的 Angular 运行时与独立的依赖注入容器（DI Container）。服务端生成的 `TokenService`（`isBrowser === false`）在渲染输出 HTML 后立即被垃圾回收；浏览器加载完成后会重新初始化一个崭新的实例（`isBrowser === true`）。
- **服务端静默降级**：在服务端执行 `getAccessToken()` 直接返回 `null`，认证拦截器因此不再附加 `Authorization` 请求头，完美契合后端公开接口的匿名调用需求。

---

## 六、利用 `@defer` 实现增量水合与渐进式加载

让首屏渲染跑得快只是第一步；如何降低客户端水合初期的 JavaScript 包体积，进一步优化**交互到下次绘制（INP）**指标？答案就是 Angular 的内置块级语法——`@defer`。

### 1. `@defer` 协同机制

`@defer` 可以将模板中的指定代码块及其依赖的所有深层组件自动剥离为独立的异步分块（Lazy-loaded Chunk）。只有在指定的触发条件（Trigger）被满足时，浏览器才会真正发起该分块的下载并激活水合。

常见触发器包括：
- `on viewport`：当目标占位区域滚动进入可视窗口时触发（首屏折叠线下内容的绝佳优化手段）；
- `on interaction`：当用户点击或聚焦占位区域时触发；
- `on hover`：鼠标悬停在占位区域时触发；
- `on idle`：浏览器主线程空闲时触发。

### 2. 延迟加载书籍列表分页器

在书籍列表页面中，搜索引擎爬虫和初次访问的用户最关心的是表格主体内容；而底部的 `MatPaginator` 是重交互控件，且处于视口折叠线下方。将其延迟加载，既精简了首屏初始 JavaScript 体积，又丝毫不影响 SEO。

在 `features/books/components/book-list/book-list.ts` 中配置分页事件：

```typescript
protected readonly store = inject(BookStore);
protected readonly dispatch = injectDispatch(bookPageEvents);

onPageChange(event: PageEvent): void {
  this.dispatch.loadBooks({
    page: event.pageIndex,
    size: event.pageSize,
  });
}
```

更新模板 `features/books/components/book-list/book-list.html`：

```html
<div class="table-wrapper">
  <table mat-table [dataSource]="books()" class="mat-elevation-z8 app-table">
    <!-- ... 数据列定义 ... -->
  </table>
</div>

<div class="paginator-shell">
  @defer (on viewport) {
    <!-- 延迟加载的核心分页器 -->
    <mat-paginator
      [length]="store.totalElements()"
      [pageSize]="store.pageSize()"
      [pageIndex]="store.currentPage()"
      [pageSizeOptions]="[5, 10, 25]"
      (page)="onPageChange($event)" />
  } @placeholder {
    <!-- 骨架占位槽，提前锁定布局高度，杜绝累积布局偏移 (CLS) -->
    <div class="paginator-placeholder"></div>
  } @loading (minimum 300ms) {
    <!-- 防闪烁加载指示器 -->
    <mat-spinner diameter="24" />
  } @error {
    <!-- 网络中断容灾降级 UI -->
    <div class="paginator-placeholder paginator-error">
      Unable to load paginator
    </div>
  }
</div>
```

关键工程细节考量：
- **`@placeholder` 防抖机制**：预留与分页器同高的占位容器，避免 Chunk 加载完成后 DOM 膨胀引起下方布局剧烈位移（消灭 CLS 问题）。
- **`@loading (minimum 300ms)`**：在网络极快时，如果加载状态持续仅几毫秒，视觉上会表现为闪烁刺眼的小菊花。设定最小显示时间阈值，确保体验平稳。
- **`@error` 优雅降级**：当下游 CDN 偶发故障或弱网丢包时，局部错误绝不会导致整个书籍页面崩溃瘫痪。

---

## 七、SSR 验证与多维测试实践

完成上述工程改造后，我们通过控制台与测试套件全方位验收 SSR 效果。

### 1. 终端与无 JS 模式验收

启动开发服务器（开发环境下 `npm run start` 内部拉起带有 SSR 拦截的 Node 开发服务）：

```bash
npm run start
```

在另一控制台窗口中，直接使用 `curl` 抓取未经浏览器 JavaScript 引擎执行的裸 HTML 响应：

```bash
curl -s http://localhost:4200/books | grep -c "Clean Code"
```

输出计数大于 0，且终端返回的 HTML 文本中清晰嵌套着包含书名、价格与作者的完整 `<table>` 与 `<tr>` 标签，证明服务端数据拉取与 DOM 拼接完全在 Node 进程中完成。

在浏览器开发者工具的 **Debugger** 面板中勾选 **Disable JavaScript**，刷新页面：

![禁用 JavaScript 状态下的书籍页面依然完整渲染](/media/posts/spring-boot-angular/img-09126.png)

即使完全剥离客户端 JavaScript 运行环境，数据列表依然完整可见！搜索框虽然由于无 JS 而尚未激活事件响应，但内容已尽入眼底；底部的分页器因 `@defer` 机制在无 JS 时呈现占位骨架，这完全符合渐进式增强设计。

### 2. Vitest 平台隔离测试设计

在单元测试层面，我们需要确保平台守卫与服务端渲染逻辑具备 100% 的确定性。

#### 测试 TokenService 在 Server 环境下的静默降级

```typescript
describe('TokenService (Server Platform)', () => {
  let service: TokenService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TokenService,
        // 关键：强制覆写 PLATFORM_ID 为 'server'
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    });
    service = TestBed.inject(TokenService);
  });

  it('在服务端环境下读取 Token 必须安全返回 null，不抛出异常', () => {
    expect(service.getAccessToken()).toBeNull();
    expect(service.getRefreshToken()).toBeNull();
    expect(service.getUser()).toBeNull();
  });

  it('在服务端环境下写操作必须安全终止，不触碰 localStorage', () => {
    expect(() => {
      service.saveTokens('mock-token', 'mock-refresh');
      service.clearAll();
    }).not.toThrow();
  });
});
```

#### 测试书籍列表组件在 Server 平台下的无错渲染

```typescript
describe('BookList Component (SSR Mode)', () => {
  it('在 server 平台且未登录状态下能够正常渲染表格且不显示管理操作按钮', async () => {
    await TestBed.configureTestingModule({
      imports: [BookList],
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        {
          provide: AuthStore,
          useValue: { isAuthenticated: signal(false) },
        },
        {
          provide: BookStore,
          useValue: {
            books: signal([{ id: 1, title: 'Clean Architecture', author: 'Robert Martin' }]),
            totalElements: signal(1),
            pageSize: signal(10),
            currentPage: signal(0),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BookList);
    // 在 Zoneless 架构下等待组件稳定渲染
    await fixture.whenStable();

    const actionButtons = fixture.debugElement.query(By.css('.header-actions'));
    expect(actionButtons).toBeNull();

    const tableRows = fixture.debugElement.queryAll(By.css('tr[mat-row]'));
    expect(tableRows.length).toBe(1);
  });
});
```

运行全局测试套件：

```bash
npm run test:run
```

所有测试绿灯通过，标志着我们的 SSR 架构正式闭环。

---

## 八、总结与下一步

在本文中，我们系统性重塑了前端渲染架构，彻底清除了早期的全站 CSR 妥协：

1. **混合渲染矩阵**：明确划分了 Server（高动态目录）、Prerender（静态法律协议）与 Client（私密与鉴权操作）的职责分工，兼顾 SEO 与交互安全。
2. **架构安全隔离**：深入剖析了 `AngularNodeAppEngine`，并借助 `isPlatformBrowser` 与 `PLATFORM_ID` 构建了可靠的平台守卫，避免了服务端执行环境下的 API 崩溃。
3. **现代水合优化**：借助 Angular 内置的现代 DOM 水合机制与 `@defer (on viewport)` 语法糖，将重型分页组件延迟至视口交互时按需加载，大幅压缩初始 Bundle 尺寸并消除了布局偏移。

至此，我们的前端应用已经具备极高的首屏交付性能与搜索引擎亲和力。然而，当前前端与后端微服务之间的数据同步依然局限于单向的主动拉取。若其他管理员在后台录入了新书，客户端页面毫不知情。在下一篇中，我们将引入 **Server-Sent Events（SSE）** 实时通信机制，在 Angular 客户端结合 RxJS 打造自动感知、实时刷新与优雅去重的实时响应式系统。
