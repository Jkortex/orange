---
title: 迪米特法则 / 最少知识原则 (Law of Demeter)
date: '2026-05-25'
tags:
  - 代码设计
  - 耦合度
  - 迪米特法则
  - 面向对象
category: laws
description: 只与你直接的朋友交谈，不要跟陌生人说话，最大程度降低类与类之间的耦合度。
---
在复杂的面向对象系统中，控制对象之间的复杂连线比设计对象本身更为关键。如果一个类知道太多其他类的内部结构细节，系统就会演变成一盘盘根错节的“意大利面条”。为了应对这一问题，1987 年秋天，美国东北大学（Northeastern University）的一项名为 Demeter 的研究项目中，Ian Holland 等人正式提出了 **迪米特法则 (Law of Demeter, LoD)**，亦称 **最少知识原则 (Least Knowledge Principle, LKP)**。它是指导软件松耦合设计的黄金法则。

---

## 1. 核心定律

> **“只与你直接的朋友谈话。”**
>
> _(“Only talk to your immediate friends.”)_

通俗地说：**一个对象应当对其他对象有尽可能少的了解。一个方法只能调用以下对象的方法，不能跨越它们去调用更深层对象的方法：**

1. **当前对象本身 (`this`)**
2. **作为参数传入该方法的方法参数对象**
3. **当前对象内部属性/成员变量所引用的对象**
4. **在该方法内部创建或实例化的局部对象**

**绝对禁止**调用由上述对象返回的更深层对象的任何方法（即禁止连续调用，如 `a.getB().getC().doSomething()`）。

---

## 2. 经验背后的本质

迪米特法则并不是一个强加的语法限制，而是为了解决深层耦合带来的软件维护灾难，其底层的软件力学逻辑包括：

### ① 消除“火车残骸”式的结构性耦合（Train Wreck Code）

当你在代码中写下 `customer.getWallet().getPaymentCard().charge(amount)` 时，看似只是简单的一行调用，其实它在底层强行绑定了三个不同的领域对象：`Customer`、`Wallet` 和 `PaymentCard`。

- 如果未来 `Customer` 的设计改了，钱包不再归 `Wallet` 类管理，或者 `PaymentCard` 的扣款方式变了，这段链式调用就会在编译期或运行期崩溃。
- 这条细长的调用链就像一列行驶中的火车，其中任何一节车厢（对象）出轨，都会导致整列火车惨烈颠覆。

### ② 信息隐藏与封装的尊严（Information Hiding & Tell, Don't Ask）

迪米特法则与 **“Tell, Don't Ask (吩咐，而不是询问)”** 原则高度一致。

- 糟糕的设计中，对象 A 不断向对象 B “询问”其内部属性（通过一层层的 Getter），并在 A 中亲自做判断和计算。这剥夺了对象 B 的封装主导权。
- 优雅的设计中，对象 A 直接向直接朋友 B 发出明确的行为“指令”，由 B 负责协调其内部更深层的属性来完成任务。对象 B 的内部实现对于 A 而言是不可见的“黑盒”。

### ③ 单元测试中 Mock 膨胀的防御（Reducing Mock Hell）

在为遵循迪米特法则的代码编写单元测试时，你只需要 Mock 你的直接依赖（直接朋友）。但对于一串长长的链式调用，你需要 Mock 每一个节点返回的临时对象（即 Mock 出来的对象又要返回一个 Mock 出来的 Wallet，Wallet 又要返回一个 Mock 出来的 Card...）。这种现象被称为 “Mock Hell (Mock地狱)”，是代码严重耦合的直接指征。

---

## 3. 实用案例分析

### 🚫 反面典型：某打车软件派单与结算模块的“越俎代庖”

某同城即时出行平台，需要实现乘客下车时的自动扣款功能。

#### 灾难设计

在结算模块 `BillingService` 中，开发人员写了以下扣款逻辑：

```java
// 严重违背迪米特法则的火车残骸代码
public class BillingService {
    public void processPayment(Trip trip, double amount) {
        Passenger passenger = trip.getPassenger();
        Wallet wallet = passenger.getWallet();
        PaymentChannel activeChannel = wallet.getActiveChannel();

        // BillingService 竟然直接插手了支付通道的具体扣减逻辑
        if (activeChannel.getBalance() >= amount) {
            activeChannel.deduct(amount);
        } else {
            throw new InsufficientBalanceException();
        }
    }
}
```

#### 崩溃场景

- 在这段代码中，`BillingService` 必须了解：`Trip` 里面有 `Passenger`，`Passenger` 里面有 `Wallet`，`Wallet` 里面有 `PaymentChannel`，甚至还亲自比对余额并操作扣款。
- 某天，为了合规风控，产品要求支持“混合支付”（即余额和微信联合扣税）。钱包的内部结构需要彻底重构，`Wallet` 不再暴露出一个唯一的 `activeChannel`。
- 这一改动直接导致 `BillingService` 编译报错。不仅如此，整个项目中所有调车、退单、风控等 8 个涉及 `passenger.getWallet()` 的微服务都必须重载和修改，开发团队不得不加班三天，逐个文件修正。

---

### ✅ 正面示范：完美封装后的“单点触达”与职责下放

架构师痛定思痛，应用迪米特法则对支付结算逻辑进行了重构。

#### 优雅设计

1. **职责内聚**：结算服务 `BillingService` 应当只跟它的直接朋友 `Trip` 或者 `Passenger` 沟通，它不需要知道钱包和通道的存在。
2. **委托逻辑**：将“扣款”这一复杂的内部控制决策，直接封装进 `Passenger`，由 `Passenger` 再下放给 `Wallet`。

```java
// 完美遵循迪米特法则的重构
public class BillingService {
    public void processPayment(Trip trip, double amount) {
        Passenger passenger = trip.getPassenger();
        // 1. BillingService 只与直接朋友 Passenger 说话
        // 2. 告诉 Passenger 去支付，具体的钱包扣款细节全部对 BillingService 屏蔽
        passenger.pay(amount);
    }
}

public class Passenger {
    private Wallet wallet;

    public void pay(double amount) {
        // Passenger 也只与直接朋友 Wallet 说话
        this.wallet.charge(amount);
    }
}
```

#### 重构收益

- 重构后，`BillingService` 的心智负担大为减轻，它只知道 `passenger.pay(amount)` 这一行契约。
- 当钱包的扣款逻辑从“单通道扣款”升级为“微信与支付宝多渠道混合扣款”甚至“先享后付”时，架构师只需要修改 `Wallet` 的内部实现，`Passenger` 和 `BillingService` 毫无察觉，完全免疫了底层的修改波及，做到了真正的“热插拔”与松耦合。

---

## 4. 行动指南

为了在实际工程中贯彻最少知识原则，研发团队需要树立以下开发规戒：

- **警惕过长的 Getter 调用链**：禁止写出超过两层以上的链式 `.` 调用（除流式 API/Builder 模式等无状态的方法链外）。任何出现 `a.getB().getC().doD()` 的代码都是 LoD 的严重警告，必须立即将逻辑封装进 B 的内部方法中。
- **牢记“吩咐，不要询问” (Tell, Don't Ask)**：尽量减少对象向外暴露只读属性（Getter），转而暴露具体行为（Method）。让对象内部管理自己的状态，外部对象只发出调用指令，而不是去获取状态自己做计算。
- **限制类的“社交圈”**：在设计类时，尽量使成员变量的类型是基础类或接口。类的公共方法数量（API 表面积）应当尽量保持小巧。如果一个类引用了过多的外部包和类，说明它的社交圈太广，需要做进一步的横向解耦或模块化裁剪。
