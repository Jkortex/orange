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

在上一章中，我们建立了 Angular 响应式表单的理论基石，深入探讨了 `FormControl`、`FormGroup`、校验模式、`FormBuilder` 服务以及错误展示策略。现在，是将这些知识付诸实践、为我们的在线书店应用构建核心表单的时候了。在本章中，我们将实现驱动应用关键用户交互的四大响应式表单：身份认证（注册与登录）以及内容管理（作者与图书）。你将学习如何在真实业务场景中应用响应式表单概念，集成 Angular Material 组件以打造专业外观，处理包括跨字段校验在内的复杂校验需求，并从一开始就设计出同时支持新增与编辑双模式的表单。我们将涵盖以下主题：

- 定义共享接口：前端与后端 DTO 对齐
- 搭建表单脚手架
- 构建注册表单
- 构建登录表单
- 构建作者表单对话框
- AI 辅助图书表单对话框开发
- 测试响应式表单
- 测试作者表单对话框
- 借助 AI 辅助生成表单测试
- 运行测试

> **注意**
>
> 本书中的某些图片在印刷版中可能较难阅读。我们保留了这些图片，因为它们反映了真实的界面，方便你在自己的屏幕上对照操作。你也可以在随书附带的 *Graphics Bundle*（图形包）中查看并放大所有图片，其链接已在前言（*Preface*）中提供。

## 技术要求（Technical requirements）

本章的源代码可以在此处获取：

`https://github.com/PacktPublishing/Spring-Boot-and-Angular-2E_Frontend/tree/main/chapter-14/`

为了同时展示传统开发方式与 AI 辅助开发工作流，我们将手动构建三个表单并展开详细讲解：注册表单（我们最复杂的认证表单）、登录表单（更简化的强化练习）以及作者表单（引入新增/编辑双模式设计）。随后，我们将基于已确立的模式，使用 AI 工具来生成图书表单。

## 定义共享接口：前端与后端 DTO 对齐（Defining shared interfaces: Aligning frontend with backend DTOs）

在构建任何表单之前，我们先来确立它们所交互的数据契约。我们的 TypeScript 接口应该镜像后端的**数据传输对象**（**DTO**，Data Transfer Objects），以在全栈范围内保持一致性。这种对齐确保了在前后端之间流转的数据遵循相同的结构，从而在我们于*第 16 章*和*第 17 章*中将这些表单对接到真实 API 端点时减少集成问题。后端 DTO 向我们精确展示了每个端点所期望的数据结构。例如，后端的 `AuthorRequest` 和 `BookRequest` DTO 定义在以下位置：

`https://github.com/PacktPublishing/Spring-Boot-and-Angular-2E_Backend/tree/main/chapter-06/inventory-ms/src/main/java/com/packt/bookstore/inventory/dto`

你可能会注意到，后端的 `BookRequest` DTO 使用了一个 `authorId` 字段（对作者实体的引用），而我们的接口将使用 `authorName` 字符串。在当前阶段这是刻意为之的：我们在本章中的表单在 UI 层面上是完整的，但尚未连接到 API，因此使用纯文本输入框输入作者姓名可以保持表单直观简洁，同时让我们专注于响应式表单的核心机制。在*第 17 章*中，当我们把图书表单对接到后端时，我们将引入包含 `authorId` 的更新版 `BookRequest` 接口，并将文本输入框替换为下拉选择框。

在*第 11 章*中，我们已经在 `shared/models/book.ts` 下创建了 `Book` 接口。在本章中，我们只需将 `id` 字段添加为可选属性（使用可选操作符 `?`），以支持编辑场景：

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

按照同样的方法，我们也在同一目录下创建作者模型，位于 `shared/models/author.ts`：

```typescript
export interface Author {
  id?: number;
  name: string;
  nationality: string;
  books?: string[];
}
```

以下是几点关键的对齐考量：

- **必填与可选**：后端 `@NotBlank`、`@NotNull` 等注解映射为 TypeScript 必选属性（无 `?`），而后端可选字段映射为 TypeScript 可选属性（带有 `?`）。
- **Java 到 TypeScript 类型映射**：后端 Java 类型根据以下标准映射规则转换为 TypeScript 类型：
  - Java `String` → TypeScript `string`
  - Java `BigDecimal` → TypeScript `number`
  - Java `Integer` → TypeScript `number`
  - Java `LocalDate` → TypeScript `string`（ISO 日期格式）
- **校验对齐**：后端校验使用诸如 `@Pattern` 和 `@PositiveOrZero` 之类的注解，我们在前端实现对等的校验器（例如，用于 ISBN 的正则表达式校验器、用于价格的最小值校验器）。

接下来，我们将实现认证相关的模型。在查阅了 `https://github.com/PacktPublishing/Spring-Boot-and-Angular-2E_Backend/tree/main/chapter-08/user-ms/src/main/java/com/packt/bookstore/users/dto` 中包含的 DTO 之后，我们将认证模型文件放置在 `shared/models/auth.ts` 下：

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

这些接口将在我们的应用中发挥多重作用。它们提供编译期类型检查，通过自动补全和错误检测提供更好的 IDE 支持，并在应用的不同部分之间建立清晰的契约。可选属性（用 `?` 标记）为不同的使用场景提供了灵活性。例如，新用户在保存到数据库之前不会有 `id`，而图书在初始创建阶段可能没有封面图片 URL。在我们新建的组件和模型接口定义完成后，*图 14.1* 展示了它们如何集成到项目的目录结构中。在定义了接口并明确了其在目录结构中的位置后，我们便可以搭建消费这些接口的四个表单组件脚手架。

## 搭建表单脚手架（Scaffolding the forms）

创建了向我们展示每个表单所需字段的接口后，让我们开始使用 Angular CLI 生成必要的组件来构建它们：

```bash
ng generate component features/auth/components/signin-form
ng generate component features/auth/components/signup-form
ng generate component features/books/components/author-form
ng generate component features/books/components/book-form
```

这些命令将在各自的功能特性模块内创建表单组件，保持我们在*第 11 章*中建立的整洁架构。

![表单脚手架生成后的目录结构](/media/posts/spring-boot-angular/img-09089.png)

*图 14.1：表单脚手架生成后的目录结构*

接下来，我们将通过构建注册表单组件将这些模型付诸实践。

## 构建注册表单（Building the signup form）

注册表单是我们最复杂的认证表单，也是本章的核心教学案例。我们将手动实现它并展开深入讲解，确立适用于后续所有表单的通用模式。该表单演示了跨字段校验（密码确认）、自定义校验器、Angular Material 集成以及我们在*第 13 章*中学到的错误展示技术。

### 步骤 1：创建自定义校验器（Step 1: Creating custom validators）

注册表单需要若干自定义校验器来处理超出 Angular 内置校验器范围的业务逻辑。我们将在共享位置创建它们，以便在各个表单之间复用。让我们创建 `shared/validators/custom-validators`：

```typescript
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
    return password === confirmPassword
      ? null
      : { passwordMismatch: true };
  };
}
```

这些自定义校验器展示了业务逻辑校验的重要模式。`noNumbersValidator` 确保姓名字段仅包含字母和空格，这对于数据质量非常重要。`passwordMatchValidator` 是一个在 `FormGroup` 级别运行以比对两个关联字段的跨字段校验器，演示了校验器如何跨多个控件协同工作。

### 步骤 2：构建组件类（Step 2: Building the component class）

现在让我们实现注册组件。我们将利用绝大多数可用的 Angular Forms 特性、基于 Signal 的响应式机制，并践行在*第 13 章*中所承诺的使用 `NonNullableFormBuilder`。我们将其放置在 `features/auth/components/signup-form/signup-form.ts` 下：

```typescript
// .. 导入项

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

  signupForm = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, noNumbersValidator()]],
    lastName: ['', [Validators.required, noNumbersValidator()]],
    email: ['', [Validators.required, Validators.email]],
    passwords: this.fb.nonNullable.group({
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      ]],
      confirmPassword: ['', [Validators.required]],
    }, { validators: [passwordMatchValidator()] }),
    phone: [''],
    address: [''],
    city: [''],
    state: [''],
    zipCode: [''],
    country: [''],
    agreeToTerms: [false, [Validators.requiredTrue]],
  });

  // 基于 Signal 的表单有效性追踪
  readonly isFormValid = toSignal(
    this.signupForm.statusChanges.pipe(
      map(status => status === 'VALID')
    ),
    { initialValue: this.signupForm.valid }
  );

  // 密码可见性切换
  hidePassword = true;
  hideConfirmPassword = true;

  // passwords 分组的 Getter
  get passwordsGroup() {
    return this.signupForm.get('passwords') as FormGroup;
  }

  getErrorMessage(controlName: string, groupName?: string): string {
    const control = groupName
      ? this.signupForm.get(groupName)?.get(controlName)
      : this.signupForm.get(controlName);

    if (!control || !control.errors || !control.touched) return '';

    if (control.hasError('required')) return `${this.formatFieldName(controlName)} is required.`;
    if (control.hasError('email')) return 'Please enter a valid email address.';
    if (control.hasError('minlength')) {
      const err = control.getError('minlength');
      return `Must be at least ${err.requiredLength} characters.`;
    }
    if (control.hasError('noNumbers')) return `${this.formatFieldName(controlName)} must not contain numbers.`;
    if (control.hasError('pattern')) return 'Must include uppercase, lowercase, and a number.';

    return 'Invalid value.';
  }

  getGroupErrorMessage(groupName: string): string {
    const group = this.signupForm.get(groupName);
    if (!group || !group.errors) return '';
    if (group.hasError('passwordMismatch')) return 'Passwords do not match.';
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
    return name.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
  }
}
```

让我们剖析此实现中的一些关键模式：

- **非空控件（Non-nullable controls）**：我们使用 `this.fb.nonNullable.group(...)` 构建表单，这是在*第 13 章*中确立的 `NonNullableFormBuilder` API，消除了在每个控件上重复编写 `nonNullable: true` 的需要。
- **跨字段校验（Cross-field validation）**：`passwords` 嵌套分组通过 `validators` 选项在组级别应用了 `passwordMatchValidator()`，比对 `password` 与 `confirmPassword` 子控件的值。
- **扁平化地址字段（Flat address fields）**：与*第 13 章*中出于教学目的采用嵌套地址分组的示例不同，这里我们将地址字段保持扁平化，以匹配真实的后端 DTO。鉴于我们的接口需要镜像后端 DTO，这是一个深思熟虑的决定。
- **错误信息辅助方法（Error message helpers）**：`getErrorMessage()` 方法集中了错误信息逻辑，接收控件名和可选的分组名。这种模式保持了模板的整洁，并使错误提示一致且易于更新。`getGroupErrorMessage()` 处理归属于分组而非单个控件的跨字段错误。其中 `pattern` 分支只返回一条消息，因为密码是注册表单中唯一的正则校验器。对于包含多个 `pattern` 字段的表单（例如图书表单的 ISBN 和封面图片 URL），我们将在本章稍后通过查找映射表按字段解析消息。
- **数据重构（Data reconstruction）**：`onSubmit()` 方法使用 `getRawValue()` 提取所有表单值（包括已禁用的控件），然后将扁平表单结构映射为我们的 `SignupRequest`。`confirmPassword` 和 `agreeToTerms` 字段仅用于前端 UI，在发射的数据中被显式排除。

### 步骤 3：构建模板（Step 3: Building the template）

注册表单的模板演示了如何在维护良好用户体验和无障碍特性的同时，组织包含多个区域的复杂表单。我们将使用多个 Angular Material 组件协同构建连贯、专业的界面，引导用户完成复杂的注册流程。以下是我们实现中的关键 Angular Material 组件：

- `MatCard` 组件提供了基础布局结构。`mat-card` 创建了一个具有投影抬升感的容器，在视觉上将表单与页面背景区隔开来，而 `mat-card-header`、`mat-card-title` 与 `mat-card-subtitle` 建立了清晰的视觉层级，让用户对表单的用途产生明确预期。
- `MatFormField` 与 `MatInput` 协同打造 Material Design 著称的增强输入体验。采用 `appearance="outline"` 的 `mat-form-field` 提供了浮动标签动画、集成的错误提示以及一致的间距，而 `mat-input` 则将标准 HTML 输入框转换为具备规范样式和交互状态的 Material Design 组件。
- `MatCheckbox` 提供了条款接受界面，具备无障碍属性和 Material Design 样式，与我们的表单校验系统无缝集成。
- `MatIcon` 与 `MatButton` 通过直观的视觉线索和交互元素增强了用户界面。图标可帮助用户快速理解字段含义（如邮箱图标）或操作（如密码可见性切换），而 Material 按钮在整个表单中提供了统一的交互模式。

以下是模板中的一些核心模式，展示了我们在模板中如何处理表单输入，包括响应式表单绑定、校验反馈以及 Material Design 组件。完整模板可以在本章的 GitHub 仓库中查阅（位于 `features/auth/components/signup-form/signup-form.html`）：

```html
<mat-card class="signup-card">
  <mat-card-header>
    <mat-card-title>Join Packt Bookstore</mat-card-title>
    <mat-card-subtitle>Create your account to start your reading journey</mat-card-subtitle>
  </mat-card-header>

  <mat-card-content>
    <form [formGroup]="signupForm" (ngSubmit)="onSubmit()" class="signup-form">
      <!-- ..更多表单字段 -->
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Email Address</mat-label>
        <input matInput type="email" formControlName="email"
               placeholder="Enter your email"
               autocomplete="email">
        <mat-icon matSuffix>email</mat-icon>
        @if (signupForm.get('email')?.invalid && signupForm.get('email')?.touched) {
          <mat-error>{{ getErrorMessage('email') }}</mat-error>
        }
      </mat-form-field>

      <div formGroupName="passwords">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Password</mat-label>
          <input matInput
                 [type]="hidePassword ? 'password' : 'text'"
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

        <!-- 确认密码：与上方的密码字段类似，绑定至 formControlName="confirmPassword"，拥有独立的 hideConfirmPassword 切换状态 -->

        @if (passwordsGroup.hasError('passwordMismatch') && passwordsGroup.get('confirmPassword')?.dirty) {
          <mat-error class="group-error">{{ getGroupErrorMessage('passwords') }}</mat-error>
        }
      </div>

      <!-- ..更多表单字段 -->

      <!-- 条款与提交 -->
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

该模板展示了若干重要模式。`formGroupName="passwords"` 指令为嵌套密码组创建了作用域上下文，使跨字段错误得以展示在两个密码字段下方。`<mat-error>` 组件与 `mat-form-field` 原生集成，具备自动显隐动画。我们使用 `@if` 控制流语法根据有效性和交互状态（`touched` 或 `dirty`）条件渲染错误，与*第 13 章*所讲完全一致。贯穿表单的 `autocomplete` 属性通过启用浏览器自动填充改善了用户体验，并且对无障碍访问至关重要。密码可见性切换使用带有 `aria-label` 属性的 `mat-icon-button`，为屏幕阅读器提供良好支持。

### 步骤 4：实现配套样式（Step 4: Implementing complementary styling）

最后，SCSS 文件在增强 Angular Material 组件的同时，确保表单在不同设备上表现良好并保持视觉一致性。你可以在此处查看完整的 SCSS 文件：`https://github.com/PacktPublishing/Spring-Boot-and-Angular-2E_Frontend/blob/main/chapter-14/src/app/features/auth/components/signup-form/signup-form.scss`。

### 步骤 5：实现注册页面（Step 5: Implementing the signup page）

遵循*第 11 章*中的 Smart/Dumb 组件模式，我们创建一个包裹注册表单的页面组件。使用以下命令生成它：

```bash
ng generate component features/auth/pages/signup
```

`signup` 页面将处理表单提交、管理页面导航，并在更广泛的认证流程中为注册表单提供宿主上下文。以下是我们放入 `pages/signup.ts` 中的组件代码：

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
    console.log('Signup data:', signupData);
    // 在第 16 章中，这里将调用 AuthStore.signup()
  }
}
```

然后将模板编写在 `pages/signup.html` 中：

```html
<div class="page-container">
  <div class="page-header">
    <h1>Create Your Account</h1>
    <p>Join thousands of readers in the Packt Bookstore community</p>
  </div>
  <app-signup-form (signupComplete)="handleSignupComplete($event)" />
</div>
```

最后，我们需要建立一些在所有页面上通用的页面样式。因此，我们应该将它们添加到主样式文件 `styles.scss` 中：

```css
.page-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.page-header {
  text-align: center;
  color: white;
  max-width: 600px;

  h1 {
    font-size: 2.5rem;
    font-weight: 300;
    margin-bottom: 0.5rem;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  p {
    font-size: 1.1rem;
    opacity: 0.9;
    margin: 0;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }
}

@media (max-width: 768px) {
  .page-container {
    padding: 1rem;
  }

  .page-header {
    h1 {
      font-size: 2rem;
    }

    p {
      font-size: 1rem;
    }
  }
}
```

### 步骤 6：更新认证路由（Step 6: Updating the authentication routes）

现在我们需要初始化认证路由，并纳入新的注册页面。让我们创建认证路由文件（名为 `features/auth/auth.routes.ts`）：

```typescript
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'signup',
    loadComponent: () => import('./pages/signup/signup')
      .then(m => m.Signup)
  },
];
```

### 步骤 7：更新主应用路由（Step 7: Updating the main app routes）

最后，确保我们在 `app.routes.ts` 中的主应用路由包含了认证路由：

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
    loadChildren: () => import('./features/books/books.routes')
      .then(m => m.routes)
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes')
      .then(m => m.routes)
  }
];
```

现在，一旦我们启动书店应用，就应该能够访问认证页面了。

![/auth/signup 路径下的注册表单](/media/posts/spring-boot-angular/img-09091.png)

*图 14.2：/auth/signup 路径下的注册表单*

我们构建了一个包含校验、Material Design 组件以及完善数据流的完备响应式表单。在注册表单完成后，我们可以复用该模式的精简版本来构建更简单的登录表单。

## 构建登录表单（Building the signin form）

登录表单在一个更简单的表单上巩固了响应式表单模式。这为我们提供了对整套工作流的第二轮实战演练：`NonNullableFormBuilder`、Angular Material 字段、错误提示展示以及 Smart/Dumb 组件拆分，同时没有跨字段校验或可选地址区域的复杂性。

### 步骤 1：构建组件类（Step 1: Building the component class）

现在让我们实现 signin-form 组件。我们将使用在注册表单中所用特性的一个子集，编写在 `features/auth/components/signin-form/signin-form.ts` 下：

```typescript
// .. 导入项
@Component({ .. })
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
    if (control.hasError('required'))
      return `${this.formatFieldName(controlName)} is required.`;
    if (control.hasError('email'))
      return 'Please enter a valid email address.';
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

其模式与注册表单相同，只是进行了精简：`NonNullableFormBuilder`、基于 Signal 的有效性追踪、集中的 `getErrorMessage()`，以及对外发射 `SigninRequest` 接口的 output 事件。`rememberMe` 字段仅用于前端 UI，不包含在发射的数据中；我们将在*第 16 章*中使用它来决定 Token 的持久化策略。

### 步骤 2：构建模板（Step 2: Building the template）

登录表单的模板复用了我们在注册表单中使用的大部分技术。你可以在此处查看完整的模板以及相关的 SCSS 文件：`https://github.com/PacktPublishing/Spring-Boot-and-Angular-2E_Frontend/blob/main/chapter-14/src/app/features/auth/components/signin-form`。

### 步骤 3：登录页面与路由（Step 3: Signin page and routing）

遵循*第 11 章*中的 Smart/Dumb 组件模式，我们将创建一个包裹 `signin` 表单的页面组件。使用以下命令生成它：

```bash
ng generate component features/auth/pages/signin
```

它遵循与注册页面相同的模式，你可以在此处查看完整的页面类代码以及相关的 SCSS 文件：`https://github.com/PacktPublishing/Spring-Boot-and-Angular-2E_Frontend/blob/main/chapter-14/src/app/features/auth/pages/signin`。

现在我们需要在认证路由中加入 `signin` 路由，随后便可以在 UI 中访问该表单。让我们更新 `features/auth/auth.routes.ts`：

```typescript
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'signin',
    loadComponent: () =>
      import('./pages/signin/signin').then(m => m.Signin)
  },
  // ..signup 路由
  {
    path: '',
    redirectTo: 'signin',
    pathMatch: 'full'
  }
];
```

![/auth/signin 路径下的登录表单](/media/posts/spring-boot-angular/img-09093.png)

*图 14.3：/auth/signin 路径下的登录表单*

**Create one here** 链接会导航至注册表单，而注册表单中的 **Sign in here** 链接会导航回登录页面；身份认证流程已经串联就绪。我们还要更新共享头部组件以包含登录链接，以便用户可以从应用中的任意位置访问认证。更新 `shared/layout/header/header.html`，在现有工具栏内容后添加一个账户按钮：

```html
<!-- 添加至现有的 header 工具栏中，放置在占位 spacer 之后 -->
<a mat-icon-button routerLink="/auth/signin"
   aria-label="Sign in to your account">
  <mat-icon>account_circle</mat-icon>
</a>
```

确保将 `RouterLink` 添加到头部组件的 imports 中，最后在 Packt Bookstore 标题上添加一个 `routerLink="/books"` 绑定（`RouterLink` 指令），以方便用户导航回主页面。在介绍了基于页面的表单之后，我们现在转向基于对话框的模式，首先从作者表单开始。

## 构建作者表单对话框（Building the author form dialog）

作者表单引入了两个重要的新模式：使用 Angular Material 的 `MatDialog` 实现**基于对话框的表单**，以及由注入数据驱动的**新增/编辑双模式支持**。作者表单无需导航至单独的页面，而是作为模态对话框打开；这非常契合这种轻量级双字段表单，能够使用户停留在当前上下文中。我们在此建立该对话框模式，随后同样将其应用到图书表单中。基于页面的表单（如注册和登录）非常适合独立的业务流程：用户导航至专用 URL，填写表单，然后被重定向。但对于作者和图书等实体的 CRUD 操作，基于对话框的表单能提供更好的体验：用户留在列表页面上，弹出对话框进行新增或编辑，完成后列表就地更新，无需经历整页导航。Angular Material 的 `MatDialog` 服务在模态浮层内打开组件。数据通过 `MAT_DIALOG_DATA` 注入令牌传入，结果在对话框通过 `MatDialogRef` 关闭时回传。这为我们提供了简洁的新增/编辑模式识别机制：如果有数据注入，即为编辑模式；如果没有，即为新增模式。

> **注意**
>
> 我们在此将作者表单构建为一个可复用的对话框组件，但目前尚未将其从任何位置呼出唤起；用于打开它的作者列表页面将在*第 17 章*登场。你可以在本章中构建并对其进行单元测试，但在那之前它不会在浏览器中呈现。
> 本章稍后的图书表单则不同：它将直接从我们在*第 11 章*中已有的图书列表页面打开，因此你可以完整地端到端运行体验它。

### 步骤 1：结合对话框集成构建组件类（Step 1: Building the component class with dialog integration）

现在让我们实现 author-form 组件。我们将在 `features/books/components/author-form/author-form.ts` 中使用与注册和登录表单相同的特性：

```typescript
// .. 导入项
@Component({ .. })
export class AuthorForm {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<AuthorForm>);
  private data: Author | null =
    inject(MAT_DIALOG_DATA, { optional: true }) ?? null;

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
    /* 结构与 signup-form 的步骤 2 相同 */
  }

  onSubmit() {
    if (this.authorForm.valid) {
      const formValue = this.authorForm.getRawValue();
      if (this.isEditMode) {
        this.dialogRef.close({ id: this.data!.id, ...formValue });
      } else {
        this.dialogRef.close(formValue);
      }
    }
  }

  onCancel() {
    this.dialogRef.close();
  }

  // formatFieldName(): 与 signup-form (步骤 2) 完全相同
}
```

让我们剖析这与基于页面的认证表单有何不同：

- **数据注入取代输入 Signal**：对话框通过 `MAT_DIALOG_DATA` 接收其数据，而非 `input()` 信号。我们使用 `{ optional: true }` 注入它，以便该令牌在新增模式（未传递数据时）解析为 `null` 而不是抛出错误。这取代了我们在页面级表单中可能会使用的 `input<Author | undefined>()` 模式。
- **对话框关闭取代输出事件**：表单不再通过 `output()` 发射事件，而是通过调用 `this.dialogRef.close(formValue)` 来传回结果。调用方组件通过对话框的 `afterClosed()` Observable 接收该值。不带参数调用关闭（在 `onCancel()` 中）表明用户取消了对话框。
- **构造函数数据填充**：由于对话框数据在构造时仅注入一次，并且在对话框生命周期内绝不会改变，因此直接使用构造函数即可将数据打补丁（patch）到表单中。数据要么存在（编辑模式），要么不存在（新增模式）；不存在对话框打开中途数据发生变化的情况。
- **感知模式的返回结果**：`onSubmit()` 方法在编辑模式下会附带原始的 `id`，使调用方拥有区分新增与更新操作所需的一切信息。

### 步骤 2：构建模板（Step 2: Building the template）

作者表单的模板复用了我们在注册表单中使用的大部分技术，但在这种情况下，表单字段被包裹在 `mat-dialog` 组件内：

```html
<h2 mat-dialog-title>
  {{ isEditMode ? 'Edit Author' : 'Add New Author' }}
</h2>

<mat-dialog-content>
  <form [formGroup]="authorForm" id="authorForm"
        (ngSubmit)="onSubmit()" class="author-form">

  <!-- ..表单字段 -->
  </form>
</mat-dialog-content>

<mat-dialog-actions align="end">
  <button mat-button (click)="onCancel()">Cancel</button>
  <button mat-raised-button color="primary"
          type="submit" form="authorForm"
          [disabled]="!isFormValid()">
    {{ isEditMode ? 'Update' : 'Create' }}
  </button>
</mat-dialog-actions>
```

该模板使用了 Material 对话框结构指令：用于标题栏的 `mat-dialog-title`、用于可滚动正文内容的 `mat-dialog-content` 以及用于底部按钮栏的 `mat-dialog-actions`。提交按钮使用 `form="authorForm"` 属性将其链接到 `mat-dialog-content` 内部的表单元素，因为按钮本身位于 `<form>` 标签外部。对于提交按钮位于 DOM 不同区域的表单，这是一种标准的 HTML 模式。

其余部分均遵循与注册表单相同的模式。你可以在此处查看完整模板以及相关 SCSS 文件：`https://github.com/PacktPublishing/Spring-Boot-and-Angular-2E_Frontend/blob/main/chapter-14/src/app/features/books/components/author-form`。

### 步骤 3：打开对话框（Step 3: Opening the dialog）

基于对话框的表单是通过父组件使用 `MatDialog` 服务以编程式打开的。我们直到*第 17 章*才会拥有作者列表页面，因此作者表单对话框目前尚无法在浏览器中预览。以下是当我们构建作者列表时，父组件将会使用的模式：

```typescript
private dialog = inject(MatDialog);

openCreateDialog() {
  const dialogRef = this.dialog.open(AuthorForm, {
    width: '480px',
  });

  // ..处理提交结果
}

openEditDialog(author: Author) {
  const dialogRef = this.dialog.open(AuthorForm, {
    width: '480px',
    data: author,
  });

  // ..处理提交结果
}
```

新增和编辑均使用相同的 `AuthorForm` 组件；唯一的区别在于是否传递了 `data`。当提供了 `data` 时，表单以编辑模式打开并预先填充各字段。在*第 17 章*中，我们将构建作者列表页面，并将这些对话框调用连接到 `AuthorStore` 以执行实际的 CRUD 操作。

现在我们已经手动构建了三个表单，并确立了清晰的模式（如使用 `NonNullableFormBuilder`、通过 `getErrorMessage()` 展示错误、集成 Angular Material 以及基于对话框的新增/编辑模式），接下来是借助 AI 生成我们应用中最复杂表单的时候了。

## AI 辅助图书表单对话框开发（AI-assisted book form dialog development）

图书表单包含 9 个具有不同校验规则的字段，演示了 AI 工具在由已确立模式引导时如何处理复杂性。早在*第 12 章*中，我们就创建了向 Copilot 提供关于项目架构、表单模式和测试约定的上下文指令文件。这些指令文件将引导此处的代码生成。

### 步骤 1：生成图书表单对话框（Step 1: Generating the book form dialog）

打开 VS Code 并激活 Copilot 的 Agent 模式：

1. 打开命令面板（*Shift* + *Cmd* + *P* 或 *Ctrl* + *Shift* + *P*）
2. 输入 `open chat agent` 并选择 **Chat: Open chat (Agent)**
3. 在 Agent 面板中，引用 signup-form 和 author-form 组件。
4. 使用以下 Prompt：

```text
Using the signup-form in features/auth/components/signup-form and the
author-form dialog in features/books/components/author-form as
reference patterns, create a book form dialog component as such:

1. Create features/books/components/book-form/book-form.ts and
   book-form.html
2. Use the Book interface from shared/models/book.ts
3. Use MatDialog pattern: inject MAT_DIALOG_DATA (optional) for
   create/edit mode, close with MatDialogRef
4. Required fields: title, isbn, authorName, price, genre, published
5. Optional fields: description, pageCount, coverImageUrl
6. Validation: isbn pattern, price min(0), pageCount min(1),
   coverImageUrl URL pattern
7. Use NonNullableFormBuilder (this.fb.nonNullable.group)
8. Use mat-datepicker for the published date field
9. Include getErrorMessage() following the signup-form pattern, but
    resolve the `pattern` error per field (ISBN vs. cover-image URL)
    via a message map, since this form has more than one pattern
    validator
10. Use mat-dialog-title, mat-dialog-content, mat-dialog-actions
    structure like author-form
11. Include Cancel button that calls dialogRef.close()
12. On submit, close with form value (include id if editing)
```

正确的生成产物会生成一个与以下代码非常接近的组件。我们将以此作为检查 AI 输出的参考基准：

```typescript
export class BookForm {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<BookForm>);
  private data: Book | null = inject(MAT_DIALOG_DATA,
    { optional: true }) ?? null;

  bookForm = this.fb.nonNullable.group({
    title:       ['', [Validators.required]],
    authorName:  ['', [Validators.required]],           // 目前使用纯文本；第 17 章中使用 mat-select
    genre:       ['', [Validators.required]],
    isbn:        ['', [Validators.required,
                       Validators.pattern(/^(?:\d{9}[\dXx]|\d{13})$/)]],
    price:       [0, [Validators.required, Validators.min(0)]],
    // 日期选择器的空状态为 null，因此此字段显式选用可空控件
    published:   this.fb.control<Date | null>(null,
      { validators: [Validators.required] }),
    description: [''],
    pageCount:   this.fb.control<number | null>(null,
      { validators: [Validators.min(1)] }),
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

  private patternMessages: Record<string, string> = {
    isbn: 'Enter a valid 10- or 13-digit ISBN.',
    coverImageUrl: 'Enter a valid URL starting with http:// or https://.',
  };

  getErrorMessage(controlName: string): string {
    const control = this.bookForm.get(controlName);
    if (!control || !control.errors || !control.touched) return '';
    if (control.hasError('required')) return `${this.formatFieldName(controlName)} is required.`;
    if (control.hasError('min')) return `${this.formatFieldName(controlName)} must be greater than zero.`;
    if (control.hasError('pattern')) return this.patternMessages[controlName] ?? 'Invalid format.';
    return 'Invalid value.';
  }

  onSubmit() {
    if (this.bookForm.invalid) return;
    const form = this.bookForm.getRawValue();
    const book: Book = {
      ...(this.data?.id ? { id: this.data.id } : {}),
      ...form,
      published: form.published!.toISOString().split('T')[0],
      pageCount: form.pageCount ?? undefined,
    };
    this.dialogRef.close(book);
  }
}
```

Agent 执行完成后，我们对照此参考基准审查其输出。以下是需要验证的关键点：

- **接口对齐（Interface alignment）**：确保表单字段与 `Book` 接口完全匹配。AI 有时会多加或遗漏字段。
- **对话框模式（Dialog pattern）**：核对注入 `MAT_DIALOG_DATA` 时是否配置了 `{ optional: true }`，以及 `onSubmit()` 在关闭对话框时是否回传了正确的数据（编辑模式下包含 `id`）。
- **校验器配置（Validator configuration）**：检查 `isbn` 是否使用了合适的正则校验器，`price` 是否使用了 `Validators.min(0)`，`pageCount` 是否使用了 `Validators.min(1)`，以及 `coverImageUrl` 是否校验了 URL 格式。
- **日期处理（Date handling）**：`published` 字段应使用 Angular Material 的 `mat-datepicker`，且发射的值应为匹配后端 `LocalDate` 格式的 ISO 日期字符串。
- **错误信息处理（Error messages）**：核对 `getErrorMessage()` 是否涵盖了图书专属字段的所有校验场景。

你会注意到图书表单对作者姓名使用了纯文本输入框。这在专注于表单机制的同时保持了简单明了。在*第 17 章*中，一旦我们拥有从 API 填充数据的 `AuthorStore`，我们将把它替换为解析为后端所期望的 `authorId` 的 `<mat-select>` 下拉框。

如果生成的代码需要调整（通常都需要），请相应地进行必要的修正。这种“审查与调整”工作流是*第 3 章*中“信任但验证（trust but verify）”准则的具体应用。

### 步骤 2：从列表页面打开图书表单对话框（Step 2: Opening the book form dialog from the list page）

与作者表单不同，我们已经拥有*第 11 章*中的图书列表页面，可用于打开图书表单对话框。让我们更新 `features/books/pages/list/list.ts` 中的 `List` 页面组件，添加一个打开对话框的新建按钮：

```typescript
// ..导入项
export class List {
  private dialog = inject(MatDialog);

  // ... 第 11 章中的既有 mock 数据

  openCreateDialog() {
    const dialogRef = this.dialog.open(BookForm, {
      width: '600px',
    });

    dialogRef.afterClosed().subscribe(result => {
      // @TODO
    });
  }

  openEditDialog(book: Book) {
    const dialogRef = this.dialog.open(BookForm, {
      width: '600px',
      data: book,
    });
    dialogRef.afterClosed().subscribe(result => {
      // @TODO
    });
  }
  // ..组件代码其余部分
```

最后，更新列表模板以添加 **Add Book** 按钮：

```html
<div class="page-header-full">
  <h1>Book Catalog</h1>
  <button mat-raised-button color="primary" (click)="openCreateDialog()">
    <mat-icon>add</mat-icon>
    Add New Book
  </button>
</div>
<book-list [books]="books" (book)="selectBook($event)" />
```

导航至 `/books` 并点击 **Add New Book** 按钮，即可看到图书表单对话框打开。

![从图书列表页面打开的图书表单对话框](/media/posts/spring-boot-angular/img-09095.png)

*图 14.4：从图书列表页面打开的图书表单对话框*

四个表单均已实现，我们现在可以通过编写测试来验证它们的行为。

## 测试响应式表单（Testing reactive forms）

测试响应式表单需要验证表单结构、校验逻辑、用户交互和数据流。我们将手动为注册表单和作者表单编写测试以确立清晰的测试模式，随后使用 AI 为登录表单和图书表单生成测试。

### 搭建测试套件（Setting up the test suite）

每个测试文件都遵循相同的搭建模式。我们在 `features/auth/components/signup-form/signup-form.spec.ts` 中已经生成了注册表单的测试骨架，在该文件中，我们将加入自己的测试用例。生成的环境配置了路由和日期处理所需的 Providers，这对我们的注册表单组件至关重要。

### 测试表单初始化与结构（Testing form initialization and structure）

我们的第一组测试应该验证表单是否以预期的结构正确初始化：

```typescript
describe('Form Initialization', () => {
  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with an invalid form', () => {
    expect(component.signupForm.valid).toBe(false);
  });

  it('should have all required form controls', () => {
    expect(component.signupForm.get('firstName')).toBeTruthy();
    expect(component.signupForm.get('lastName')).toBeTruthy();
    expect(component.signupForm.get('email')).toBeTruthy();
    expect(component.signupForm.get('agreeToTerms')).toBeTruthy();
  });

  it('should have nested password group', () => {
    const passwordsGroup = component.signupForm.get('passwords');
    expect(passwordsGroup).toBeTruthy();
    expect(passwordsGroup?.get('password')).toBeTruthy();
    expect(passwordsGroup?.get('confirmPassword')).toBeTruthy();
  });
});
```

### 测试字段校验（Testing field validation）

单个字段校验器构成了数据质量的第一道防线。每个字段根据我们的业务规则和后端 DTO 契约都有特定的要求：姓名不能包含数字，邮箱必须符合标准格式，密码必须满足安全性要求。这些测试验证每个校验器是否正确执行其规则，在拒绝无效输入的同时接受有效数据。通过隔离测试校验器，当出现校验问题时我们可以快速定位具体哪个规则失败，从而使调试显著简化：

```typescript
describe('Field Validation', () => {
  it('should validate firstName as required', () => {
    const firstName = component.signupForm.get('firstName');
    expect(firstName?.hasError('required')).toBe(true);

    firstName?.setValue('John');
    expect(firstName?.valid).toBe(true);
  });

  it('should reject firstName with numbers', () => {
    const firstName = component.signupForm.get('firstName');
    firstName?.setValue('John123');
    expect(firstName?.hasError('noNumbers')).toBe(true);
  });

  it('should validate email format', () => {
    const email = component.signupForm.get('email');

    email?.setValue('invalid');
    expect(email?.hasError('email')).toBe(true);

    email?.setValue('valid@email.com');
    expect(email?.valid).toBe(true);
  });

  // .. 更多字段校验测试
});
```

#### 测试跨字段校验（Testing cross-field validation）

单个字段校验确保每个字段满足自身的要求，而跨字段校验器则强制约束多个字段之间的关联关系。密码匹配校验器是一个绝佳示例：两个密码字段可能各自都是有效的（符合长度和复杂度要求），但如果不匹配，表单仍应处于无效状态。而且它在 `FormGroup` 级别而非 `FormControl` 级别运行，需要专门的测试：

```typescript
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
```

#### 测试错误提示信息生成（Testing error message generation）

错误提示信息是校验逻辑与用户之间的主要沟通桥梁。宽泛模糊或不正确的错误信息会让用户受挫并降低表单完成率，而清晰具体的提示则能引导用户成功提交。这些测试验证 `getErrorMessage()` 和 `getGroupErrorMessage()` 方法针对各类校验错误生成适当的消息，并且消息仅在合适的时机出现（在用户触碰字段 `touched` 之后）：

```typescript
describe('Error Messages', () => {
  it('should return empty string for untouched fields', () => {
    expect(component.getErrorMessage('firstName')).toBe('');
  });

  it('should return required error message', () => {
    const firstName = component.signupForm.get('firstName');
    firstName?.markAsTouched();
    expect(component.getErrorMessage('firstName')).toContain('required');
  });

  it('should return group error for password mismatch', () => {
    const passwordsGroup = component.signupForm.get('passwords');
    passwordsGroup?.get('password')?.setValue('Strong@Pass1');
    passwordsGroup?.get('confirmPassword')?.setValue('Different@Pass1');
    passwordsGroup?.markAsTouched();
    expect(component.getGroupErrorMessage('passwords'))
      .toContain('do not match');
  });
});
```

#### 测试表单提交（Testing form submission）

提交是用户与后端之间的最终关卡。提交无效数据的表单会引发下游缺陷，而静默吞没有效提交的表单则会让用户困惑操作是否成功。这些测试验证 `onSubmit()` 仅在所有校验规则均通过时才对外发射格式正确的 `SignupRequest`，而在表单无效时不执行任何操作，从而确保我们的表单既不会发送畸形数据，也不会丢失有效输入：

```typescript
describe('Form Submission', () => {
  it('should emit signupComplete with correct data', () => {
    const emitSpy = vi.spyOn(component.signupComplete, 'emit');

    component.signupForm.patchValue({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      passwords: {
        password: 'Strong@Pass1',
        confirmPassword: 'Strong@Pass1'
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

  it('should not emit when form is invalid', () => {
    const emitSpy = vi.spyOn(component.signupComplete, 'emit');
    component.onSubmit();
    expect(emitSpy).not.toHaveBeenCalled();
  });
});
```

注册表单测试确立了我们的模式；接下来我们将其应用于基于对话框的作者表单。

## 测试作者表单对话框（Testing the author form dialog）

基于对话框的表单需要不同的测试配置。我们需要在测试模块中提供 `MAT_DIALOG_DATA` 和 Mock 的 `MatDialogRef`：

```typescript
// ..导入项
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
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AuthorForm);
    component = fixture.componentInstance;
  }

  describe('Create Mode', () => {
    beforeEach(() => {
      createComponent(null);
    });

    it('should initialize with empty fields', () => {
      expect(component.authorForm.get('name')?.value).toBe('');
      expect(component.isEditMode).toBe(false);
    });

    it('should close dialog with form data on submit', () => {
      component.authorForm.patchValue({
        name: 'Test Author',
        nationality: 'Greek'
      });
      component.onSubmit();
      expect(mockDialogRef.close).toHaveBeenCalledWith({
        name: 'Test Author',
        nationality: 'Greek'
      });
    });

    it('should close without data on cancel', () => {
      component.onCancel();
      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });
  });

  describe('Edit Mode', () => {
    const existingAuthor = {
      id: 1, name: 'Existing Author', nationality: 'British'
    };

    beforeEach(() => {
      createComponent(existingAuthor);
    });

    it('should populate form with injected data', () => {
      expect(component.authorForm.get('name')?.value)
        .toBe('Existing Author');
      expect(component.isEditMode).toBe(true);
    });

    // .. 模式感知的 close-with-id 断言可查阅代码仓库
  });
});
```

与基于页面的表单测试相比，核心差异在于 `createComponent()` 辅助函数。通过接收 `dialogData` 参数，我们可以在新增模式（通过传入 `null`）或编辑模式（传入作者对象）下创建组件，并相应地配置 `MAT_DIALOG_DATA` Provider。Mock 的 `MatDialogRef` 让我们能够验证对话框在提交时是否携带正确的数据关闭，并在取消时是否不带数据直接关闭。在手工编写的对话框测试确立模式之后，我们可以将重复的其余工作交由 Copilot 完成。

## 借助 AI 辅助生成表单测试（Generating form tests with AI assistance）

鉴于我们已经在注册表单和作者表单中确立了完善的测试模式，我们可以利用 AI 为登录表单和图书表单对话框生成类似的测试套件：

```text
Using the signup-form tests in signup-form.spec.ts
and the author-form dialog tests in author-form.spec.ts
as reference patterns, create comprehensive unit tests for the
signin-form and the book-form dialog component. Use Vitest tooling.

The tests should cover:
1. Component initialization and form structure
2. Required field validation
3. Optional field handling
4. Price validation (min 0)
5. ISBN format validation
6. Create mode (empty form, closes dialog with form data)
7. Edit mode (populated via MAT_DIALOG_DATA, closes with id)
8. Cancel button (closes dialog without data)
9. Error message generation for all fields
```

审查生成的测试以确保准确性，特别是 `book-form.spec.ts` 中的 `MAT_DIALOG_DATA` Provider 配置以及对话框关闭断言。在图书表单测试生成完成后，让我们运行完整的测试套件以确认所有测试均通过。

## 运行测试（Running the tests）

最后，使用我们在*第 11 章*中配置的 Vitest 命令执行所有测试套件：

```bash
npm run test:run
```

测试执行完成后，终端输出应如下所示：

![生成的注册表单测试及执行输出结果](/media/posts/spring-boot-angular/img-09097.png)

*图 14.5：生成的注册表单测试及执行输出结果*

至此，本章内容全部结束。四个表单组件的所有测试均已通过，我们确认了表单符合预期行为。这为我们在后续各章演进这些表单提供了坚实的安全网。

## 本章小结（Summary）

在本章中，我们采用两种宿主策略为书店应用实现了四个响应式表单：用于身份认证的页面级表单（注册与登录），以及用于 CRUD 操作的对话框表单（作者与图书）。注册表单作为核心教学载体，引入了我们在本章贯穿使用的诸多表单模式；而作者表单对话框则引入了利用 MatDialog 进行新增/编辑模式判定的机制，AI 生成的图书表单对话框随后全面复用了该模式。所有四个表单在 UI 层面上均已完备，但尚未连接到后端 API。

在下一章中，我们将学习 Angular 应用中的状态管理概念与实现，探索将显著增强应用架构与数据流管理的 Signal 和 Store 模式。在*第 16 章*和*第 17 章*中，我们将把这些表单对接到认证端点，并完成作者与图书的完整 CRUD 操作。
