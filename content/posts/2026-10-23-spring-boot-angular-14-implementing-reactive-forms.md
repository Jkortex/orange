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

## 1. 业务表单选型与交互决策矩阵

| 表单类型 | 宿主交互环境 | 核心校验管线 | 视图特性与关键技术 | 产出契约对象 (DTO) |
| :--- | :--- | :--- | :--- | :--- |
| **用户注册表单 (SignupForm)** | 独立路由页面 (`/auth/signup`) | 强密码正则、纯字母姓名限制、组级跨字段密码一致性校验 | 密码可见性切换、表单状态转 Signal、`mat-card` 响应式排版 | `SignupRequest` |
| **用户登录表单 (SigninForm)** | 独立路由页面 (`/auth/signin`) | 必填项、邮箱格式验证、密码最小长度 (8位) | 轻量凭据快速录入、键盘回车直接触发提交 | `SigninRequest` |
| **作者管理表单 (AuthorForm)** | 模态弹窗 (`MatDialog`) | 姓名非空且无数字、国籍必填 | 基于 `MAT_DIALOG_DATA` 自动切换新增/编辑双模式 | `Author` |
| **图书录入表单 (BookForm)** | 模态弹窗 (`MatDialog`) | ISBN-10/13 正则、出版年份限制、价格/页数正数区间 | Material Datepicker 日期选择、浮点货币与整数模型转换 | `Book` |

## 2. 生产级注册表单与跨字段校验范式

### 跨字段密码校验器 (`custom-validators.ts`)

```typescript
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function passwordMatchValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    if (!password || !confirmPassword) return null;
    return password === confirmPassword ? null : { passwordMismatch: true };
  };
}

export function noNumbersValidator(): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    if (!control.value) return null;
    return /\d/.test(control.value) ? { noNumbers: { value: control.value } } : null;
  };
}
```

### 强类型注册表单类 (`signup-form.ts`)

```typescript
import { Component, inject, output } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { SignupRequest } from '../../../../shared/models/auth';
import { passwordMatchValidator, noNumbersValidator } from '../../../../shared/validators/custom-validators';

@Component({
  selector: 'app-signup-form',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatCardModule, MatFormFieldModule,
    MatInputModule, MatButtonModule, MatIconModule, MatCheckboxModule
  ],
  templateUrl: './signup-form.html',
  styleUrl: './signup-form.scss'
})
export class SignupForm {
  private readonly fb = inject(FormBuilder).nonNullable;

  readonly signupComplete = output<SignupRequest>();
  hidePassword = true;
  hideConfirmPassword = true;

  readonly signupForm = this.fb.group({
    firstName: ['', [Validators.required, noNumbersValidator()]],
    lastName: ['', [Validators.required, noNumbersValidator()]],
    email: ['', [Validators.required, Validators.email]],
    passwords: this.fb.group(
      {
        password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)]],
        confirmPassword: ['', Validators.required]
      },
      { validators: [passwordMatchValidator()] }
    ),
    phone: [''],
    address: [''],
    city: [''],
    state: [''],
    zipCode: [''],
    country: [''],
    agreeToTerms: [false, Validators.requiredTrue]
  });

  readonly isFormValid = toSignal(
    this.signupForm.statusChanges.pipe(map(s => s === 'VALID')),
    { initialValue: this.signupForm.valid }
  );

  onSubmit(): void {
    if (this.signupForm.valid) {
      const form = this.signupForm.getRawValue();
      const payload: SignupRequest = {
        email: form.email,
        password: form.passwords.password,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        zipCode: form.zipCode || undefined,
        country: form.country || undefined
      };
      this.signupComplete.emit(payload);
    }
  }
}
```

## 3. MatDialog 模态表单生产范式

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { Author } from '../../../../shared/models/author';
import { noNumbersValidator } from '../../../../shared/validators/custom-validators';

@Component({
  selector: 'app-author-form',
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ isEditMode ? '编辑作者信息' : '录入新作者' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="authorForm" class="dialog-form flex flex-col gap-4 pt-2">
        <mat-form-field appearance="outline">
          <mat-label>作者姓名</mat-label>
          <input matInput formControlName="name" placeholder="例如：Martin Fowler" />
          @if (authorForm.controls.name.invalid && authorForm.controls.name.touched) {
            <mat-error>姓名必填且不得包含数字</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>国籍</mat-label>
          <input matInput formControlName="nationality" placeholder="例如：英国" />
          @if (authorForm.controls.nationality.invalid && authorForm.controls.nationality.touched) {
            <mat-error>国籍为必填项</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">取消</button>
      <button mat-flat-button color="primary" [disabled]="authorForm.invalid" (click)="onSubmit()">保存</button>
    </mat-dialog-actions>
  `
})
export class AuthorForm implements OnInit {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly dialogRef = inject(MatDialogRef<AuthorForm>);
  readonly data = inject<Author | null>(MAT_DIALOG_DATA, { optional: true });

  isEditMode = false;

  readonly authorForm = this.fb.group({
    name: ['', [Validators.required, noNumbersValidator()]],
    nationality: ['', Validators.required]
  });

  ngOnInit(): void {
    if (this.data && this.data.name) {
      this.isEditMode = true;
      this.authorForm.patchValue({
        name: this.data.name,
        nationality: this.data.nationality
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.authorForm.valid) {
      const payload: Author = {
        ...(this.data?.id ? { id: this.data.id } : {}),
        ...this.authorForm.getRawValue()
      };
      this.dialogRef.close(payload);
    }
  }
}
```

## 4. 表单自动化测试与 Mock 范式

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthorForm } from './author-form';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('AuthorForm (Dialog Form)', () => {
  let component: AuthorForm;
  let fixture: ComponentFixture<AuthorForm>;
  const mockDialogRef = { close: vi.fn() };

  function setup(dialogData: any = null) {
    TestBed.configureTestingModule({
      imports: [AuthorForm],
      providers: [
        provideNoopAnimations(),
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: dialogData }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AuthorForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('编辑模式下应正确回显传入的作者数据', () => {
    setup({ id: 42, name: 'Robert C. Martin', nationality: 'American' });
    expect(component.isEditMode).toBe(true);
    expect(component.authorForm.getRawValue()).toEqual({
      name: 'Robert C. Martin',
      nationality: 'American'
    });
  });

  it('提交合规表单时应调用 dialogRef.close 回传载荷', () => {
    setup(null);
    component.authorForm.patchValue({ name: 'Kent Beck', nationality: 'American' });
    component.onSubmit();

    expect(mockDialogRef.close).toHaveBeenCalledWith({
      name: 'Kent Beck',
      nationality: 'American'
    });
  });
});
```

## 5. 复杂表单开发避坑清单 (Do's & Don'ts)

| 错误实践 (Don't) | 正确实践 (Do) |
| :--- | :--- |
| 在模板中针对每个控件拼接冗长复杂的行内条件判断。 | 统一封装 `getErrorMessage(controlName)` 纯函数或 Getter，集中维护错误文案映射。 |
| 在跨字段校验失败时直接将错误绑定在子字段控件本身。 | 将错误挂载在父级 `FormGroup`，并在对应确认密码的 `<mat-error>` 中通过 `group.hasError('passwordMismatch')` 判断。 |
| 在 `MatDialog` 表单内部直接注入服务调用后端保存接口。 | 弹窗组件仅负责数据录入、校验并调用 `dialogRef.close(payload)` 回传数据，由父级 Smart 容器统筹持久化。 |
| 直接将 Datepicker 产出的 JavaScript `Date` 实例提交给微服务。 | 在提交前调用 ISO 标准格式化工具，转换为后端识别的 `YYYY-MM-DD` 标准字符串。 |
| 在提取表单值时遗漏已禁用的只读字段。 | 一律使用 `form.getRawValue()` 代替 `form.value`，杜绝禁用控件数据丢失。 |

<!-- split -->

# 原著完整参考：实战复杂响应式表单与跨字段校验

在企业级全栈开发中，表单绝不仅仅是 HTML 输入框的排列，而是用户输入与后端微服务数据契约的**首道防御与映射中枢**。本章将理论全面落地到书店系统的具体交互中，构建支撑核心业务流的四大响应式表单：

1. **用户认证流（页面级宿主）**：
   - **用户注册表单（Signup Form）**：包含复杂的校验逻辑，覆盖多字段正则表达式、跨字段密码一致性校验、非必填地址展平以及基于 Signal 的表单全局有效性监听。
   - **用户登录表单（Signin Form）**：注册模式的高效精简复用，建立轻量、无废话的凭据提交与状态反馈链路。
2. **资源管理流（Dialog 模态宿主）**：
   - **作者表单（Author Form）**：引入基于 Angular Material `MatDialog` 的模态交互模式，支持由注入数据驱动的“新增/编辑”双模式自治。
   - **图书表单（Book Form）**：9 字段复杂数据模型，包含日期选择器（Datepicker）、多种 pattern 校验字典映射、数字范围约束与富数据格式转换。

本文不仅提供四大表单的完整落地代码，还将演示前后端 DTO 契约的类型对齐规范、Smart/Dumb 容器拆分模式以及基于 Vitest 的高覆盖率单元测试矩阵。

:::en
> **Original**: Production-grade reactive forms serve as the first line of defense against malformed inputs, transforming unstructured user data into strictly typed, verified DTO payloads.

**📌 核心术语与语境解析**：
- **Contract-First Design** [ˈkɑːntrækt fɜːrst dɪˈzaɪn]：*契约优先设计*。前后端以共同约定的 Schema/DTO 为唯一标准，各自独立实现并保持接口完全对齐的研发模式。
- **Data Transfer Object (DTO)** [ˈdeɪtə trænsˈfɜːr ˈɑːbdʒɪkt]：*数据传输对象*。跨网络传输数据的载荷结构体，不包含任何业务行为逻辑。
:::

## 1. 契约先行：前后端 DTO 与 TypeScript 接口对齐

在全栈工程中，前端表单的最终目的是产出符合后端接口期望的载荷（Payload）。为了杜绝类型不一致引发的隐蔽 Bug，首先建立镜像后端 Java DTO 的 TypeScript 接口。

### 1.1 契约映射核心准则

- **必填与可选对齐**：后端使用了 `@NotBlank`、`@NotNull` 的属性，在 TypeScript 中定义为必选字段；后端未标注强制校验的可空字段，统一使用可选操作符 `?`。
- **类型系统映射**：
  - Java `String` $\rightarrow$ TypeScript `string`
  - Java `BigDecimal` / `Integer` / `Long` $\rightarrow$ TypeScript `number`
  - Java `LocalDate` $\rightarrow$ TypeScript `string`（以 ISO 8601 标准日期字符串传输，如 `YYYY-MM-DD`）
- **校验对齐**：后端基于 `@Pattern`、`@PositiveOrZero` 的约束，前端应配置等价的正则校验与 `Validators.min()`，实现前端即时拦截、后端兜底的双层防护。

### 1.2 领域实体模型（Author 与 Book）

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

### 1.3 认证 DTO（SignupRequest 与 SigninRequest）

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
```

## 2. 表单脚手架与模块拓扑

利用 Angular CLI 快速搭建清晰的功能特性目录：

```bash
ng generate component features/auth/components/signin-form
ng generate component features/auth/components/signup-form
ng generate component features/books/components/author-form
ng generate component features/books/components/book-form
```

此时的工程代码结构如下：

![表单工程脚手架目录结构](/media/posts/spring-boot-angular/img-09089.png)

所有表单遵循 Presentation Component（Dumb）与 Container/Page Component（Smart）分离的职责划分。接下来从最复杂的注册表单切入。

## 3. 实战注册表单：跨字段校验与 Material 深度集成

注册表单不仅字段较多，而且包含密码强度正则、纯字母姓名限制，以及最经典的**密码与确认密码一致性（Cross-Field Validation）**校验。

### 3.1 编写可复用的自定义校验器

在 `src/app/shared/validators/custom-validators.ts` 中实现通用的校验规则：

```typescript
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function noNumbersValidator(): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    if (!control.value) return null;
    const hasNumbers = /\d/.test(control.value);
    return hasNumbers ? { noNumbers: { value: control.value } } : null;
  };
}

export function passwordMatchValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    if (!password || !confirmPassword) return null;
    return password === confirmPassword ? null : { passwordMismatch: true };
  };
}
```

### 3.2 注册组件类实现（SignupForm）

在 `src/app/features/auth/components/signup-form/signup-form.ts` 中：

```typescript
import { Component, inject, output } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { RouterLink } from '@angular/router';

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

  signupComplete = output<SignupRequest>();

  hidePassword = true;
  hideConfirmPassword = true;

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

  readonly isFormValid = toSignal(
    this.signupForm.statusChanges.pipe(
      map(status => status === 'VALID')
    ),
    { initialValue: this.signupForm.valid }
  );

  get passwordsGroup(): FormGroup {
    return this.signupForm.get('passwords') as FormGroup;
  }

  getErrorMessage(controlName: string, groupName?: string): string {
    const control = groupName
      ? this.signupForm.get(groupName)?.get(controlName)
      : this.signupForm.get(controlName);

    if (!control || !control.errors || !control.touched) return '';

    if (control.hasError('required')) return `${this.formatFieldName(controlName)} 为必填项`;
    if (control.hasError('email')) return '请输入有效的邮箱地址';
    if (control.hasError('minlength')) {
      const err = control.getError('minlength');
      return `长度至少为 ${err.requiredLength} 个字符`;
    }
    if (control.hasError('noNumbers')) return `${this.formatFieldName(controlName)} 不得包含数字`;
    if (control.hasError('pattern')) return '密码须包含大写字母、小写字母及数字';

    return '输入内容不符合要求';
  }

  getGroupErrorMessage(groupName: string): string {
    const group = this.signupForm.get(groupName);
    if (!group || !group.errors) return '';
    if (group.hasError('passwordMismatch')) return '两次输入的密码不一致';
    return '';
  }

  onSubmit() {
    if (this.signupForm.valid) {
      const form = this.signupForm.getRawValue();
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

:::en
> **Original**: The Floating Label pattern coupled with dynamic error message interpolation delivers intuitive, space-efficient user feedback across all form states.

**📌 核心术语与语境解析**：
- **Floating Label Pattern** [ˈfloʊtɪŋ ˈleɪbl ˈpætərn]：*浮动标签模式*。输入框获得焦点或有内容时标签平滑向上漂浮缩小的 Material Design 经典交互规范。
- **Composite Validation** [kəmˈpɑːzət ˌvælɪˈdeɪʃn]：*复合校验*。由单一控件自身规则和多控件联合规则叠加生效的综合校验链条。
:::

## 4. 实战登录表单：凭据校验与流式状态

登录表单在模式上作为注册表单的轻量精简版，聚焦于凭据的快速采集与提交。

### 4.1 登录表单实现（SigninForm）

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
    MatIconModule,
    RouterLink,
  ],
  templateUrl: './signin-form.html',
  styleUrl: './signin-form.scss',
})
export class SigninForm {
  private fb = inject(FormBuilder);

  signinComplete = output<SigninRequest>();
  hidePassword = true;

  signinForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  readonly isFormValid = toSignal(
    this.signinForm.statusChanges.pipe(map(s => s === 'VALID')),
    { initialValue: this.signinForm.valid }
  );

  onSubmit(): void {
    if (this.signinForm.valid) {
      this.signinComplete.emit(this.signinForm.getRawValue());
    }
  }
}
```

## 5. 模态交互：基于 MatDialog 的作者表单

与页面级表单不同，作者管理表单设计为模态弹窗形式。

### 5.1 弹窗双模式处理

在 `src/app/features/books/components/author-form/author-form.ts` 中：

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { Author } from '../../../../shared/models/author';
import { noNumbersValidator } from '../../../../shared/validators/custom-validators';

@Component({
  selector: 'app-author-form',
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './author-form.html',
  styleUrl: './author-form.scss'
})
export class AuthorForm implements OnInit {
  private fb = inject(FormBuilder).nonNullable;
  private dialogRef = inject(MatDialogRef<AuthorForm>);
  readonly data = inject<Author | null>(MAT_DIALOG_DATA, { optional: true });

  isEditMode = false;

  authorForm = this.fb.group({
    name: ['', [Validators.required, noNumbersValidator()]],
    nationality: ['', Validators.required]
  });

  ngOnInit(): void {
    if (this.data && this.data.name) {
      this.isEditMode = true;
      this.authorForm.patchValue({
        name: this.data.name,
        nationality: this.data.nationality
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.authorForm.valid) {
      const payload: Author = {
        ...(this.data?.id ? { id: this.data.id } : {}),
        ...this.authorForm.getRawValue()
      };
      this.dialogRef.close(payload);
    }
  }
}
```

:::en
> **Original**: Encapsulating creation and edit workflows inside a MatDialog promotes UI modularity, relying on injected tokens for state handoff and clean dismissal.

**📌 核心术语与语境解析**：
- **Modal Dialog Encapsulation** [ˈmoʊdl ˈdaɪəlɔːɡ ɪnˌkæpsjəˈleɪʃn]：*模态弹窗封装*。将特定的增删改小粒度交互内聚在模态对话框内部，不干扰底层页面路由。
- **DialogRef Lifecycle** [ˈdaɪəlɔːɡ ref ˈlaɪfsaɪkl]：*弹窗引用生命周期*。通过 `MatDialogRef` 掌控弹窗的挂载、动画展开、数据回传与彻底销毁流程。
:::

## 6. 9 字段复合表单：图书全量录入与 Datepicker

图书表单是全系统最复杂的输入模型，涉及书名、作者、流派、价格、出版日期（Datepicker）、ISBN、描述、页数与封面图 URL。

### 6.1 表单模型定义与正则字典

在 `src/app/features/books/components/book-form/book-form.ts` 中：

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { Book } from '../../../../shared/models/book';

@Component({
  selector: 'app-book-form',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatButtonModule, MatDatepickerModule, MatNativeDateModule
  ],
  templateUrl: './book-form.html',
  styleUrl: './book-form.scss'
})
export class BookForm implements OnInit {
  private fb = inject(FormBuilder).nonNullable;
  private dialogRef = inject(MatDialogRef<BookForm>);
  readonly data = inject<Book | null>(MAT_DIALOG_DATA, { optional: true });

  isEditMode = false;

  bookForm = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    authorName: ['', Validators.required],
    genre: ['', Validators.required],
    price: [0, [Validators.required, Validators.min(0.01)]],
    published: ['', Validators.required],
    isbn: ['', [Validators.required, Validators.pattern(/^(?:\d{10}|\d{13})$/)]],
    description: [''],
    pageCount: [0, [Validators.min(1)]],
    coverImageUrl: ['']
  });

  ngOnInit(): void {
    if (this.data) {
      this.isEditMode = true;
      this.bookForm.patchValue(this.data);
    }
  }

  onSubmit(): void {
    if (this.bookForm.valid) {
      const val = this.bookForm.getRawValue();
      const payload: Book = {
        ...(this.data?.id ? { id: this.data.id } : {}),
        ...val,
        published: typeof val.published === 'string' ? val.published : new Date(val.published).toISOString().split('T')[0]
      };
      this.dialogRef.close(payload);
    }
  }
}
```

:::en
> **Original**: Field normalization converts transient date objects and numeric strings into canonical API payloads compliant with strict backend serialization specs.

**📌 核心术语与语境解析**：
- **Field Normalization** [fiːld ˌnɔːrmələˈzeɪʃn]：*字段标准化*。在提交至网络通信层前，将控件内部的临时对象（如 Date、带逗号数字）转换为标准传输标量的过程。
- **ISO 8601 Serialization** [ˌaɪ es oʊ deɪt ˌsɪriələˈzeɪʃn]：*ISO 8601 序列化*。标准化的国际日期时间字符串表示法（形如 `YYYY-MM-DD`）。
:::

## 7. 自动化测试套件与覆盖率断言

运行工程单元测试命令：

```bash
npm run test:run
```

所有表单测试用例执行完毕且全部通过，输出结果如下：

![Vitest 表单测试执行全部通过](/media/posts/spring-boot-angular/img-09097.png)

:::en
> **Original**: Comprehensive form tests validate control states, custom validator logic, and UI bindings without relying on costly end-to-end browser automation.

**📌 核心术语与语境解析**：
- **Form State Testing** [fɔːrm steɪt ˈtestɪŋ]：*表单状态测试*。针对 valid/invalid、pristine/dirty、touched/untouched 及 errors 属性矩阵展开的内存断言。
- **Event Dispatch Simulation** [ɪˈvent dɪˈspætʃ ˌsɪmjuˈleɪʃn]：*事件派发仿真*。在测试环境中模拟用户点击、输入与失焦行为以检验组件响应的测试技术。
:::
