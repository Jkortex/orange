---
title: Spring Boot & Angular 全栈实战（十三）：深入理解 Angular 响应式表单设计哲学
date: 2026-10-23T00:13:00Z
description: 对比模板驱动表单与响应式表单，剖析 FormGroup、FormControl 与 FormArray 的模型不可变性，解析同步与异步校验器的运行机制。
category: fullstack
column: spring-boot-angular
tags:
  - Angular
  - Reactive Forms
  - 响应式表单
  - 前端表单
---

## 1. 表单架构体系选型决策矩阵

| 技术维度 | 响应式表单 (Reactive Forms) | 模板驱动表单 (Template-Driven) | 信号表单 (Signal Forms 前瞻) |
| :--- | :--- | :--- | :--- |
| **模型建立时机** | **显式（Explicit）**：TypeScript 中同步声明 | **隐式（Implicit）**：模板渲染后由指令动态推导 | **声明式（Signal-based）**：基于信号原语构建 |
| **数据流架构** | **单向同步流**：结构可预测，严格契约驱动 | **双向绑定**：依赖 `[(ngModel)]`，视图模型高耦合 | **细粒度依赖图**：值变更直接通知绑定微任务 |
| **类型安全机制** | **原生强类型（Typed Forms）** 支持 `nonNullable` | 类型推断薄弱，模板变量易退化为 `any` | 原生 Signal 类型安全，编译期全面推导 |
| **校验器机制** | **纯函数（Pure Functions）**：作为配置项传入 | **指令（Directives）**：作为 HTML 属性修饰 | 纯函数配合响应式计算属性派发 |
| **单元测试成本** | **极低**：脱离 DOM，在内存中直接对模型断言 | **较高**：必须依赖组件挂载与变更检测生命周期 | 极低：基于 Signal 读写直接断言 |
| **首选生产场景** | 复杂业务表单、动态增减行、跨字段与异步校验 | 极简单字段搜索框、纯静态展示性筛选 | 未来下一代 Angular 原生细粒度响应式表单 |

## 2. 强类型表单与 Signals 响应式互操作范式

结合 `NonNullableFormBuilder` 与 `@angular/core/rxjs-interop` 的 `toSignal()` 实现表单到 Signals 的无缝桥接：

```typescript
import { Component, inject, computed } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

@Component({
  selector: 'app-user-profile-editor',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="profileForm" (ngSubmit)="submit()">
      <input formControlName="username" placeholder="用户名" />
      <input formControlName="email" type="email" placeholder="电子邮箱" />

      @if (emailErrors(); as err) {
        <span class="error-text">邮箱格式不合法</span>
      }

      <p class="summary">{{ previewText() }}</p>
      <button type="submit" [disabled]="!isFormValid()">保存配置</button>
    </form>
  `
})
export class UserProfileEditor {
  private readonly fb = inject(FormBuilder).nonNullable;

  // 1. 强类型不可空表单定义
  readonly profileForm = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    bio: ['']
  });

  // 2. 将表单 Observable 流转换为 Signals
  readonly formValue = toSignal(this.profileForm.valueChanges, {
    initialValue: this.profileForm.getRawValue()
  });

  readonly isFormValid = toSignal(
    this.profileForm.statusChanges.pipe(map(s => s === 'VALID')),
    { initialValue: this.profileForm.valid }
  );

  readonly emailErrors = toSignal(
    this.profileForm.controls.email.statusChanges.pipe(
      map(() => this.profileForm.controls.email.errors)
    ),
    { initialValue: null }
  );

  // 3. 派生只读计算信号
  readonly previewText = computed(() => {
    const val = this.formValue();
    return `当前编辑用户: ${val.username || '未命名'} (${val.email || '未填邮箱'})`;
  });

  submit(): void {
    if (this.profileForm.valid) {
      // 必须调用 getRawValue() 提取完备载荷（包含禁用字段）
      const payload = this.profileForm.getRawValue();
      console.log('[Audit] 提交表单载荷:', payload);
    }
  }
}
```

## 3. 动态 FormArray 与 Zoneless 驱动范式

在 Zoneless 变更检测下，`FormArray` 必须将 `controls` 包装为 Signal，驱动原生控制流 `@for` 精准重排：

```typescript
import { Component, inject } from '@angular/core';
import { FormBuilder, Validators, FormArray, FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

@Component({
  selector: 'app-book-tags-editor',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div [formGroup]="containerForm">
      <div formArrayName="tags">
        <h4>图书标签清单</h4>
        @for (ctrl of tagControls(); track $index; let i = $index) {
          <div class="tag-row flex gap-2 mb-2">
            <input [formControlName]="i" placeholder="输入标签名" />
            <button type="button" (click)="removeTag(i)" [disabled]="tagsArray.length <= 1">删除</button>
          </div>
        } @empty {
          <p>暂无标签，请点击新增。</p>
        }
        <button type="button" (click)="addTag()">新增标签</button>
      </div>
    </div>
  `
})
export class BookTagsEditor {
  private readonly fb = inject(FormBuilder).nonNullable;

  readonly containerForm = this.fb.group({
    tags: this.fb.array<FormControl<string>>([
      this.fb.control('计算机科学', Validators.required)
    ])
  });

  get tagsArray(): FormArray<FormControl<string>> {
    return this.containerForm.controls.tags;
  }

  // 关键：将 FormArray 控件引用流转换为 Signal，驱动 @for 实时刷新
  readonly tagControls = toSignal(
    this.tagsArray.valueChanges.pipe(map(() => this.tagsArray.controls)),
    { initialValue: this.tagsArray.controls }
  );

  addTag(): void {
    this.tagsArray.push(this.fb.control('', Validators.required));
  }

  removeTag(index: number): void {
    if (this.tagsArray.length > 1) {
      this.tagsArray.removeAt(index);
    }
  }
}
```

## 4. 自定义跨字段校验与防抖异步校验范式

```typescript
import { AbstractControl, AsyncValidatorFn, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';

/**
 * 跨字段校验：确认密码一致性
 * 挂载在包含 password 与 confirmPassword 的父级 FormGroup 上
 */
export function passwordMatchValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;

    if (!password || !confirmPassword) return null;
    return password === confirmPassword ? null : { passwordMismatch: true };
  };
}

/**
 * 异步防抖校验：验证唯一性
 * 返回 Observable<ValidationErrors | null>，配合 updateOn: 'blur' 使用
 */
export function uniqueUsernameValidator(): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    if (!control.value) return of(null);

    const reserved = ['admin', 'root', 'administrator'];
    return of(reserved.includes(control.value.trim().toLowerCase())).pipe(
      delay(300), // 模拟微服务网络 I/O
      map(isTaken => (isTaken ? { usernameTaken: { value: control.value } } : null))
    );
  };
}
```

## 5. 响应式表单工程避坑清单 (Do's & Don'ts)

| 错误实践 (Don't) | 正确实践 (Do) |
| :--- | :--- |
| 在提交表单时直接调用 `form.value` 提取载荷。 | 调用 `form.getRawValue()`，保证处于 `disabled` 状态的字段（如只读主键、不可变编码）不丢失。 |
| 混淆 `setValue()` 与 `patchValue()` 的严格性边界。 | 全量结构对齐时使用 `setValue`（字段缺失直接抛错），局部增量更新使用 `patchValue`。 |
| 使用传统无约束的 `new FormControl()`，导致 `reset()` 时值意外退化为 `null`。 | 始终配置 `{ nonNullable: true }` 或使用 `fb.nonNullable`，使 `reset()` 自动回退至初始默认值。 |
| 为涉及网络请求的异步校验器配置默认的 `'change'` 触发策略。 | 显式设置 `updateOn: 'blur'`，避免每次击键引发后端接口的高频网络风暴。 |
| 将多字段联合校验器挂载在单个子级 `FormControl` 实例上。 | 将跨字段校验器声明在统筹这些字段的父级 `FormGroup` 上，统一持有并派发错误。 |

<!-- split -->

在上一章中，我们建立了基于 AI 辅助的 Angular 开发综合框架。我们探讨了 GitHub Copilot 的三种工作模式，创建了用于为 AI 工具注入项目特定上下文的指令文件，并深入梳理了在自动化生成与深思熟虑的架构决策之间保持平衡的最佳实践。随着 AI 辅助研发工作流的就绪并为加速开发奠定基础，现在我们准备好攻克用户输入处理的核心基石。

在本章中，我们将探索 Angular 表单系统的理论基石，深入理解在现代 Web 应用程序中实现健壮表单处理的核心概念、设计模式以及校验策略。学完本章后，你将透彻理解模板驱动表单与响应式表单之间的本质差异，精通 `FormGroup` 与 `FormControl` 的核心机制，掌握各类校验模式，并学会利用 `FormBuilder` 服务极简化表单构建。

本章将系统涵盖以下主题：

- 选择合适的方法：模板驱动表单对比响应式表单
- 使用表单控件（`FormControl`）
- 组合表单控件（`FormGroup` 与 `FormArray`）
- 使用 `FormBuilder` 服务生成控件
- 校验表单输入（内置校验、自定义校验、跨字段校验与异步校验）

## 选择合适的方法——模板驱动表单与响应式表单（Choosing the right approach – Template-driven versus Reactive forms）

使用 Angular 的核心优势之一在于其通过 `@angular/forms` 包提供了开箱即用的内置表单支持。这意味着开发者无需引入任何第三方库即可构建出功能强大、交互丰富的表单。Angular 为处理用户输入提供了两种主要方法：**模板驱动表单（Template-driven forms）**与**响应式表单（Reactive forms）**。这两种方法共享共同的底层基础设施（包括 `FormControl` 和 `FormGroup` 等核心类），但在表单模型的定义、管理和校验方式上存在根本差异：

| 评估维度 | 响应式表单 (Reactive Forms) | 模板驱动表单 (Template-Driven Forms) |
| --- | --- | --- |
| 表单模型设置 (Form model setup) | 显式（在组件类中声明） | 隐式（在模板中声明） |
| 表单模型构建 (Form model construction) | 在代码中同步创建，即刻可用 | 模板初始化后由指令在底层异步构建 |
| 校验机制 (Validation) | 函数式（Validators 纯函数） | 指令式（required、minlength 等 HTML 指令） |
| 可伸缩性与测试 (Scalability and testing) | 高度可伸缩，易于单元测试 | 可伸缩性较弱，测试成本较高 |
| 典型应用场景 (Typical use case) | 复杂、动态或大型企业级表单 | 简单、静态的基础表单 |

*表 13.1：响应式表单与模板驱动表单的快速对比（Table 13.1: A quick comparison between Reactive and Template-Driven forms）*

对于我们的书店应用程序（Bookstore Application），我们将全面聚焦于实现**响应式表单**，因为它们赋予我们对表单结构和校验逻辑的完全掌控权。响应式表单非常适合像书店这样的企业级应用程序——在这些系统中，可复用性、单元测试覆盖率以及动态运行时行为至关重要。

然而，在深入响应式表单之前，了解 Angular 另一种表单方案（模板驱动表单）的基础知识同样大有裨益。

### 模板驱动表单简析（A quick look at template-driven forms）

模板驱动表单是 Angular 的另一套表单方案，在我们重点研究响应式表单之前值得简要回顾。顾名思义，它依赖于直接在 HTML 模板中声明的 Angular 指令。表单模型是隐式构建的：诸如 `ngForm`、`ngModelGroup` 和 `ngModel` 等指令指示 Angular 在解析和处理模板时动态实例化并注册 `FormControl` 和 `FormGroup` 实例，因此你永远不需要在组件（`Component`）类中显式声明它们。

要使用模板驱动表单，我们必须在需要使用表单的组件中导入 `FormsModule`。在下面的代码示例中，我们在示例 `login.ts` 组件中导入了 `FormsModule`：

```typescript
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'login',
  imports: [FormsModule],
  template: `
    <form #userForm="ngForm" (ngSubmit)="onSubmit(userForm)">
      <input name="email" [(ngModel)]="email" />
      <input name="password" [(ngModel)]="password" />
      <button type="submit">Login</button>
    </form>
  `,
})
export class Login {
  email = '';
  password = '';

  onSubmit(userForm: any) {
    console.log(userForm.value); // 输出: { email: '...', password: '...'}
  }
}
```

该示例汇集了模板驱动表单的所有关键部件。一旦导入了 `FormsModule`，Angular 就会自动为 `<form>` 元素增强 `ngForm` 功能。虽然将 `ngForm` 指令显式添加到 `<form>` 元素并非严格必需，但通过 `#userForm="ngForm"` 声明可以创建一个模板引用变量，使我们能够访问该表单的整体状态，包括 `userForm.value` 和 `userForm.valid` 等关键属性。

每个输入框上的 `[(ngModel)]` 指令创建了双向数据绑定，在底层幕后自动生成内部的 `FormControl` 实例。每个输入框还必须具备一个 `name` 属性，以便 Angular 能够在表单的控件组中正确注册它。最后，`<form>` 标签上的 `(ngSubmit)` 事件在用户点击 **Login** 按钮时调用我们的 `onSubmit()` 方法。该方法接收表单引用，允许我们访问 `userForm.value`——一个包含所有字段值的 JSON 对象——随后我们可以将其用于业务逻辑（例如向 API 发送数据）。这种设置实现起来非常迅速，非常适合小型应用或极简表单。然而，它存在一些相当显著的局限性，使得它不适用于我们的项目。

#### 为什么我们在本项目中不使用模板驱动表单（Why we're not using template-driven forms in this project）

模板驱动表单对于书店应用程序来说并不理想，原因如下：

- **可伸缩性（Scalability）**：所有逻辑都嵌入在模板中，随着表单规模和复杂度的增长，维护难度急剧上升。
- **校验（Validation）**：校验规则是通过属性和指令应用的，这使得它们很难进行集中化治理或独立测试。
- **测试（Testing）**：测试需要手动触发变更检测周期，并且缺乏响应式表单所具备的细粒度可控性。

鉴于这些约束，我们将在整个书店应用程序中全面采用**响应式表单**。它们能更好地与我们的系统架构契合，提供对表单模型的完全掌控，并且能够在认证鉴权、图书管理和订单处理等各功能模块间无缝扩展。

现在让我们深入探讨响应式表单的工作机制。

### 响应式方法（The reactive approach）

响应式表单采取了完全相反的架构立场：表单模型作为类型化的 `FormGroup` 直接驻留在组件类中，而非模板中。你在 TypeScript 中定义其数据结构、校验规则和初始状态，而模板仅仅绑定到该模型，不负责构建模型。这种关注点分离使表单更易于进行单元测试，通过强类型表单（Typed Forms）提供编译期类型安全，并且能够优雅伸缩以应对在模板驱动表单中极易失控的复杂需求：动态字段集合、条件校验以及跨字段联动规则。

#### 使用响应式表单（Using reactive forms）

使用响应式表单的第一步是将 `ReactiveFormsModule` 从 `@angular/forms` 导入到组件的 `imports` 数组中。`ReactiveFormsModule` 包含了实现响应式表单所需的所有指令与核心类（例如 `FormGroup` 和 `FormControl`）。

例如：

```typescript
import { Component } from '@angular/core';
import { FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'user-profile',
  imports: [ReactiveFormsModule],
  templateUrl: './user-profile.html',
})
export class UserProfile {
  userProfileForm = new FormGroup({
    email: new FormControl(''),
    firstName: new FormControl(''),
    lastName: new FormControl(''),
  });

  onSubmit() {
    console.log(this.userProfileForm.value);
  }
}
```

该示例介绍了响应式表单的核心构建基块：

- `FormControl`：代表单个输入字段，并追踪其当前值和校验状态。每个 `FormControl` 实例的类型都会自动推导为初始值的类型与 `null` 的联合类型，在本例中为 `FormControl<string | null>`。
- `FormGroup`：将多个控件组合为一个结构化对象，映射数据模型的逻辑分块。
- `FormArray`：（本例暂未涉及）用于管理表单控件的动态有序列表，常用于标签列表、技能集合或动态增减的输入行等场景。

在随后的模板中，我们使用 `[formGroup]` 指令将 `FormGroup` 绑定到 `<form>` 元素。随后使用 `formControlName` 将每个独立的输入框链接到其对应的控件。`(ngSubmit)` 事件负责处理表单提交：

```html
<form [formGroup]="userProfileForm" (ngSubmit)="onSubmit()">
  <p>
    <label for="email">Email</label>
    <input id="email" type="email" formControlName="email" />
  </p>
  <p>
    <label for="firstName">First Name</label>
    <input id="firstName" type="text" formControlName="firstName" />
  </p>
  <p>
    <label for="lastName">Last Name</label>
    <input id="lastName" type="text" formControlName="lastName" />
  </p>
  <p>
    <button type="submit">Submit</button>
  </p>
</form>
```

在示例代码中，我们可以看到模板与模板驱动表单非常相似。唯一的区别在于我们使用 `formGroup` 和 `formControlName` 指令来绑定表单。`formGroup` 指令用于绑定组件类中的 `userProfileForm` 表单组；另一方面，`formControlName` 指令用于绑定在 `userProfileForm` 表单组中定义的各个表单控件的值与状态。最后，我们依然使用 `ngSubmit` 事件在点击表单中的 **Submit** 按钮时调用提交方法。

现在我们已经了解了如何创建基础响应式表单，接下来让我们深入探究 `FormControl`，看看是什么让它成为 Angular 响应式表单 API 中如此强大的基石。

## 使用表单控件（Working with form controls）

在本节中，我们将深入探讨响应式表单中表单控件的概念。虽然我们在上一节中已经创建了表单控件的示例，但现在我们将全面剖析 Angular 中表单控件的丰富函数与核心能力。

一个 `FormControl` 实例代表一个单一的输入字段。它存储该字段的当前值、校验状态以及交互元数据（例如用户是否已与其发生交互）。你可以将其与 `<input>`、`<textarea>` 或 `<select>` 等输入元素配合使用。与模板驱动表单不同，所有这些控制逻辑都完全驻留在组件类中。接下来，让我们看看表单控件的各种方法与特性。

### 常用方法与属性（Common methods and properties）

每个 `FormControl` 实例都继承自 `AbstractControl`，后者提供了大量用于与表单值和状态交互的实用方法：

- `setValue()`：为控件设置新值的方法。

**接受的参数**：
- `value`：赋给表单控件的新值。
- `options`：一个对象，用于配置控件在值发生变更时如何传播变更并触发事件。我们可以配置以下选项：
  - `onlySelf`：当设置为 `true` 时，该控件的变更不会向上传播影响其他父级或兄弟控件。
  - `emitEvent`：当设置为 `true`（或未指定，因为 `true` 是默认值）时，当表单控件的状态和值更新时，将触发并派发 `statusChanges` 和 `valueChanges` 可观察流（Observables）。
  - `emitModelToViewChange`：当设置为 `true`（或未指定，默认为 `true`）时，表单控件的变更将调用 `onChange` 回调以更新视图。
  - `emitViewToModelChange`：当设置为 `true`（或未指定，默认为 `true`）时，视图的变更将触发 `ngModelChange` 事件以更新模型。

使用 `setValue()` 方法的代码签名如下：

```typescript
setValue(value: TValue, options?: { onlySelf?: boolean; emitEvent?: boolean; emitModelToViewChange?: boolean; emitViewToModelChange?: boolean; }): void
```

- `patchValue()`：修补（部分更新）控件的值。`patchValue` 方法接受的参数与 `setValue()` 方法完全一致。

使用 `patchValue()` 方法的代码签名如下：

```typescript
patchValue(value: TValue, options?: { onlySelf?: boolean; emitEvent?: boolean; emitModelToViewChange?: boolean; emitViewToModelChange?: boolean; }): void
```

- `getRawValue()`：检索表单控件的原始值。在包含处于禁用（`disabled`）状态的表单控件时尤其实用。

使用 `getRawValue()` 方法的代码签名如下：

```typescript
getRawValue(): TValue
```

- `reset()`：将表单控件重置为其默认值，同时将控件标记为未修改（`pristine`）和未触碰（`untouched`）。

**接受的参数**：
- `formState`：定义控件的初始值以及禁用状态。
- `options`：一个配置对象，定义控件在重置时如何传播变更并派发事件：
  - `onlySelf`：当设置为 `true` 时，该控件的重置操作不会影响其他控件。
  - `emitEvent`：当设置为 `true`（默认值）时，派发 `statusChanges` 和 `valueChanges` 可观察流。

使用 `reset()` 方法的代码签名如下：

```typescript
reset(formState?: TValue | FormControlState<TValue>, options?: { onlySelf?: boolean; emitEvent?: boolean; }): void
```

我们已经学习了可以在表单控件中调用的各种方法。现在，让我们看一些表单控件不同用法的具体示例。

### 初始化表单控件（Initializing form controls）

初始化表单控件有多种方式。我们可以为特定表单控件设置初始值、禁用状态以及校验器。现代 Angular 通过配置对象模式提供了更完善的类型安全和更清晰的语法。让我们来看看以下示例：

- **使用初始值初始化表单控件**：

```typescript
// 具备类型安全的现代化方式
const control = new FormControl('Some text', { nonNullable: true });
console.log(control.value); // 'Some text' (类型推导为 string，而非 string | null)

// 传统方式 (依然有效)
const legacyControl = new FormControl('Some text');
console.log(legacyControl.value); // 'Some text' (类型推导为 string | null)
```

在上述代码中，我们通过配置对象实例化了表单控件。通过 `nonNullable: true`，控件的值被严格类型化为 `string`。

- **使用初始值与禁用状态初始化表单控件**：

```typescript
const control = new FormControl(
  { value: 'Some text', disabled: true },
  { nonNullable: true }
);
console.log(control.value, control.status); // 'Some text', 'DISABLED'
```

在上述代码中，我们使用状态对象作为初始值实例化了表单控件。这同时初始化了控件的值和禁用状态。我们可以通过读取继承自 `AbstractControl` 的 `status` 属性来获取其状态。

- **使用初始值和内置校验器数组初始化表单控件**：

```typescript
const control = new FormControl('', {
  validators: [Validators.email, Validators.required],
  nonNullable: true
});
// 获取状态
console.log(control.status); // 'INVALID'
```

我们在上述代码中使用空字符串实例化了表单控件。校验器数组中同时包含了邮箱格式校验与必填字段校验。由于字段当前为空且不符合合法邮箱格式，因此其状态将返回 `INVALID`。

### 重置表单控件（Resetting form controls）

我们可以使用 `reset()` 方法来重置表单控件的值和状态。其具体行为取决于我们是否传入了参数，以及该控件在声明时是否指定了 `nonNullable`。让我们来看以下不同用法的代码示例：

- **将控件重置为特定值**：

```typescript
const control = new FormControl('Text');
console.log(control.value); // 'Text'
control.reset('No Text');
console.log(control.value); // 'No Text'
```

在上述代码中，我们调用带有实参的 `reset()` 方法。传入的参数允许我们将表单控件显式重置为指定的新值。

- **不带参数重置控件**：

```typescript
const control = new FormControl('Text');
console.log(control.value); // 'Text'
control.reset();
console.log(control.value); // null
```

在不带任何参数调用 `reset()` 时，默认情况下控件会被重置为 `null`，而不是恢复为其构造函数中传入的初始值。因此对于任何可为空的控件（在 Angular 中控件默认均为 nullable），`null` 即是其回退重置值。

- **将控件重置为初始默认值**：

```typescript
const control = new FormControl('Text', { nonNullable: true });
console.log(control.value); // 'Text'
control.reset();
console.log(control.value); // 'Text'
```

为了让 `reset()` 能够准确恢复传递给构造函数的初始值，我们需要将该控件声明为 `nonNullable`。设置 `nonNullable: true` 后，初始值会在内部被持久保存为控件的 `defaultValue`，调用 `reset()` 时便会回退到 `defaultValue` 而非退化为 `null`。

### 监听事件（Listening to events）

在使用表单控件时，我们可以监听多种事件流（例如值变更与状态变更），而在现代 Angular 中，我们应当通过 Signals 来桥接这些事件以获得更出色的响应式能力。让我们看看以下监听表单控件事件的代码示例：

- **监听值变更（Value Changes）**：

```typescript
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

control = new FormControl('', { nonNullable: true });

// 将监听流转换为 Signal
readonly controlValue = toSignal(this.control.valueChanges, {
  initialValue: this.control.value
});

// 在模板中，我们现在可以直接使用：{{ controlValue() }}
// 当控件值发生改变时，该 signal 将自动同步更新

// 编程式修改控件值的示例
this.control.setValue('Fantasy');

// controlValue 信号将自动响应并反映此项变更
```

在上述代码中，我们使用 `toSignal()` 将 `valueChanges` 属性转换为 Signal。每当表单控件的值通过用户界面输入或编程式调用发生变更时，`valueChanges` 就会派发新值。Signal 方案消除了手动管理订阅与退订（Unsubscribe）的样板代码，并能更无缝地融入 Angular 的现代化变更检测体系。

- **监听状态变更（Status Changes）**：

```typescript
readonly controlStatus = toSignal(this.control.statusChanges, {
  initialValue: this.control.status
});

readonly isControlValid = toSignal(
  this.control.statusChanges.pipe(
    map(status => status === 'VALID')
  ),
  { initialValue: this.control.valid }
);

// 编程式状态变更会自动更新信号
this.control.disable();
console.log(this.controlStatus()); // 'DISABLED'

this.control.enable();
console.log(this.controlStatus()); // 'INVALID'（若存在未通过的校验器）

// 在模板中直接使用该信号：
// @if (controlStatus() === 'INVALID') { <span>Fix errors</span> }
```

在上述代码中，我们既追踪了原始状态流，又派生出了用于判断校验是否通过的布尔型 Signal。每当控件的状态在 `VALID`、`INVALID`、`PENDING` 或 `DISABLED` 之间转换时，`statusChanges` Observable 都会派发事件。基于 Signal 的方案使我们能够构建出当底层表单控件状态变化时自动更新的响应式计算值。

我们已经全面掌握了表单控件的特性与功能；接下来，我们将讨论如何利用表单组（`FormGroup`）和表单数组（`FormArray`）对表单控件进行编组与管理。

## 组合表单控件（Grouping form controls）

表单通常包含多个互相关联的控件，对它们进行逻辑编组能够赋予表单更清晰的层次结构，使其更易于阅读、校验并作为一个整体进行提交。响应式表单提供了两种编组原语：

- `FormGroup`：一组固定的具名表单控件集合，类似于 JavaScript 对象。每个子控件均通过键名访问（例如 `form.controls.email`）。当表单的字段结构在设计期就已经确定时（例如包含邮箱和密码的登录表单），请使用 `FormGroup`。`FormGroup` 还可以包含嵌套的 `FormGroup`，用于表达如 `billingAddress`（账单地址）和 `shippingAddress`（配送地址）等结构化模块。
- `FormArray`：一个有序且动态的表单控件列表，类似于 JavaScript 数组。每个子控件均通过数字索引访问（例如 `form.controls.tags.at(0)`）。当控件的数量无法预先得知、用户可以在运行时动态添加或删除项目时（例如图书的标签列表、电话号码列表或共同作者列表），请使用 `FormArray`。

### 创建表单组（Creating form groups）

表单组允许我们按分组统一管控表单控件的值与状态。我们也可以通过控件名称访问表单组内部的单一表单控件。要创建表单组，请按照以下步骤操作：

1. 假设我们要构建一个注册（`Signup`）表单。第一步是从 `@angular/forms` 包中导入 `FormGroup` 和 `FormControl` 类：

```typescript
import { FormGroup, FormControl } from '@angular/forms';
```

2. 下一步是创建 `FormGroup` 实例。在本例中，我们创建一个包含 `firstName`、`lastName` 和 `password` 三个表单控件的新表单组：

```typescript
export class Signup {
  signupForm = new FormGroup({
    firstName: new FormControl('', { nonNullable: true }),
    lastName: new FormControl('', { nonNullable: true }),
    password: new FormControl('', { nonNullable: true })
  });

  // 基于 Signal 的表单状态追踪
  readonly formValue = toSignal(this.signupForm.valueChanges, {
    initialValue: this.signupForm.value
  });
}
```

在上述代码中，我们创建了一个名为 `signupForm` 的新表单组。同时，我们传入了一个包含三个表单控件的对象作为 `signupForm` 的配置参数。`nonNullable: true` 选项通过防止值退化为 `null` 确保了类型安全。我们还添加了基于 Signal 的响应式状态追踪，以便更好地与 Angular 现代响应式系统集成。

3. 下一步是将我们的 `formGroup` 实例绑定到视图中的表单元素：

```html
<form [formGroup]="signupForm">
  <label for="first-name">First Name: </label>
  <input id="first-name" type="text"
    formControlName="firstName">
  <label for="last-name">Last Name: </label>
  <input id="last-name" type="text"
    formControlName="lastName">
  <label for="password">Password: </label>
  <input id="password" type="password"
    formControlName="password">
</form>
```

在上述代码中，我们使用 `formGroup` 指令将 `signupForm` 绑定到 `<form>` 元素上。同时，我们必须使用 `formControlName` 指令将每个表单控件与具体的 input 元素建立映射。

4. 最后一步是获取整个表单组的值。我们将使用 `ngSubmit` 事件调用提交方法，并通过读取 `value` 属性检索表单数据：

```html
<!-- signup.html -->
<form [formGroup]="signupForm" (ngSubmit)="onSubmit()">
```

```typescript
// signup.ts
onSubmit() {
  // 将表单组的值作为 JSON 打印输出
  console.log(this.signupForm.value);
}
```

我们已经创建并绑定了一个基础表单组，但这仅是一个展现控件线性扁平结构的简单表单。现在，让我们来创建包含子表单组的嵌套结构。

### 创建嵌套表单组（Creating nested form groups）

表单组除了容纳扁平的控件列表外，还可以容纳另一个表单组。想象一个 JSON 对象的某些属性值本身又是另一个复杂的 JSON 对象。简单的扁平表单控件集合无法胜任这种层级结构，因此我们需要创建嵌套表单组来精准映射此类对象。

按照以下步骤即可构建嵌套表单组：

1. 我们将沿用前面的表单示例。但这一次，我们希望在表单中新增一个 `address`（地址）属性；我们不再将其声明为单一的表单控件，而是将其声明为一个新的 `FormGroup` 实例：

```typescript
export class Signup {
  signupForm = new FormGroup({
    firstName: new FormControl('', { nonNullable: true }),
    lastName: new FormControl('', { nonNullable: true }),
    password: new FormControl('', { nonNullable: true }),
    address: new FormGroup({
      street: new FormControl('', { nonNullable: true }),
      city: new FormControl('', { nonNullable: true }),
      country: new FormControl('', { nonNullable: true })
    })
  });

  // 访问嵌套表单组的 Getter
  get addressGroup() {
    return this.signupForm.get('address') as FormGroup;
  }
}
```

在上述代码中，我们将 `address` 属性添加为新的表单组实例。我们还在该表单组内部添加了三个新的表单控件——即 `street`（街道）、`city`（城市）与 `country`（国家）。这便构成了一个**嵌套表单组（Nested form group）**。

2. 下一步是将嵌套表单组绑定到视图中的对应 DOM 元素：

```html
<div formGroupName="address">
  <label for="street">Street:</label>
  <input id="street" type="text"
    formControlName="street">
  <label for="city">City: </label>
  <input id="city" type="text"
    formControlName="city">

  <label for="country">Country: </label>
  <input id="country" type="text"
    formControlName="country">
</div>
```

在上述代码中，我们使用 `formGroupName` 指令绑定了 `address` 表单组。请牢记，该容器元素必须嵌套在父级 `signupForm` 表单组之内。我们同样使用 `formControlName` 指令绑定嵌套表单组下的各个子控件。此时，我们依然可以如先前一样利用 `ngSubmit` 事件并访问 `value` 属性，直接获取包含嵌套对象结构的完整表单数据。

我们已经使用表单组创建了简单和复杂的表单。现在让我们讨论另一种编组控件的方式——表单数组（`FormArray`）。

### 创建表单数组（Creating form arrays）

表单数组非常实用，特别是当我们希望在运行时动态添加或移除表单控件时。它使我们的应用表单具备极高的灵活性，同时能够处理更加复杂的列表型对象结构。要创建表单数组，请参考以下实现步骤：

1. 我们继续沿用前面的表单示例。在此场景下，我们希望在表单中新增一个 `genres` 属性（以便用户录入他们喜爱的图书流派），并将其声明为新的 `FormArray` 实例：

```typescript
export class Signup {
  signupForm = new FormGroup({
    firstName: new FormControl('', { nonNullable: true }),
    lastName: new FormControl('', { nonNullable: true }),
    password: new FormControl('', { nonNullable: true }),
    genres: new FormArray<FormControl<string>>([])
  });

  // 强类型的 Getter，便于便捷访问
  get genresArray() {
    return this.signupForm.get('genres') as FormArray<FormControl<string>>;
  }

  // 基于 Signal 的动态控件列表
  readonly genreControls = toSignal(
    this.genresArray.valueChanges.pipe(
      map(() => this.genresArray.controls)
    ),
    { initialValue: this.genresArray.controls }
  );
}
```

在上述代码中，我们在 `signupForm` 表单组内部集成了名为 `genres` 的 `FormArray` 实例。`FormArray` 初始化为空数组，这意味着用户初始时没有任何流派字段，并可按需动态追加。强类型的 Getter 为我们在整个组件中访问该数组提供了干净统一的入口，确保类型安全并获得更好的 IDE 智能感知支持。我们还基于 `FormArray` 的 `valueChanges` 可观察流派生出了 `genreControls` Signal；这一设计对于我们的应用至关重要，因为本项目采用了**无 Zone.js 变更检测（Zoneless Change Detection）**模式，在此模式下模板仅在其读取的 Signal 发生变化时才会触发重新渲染。

2. 下一步是编写能够在表单数组中动态添加和删除表单控件实例的方法：

```typescript
addGenre() {
  const newGenreControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required]
  });
  this.genresArray.push(newGenreControl);
}

removeGenre(index: number) {
  if (this.genresArray.length > 1) {
    this.genresArray.removeAt(index);
  }
}

clearAllGenres() {
  this.genresArray.clear();
}
```

在上述代码中，我们创建了操作表单数组的三个方法。`addGenre()` 方法创建附带校验规则的新表单控件实例，并将其追加到 `genres` 表单数组中，瞬间动态扩展表单。另一方面，`removeGenre()` 方法安全地移除指定索引处的控件。其中的防护守卫 `length > 1` 确保在数组已录入内容时始终至少保留一项；模板也通过在仅剩一项时禁用删除按钮来强制执行这同一规则，从而保证了业务方法与 UI 表现的高度一致。`clearAllGenres()` 方法则演示了在需要时如何快速清空整个数组。

3. 最后一步是将表单数组实例绑定到视图中的表单元素：

```html
<div formArrayName="genres">
  <label for="genres">Favorite Book Genres</label>
  @for (genre of genreControls(); track $index; let i = $index) {
    <div class="input-group mb-3">
      <input
        type="text"
        class="form-control"
        [formControlName]="i"
        placeholder="Enter a book genre (e.g. Fantasy, Mystery)"
      />
      <button
        type="button"
        class="btn btn-danger"
        [disabled]="genresArray.length <= 1"
        (click)="removeGenre(i)"
      >
        Delete
      </button>
    </div>
  } @empty {
    <p>No genres added yet. Click "Add Genre" to begin.</p>
  }
  <button class="btn btn-info me-md-2"
    type="button" (click)="addGenre()">
    Add
  </button>
</div>
```

在上述代码中，我们使用了 Angular 现代的 `@for` 控制流语法来遍历 `genreControls()`——即派生自 `FormArray` 的 `valueChanges` 可观察流的 Signal。因为我们的应用采用了 Zoneless 变更检测，`@for` 循环必须读取 Signal 才能在增删条目时自动重新渲染；`genreControls()` 精准地提供了这一机制，它在由 `addGenre()`、`removeGenre()` 或 `clearAllGenres()` 触发的每一次结构性变动时都会发出更新。

每个控件都将其索引数字作为 `formControlName` 指令的参数进行绑定，从而在动态数组与 UI 之间建立了无缝连接。`@empty` 块在尚无任何流派条目时提供友好的操作引导，显著提升用户体验。删除按钮包含了智能禁用逻辑，以便在需要时保留至少一个输入框；而基于 `$index` 的 track 函数则确保了在增删条目时 DOM 更新的高性能。

我们已经成功运用表单组和表单数组构建了响应式表单。接下来，我们将探讨 `FormBuilder` 服务，它能够极大简化在应用程序中声明表单的语法复杂度。

## 使用 FormBuilder 服务生成控件（Using the FormBuilder service to generate controls）

在前面的小节中，我们通过手动实例化 `FormGroup`、`FormArray` 和 `FormControl` 对象来创建响应式表单。例如，定义一个带有校验规则的单一非空控件需要编写：

```typescript
firstName: new FormControl('', {
  validators: [Validators.required],
  nonNullable: true
})
```

随着表单复杂度的增长，对每个字段重复这种模式会产生冗长、充斥着模板样板代码的实现，使得阅读和维护变得更加困难。`FormBuilder` 完美化解了这一痛点：它提供了一套简洁的工厂方法，以显著精简的代码生成完全相同的底层对象，使表单定义在需求演进时更易于扫读与修改。

`FormBuilder` 是一个 Angular 依赖注入服务，通过工厂方法简化表单构建。与其手动实例化各个表单控件类，不如使用 `FormBuilder` 提供的快捷方法以更清爽的语法生成相同对象。在字段多达数十个且伴随复杂校验规则的企业级应用中，这种方法带来的收益尤为显著。

要使用 `FormBuilder` 创建响应式表单，请遵循以下步骤：

1. 第一步是从 `@angular/forms` 将 `FormBuilder` 服务导入到我们的组件中：

```typescript
import { FormBuilder } from '@angular/forms';
```

2. 下一步是通过依赖注入获取服务，并利用 `FormBuilder` 的方法创建和生成控件：

```typescript
export class Signup {
  private fb = inject(FormBuilder);

  signupForm = this.fb.group({
    firstName: this.fb.control('', {
      validators: [Validators.required],
      nonNullable: true
    }),
    lastName: this.fb.control('', {
      validators: [Validators.required],
      nonNullable: true
    }),
    password: this.fb.control('', {
      validators: [Validators.required, Validators.minLength(8)],
      nonNullable: true
    }),
    address: this.fb.group({
      street: this.fb.control('', { nonNullable: true }),
      city: this.fb.control('', { nonNullable: true }),
      country: this.fb.control('', { nonNullable: true })
    }),
    genres: this.fb.array<string>([])
  });

  // 基于 Signal 的表单状态追踪
  readonly formValue = toSignal(this.signupForm.valueChanges, {
    initialValue: this.signupForm.value
  });

  // 便捷访问 genres 表单数组
  get genresArray() {
    return this.signupForm.get('genres') as FormArray<FormControl<string>>;
  }
}
```

3. 最后一步是迁移流派辅助方法，同样使用 `FormBuilder` 服务提供的方法：

```typescript
addGenre() {
  const newGenreControl = this.fb.control('', {
    validators: [Validators.required],
    nonNullable: true
  });
  this.genresArray.push(newGenreControl);
}

// 其余方法保持不变
```

你可能已经注意到，我们在每个控件定义上都反复声明了 `nonNullable: true`。这对于类型安全是必不可少的；若缺少此配置，每个控件的值类型都会包含 `null`，从而迫使我们在整个代码中充斥着不必要的空值检查。然而，Angular 专门提供了 `NonNullableFormBuilder` 来彻底消除这种重复。我们可以直接通过 `this.fb.nonNullable` 访问它：

```typescript
export class Signup {
  private fb = inject(FormBuilder);

  signupForm = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(8)]],
    address: this.fb.nonNullable.group({
      street: [''],
      city: [''],
      country: ['']
    }),
    genres: this.fb.nonNullable.array<string>([])
  });
}
```

借助 `this.fb.nonNullable`，在该构建器作用域内创建的每一个控件都会默认采用非空类型，在绝不牺牲类型安全的前提下生成极其清爽的表单定义。请留意语法变得何其精简：我们可以使用简洁的数组字面量记法 `['', Validators.required]`，彻底取代冗长的 `this.fb.control('', { validators: [Validators.required], nonNullable: true })`。这两种方式生成的底层对象完全等价，因此在二者之间做出选择纯粹取决于团队的可读性偏好。在*第 14 章*构建书店表单时，我们将全面采用这种 `NonNullableFormBuilder` 简写模式。

上述代码的实际运行表现与前一节完全一致。`FormBuilder` 方法的核心价值在于使响应式表单的代码结构保持高度整洁且具备极佳的可读性。

现在，我们将深入探讨如何为表单控件添加校验逻辑。

## 校验表单输入（Validating form input）

在上一节中，我们已经成功创建并精简了响应式表单，但我们还需要确保表单能够准确接收合法数据，同时提供友好的用户体验，让用户能直观获知每个输入项的合法取值规则。现在，我们将学习如何为响应式表单添加校验。

在响应式表单中，校验器是直接作为参数传递给组件类中的表单控件的，而非作为属性写在 HTML 模板中。默认情况下，Angular 响应式表单会在每次击键时立即触发校验（即 `change` 策略）。虽然这能提供即时反馈，但有时会显得过于激进——例如在用户还在输入过程中就过早弹出错误警告。为此，Angular 提供了 `updateOn` 选项，用于精确控制表单何时更新值并执行校验：

```typescript
// 仅在用户离开输入框失焦时触发校验
email: this.fb.control('', {
  validators: [Validators.required, Validators.email],
  nonNullable: true,
  updateOn: 'blur'
})

// 仅在表单提交时触发校验
signupForm = this.fb.group({
  firstName: [''],
  lastName: [''],
}, { updateOn: 'submit' })
```

Angular 提供了三种可选的触发策略：

- `change`（默认策略）：在每一次输入事件发生时立即更新，最适合实时搜索建议或需要即时响应的交互场景。
- `blur`：在输入字段失去焦点时更新，非常适合不希望在用户输入半途中打扰用户的表单字段。
- `submit`：仅在表单提交时统一更新，适用于无需行内即时反馈的极简表单。

在 `FormGroup` 级别配置 `updateOn` 会自动应用到其下所有子控件，除非个别子控件显式覆盖了该配置。在*第 14 章*中，我们将在特定字段上使用 `blur` 来打造更为丝滑优雅的校验体验。

### 内置校验器（Built-in validators）

Angular 提供了多个开箱即用的内置校验函数，可以直接在表单中使用。让我们了解其中最核心的几类：

- **数值范围校验（`min` 与 `max`）**：`Validators.min()` 和 `Validators.max()` 函数确保数值落入指定区间，非常适合校验年龄、折扣百分比、库存数量等数值型输入：

```typescript
// 最小值校验
form = this.fb.group({
  age: this.fb.control(25, {
    validators: [Validators.min(18)],
    nonNullable: true
  })
});
console.log(this.form.get('age')?.status); // 'VALID' (25 >= 18)

// 最大值校验
form = this.fb.group({
  discount: this.fb.control(15, {
    validators: [Validators.max(50)],
    nonNullable: true
  })
});
console.log(this.form.get('discount')?.status); // 'VALID' (15 <= 50)
```

- **必填项校验（`required`）**：`Validators.required` 函数确保表单控件具备非空值，对于电子邮箱或用户名等必填字段至关重要：

```typescript
form = this.fb.group({
  email: this.fb.control('user@example.com', {
    validators: [Validators.required, Validators.email],
    nonNullable: true
  })
});
console.log(this.form.get('email')?.status); // 'VALID'
```

> **注意**
>
> **布尔值校验（`requiredTrue`）**：`Validators.requiredTrue` 函数用于校验表单控件的值必须严格为 `true`。该校验器常用于诸如“服务条款与隐私协议”等必须由用户明确勾选同意的复选框场景：

```typescript
form = this.fb.group({
  acceptTerms: this.fb.control(true, {
    validators: [Validators.requiredTrue],
    nonNullable: true
  })
});
console.log(this.form.get('acceptTerms')?.status); // 'VALID'
```

- **字符串长度校验（`minLength` 与 `maxLength`）**：`Validators.minLength()` 和 `Validators.maxLength()` 函数对字符串输入的字符长度施加约束，确保用户名、密码或简介描述等字段满足最小和最大字符长度要求：

```typescript
form = this.fb.group({
  username: this.fb.control('john_doe', {
    validators: [
      Validators.required,
      Validators.minLength(3),
      Validators.maxLength(20)
    ],
    nonNullable: true
  })
});
console.log(this.form.get('username')?.status); // 'VALID'
```

- **正则表达式模式匹配校验（`pattern`）**：`Validators.pattern()` 函数使用正则表达式验证输入，支持对电话号码、邮政编码、自定义标识符等结构化文本格式进行严格校验：

```typescript
form = this.fb.group({
  phoneNumber: this.fb.control('123-456-7890', {
    validators: [
      Validators.required,
      Validators.pattern(/^\d{3}-\d{3}-\d{4}$/)
    ],
    nonNullable: true
  })
});
console.log(this.form.get('phoneNumber')?.status); // 'VALID'
```

### 自定义校验器（Custom validators）

虽然内置校验器涵盖了大多数通用场景，但现实世界的业务应用通常需要处理特定于业务领域的校验逻辑。自定义校验器允许我们实现业务规则、跨字段校验以及 Angular 标准校验器未覆盖的复杂数据核验。

让我们来看以下自定义校验器的实现示例：

```typescript
import { AbstractControl, ValidationErrors, ValidatorFn } from "@angular/forms";

export function noNumbersValidator(): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    if (!control.value) return null; // 对空值不进行校验，交给 required 负责

    const hasNumbers = /\d/.test(control.value);
    return hasNumbers ? { noNumbers: { value: control.value } } : null;
  };
}
```

该自定义校验器严格遵循 Angular 校验函数的标准签名。它接收一个 `AbstractControl` 实例，并返回 `null`（表示输入合法有效）或包含错误详细信息的 `ValidationErrors` 对象。错误对象使用具有描述性的键名（`noNumbers`），并将导致错误的非法值包含在内以便于调试与提示。

成功创建自定义校验器后，我们就可以像使用内置校验器一样将其配置在控件中：

```typescript
signupForm = this.fb.group({
  // ..其他字段
  address: this.fb.group({
    street: this.fb.control('', { nonNullable: true }),
    city: this.fb.control('', {
      validators: [noNumbersValidator()],
      nonNullable: true
    }),
    country: this.fb.control('', { nonNullable: true })
  }),
  genres: this.fb.array<string>([])
});
```

在上述示例代码中，我们希望城市（`city`）字段仅包含纯字母字符。在此场景下，我们将 `noNumbersValidator()` 作为参数传递给 `city` 控件的 `validators` 数组。

### 跨字段校验器（Cross-field validators）

单字段校验器仅孤立地作用于单一控件。然而，某些业务规则涉及到两个或多个字段之间的逻辑联动，最典型的例子便是密码确认（Password Confirmation）——其中每个字段单独看可能都是合法的，但如果两者内容不匹配，整个表单就应当处于无效状态。

针对此类场景，Angular 支持在 `FormGroup` 级别而非单一控件级别挂载校验器，从而让校验器能够直接访问整个表单组。跨字段校验器遵循相同的 `ValidatorFn` 函数签名，但它接收的 `AbstractControl` 参数实际为整个 `FormGroup` 实例：

```typescript
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

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

由于校验器接收到的是表单组实例，它可以通过 `group.get()` 自由读取其内部包含的任意子控件。当密码一致时返回 `null`，不一致时则返回 `{ passwordMismatch: true }` 错误对象。

在应用该校验器时，务必将其传递给统筹这组比较字段的 `FormGroup` 的 `validators` 配置项，而非挂载在任何单一子控件上：

```typescript
signupForm = this.fb.nonNullable.group({
  // ..其他字段
  passwords: this.fb.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
  }, { validators: [passwordMatchValidator()] })
});
```

该校验器的作用域被严格限定在嵌套的 `passwords` 表单组中，这使得密码比对逻辑与表单的其余部分隔离开来。由于错误直接归属于该表单组而非任何单一子控件，因此在模板中检查错误时需要以该表单组为目标：

```html
@if (signupForm.get('passwords')?.hasError('passwordMismatch')
  && signupForm.get('passwords')?.touched) {
  <span class="error">Passwords do not match.</span>
}
```

我们将在*第 14 章*的书店注册表单中完整落地这一模式，届时 `passwordMatchValidator()` 将与其他自定义校验器一同守护书店的数据安全。

### 异步校验器（Async validators）

我们目前介绍的校验器已能覆盖大多数场景，但某些校验规则只能由服务端给出裁决——例如检查用户名或电子邮箱是否已被其他用户注册。针对这些场景，Angular 提供了**异步校验器（Async validators）**：它们不直接返回结果，而是返回一个 `Promise` 或 `Observable`，允许表单控件等待异步响应就绪后再判定其最终有效性状态。

异步校验器遵循与同步校验器相同的工厂函数模式，但其返回类型为 `AsyncValidatorFn`：

```typescript
import { AbstractControl, ValidationErrors, AsyncValidatorFn } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';

export function uniqueUsernameValidator(): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    // 模拟带有 300 毫秒延迟的 API 网络请求
    const takenUsernames = ['admin', 'johndoe', 'testuser'];
    return of(takenUsernames.includes(control.value)).pipe(
      delay(300),
      map(isTaken => (isTaken ? { usernameTaken: true } : null))
    );
  };
}
```

该校验器使用 `of()` 和 `delay()` 模拟了一次服务端网络往返。在真实生产应用中，你只需将其替换为对后端 API 的 HTTP 真实调用。其返回类型 `Observable<ValidationErrors | null>` 与同步模式呼应：`null` 表示合法有效，错误对象则表示校验失败。

异步校验器通过 `asyncValidators` 选项传入，与同步校验器完全分离：

```typescript
username: this.fb.control('', {
  validators: [Validators.required, Validators.minLength(3)],
  asyncValidators: [uniqueUsernameValidator()],
  nonNullable: true,
  updateOn: 'blur' // 强烈推荐：避免每次击键都触发网络请求
})
```

在异步校验器执行期间，控件会进入 `PENDING`（挂起中）状态。你可以在模板中利用该状态向用户呈现加载指示器：

```html
@if (signupForm.get('username')?.status === 'PENDING') {
  <span>Checking availability...</span>
}
@if (signupForm.get('username')?.hasError('usernameTaken') &&
  signupForm.get('username')?.touched) {
  <span class="error">This username is already taken.</span>
}
```

请特别注意 `updateOn: 'blur'` 的配置。由于异步校验器通常伴随着真实网络请求，若在每次击键时都触发校验，势必会向服务端倾泻大量不必要的无用 API 调用。将异步校验器与 `blur` 策略相结合，能够确保仅在用户输入完毕并离开输入框时才发起校验请求。

### 在模板中显示校验错误（Displaying validation errors in templates）

编写校验器只完成了表单交互的一半；我们还需要以清晰、及时的方式向用户呈现校验错误。Angular 在 `AbstractControl` 上提供了多种实用方法，使我们能够编程式检查特定错误并精准控制错误提示信息的展示时机，从而营造出丝滑的用户体验。

每个 `FormControl` 均暴露了 `hasError()` 方法和 `errors` 属性，方便我们编程式检查校验状态：

```typescript
// 检查特定错误
this.signupForm.get('email')?.hasError('required')    // 返回 true 或 false
this.signupForm.get('email')?.hasError('email')        // 返回 true 或 false

// 获取控件上的全部错误对象
this.signupForm.get('email')?.errors
// 示例返回值: { required: true } 或 { email: true }，校验通过时返回 null
```

然而，通常情况下我们绝不希望在表单初次加载时就向用户展示错误信息——因为此时用户甚至都还没来得及与表单发生任何交互。Angular 在每个控件上贴心地追踪了两种关键交互状态：`touched`（用户曾聚焦过该输入框并随后移开了焦点）与 `dirty`（用户已实际更改过输入框的值）。我们将这些交互状态与错误检查相结合，通过 Angular 现代的 `@if` 控制流来按需展示上下文错误提示：

```html
<form [formGroup]="signupForm" (ngSubmit)="onSubmit()">
  <label for="email">Email</label>
  <input id="email" type="email" formControlName="email" />

  @if (signupForm.get('email')?.hasError('required')
       && signupForm.get('email')?.touched) {
    <span class="error">Email is required.</span>
  }
  @if (signupForm.get('email')?.hasError('email')
       && signupForm.get('email')?.touched) {
    <span class="error">Please enter a valid email address.</span>
  }

  <!-- 其他字段 -->

  <button type="submit" [disabled]="signupForm.invalid">Submit</button>
</form>
```

在行业实践中，让每条错误提示同时检查错误状态和用户交互状态是一种通用准则，这能确保错误信息只在用户真正操作过该字段后才呈现。提交按钮使用 `[disabled]="signupForm.invalid"` 来阻止在所有控件通过校验前提交表单。

需要指出的是，禁用提交按钮虽然是一种极其普遍且广泛使用的模式，但在无障碍辅助（Accessibility）方面存在一定的权衡考量：处于禁用状态的按钮会从键盘 Tab 聚焦顺序中被移除，导致键盘导航或屏幕阅读器用户无法聚焦该按钮。另一种替代方案是保持按钮始终处于启用状态，转而在 `onSubmit()` 内部进行业务拦截防护，并在用户点击提交时统一触发呈现所有未通过的错误提示。这两种模式均完全可行；在*第 14 章*中，我们将采用禁用方案，配合 Angular Material 的 `mat-raised-button`——它不仅在视觉上精准呈现禁用状态，还能通过 `mat-form-field` 和 `mat-error` 完备处理整个表单的无障碍辅助体验。

> **注意**
>
> **关于 Signal Forms 的说明**
>
> Angular 现已推出一套稳定且基于 Signal 的表单 API，称为 **Signal Forms**，它完全构建在 Signals 基础之上并具备头等类型安全。这是一项非常引人注目且值得探索的现代化方案。在本书中，我们主要使用通过 `toSignal()` 增强了 Signal 集成的响应式表单（Reactive Forms）API。响应式表单成熟且久经沙场检验；它是你在现存 Angular 代码库中最常见且最需要维护的模式，并且能与我们在后续章节中构建的 Angular Material 组件和 NgRx SignalStore 数据流无缝集成。你在本章学到的核心概念——控件（Controls）、表单组（Groups）、校验（Validation）与错误处理（Error Handling）——可以直接迁移映射到 Signal Forms，因此后续若采用该 API，这些知识完全适用。

## 本章小结（Summary）

在本章中，我们为 Angular 响应式表单建立了扎实完备的理论基础。你深入学习了 `FormControl`、`FormGroup` 和 `FormArray` 的基本概念，理解了它们如何紧密协同以构建出强大的表单拓扑结构。我们系统对比了模板驱动表单与响应式表单之间的本质区别，阐明了为何响应式表单在企业级应用中具备更卓越的控制力、可测试性与可伸缩性。你掌握了从内置校验器到自定义校验器的全套校验模式，并领会了 `FormBuilder` 服务如何以更清爽、更易维护的语法极大简化表单创建。我们还探讨了应对复杂数据结构的嵌套表单组，以及管理变长动态列表数据的动态表单数组等进阶特性。

掌握了这些坚实的理论基石，你现已准备就绪，可以自信地将这些核心知识投入到为我们的书店应用程序构建真实企业级表单的实践中。

在下一章中，我们将通过亲手为项目实现用户认证与图书管理的核心表单，将本章学到的理论全部转化为实战代码！
