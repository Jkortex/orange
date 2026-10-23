---
title: Spring Boot & Angular 全栈实战（十四）：实战复杂响应式表单与跨字段校验
date: 2026-10-23T00:14:00Z
description: 结合 Angular Material 实战注册、登录、作者与图书四大表单，落地密码一致性跨字段校验、动态错误提示与 AI 辅助生成表单流。
category: fullstack
column: spring-boot-angular
tags:
  - Angular Material
  - 响应式表单
  - 跨字段校验
  - 实战开发
---

> 💡 **专栏导读**：本文收录于专栏 [《Spring Boot 4 & Angular 22 全栈微服务实战》](/columns/spring-boot-angular)。全专栏共 22 篇，深度覆盖 Java 26 微服务拆分、Spring Cloud 网关与安全鉴权、Angular 22 Signals 状态治理以及端到端容器化交付的全链路工程实践。

---

## 1. 架构总览：从表单机制到业务交互落地

在上一章中，我们建立了 Angular 响应式表单（Reactive Forms）的理论体系，系统剖析了 `FormControl`、`FormGroup`、内置校验器、`NonNullableFormBuilder` 以及统一错误展示模式。

在企业级全栈开发中，表单绝不仅仅是 HTML 输入框的排列，而是用户输入与后端微服务数据契约的**首道防御与映射中枢**。本章我们将理论全面落地到书店系统的具体交互中，构建支撑核心业务流的四大响应式表单：

1. **用户认证流（页面级宿主）**：
   - **用户注册表单（Signup Form）**：包含最复杂的校验逻辑，覆盖多字段正则表达式、跨字段密码一致性校验、非必填地址展平以及基于 Signal 的表单全局有效性监听。
   - **用户登录表单（Signin Form）**：注册模式的高效精简复用，建立轻量、无废话的凭据提交与状态反馈链路。
2. **资源管理流（Dialog 模态宿主）**：
   - **作者表单（Author Form）**：引入基于 Angular Material `MatDialog` 的模态交互模式，支持由注入数据驱动的“新增/编辑”双模式自治。
   - **图书表单（Book Form）**：9 字段复杂数据模型，包含日期选择器（Datepicker）、多种 pattern 校验字典映射、数字范围约束与富数据格式转换。

本文不仅提供四大表单的完整落地代码，还将演示前后端 DTO 契约的类型对齐规范、Smart/Dumb 容器拆分模式以及基于 Vitest 的高覆盖率单元测试矩阵。

---

## 2. 契约先行：前后端 DTO 与 TypeScript 接口对齐

在全栈工程中，前端表单的最终目的是产出符合后端接口期望的载荷（Payload）。为了杜绝类型不一致引发的隐蔽 Bug，我们首先建立严格镜像后端 Java DTO 的 TypeScript 接口。

### 2.1 契约映射核心准则

- **必填与可选对齐**：后端使用了 `@NotBlank`、`@NotNull` 的属性，在 TypeScript 中定义为必选字段；后端未标注强制校验的可空字段，统一使用可选操作符 `?`。
- **类型系统映射**：
  - Java `String` $\rightarrow$ TypeScript `string`
  - Java `BigDecimal` / `Integer` / `Long` $\rightarrow$ TypeScript `number`
  - Java `LocalDate` $\rightarrow$ TypeScript `string`（以 ISO 8601 标准日期字符串传输，如 `YYYY-MM-DD`）
- **校验对齐**：后端基于 `@Pattern`、`@PositiveOrZero` 的约束，前端应配置等价的正则校验与 `Validators.min()`，实现前端即时拦截、后端兜底的双层防护。

### 2.2 领域实体模型（Author 与 Book）

在 `src/app/shared/models/author.ts` 中定义作者模型：

```typescript
export interface Author {
  id?: number;
  name: string;
  nationality: string;
  books?: string[];
}
```

在 `src/app/shared/models/book.ts` 中完善图书模型，支持编辑场景下的可选主键：

```typescript
export interface Book {
  id?: number;
  title: string;
  authorName: string; // 当前阶段在 UI 上使用文本展示，后续对接微服务 API 时无缝过渡为 authorId
  genre: string;
  price: number;
  published: string;
  isbn: string;
  description?: string;
  pageCount?: number;
  coverImageUrl?: string;
}
```

### 2.3 认证 DTO（SignupRequest 与 SigninRequest）

在 `src/app/shared/models/auth.ts` 中定义与用户微服务契约一致的认证模型：

```typescript
export interface SignupRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export interface SigninRequest {
  email: string;
  password: string;
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

---

## 3. 表单脚手架与模块拓扑

利用 Angular CLI 快速搭建清晰的功能特性目录：

```bash
ng generate component features/auth/components/signin-form
ng generate component features/auth/components/signup-form
ng generate component features/books/components/author-form
ng generate component features/books/components/book-form
```

此时的工程代码结构如下：

![表单工程脚手架目录结构](/media/posts/spring-boot-angular/img-09089.png)

所有表单遵循 Presentation Component（Dumb）与 Container/Page Component（Smart）分离的职责划分。接下来我们从最复杂的注册表单切入。

---

## 4. 实战注册表单：跨字段校验与 Material 深度集成

注册表单不仅字段较多，而且包含密码强度正则、纯字母姓名限制，以及最经典的**密码与确认密码一致性（Cross-Field Validation）**校验。

### 4.1 编写可复用的自定义校验器

在 `src/app/shared/validators/custom-validators.ts` 中实现通用的校验规则：

```typescript
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * 限制文本不能包含任何数字
 */
export function noNumbersValidator(): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    if (!control.value) return null;
    const hasNumbers = /\d/.test(control.value);
    return hasNumbers ? { noNumbers: { value: control.value } } : null;
  };
}

/**
 * 组级跨字段校验：检查 password 与 confirmPassword 是否完全一致
 */
export function passwordMatchValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    if (!password || !confirmPassword) return null;
    return password === confirmPassword
      ? null
      : { passwordMismatch: true };
  };
}
```

> **设计要点**：
> - 单字段校验器挂载在 `FormControl` 上，参数为 `control`；
> - 跨字段校验器必须挂载在包含这两个字段的 `FormGroup` 上，参数为 `group`，通过 `group.get()` 提取兄弟字段的值并进行逻辑比对。

### 4.2 注册组件类实现（SignupForm）

在 `src/app/features/auth/components/signup-form/signup-form.ts` 中实现：

```typescript
import { Component, inject, output } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { RouterLink } from '@angular/router';

// Angular Material 模块导入
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';

import { SignupRequest } from '../../../../shared/models/auth';
import { noNumbersValidator, passwordMatchValidator } from '../../../../shared/validators/custom-validators';

@Component({
  selector: 'app-signup-form',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    RouterLink,
  ],
  templateUrl: './signup-form.html',
  styleUrl: './signup-form.scss',
})
export class SignupForm {
  private fb = inject(FormBuilder);

  // 向父组件发出的提交完成事件
  signupComplete = output<SignupRequest>();

  // 密码可见性切换状态
  hidePassword = true;
  hideConfirmPassword = true;

  // 使用 NonNullableFormBuilder 声明强类型、不退化为 null 的表单树
  signupForm = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, noNumbersValidator()]],
    lastName: ['', [Validators.required, noNumbersValidator()]],
    email: ['', [Validators.required, Validators.email]],
    passwords: this.fb.nonNullable.group(
      {
        password: [
          '',
          [
            Validators.required,
            Validators.minLength(8),
            Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
          ],
        ],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: [passwordMatchValidator()] }
    ),
    phone: [''],
    address: [''],
    city: [''],
    state: [''],
    zipCode: [''],
    country: [''],
    agreeToTerms: [false, [Validators.requiredTrue]],
  });

  // 基于 Angular Signals 的表单状态派生：桥接 statusChanges
  readonly isFormValid = toSignal(
    this.signupForm.statusChanges.pipe(
      map(status => status === 'VALID')
    ),
    { initialValue: this.signupForm.valid }
  );

  get passwordsGroup(): FormGroup {
    return this.signupForm.get('passwords') as FormGroup;
  }

  /**
   * 集中格式化控件错误提示
   */
  getErrorMessage(controlName: string, groupName?: string): string {
    const control = groupName
      ? this.signupForm.get(groupName)?.get(controlName)
      : this.signupForm.get(controlName);

    if (!control || !control.errors || !control.touched) return '';

    if (control.hasError('required')) {
      return `${this.formatFieldName(controlName)} is required.`;
    }
    if (control.hasError('email')) {
      return 'Please enter a valid email address.';
    }
    if (control.hasError('minlength')) {
      const err = control.getError('minlength');
      return `Must be at least ${err.requiredLength} characters.`;
    }
    if (control.hasError('noNumbers')) {
      return `${this.formatFieldName(controlName)} must not contain numbers.`;
    }
    if (control.hasError('pattern')) {
      return 'Must include uppercase, lowercase, and a number.';
    }

    return 'Invalid value.';
  }

  /**
   * 获取表单组级错误提示（如密码一致性校验失败）
   */
  getGroupErrorMessage(groupName: string): string {
    const group = this.signupForm.get(groupName);
    if (!group || !group.errors) return '';
    if (group.hasError('passwordMismatch')) {
      return 'Passwords do not match.';
    }
    return '';
  }

  onSubmit() {
    if (this.signupForm.valid) {
      const form = this.signupForm.getRawValue();
      // 数据重构：剔除 UI 专属字段（confirmPassword, agreeToTerms），精准组装 SignupRequest
      const signupData: SignupRequest = {
        email: form.email,
        password: form.passwords.password,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        zipCode: form.zipCode || undefined,
        country: form.country || undefined,
      };
      this.signupComplete.emit(signupData);
    }
  }

  private formatFieldName(name: string): string {
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, s => s.toUpperCase())
      .trim();
  }
}
```

### 4.3 注册表单模板编排

在 `src/app/features/auth/components/signup-form/signup-form.html` 中：

```html
<mat-card class="signup-card">
  <mat-card-header>
    <mat-card-title>Join Packt Bookstore</mat-card-title>
    <mat-card-subtitle>Create your account to start your reading journey</mat-card-subtitle>
  </mat-card-header>

  <mat-card-content>
    <form [formGroup]="signupForm" (ngSubmit)="onSubmit()" class="signup-form">
      <!-- 姓名区域 -->
      <div class="name-row">
        <mat-form-field appearance="outline" class="half-width">
          <mat-label>First Name</mat-label>
          <input matInput formControlName="firstName" placeholder="John" autocomplete="given-name">
          @if (signupForm.get('firstName')?.invalid && signupForm.get('firstName')?.touched) {
            <mat-error>{{ getErrorMessage('firstName') }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="half-width">
          <mat-label>Last Name</mat-label>
          <input matInput formControlName="lastName" placeholder="Doe" autocomplete="family-name">
          @if (signupForm.get('lastName')?.invalid && signupForm.get('lastName')?.touched) {
            <mat-error>{{ getErrorMessage('lastName') }}</mat-error>
          }
        </mat-form-field>
      </div>

      <!-- 邮箱 -->
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Email Address</mat-label>
        <input matInput type="email" formControlName="email" placeholder="Enter your email" autocomplete="email">
        <mat-icon matSuffix>email</mat-icon>
        @if (signupForm.get('email')?.invalid && signupForm.get('email')?.touched) {
          <mat-error>{{ getErrorMessage('email') }}</mat-error>
        }
      </mat-form-field>

      <!-- 嵌套密码组 -->
      <div formGroupName="passwords">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Password</mat-label>
          <input matInput [type]="hidePassword ? 'password' : 'text'"
                 formControlName="password"
                 autocomplete="new-password">
          <button mat-icon-button matSuffix type="button"
                  (click)="hidePassword = !hidePassword"
                  [attr.aria-label]="hidePassword ? 'Show password' : 'Hide password'">
            <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
          @if (signupForm.get('passwords.password')?.invalid && signupForm.get('passwords.password')?.touched) {
            <mat-error>{{ getErrorMessage('password', 'passwords') }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Confirm Password</mat-label>
          <input matInput [type]="hideConfirmPassword ? 'password' : 'text'"
                 formControlName="confirmPassword"
                 autocomplete="new-password">
          <button mat-icon-button matSuffix type="button"
                  (click)="hideConfirmPassword = !hideConfirmPassword"
                  [attr.aria-label]="hideConfirmPassword ? 'Show password' : 'Hide password'">
            <mat-icon>{{ hideConfirmPassword ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
          @if (signupForm.get('passwords.confirmPassword')?.invalid && signupForm.get('passwords.confirmPassword')?.touched) {
            <mat-error>{{ getErrorMessage('confirmPassword', 'passwords') }}</mat-error>
          }
        </mat-form-field>

        <!-- 跨字段组级错误展示 -->
        @if (passwordsGroup.hasError('passwordMismatch') && passwordsGroup.get('confirmPassword')?.dirty) {
          <mat-error class="group-error">{{ getGroupErrorMessage('passwords') }}</mat-error>
        }
      </div>

      <!-- 条款勾选与操作按钮 -->
      <mat-checkbox formControlName="agreeToTerms" class="terms-checkbox">
        I agree to the Terms of Service and Privacy Policy
      </mat-checkbox>

      <div class="form-actions">
        <button mat-raised-button color="primary" type="submit"
                [disabled]="!isFormValid()"
                class="full-width signup-button">
          Create Account
        </button>
        <div class="form-links">
          <span>Already have an account? </span>
          <a mat-button routerLink="/auth/signin">Sign in here</a>
        </div>
      </div>
    </form>
  </mat-card-content>
</mat-card>
```

### 4.4 页面级宿主组件与路由集成

创建页面级 Smart 组件 `src/app/features/auth/pages/signup/signup.ts` 承接表单事件并协同导航：

```typescript
import { Component } from '@angular/core';
import { SignupForm } from '../../components/signup-form/signup-form';
import { SignupRequest } from '../../../../shared/models/auth';

@Component({
  selector: 'app-signup',
  imports: [SignupForm],
  templateUrl: './signup.html',
  styleUrl: './signup.scss',
})
export class Signup {
  handleSignupComplete(signupData: SignupRequest) {
    console.log('Signup payload:', signupData);
    // 后续章节直接对接 AuthStore
  }
}
```

配套的 `signup.html`：

```html
<div class="page-container">
  <div class="page-header">
    <h1>Create Your Account</h1>
    <p>Join thousands of readers in the Packt Bookstore community</p>
  </div>
  <app-signup-form (signupComplete)="handleSignupComplete($event)" />
</div>
```

配置认证路由 `src/app/features/auth/auth.routes.ts`：

```typescript
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'signup',
    loadComponent: () => import('./pages/signup/signup').then(m => m.Signup),
  },
];
```

并在 `src/app/app.routes.ts` 中注册：

```typescript
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'books', pathMatch: 'full' },
  {
    path: 'books',
    loadChildren: () => import('./features/books/books.routes').then(m => m.routes),
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.routes),
  },
];
```

启动应用后，访问 `/auth/signup` 可以看到完整的注册表单交互：

![注册表单前端渲染效果](/media/posts/spring-boot-angular/img-09091.png)

---

## 5. 构建登录表单：精简高效的凭据链路

登录表单是注册表单的精简镜像，只包含邮箱、密码以及 `rememberMe` 勾选项。

### 5.1 组件类实现（SigninForm）

在 `src/app/features/auth/components/signin-form/signin-form.ts` 中：

```typescript
import { Component, inject, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { RouterLink } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';

import { SigninRequest } from '../../../../shared/models/auth';

@Component({
  selector: 'app-signin-form',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    RouterLink,
  ],
  templateUrl: './signin-form.html',
  styleUrl: './signin-form.scss',
})
export class SigninForm {
  private fb = inject(FormBuilder);

  signinComplete = output<SigninRequest>();

  signinForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    rememberMe: [false],
  });

  readonly isFormValid = toSignal(
    this.signinForm.statusChanges.pipe(
      map(status => status === 'VALID')
    ),
    { initialValue: this.signinForm.valid }
  );

  hidePassword = true;

  getErrorMessage(controlName: string): string {
    const control = this.signinForm.get(controlName);
    if (!control || !control.errors || !control.touched) return '';
    if (control.hasError('required')) {
      return `${this.formatFieldName(controlName)} is required.`;
    }
    if (control.hasError('email')) {
      return 'Please enter a valid email address.';
    }
    return 'Invalid value.';
  }

  onSubmit() {
    if (this.signinForm.valid) {
      const form = this.signinForm.getRawValue();
      this.signinComplete.emit({
        email: form.email,
        password: form.password,
      });
    }
  }

  private formatFieldName(name: string): string {
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, s => s.toUpperCase())
      .trim();
  }
}
```

### 5.2 登录路由与全局导航入口

在 `features/auth/auth.routes.ts` 中补充 `signin` 路由：

```typescript
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'signin',
    loadComponent: () => import('./pages/signin/signin').then(m => m.Signin),
  },
  {
    path: 'signup',
    loadComponent: () => import('./pages/signup/signup').then(m => m.Signup),
  },
  {
    path: '',
    redirectTo: 'signin',
    pathMatch: 'full',
  },
];
```

访问 `/auth/signin`，即可呈现登录交互卡片：

![登录表单界面](/media/posts/spring-boot-angular/img-09093.png)

为了让用户在任意页面都能快速跳转到登录页，我们在公共顶部导航栏 `src/app/shared/layout/header/header.html` 中追加登录按钮：

```html
<!-- 在现有的 header toolbar 中，spacer 占位符之后追加 -->
<a mat-icon-button routerLink="/auth/signin" aria-label="Sign in to your account">
  <mat-icon>account_circle</mat-icon>
</a>
```

并在 `Header` 组件的 `imports` 中加入 `RouterLink` 指令。

---

## 6. 构建作者模态表单：MatDialog 与双模式支持

相比全屏页面级表单，CRUD 实体操作通常更推荐使用**模态对话框（Modal Dialog）**。它能让用户在不丢失列表上下文、不触发全页刷新的前提下快速完成增删改。

### 6.1 模态表单的设计考量

1. **数据流动模式不同**：
   - 页面表单通过 `output()` 发射事件；
   - 模态对话框通过 `MAT_DIALOG_DATA` 注入入参，并通过 `dialogRef.close(data)` 传出结果。
2. **“创建 / 编辑”模式自适配**：
   - 如果注入的 `MAT_DIALOG_DATA` 为 `null`，则为**创建模式**；
   - 如果包含实体对象，则为**编辑模式**，表单自动通过 `patchValue` 回填数据，提交时额外携带原实体 `id`。

### 6.2 组件实现（AuthorForm）

在 `src/app/features/books/components/author-form/author-form.ts` 中：

```typescript
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { Author } from '../../../../shared/models/author';

@Component({
  selector: 'app-author-form',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './author-form.html',
  styleUrl: './author-form.scss',
})
export class AuthorForm {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<AuthorForm>);
  // 声明为 optional: true，在新增模式未传参时解析为 null，而非抛出注入异常
  private data: Author | null = inject(MAT_DIALOG_DATA, { optional: true }) ?? null;

  authorForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    nationality: ['', [Validators.required]],
  });

  readonly isFormValid = toSignal(
    this.authorForm.statusChanges.pipe(
      map(status => status === 'VALID')
    ),
    { initialValue: this.authorForm.valid }
  );

  get isEditMode(): boolean {
    return this.data !== null;
  }

  constructor() {
    if (this.data) {
      this.authorForm.patchValue({
        name: this.data.name,
        nationality: this.data.nationality,
      });
    }
  }

  getErrorMessage(controlName: string): string {
    const control = this.authorForm.get(controlName);
    if (!control || !control.errors || !control.touched) return '';
    if (control.hasError('required')) return `${this.formatFieldName(controlName)} is required.`;
    if (control.hasError('minlength')) {
      const err = control.getError('minlength');
      return `Must be at least ${err.requiredLength} characters.`;
    }
    return 'Invalid value.';
  }

  onSubmit() {
    if (this.authorForm.valid) {
      const formValue = this.authorForm.getRawValue();
      if (this.isEditMode) {
        // 编辑模式：回传时必须带上原始 id
        this.dialogRef.close({ id: this.data!.id, ...formValue });
      } else {
        // 新增模式：仅回传表单内容
        this.dialogRef.close(formValue);
      }
    }
  }

  onCancel() {
    this.dialogRef.close(); // 无参关闭代表取消
  }

  private formatFieldName(name: string): string {
    return name.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
  }
}
```

### 6.3 模态模板与表单按钮解耦

在 `src/app/features/books/components/author-form/author-form.html` 中：

```html
<h2 mat-dialog-title>
  {{ isEditMode ? 'Edit Author' : 'Add New Author' }}
</h2>

<mat-dialog-content>
  <form [formGroup]="authorForm" id="authorForm" (ngSubmit)="onSubmit()" class="author-form">
    <mat-form-field appearance="outline" class="full-width">
      <mat-label>Author Name</mat-label>
      <input matInput formControlName="name" placeholder="e.g. Robert C. Martin">
      @if (authorForm.get('name')?.invalid && authorForm.get('name')?.touched) {
        <mat-error>{{ getErrorMessage('name') }}</mat-error>
      }
    </mat-form-field>

    <mat-form-field appearance="outline" class="full-width">
      <mat-label>Nationality</mat-label>
      <input matInput formControlName="nationality" placeholder="e.g. American">
      @if (authorForm.get('nationality')?.invalid && authorForm.get('nationality')?.touched) {
        <mat-error>{{ getErrorMessage('nationality') }}</mat-error>
      }
    </mat-form-field>
  </form>
</mat-dialog-content>

<mat-dialog-actions align="end">
  <button mat-button (click)="onCancel()">Cancel</button>
  <!-- 核心技巧：使用 HTML5 form 属性，将弹窗动作条按钮与内层 form 关联 -->
  <button mat-raised-button color="primary" type="submit" form="authorForm" [disabled]="!isFormValid()">
    {{ isEditMode ? 'Update' : 'Create' }}
  </button>
</mat-dialog-actions>
```

> **DOM 结构解耦技巧**：
> Material Dialog 规范中，`<mat-dialog-actions>` 位于 `<mat-dialog-content>` 之外。常规情况下把 submit 按钮放在 `<form>` 外无法触发表单的 `(ngSubmit)`。通过在 `<form id="authorForm">` 上定义 ID，并在按钮上指定 `form="authorForm"`，完全符合标准 HTML5 跨容器表单触发表单行为。

---

## 7. 复杂图书模态表单与 AI 协同演进

图书模型具有 9 个字段，包含数字校验、ISBN 正则校验、URL 正则校验和日期控件，是典型的企业级高复杂度表单。在工程实践中，由于前面已经沉淀了完善的代码模式与校验规范，此类表单非常适合通过标准化 Prompt 驱动 AI 辅助生成。

### 7.1 图书表单组件实现（BookForm）

在 `src/app/features/books/components/book-form/book-form.ts` 中：

```typescript
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';

import { Book } from '../../../../shared/models/book';

@Component({
  selector: 'app-book-form',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDatepickerModule,
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './book-form.html',
  styleUrl: './book-form.scss',
})
export class BookForm {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<BookForm>);
  private data: Book | null = inject(MAT_DIALOG_DATA, { optional: true }) ?? null;

  bookForm = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    authorName: ['', [Validators.required]],
    genre: ['', [Validators.required]],
    isbn: ['', [Validators.required, Validators.pattern(/^(?:\d{9}[\dXx]|\d{13})$/)]],
    price: [0, [Validators.required, Validators.min(0)]],
    // Datepicker 的清空状态为 null，显式声明为可空控件
    published: this.fb.control<Date | null>(null, { validators: [Validators.required] }),
    description: [''],
    pageCount: this.fb.control<number | null>(null, { validators: [Validators.min(1)] }),
    coverImageUrl: ['', [Validators.pattern(/^https?:\/\/.+/)]],
  });

  get isEditMode(): boolean {
    return this.data !== null;
  }

  constructor() {
    if (this.data) {
      this.bookForm.patchValue({
        ...this.data,
        published: this.data.published ? new Date(this.data.published) : null,
      });
    }
  }

  // 针对存在多个 pattern 校验项的表单，建立动态字典映射
  private patternMessages: Record<string, string> = {
    isbn: 'Enter a valid 10- or 13-digit ISBN.',
    coverImageUrl: 'Enter a valid URL starting with http:// or https://.',
  };

  getErrorMessage(controlName: string): string {
    const control = this.bookForm.get(controlName);
    if (!control || !control.errors || !control.touched) return '';
    if (control.hasError('required')) {
      return `${this.formatFieldName(controlName)} is required.`;
    }
    if (control.hasError('min')) {
      return `${this.formatFieldName(controlName)} must be greater than zero.`;
    }
    if (control.hasError('pattern')) {
      return this.patternMessages[controlName] ?? 'Invalid format.';
    }
    return 'Invalid value.';
  }

  onSubmit() {
    if (this.bookForm.invalid) return;
    const form = this.bookForm.getRawValue();

    // 数据清洗与格式标准化
    const book: Book = {
      ...(this.data?.id ? { id: this.data.id } : {}),
      ...form,
      // Date 对象标准化为后端期望的 YYYY-MM-DD 字符串
      published: form.published!.toISOString().split('T')[0],
      pageCount: form.pageCount ?? undefined,
    };
    this.dialogRef.close(book);
  }

  onCancel() {
    this.dialogRef.close();
  }

  private formatFieldName(name: string): string {
    return name.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
  }
}
```

### 7.2 挂载模态对话框至图书列表页

在图书展示页 `src/app/features/books/pages/list/list.ts` 中，通过注入 `MatDialog` 完成对弹窗的呼出与结果监听：

```typescript
import { Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { BookForm } from '../../components/book-form/book-form';
import { Book } from '../../../../shared/models/book';

export class List {
  private dialog = inject(MatDialog);

  openCreateDialog() {
    const dialogRef = this.dialog.open(BookForm, {
      width: '600px',
    });

    dialogRef.afterClosed().subscribe((result: Book | undefined) => {
      if (result) {
        console.log('Book created:', result);
      }
    });
  }

  openEditDialog(book: Book) {
    const dialogRef = this.dialog.open(BookForm, {
      width: '600px',
      data: book,
    });

    dialogRef.afterClosed().subscribe((result: Book | undefined) => {
      if (result) {
        console.log('Book updated:', result);
      }
    });
  }
}
```

并在列表头部放置触发按钮：

```html
<div class="page-header-full">
  <h1>Book Catalog</h1>
  <button mat-raised-button color="primary" (click)="openCreateDialog()">
    <mat-icon>add</mat-icon>
    Add New Book
  </button>
</div>
```

运行并在前端点击 **Add New Book**，弹出的模态窗如下图所示：

![图书模态表单在列表页呼出运行效果](/media/posts/spring-boot-angular/img-09095.png)

---

## 8. 响应式表单单元测试矩阵（Vitest）

响应式表单最大的工程优势在于其**高可测试性**——因为表单树与校验状态均属于纯 TypeScript 逻辑模型，无需每次都进行重度的真实 DOM 渲染即可完成高密度的规则断言。

### 8.1 注册表单核心测试（SignupForm Spec）

在 `features/auth/components/signup-form/signup-form.spec.ts` 中针对初始化、单字段正则、跨字段密码比对与提交载荷进行测试覆盖：

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SignupForm } from './signup-form';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';

describe('SignupForm', () => {
  let component: SignupForm;
  let fixture: ComponentFixture<SignupForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignupForm],
      providers: [provideNoopAnimations(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SignupForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Form Initialization', () => {
    it('should initialize with an invalid form', () => {
      expect(component.signupForm.valid).toBe(false);
    });

    it('should have nested password group', () => {
      const passwordsGroup = component.signupForm.get('passwords');
      expect(passwordsGroup).toBeTruthy();
      expect(passwordsGroup?.get('password')).toBeTruthy();
      expect(passwordsGroup?.get('confirmPassword')).toBeTruthy();
    });
  });

  describe('Field Validation', () => {
    it('should reject firstName with numbers', () => {
      const firstName = component.signupForm.get('firstName');
      firstName?.setValue('John123');
      expect(firstName?.hasError('noNumbers')).toBe(true);
    });

    it('should validate email format', () => {
      const email = component.signupForm.get('email');
      email?.setValue('invalid-email');
      expect(email?.hasError('email')).toBe(true);

      email?.setValue('valid@example.com');
      expect(email?.valid).toBe(true);
    });
  });

  describe('Cross-Field Validation', () => {
    it('should detect password mismatch', () => {
      const passwordsGroup = component.signupForm.get('passwords');
      passwordsGroup?.get('password')?.setValue('Strong@Pass1');
      passwordsGroup?.get('confirmPassword')?.setValue('Different@Pass1');
      passwordsGroup?.updateValueAndValidity();

      expect(passwordsGroup?.hasError('passwordMismatch')).toBe(true);
    });

    it('should pass when passwords match', () => {
      const passwordsGroup = component.signupForm.get('passwords');
      passwordsGroup?.get('password')?.setValue('Strong@Pass1');
      passwordsGroup?.get('confirmPassword')?.setValue('Strong@Pass1');
      passwordsGroup?.updateValueAndValidity();

      expect(passwordsGroup?.hasError('passwordMismatch')).toBe(false);
    });
  });

  describe('Form Submission', () => {
    it('should emit signupComplete with cleaned data when valid', () => {
      const emitSpy = vi.spyOn(component.signupComplete, 'emit');

      component.signupForm.patchValue({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        passwords: {
          password: 'Strong@Pass1',
          confirmPassword: 'Strong@Pass1',
        },
        agreeToTerms: true,
      });

      component.onSubmit();

      expect(emitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          password: 'Strong@Pass1',
        })
      );
    });
  });
});
```

### 8.2 模态表单测试：动态 Provider Mock

测试 `AuthorForm` 时，关键在于如何优雅地模拟 `MatDialogRef` 和 `MAT_DIALOG_DATA`，并在同一个测试套件中分别验证“创建”与“编辑”模式：

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthorForm } from './author-form';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('AuthorForm', () => {
  let component: AuthorForm;
  let fixture: ComponentFixture<AuthorForm>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };

  function createComponent(dialogData: any = null) {
    mockDialogRef = { close: vi.fn() };

    TestBed.configureTestingModule({
      imports: [AuthorForm],
      providers: [
        provideNoopAnimations(),
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthorForm);
    component = fixture.componentInstance;
  }

  describe('Create Mode', () => {
    beforeEach(() => {
      createComponent(null);
    });

    it('should initialize with empty fields and editMode false', () => {
      expect(component.authorForm.get('name')?.value).toBe('');
      expect(component.isEditMode).toBe(false);
    });

    it('should close dialog with form payload on submit', () => {
      component.authorForm.patchValue({ name: 'Martin Fowler', nationality: 'British' });
      component.onSubmit();
      expect(mockDialogRef.close).toHaveBeenCalledWith({
        name: 'Martin Fowler',
        nationality: 'British',
      });
    });
  });

  describe('Edit Mode', () => {
    const existingAuthor = { id: 42, name: 'Robert C. Martin', nationality: 'American' };

    beforeEach(() => {
      createComponent(existingAuthor);
    });

    it('should populate form with injected data', () => {
      expect(component.authorForm.get('name')?.value).toBe('Robert C. Martin');
      expect(component.isEditMode).toBe(true);
    });

    it('should close dialog with attached ID on submit', () => {
      component.onSubmit();
      expect(mockDialogRef.close).toHaveBeenCalledWith({
        id: 42,
        name: 'Robert C. Martin',
        nationality: 'American',
      });
    });
  });
});
```

### 8.3 执行测试套件

运行工程单元测试命令：

```bash
npm run test:run
```

所有表单测试用例执行完毕且全部通过，输出结果如下：

![Vitest 表单测试执行全部通过](/media/posts/spring-boot-angular/img-09097.png)

---

## 9. 总结与下章演进

在本章中，我们以真实生产需求为导向，全面完成了书店前端系统的响应式表单基建：

1. **宿主策略分流**：针对认证流程，采用页面级表单结合路由导航；针对实体增删改，采用轻量模态对话框（`MatDialog`）结合 `MAT_DIALOG_DATA` 注入。
2. **校验矩阵与状态派生**：深入实战了组级跨字段校验器（`passwordMatchValidator`），通过 `toSignal(statusChanges)` 将表单校验有效性无缝桥接至 Angular Signals 响应式闭环。
3. **严格的 DTO 契约对齐**：通过 `getRawValue()` 提取强类型数据，并在提交前剔除仅供 UI 消费的冗余字段，保障进入通信层的数据纯净可靠。

目前这四大表单的交互与测试均已自治闭环，但表单产生的数据仍停留在控制台输出中。在下一章中，我们将进入 **Angular 22 现代状态管理**的核心领域，深度探索 **NgRx SignalStore** 与全新的 **Events Plugin**，构建清晰、可预测且具备完整事件溯源能力的认证状态中心（`AuthStore`）。
