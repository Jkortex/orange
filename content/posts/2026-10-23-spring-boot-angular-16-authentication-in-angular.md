---
title: Spring Boot & Angular 全栈实战（十六）：Angular 客户端鉴权、拦截器与路由守卫
date: 2026-10-23T00:16:00Z
description: 前端完整对接后端认证微服务，实现基于 HTTP Interceptor 的 JWT 自动装配、无感 Token 刷新、路由守卫与受保护的个人中心页面。
category: fullstack
column: spring-boot-angular
tags:
  - Angular
  - JWT
  - 拦截器
  - 路由守卫
  - 前端安全
---

> 💡 **专栏导读**：本文收录于专栏 [《Spring Boot 4 & Angular 22 全栈微服务实战》](/columns/spring-boot-angular)。全专栏共 22 篇，深度覆盖 Java 26 微服务拆分、Spring Cloud 网关与安全鉴权、Angular 22 Signals 状态治理以及端到端容器化交付的全链路工程实践。

---

在前一章中，我们借助 NgRx Events Plugin 为 Angular 应用搭建起了一套架构严密的响应式认证状态管理系统（`AuthStore`）。当时为了聚焦于事件模型、状态机跃迁与 UI 表单的绑定，我们使用了基于内存与模拟延迟的 Mock 数据源。

在真实的生产架构中，客户端必须与后端的 API 网关及认证微服务（Keycloak/Spring Security）进行真实通信。得益于在设计之初坚持面向接口而非面向实现的原则，当我们将前端从 Mock 迁移到真实 HTTP 调用时，**`AuthStore` 对外的公共方法签名与核心事件契约完全不需要改动**。

本文我们将全面攻克前端鉴权链路的核心工程挑战：
1. **多环境 API 配置与 SSR 渲染策略调优**；
2. **基于现代 Fetch API 的 `HttpClient` 注册**；
3. **基于函数式 `HttpInterceptorFn` 的 JWT 自动装配与高并发无感 Token 刷新（Silent Token Refresh）**；
4. **利用 NgRx SignalStore `withHooks` 实现基于 `localStorage` 的登录态自动唤醒与还原**；
5. **基于 Signals 的函数式路由守卫（`authGuard` / `guestGuard`）**；
6. **受保护的个人中心（Profile）完整功能开发**；
7. **针对 HTTP 拦截器与路由守卫的高密度单元测试矩阵**。

---

## 一、应用级网络与渲染架构准备

在发起真实 HTTP 请求前，我们需要先调整 Angular 应用的底层运行环境，包括渲染模式、环境常量注入以及 HTTP 客户端提供者。

### 1.1 客户端渲染策略调整（SSR 兼容性隔离）

服务端渲染（SSR）在预渲染阶段运行于 Node.js 环境，该环境中不存在浏览器专属的全局 API（如 `window`、`document`、`localStorage`）。我们的身份令牌持久化机制依赖于 `localStorage`，若在预渲染执行路径中直接调用，会导致构建或服务端报错。

为了优先打通端到端业务流，我们暂时在 `src/app/app.routes.server.ts` 中将全局路由模式切换为纯客户端渲染（CSR），后续章节我们会深入配置细粒度的按路由 SSR/SSG 策略：

```typescript
import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
```

通过这一设置，Angular 将绕过服务端预渲染，确保依赖浏览器 API 的安全存储模块能够安全初始化。

### 1.2 区分环境的 API 端点配置

在开发与生产环境中，前端访问 API 网关的基准 URL 通常不同：本地开发直连 `http://localhost:8080`，而生产环境通常部署在网关之后走同源相对路径。

创建开发环境配置 `src/environments/environment.ts`：

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/packt',
};
```

创建生产环境配置 `src/environments/environment.prod.ts`：

```typescript
export const environment = {
  production: true,
  apiUrl: '/packt',
};
```

在 `angular.json` 的生产构建（`configurations.production`）中配置静态文件替换：

```json
"fileReplacements": [
  {
    "replace": "src/environments/environment.ts",
    "with": "src/environments/environment.prod.ts"
  }
]
```

后续所有服务仅需统一引用 `environment.apiUrl`，便能在编译期自动按目标环境解析。

### 1.3 注册现代 HttpClient：启用 Fetch 与拦截器

Angular 推荐在独立应用架构（Standalone Bootstrap）中使用 `provideHttpClient`，并配合 `withFetch()` 替代过时的 `XMLHttpRequest`，不仅执行效率更高，还能原生适配流式处理。

在 `src/app/app.config.ts` 中完成网络基础提供者的注入：

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    // 启用原生 Fetch API，并预留拦截器接入槽位
    provideHttpClient(withFetch(), withInterceptors([])),
  ],
};
```

---

## 二、鉴权数据模型与持久化基础

### 2.1 对齐后端响应契约

根据后端微服务的接口定义，用户登录成功后返回的载荷中包含 Keycloak 派发的唯一标识 `keycloakId`，而令牌刷新端点（`POST /users/refresh-token`）仅返回双 Token（Access & Refresh），不携带冗余的 User 详情。

更新通用模型 `src/app/shared/models/auth.ts`：

```typescript
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserInfo | null;
}

export interface UserInfo {
  id: string;
  keycloakId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}
```

### 2.2 封装 TokenService：规避硬编码与集中治理

为了避免将 `localStorage` 的键名硬编码散落于各业务组件中，同时方便测试时全面 Mock 浏览器存储 API，我们封装专用的 `TokenService`。

创建 `src/app/core/services/token.service.ts`：

```typescript
import { Injectable } from '@angular/core';
import { UserInfo } from '../../shared/models/auth';

const ACCESS_TOKEN_KEY = 'bookstore_access_token';
const REFRESH_TOKEN_KEY = 'bookstore_refresh_token';
const USER_KEY = 'bookstore_user';

@Injectable({ providedIn: 'root' })
export class TokenService {
  saveTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  saveUser(user: UserInfo): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  getUser(): UserInfo | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserInfo;
    } catch {
      return null;
    }
  }

  clearAll(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}
```

> **安全与存储权衡**：  
> 我们选用 `localStorage` 而非 `sessionStorage`，是为了保证用户在关闭标签页或重新打开浏览器时依然保留登录会话。需要注意，浏览器客户端存储无法免疫 XSS 攻击，因此必须坚守后端信任边界：客户端绝不能私自伪造用户身份，仅作为凭据持有者。

---

## 三、核心机制：HTTP 拦截器与透明 Token 刷新

在微服务架构中，**信任边界由 API 网关牢牢把守**。客户端只需将 JWT Access Token 放入 `Authorization: Bearer <token>` 报头中。网关验证其真实性后，会主动解析 Claims 并向下游微服务注入安全上下文请求头（如 `X-User-Id`）。客户端无需、也不应自行伪造任何身份头。

因此，我们的 HTTP 拦截器聚焦两大职责：
1. **统一装配 Bearer Token**；
2. **捕获 401 Unauthorized 状态码，执行无感知令牌续期并安全重试**。

### 3.1 拦截器核心实现与并发锁保护

在单页面应用中，若 Access Token 过期，页面上同时触发的多个 HTTP 请求可能在同一瞬间接收到 `401` 响应。如果每个 `401` 都独立触发刷新请求，将引发灾难性的并发刷新竞争（Race Condition）——某些严格的 OAuth2 / Keycloak 策略一旦检测到同一个 Refresh Token 被重复使用，会直接注销该会话。

我们引入 `isRefreshing` 互斥标志与 RxJS 的 `BehaviorSubject` 构成等待队列：
- 第一个捕获 401 的请求负责发起后端刷新；
- 后续并发的 401 挂起并等待 `refreshedToken$` 广播最新 Token，随后统一无感重试。

创建 `src/app/core/interceptors/auth.interceptor.ts`：

```typescript
import { HttpInterceptorFn, HttpErrorResponse, HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { Dispatcher } from '@ngrx/signals/events';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse } from '../../shared/models/auth';
import { authApiEvents } from '../../features/auth/store/auth.events';
import { TokenService } from '../services/token.service';

let isRefreshing = false;
const refreshedToken$ = new BehaviorSubject<string | null>(null);

function buildAuthHeaders(tokenService: TokenService): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = tokenService.getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenService = inject(TokenService);
  const http = inject(HttpClient);
  const dispatcher = inject(Dispatcher);

  // 白名单：登录、注册、刷新自身不可挂载旧 Token
  const skipAuthHeaders =
    req.url.includes('/users/signin') ||
    req.url.includes('/users/signup') ||
    req.url.includes('/users/refresh-token');

  // 登出或上述白名单发生 401 时不触发二次刷新
  const skipRefreshOn401 = skipAuthHeaders || req.url.includes('/users/logout');

  if (skipAuthHeaders) {
    return next(req);
  }

  const headers = buildAuthHeaders(tokenService);
  const authReq = Object.keys(headers).length > 0 ? req.clone({ setHeaders: headers }) : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !skipRefreshOn401) {
        const retryWith = (token: string) =>
          next(
            req.clone({
              setHeaders: { Authorization: `Bearer ${token}` },
            })
          );

        // 如果已有正在执行的刷新请求，挂起当前请求等待广播
        if (isRefreshing) {
          return refreshedToken$.pipe(
            filter((token): token is string => token !== null),
            take(1),
            switchMap(retryWith)
          );
        }

        const refreshToken = tokenService.getRefreshToken();
        if (!refreshToken) {
          dispatcher.dispatch(
            authApiEvents.tokenRefreshFailure({
              error: 'No refresh token available',
            })
          );
          return throwError(() => error);
        }

        isRefreshing = true;
        refreshedToken$.next(null);

        // 注意：此处直接注入底层 HttpClient 发起调用，避免重入本拦截器导致循环死锁
        return http
          .post<AuthResponse>(`${environment.apiUrl}/user/api/users/refresh-token`, {
            refreshToken,
          })
          .pipe(
            switchMap((response) => {
              isRefreshing = false;
              // 广播成功事件，驱动 Store 更新
              dispatcher.dispatch(
                authApiEvents.tokenRefreshSuccess({
                  accessToken: response.accessToken,
                  refreshToken: response.refreshToken,
                })
              );
              refreshedToken$.next(response.accessToken);
              return retryWith(response.accessToken);
            }),
            catchError((refreshError) => {
              isRefreshing = false;
              dispatcher.dispatch(
                authApiEvents.tokenRefreshFailure({
                  error: 'Token refresh failed',
                })
              );
              return throwError(() => refreshError);
            })
          );
      }
      return throwError(() => error);
    })
  );
};
```

### 3.2 注册拦截器

在 `src/app/app.config.ts` 中注册该拦截器：

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
  ],
};
```

---

## 四、重构 AuthService：接入真实 HTTP 通信

在有了 HTTP 拦截器的自动鉴权头加持后，`AuthService` 的逻辑变得异常精简纯粹：每个方法仅执行纯粹的 `HttpClient` 调用，完全解耦请求头管理。

更新 `src/app/features/auth/services/auth.service.ts`：

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthResponse, UserInfo, UserProfile } from '../../../shared/models/auth';

export interface SigninRequest {
  email: string;
  password?: string;
}

export interface SignupRequest {
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/user/api/users`;

  signin(credentials: SigninRequest): Observable<{
    user: UserInfo;
    accessToken: string;
    refreshToken: string;
  }> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/signin`, credentials).pipe(
      map((response) => ({
        user: response.user!,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      }))
    );
  }

  signup(data: SignupRequest): Observable<void> {
    return this.http
      .post<{ success: boolean; message: string }>(`${this.baseUrl}/signup`, data)
      .pipe(map(() => undefined));
  }

  refreshToken(refreshToken: string): Observable<{
    accessToken: string;
    refreshToken: string;
  }> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/refresh-token`, { refreshToken })
      .pipe(
        map((response) => ({
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
        }))
      );
  }

  logout(): Observable<void> {
    return this.http
      .post<{ success: boolean; message: string }>(`${this.baseUrl}/logout`, {})
      .pipe(map(() => undefined));
  }

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.baseUrl}/profile`);
  }

  updateProfile(profile: UserProfile): Observable<UserProfile> {
    return this.http.put<UserProfile>(`${this.baseUrl}/profile`, profile);
  }
}
```

---

## 五、扩展 AuthStore 状态流转与事件编排

### 5.1 扩展认证事件组

更新 `src/app/features/auth/store/auth.events.ts`，加入登出与 Token 刷新相关的领域事件：

```typescript
import { type } from '@ngrx/signals';
import { eventGroup } from '@ngrx/signals/events';
import { UserInfo } from '../../../shared/models/auth';
import { SigninRequest, SignupRequest } from '../services/auth.service';

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
    logoutSuccess: type<void>(),
    logoutFailure: type<{ error: string }>(),
    tokenRefreshSuccess: type<{
      accessToken: string;
      refreshToken: string;
    }>(),
    tokenRefreshFailure: type<{ error: string }>(),
  },
});
```

### 5.2 状态跃迁 Reducer

在 `src/app/features/auth/store/auth.store.ts` 的 `withReducer` 块中，增补对于注销与刷新事件的纯函数状态转移：

```typescript
// 登出成功：全量重置为初始状态
on(authApiEvents.logoutSuccess, () => ({
  ...initialAuthState,
})),

on(authApiEvents.logoutFailure, (event) => ({
  loading: false,
  error: event.payload.error,
})),

// 刷新成功：只更新 Token，保留已有用户信息
on(authApiEvents.tokenRefreshSuccess, (event) => ({
  accessToken: event.payload.accessToken,
  refreshToken: event.payload.refreshToken,
})),

// 刷新失败：会话彻底失效，回退至初始态
on(authApiEvents.tokenRefreshFailure, () => ({
  ...initialAuthState,
})),
```

### 5.3 异步事件处理器：安全服务端注销与容灾

在真实生产环境下，单纯在前端清空 Token 会留下安全漏洞（Refresh Token 在 Keycloak 侧依然有效）。客户端必须请求服务端的注销接口使该 Token 失效。

在 `withEventHandlers` 中配置：

```typescript
withEventHandlers(
  (
    store,
    events = inject(Events),
    authService = inject(AuthService),
    tokenService = inject(TokenService)
  ) => ({
    // .. 既有 signin$, signup$

    logout$: events.on(authPageEvents.logoutClicked).pipe(
      exhaustMap(() =>
        tokenService.getAccessToken()
          ? authService.logout().pipe(
              map(() => authApiEvents.logoutSuccess()),
              catchError((error: unknown) =>
                of(
                  authApiEvents.logoutFailure({
                    error: normalizeApiErrorMessage(error, 'Unable to sign out right now.'),
                  })
                )
              )
            )
          : of(authApiEvents.logoutSuccess())
      )
    ),

    // 当拦截器派发 tokenRefreshFailure 时，联动触发注销流程
    refreshToken$: events
      .on(authApiEvents.tokenRefreshFailure)
      .pipe(map(() => authPageEvents.logoutClicked())),
  })
),
```

### 5.4 状态持久化订阅与 side-effect 分离

利用 `withMethods` 将本地存储（`TokenService`）和页面导航（`Router`）等副作用与 Store 统一装配：

```typescript
withMethods(
  (
    store,
    events = inject(Events),
    router = inject(Router),
    tokenService = inject(TokenService)
  ) => {
    // 登录成功时写入 localStorage
    events
      .on(authApiEvents.signinSuccess)
      .pipe(takeUntilDestroyed())
      .subscribe((event) => {
        tokenService.saveTokens(event.payload.accessToken, event.payload.refreshToken);
        if (event.payload.user) {
          tokenService.saveUser(event.payload.user);
        }
      });

    // 刷新成功时同步更新 localStorage
    events
      .on(authApiEvents.tokenRefreshSuccess)
      .pipe(takeUntilDestroyed())
      .subscribe((event) => {
        tokenService.saveTokens(event.payload.accessToken, event.payload.refreshToken);
      });

    events
      .on(authApiEvents.signinSuccess)
      .pipe(takeUntilDestroyed())
      .subscribe(() => router.navigate(['/books']));

    events
      .on(authApiEvents.signupSuccess)
      .pipe(takeUntilDestroyed())
      .subscribe(() => router.navigate(['/auth/signin']));

    // 登出成功时立即清理持久化数据，再跳转登录页
    events
      .on(authApiEvents.logoutSuccess)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        tokenService.clearAll();
        router.navigate(['/auth/signin']);
      });

    return {
      clearError: () => patchState(store, { error: null }),
    };
  }
),
```

### 5.5 页面刷新会话自愈：withHooks 机制

为了防止用户 F5 刷新页面导致内存状态清空而被误踢出系统，使用 NgRx SignalStore 的 `withHooks` 生命周期钩子，在 Store 首次注入（`onInit`）时从 `TokenService` 恢复会话：

```typescript
withHooks({
  onInit(store) {
    const tokenService = inject(TokenService);
    const accessToken = tokenService.getAccessToken();
    const refreshToken = tokenService.getRefreshToken();
    const user = tokenService.getUser();
    if (accessToken && refreshToken && user) {
      patchState(store, { accessToken, refreshToken, user });
    }
  },
}),
```

---

## 六、函数式路由守卫（Functional Route Guards）

Angular 摒弃了过时的 Class 形式守卫，推荐使用轻量灵活的函数式 `CanActivateFn`。

创建 `src/app/core/guards/auth.guard.ts`：

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../../features/auth/store/auth.store';

/**
 * 保护私有业务路由：未登录则重定向至登录页
 */
export const authGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  const router = inject(Router);
  if (store.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/auth/signin']);
};

/**
 * 保护公开访客路由：已登录用户不可重复进入登录/注册页
 */
export const guestGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  const router = inject(Router);
  if (!store.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/books']);
};
```

> 💡 **架构建议**：使用 `router.createUrlTree()` 取代命令式的 `router.navigate()`，能让 Angular 路由调度器在同一导航事务周期中直接完成重定向，杜绝竞态与双重重绘。

在 `src/app/app.routes.ts` 中配置路由守卫与懒加载：

```typescript
import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'books', pathMatch: 'full' },
  {
    path: 'books',
    canActivate: [authGuard],
    loadChildren: () => import('./features/books/books.routes').then((m) => m.routes),
  },
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.routes),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/pages/profile/profile').then((m) => m.Profile),
  },
];
```

---

## 七、构建受保护的个人中心页面（Profile）

我们采用「智能页面组件（Smart Component）+ 纯受控表单组件（Dumb Component）」的标准分层来构建个人资料功能。

### 7.1 表单展示组件：ProfileForm

`ProfileForm` 通过 Signal-based `input()` 接收原始数据，使用 `output()` 抛出提交事件，并通过 `effect()` 在外部数据变更时自适应更新表单：

```typescript
import { Component, FormBuilder, inject, input, output, effect } from '@angular/core';
import { ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { UserProfile } from '../../../../shared/models/auth';

@Component({
  selector: 'app-profile-form',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './profile-form.html',
  styleUrl: './profile-form.scss',
})
export class ProfileForm {
  private fb = inject(FormBuilder);
  profileData = input<UserProfile | null>(null);
  loading = input<boolean>(false);
  profileSubmit = output<UserProfile>();

  profileForm = this.fb.nonNullable.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    phone: [''],
    address: [''],
    city: [''],
    state: [''],
    zipCode: [''],
    country: [''],
  });

  readonly isFormValid = toSignal(
    this.profileForm.statusChanges.pipe(map((status) => status === 'VALID')),
    { initialValue: this.profileForm.valid }
  );

  constructor() {
    effect(() => {
      const data = this.profileData();
      if (data) {
        this.profileForm.patchValue({
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone ?? '',
          address: data.address ?? '',
          city: data.city ?? '',
          state: data.state ?? '',
          zipCode: data.zipCode ?? '',
          country: data.country ?? '',
        });
      }
    });
  }

  getErrorMessage(controlName: string): string {
    const control = this.profileForm.get(controlName);
    if (!control || !control.errors || !control.touched) return '';
    if (control.hasError('required')) return `${this.formatFieldName(controlName)} is required.`;
    return 'Invalid value.';
  }

  onSubmit() {
    if (this.profileForm.valid) {
      const form = this.profileForm.getRawValue();
      const profileData: UserProfile = {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        zipCode: form.zipCode || undefined,
        country: form.country || undefined,
      };
      this.profileSubmit.emit(profileData);
    }
  }

  private formatFieldName(name: string): string {
    return name.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim();
  }
}
```

### 7.2 智能容器组件：Profile

个人中心页面组件直接与 `AuthService` 通信，负责数据拉取、全局 SnackBar 提示与加载状态控制：

```typescript
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../auth/services/auth.service';
import { AuthStore } from '../../auth/store/auth.store';
import { UserProfile } from '../../../../shared/models/auth';
import { normalizeApiErrorMessage } from '../../../../shared/utils/error-message';
import { ProfileForm } from '../../components/profile-form/profile-form';

@Component({
  selector: 'app-profile',
  imports: [ProfileForm, MatProgressSpinnerModule, MatSnackBarModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile implements OnInit {
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  protected readonly store = inject(AuthStore);

  profileData = signal<UserProfile | null>(null);
  loading = signal(false);
  pageLoading = signal(true);
  error = signal<string | null>(null);

  ngOnInit() {
    this.loadProfile();
  }

  private loadProfile() {
    this.pageLoading.set(true);
    this.authService.getProfile().subscribe({
      next: (profile: UserProfile) => {
        this.profileData.set(profile);
        this.pageLoading.set(false);
      },
      error: (err: unknown) => {
        const message = normalizeApiErrorMessage(err, 'Failed to load profile');
        this.error.set(message);
        this.pageLoading.set(false);
      },
    });
  }

  handleProfileSubmit(profile: UserProfile) {
    this.loading.set(true);
    this.authService.updateProfile(profile).subscribe({
      next: (updated: UserProfile) => {
        this.profileData.set(updated);
        this.loading.set(false);
        this.snackBar.open('Profile updated successfully', 'Close', { duration: 3000 });
      },
      error: (err: unknown) => {
        const message = normalizeApiErrorMessage(err, 'Failed to update profile');
        this.loading.set(false);
        this.snackBar.open(message, 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar'],
        });
      },
    });
  }
}
```

在 `src/app/shared/layout/header/header.html` 中，当用户登录后，提供快捷的个人中心跳转图标：

```html
<button mat-icon-button routerLink="/profile" aria-label="View your profile">
  <mat-icon>person</mat-icon>
</button>
```

页面运行效果如图所示：

![个人资料页面与更新提示](/media/posts/spring-boot-angular/img-09109.png)

---

## 八、鉴权层自动化测试矩阵

网络基础设施与安全逻辑是系统的生命线，我们通过 `provideHttpClientTesting` 构建零网络副作用的测试沙箱。

### 8.1 AuthService 单元测试

核心测试逻辑涵盖三阶段：调用服务、断言拦截到的 HTTP 请求体与报头、调用 `req.flush()` 模拟后端返回：

```typescript
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should POST credentials and return mapped response', () => {
    const credentials = { email: 'test@bookstore.com', password: 'password123' };
    const mockResponse = {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      tokenType: 'Bearer',
      expiresIn: 300,
      user: {
        id: '123',
        keycloakId: 'kc-123',
        email: 'test@bookstore.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
      },
    };

    service.signin(credentials).subscribe((result) => {
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.user.email).toBe('test@bookstore.com');
      expect((result as any).tokenType).toBeUndefined();
    });

    const req = httpMock.expectOne((r) => r.url.includes('/users/signin'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(credentials);
    req.flush(mockResponse);
  });
});
```

### 8.2 TokenService 测试沙箱

针对 `localStorage` 进行 `vi.spyOn(Storage.prototype, 'setItem')` Spy 劫持，避免污染宿主环境，并针对异常 JSON 验证优雅降级：

![TokenService 单元测试执行结果](/media/posts/spring-boot-angular/img-09111.png)

### 8.3 路由守卫测试（TestBed.runInInjectionContext）

由于函数式守卫内部依赖 `inject()`，测试执行时必须置于依赖注入上下文中：

```typescript
it('authGuard should allow navigation if user is authenticated', () => {
  TestBed.runInInjectionContext(() => {
    const result = authGuard({} as any, {} as any);
    expect(result).toBe(true);
  });
});
```

---

## 九、总结与后续演进

在本章中，我们完成了 Angular 客户端与 Spring Boot / Spring Security 鉴权后端的全链路连通：
- **无侵入重构**：保持 `AuthStore` 契约不变，将底层服务无缝切换为真实 `HttpClient`；
- **工业级拦截器**：实现了 JWT 请求头自动注入、401 拦截、带锁并发无感刷新以及重放重试；
- **状态持久化与自愈**：利用 SignalStore `withHooks` 结合 `TokenService` 实现了优雅的断点续签与会话保留；
- **安全边界防护**：通过函数式路由守卫（`authGuard` 与 `guestGuard`）构建了完善的页面权限防火墙。

在下一篇中，我们将进入业务领域的核心：**基于 Signals 状态管理驱动的图书与作者完整 CRUD 闭环**。我们将实战服务端分页响应适配、防抖搜索、模态框嵌套交互以及级联下拉关联设计。
