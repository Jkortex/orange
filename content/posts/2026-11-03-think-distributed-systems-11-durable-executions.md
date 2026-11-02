---
title: "Think Distributed Systems（十一）：持久执行——把失败关进平台层"
date: 2026-11-03T03:50:00Z
description: "两个原子动作的顺序组合并不原子，部分执行是分布式系统的原罪；持久执行通过日志重放或状态快照，让失败无感知的代码获得失败透明的执行。"
category: distributed-systems
column: think-distributed-systems
tags:
  - "持久执行"
  - "Saga"
  - "原子性"
  - "幂等性"
  - "工作流"
  - "前向恢复"
---

# 第 11 章：持久执行

本章涵盖：

- 短进程与长进程
- 无失败的定义
- 容忍失败的执行
- Saga 与持久执行的对比

**持久执行（durable execution）之于分布式系统，正如事务之于数据库**：一种把“失败可能发生”这件事隐藏起来的抽象。

## 11.1 部分执行的陷阱

> 在部分失败面前，即使最基础的推理规则也不再成立。
> ——Black、Cremet、Guerraoui、Odersky，《An Equational Theory for Transactions》

设想用户注册流媒体平台：平台先扣款，再开通内容库访问。代码看起来没问题，但它只处理了**happy path**：如果扣款成功、写库之前崩溃，用户被扣了钱却没有内容访问权。

这暴露了一个根本问题：**两个原子动作的顺序组合，本身并不原子。**

$$t\ |\ \text{crash} \equiv prefix\ t$$

理想情况下，执行应当是**失败透明**的：无失败执行，与“失败后恢复并继续”的执行不可区分。

$$t\ |\ \text{crash} \equiv t\ \text{or nothing}$$

> **顿悟时刻：原子性的两种含义**
>
> - **并发原子性**：进程执行在可观察层面等价于“不被打断”，中间状态对其他进程不可见——数据库称之为**隔离性**。
> - **失败原子性**：进程执行在可观察层面等价于“全有或全无”，但中间状态对其他进程**可见**。
>
> 并发原子性常常是“想要”，失败原子性常常是“必需”——否则系统无法从正确状态迁移到正确状态。

:::en
> **Original**: We've run into a fundamental problem in software engineering. The sequential composition of two atomic actions is not itself atomic, leaving us vulnerable to crash failure that results in partial execution. ... Ideally, the execution of a process is failure-transparent, meaning that a failure-free execution is indistinguishable from a failed execution that was subsequently recovered.

**📌 核心术语与语境解析**：
- **Failure atomicity**：*失败原子性*。全有或全无，允许中间状态被观察。
- **Failure transparency**：*失败透明*。外部无法区分“没失败”与“失败后恢复”。
:::

## 11.2 系统模型

> 程序员的活动在其构造出正确定义时并未结束；真正构成其活动主题的，是在该定义控制下发生的执行。
> ——E.W. Dijkstra

日常讨论中，我们常把**定义（代码）** 与**执行（运行中的代码）** 混为一谈。要建立清晰模型，必须区分：

- **failure-aware / failure-agnostic** 描述**定义**；
- **failure-free / failure-tolerant / failure-transparent** 描述**执行**。

### 11.2.1 进程定义

进程定义 P 是步骤 A、B……的序列，每一步都是**失败原子动作**：

$$P = A \cdot P' \mid \varepsilon$$

- A · P′：先执行原子动作 A，再表现得像后继进程 P′；
- ε：进程终止（本质上是成功终止）。

### 11.2.2 进程执行

对进程定义 P，执行是轨迹 t，P 的每一步 A 对应 t 中一个可观察事件 a。假设 Crash-Stop 失败（执行可在任意时刻停止）：

$$P = A \cdot B \cdot \varepsilon \Rightarrow t = \times \mid a \cdot \times \mid a \cdot b \cdot \checkmark$$

- ✓ 表示成功执行；
- × 表示崩溃失败。

显然：**单步进程的执行继承其步骤的失败原子性**；但**多步进程的执行不继承**——**失败原子性不可组合**。

> **顿悟时刻：短执行 vs. 长执行**
>
> Garcia-Molina 与 Salem 在《Sagas》中提出短执行与长执行：**短执行由单步构成，长执行由多步构成**。所以“长短”说的不是物理时间，而是**逻辑时间**——以步骤为刻度。

:::en
> **Original**: In our day-to-day conversations, we often blur the lines between definition (the code) and execution (the running code). ... Failure-aware and failure-agnostic are related to definitions, whereas failure-free, failure-tolerant, and failure-transparent are associated with executions.

**📌 核心术语与语境解析**：
- **Definition vs. execution**：*定义 vs. 执行*。静态代码与动态运行，失败语义分属两者。
- **Failure atomicity does not compose**：*失败原子性不可组合*。这是持久执行存在的根本理由。
:::

## 11.3 失败透明的恢复

若“无失败执行”产生的事件序列，与“失败—恢复—继续”产生的事件序列**等价**，则恢复是失败透明的。换言之，瞬态或间歇失败不能阻止执行跑到终点（永久失败则可以）。

本章只讨论**前向恢复**；后向恢复与补偿见第 3 章。

等价由**等价函数**判定，而等价函数是应用相关的——**由你来决定两个事件序列何时算等价**。

以打印 a 到 f 为例：

- 进程定义：P = A·B·C·D·E·F·ε；
- 无失败执行：t = a·b·c·d·e·f·✓。

常见的等价函数：

| 等价函数 | 失败后的轨迹 | 代价 |
| :--- | :--- | :--- |
| 恒等（identity） | a·b·c💥d·e·f·✓ | 等价于 exactly-once，通常不可达 |
| 允许重复最后一个事件 | a·b·c💥c·d·e·f·✓ | 只需最后一步幂等 |
| 允许重复最后 n 个事件 | a·b·c💥b·c·d·e·f·✓ | 需要回退窗口内幂等 |
| 重启（restart） | a·b·c💥a·b·c·d·e·f·✓ | 整段重放，要求全部幂等 |

:::en
> **Original**: Recovery of a process is considered failure-transparent if a failure-free execution produces a sequence of events equivalent to that of a failed, recovered, and continued execution. ... All discussion of failure-transparent recovery occurs in the context of a specific equivalence function. ... This function is specific to the application, and as software engineers, we have the authority to decide when two sequences of events are equivalent.

**📌 核心术语与语境解析**：
- **Equivalence function**：*等价函数*。定义“恢复后的轨迹是否可接受”的判据。
- **Exactly-once**：*恰好一次*。最严格但通常不可实现的等价标准。
:::

## 11.4 失败透明恢复的策略

要容忍事件重复，动作必须**幂等**。恢复并继续执行有两种主流模式：

### 11.4.1 重启（restart）

从**头**重新执行整个进程。若每步都幂等，实现很简单。但重启有局限：

- **时间语义被重置**：若注册流程是“先建账号，一周后再扣款”，重启会把一周的延迟重置；
- **非确定性动作**：取当前时间、生成随机数这类动作，重启后可能得到不同结果，导致行为错误。

### 11.4.2 恢复（resume）

从**最近的保存点（save point）** 继续执行。通过在步骤之间捕获足够信息，执行可以在失败后真正“接着跑”。

:::en
> **Original**: Process executions recover from failures by restarting the process execution from the beginning. A process restart is simple to implement if the process steps are idempotent. ... Process executions recover from failures by restarting the process execution from their most recent save point. By capturing sufficient information between process steps, a process execution effectively resumes after a failure.

**📌 核心术语与语境解析**：
- **Restart / resume**：*重启 / 恢复*。从头再来 vs. 从断点继续。
- **Save point**：*保存点*。持久化的执行进度，是 resume 的前提。
:::

## 11.5 失败透明恢复的实现

实现分两个层次：应用层与平台层。

- **应用层**：进程定义必须 **failure-aware**，显式处理失败；
- **平台层**：进程定义保持 **failure-agnostic / failure-oblivious**，失败处理被封装在平台内。

这形成一条**失败处理阶梯（failure-handling ladder）**：从“失败起源”到“失败遏制”，逐级向上转义（escalation），最终让业务代码停留在“无感知”层。

### 11.5.1 应用层实现：Saga

应用层实现的结果是 **failure-aware 的进程定义**：开发者自己负责检测与缓解，代码里写满失败处理。

**Saga** 就是这种模式：它产生失败透明的执行，但代价是业务逻辑被状态机淹没。常见实现是状态机式：每步之后持久化 saga 的状态与下一步触发器。

```javascript
async function signupSaga(state) {
  switch (state.label) {
    case 'createAccount':
      const account = await AccountCreate();
      return { label: 'createPayment', account };
    case 'createPayment':
      const payment = await PaymentCreate();
      return { label: 'done', payment };
    default:
      throw new Error('Unknown state');
  }
}
```

这种写法确实能恢复，但它**掩盖了注册流程的核心业务逻辑**，更难读、更难维护。

### 11.5.2 平台层实现：持久执行

平台层实现的结果是 **failure-agnostic 的进程定义**：开发者不处理失败，代码里看不到任何失败分支。

**持久执行**就是这种模式，有两种实现策略：

- **基于日志（log-based）**：把每步的输出记入持久日志，失败时重放执行并对已执行事件去重。典型写法是协程：yield 一个待执行函数，运行时执行它、把结果写日志、再把结果送回协程；恢复时若日志中已有该步结果，直接复用并快进到失败点。
- **基于状态（state-based）**：定期持久化完整状态快照，恢复时从最近快照继续。

:::en
> **Original**: When failure transparency is implemented at the platform level, the result is failure-agnostic or failure-oblivious process definitions. In other words, the developer of the process is not responsible for failure detection and mitigation, and the resulting process definition—the code—does not account for the possibility of failure. ... Durable executions are failure-agnostic process definitions resulting in failure-transparent process executions. Today, there are two implementation strategies for durable executions: log-based and state-based.

**📌 核心术语与语境解析**：
- **Durable execution**：*持久执行*。平台托管执行进度，业务代码保持无感知。
- **Failure-oblivious**：*失败无感知*。代码中完全没有失败处理痕迹。
:::

## 本章小结

1. **两个原子动作的组合不原子**：部分执行是分布式系统的原罪。
2. **失败原子性不可组合**，但**失败透明**可以通过恢复实现。
3. **等价函数由应用定义**：从 exactly-once 到 restart，严格程度逐级放宽。
4. **重启简单但会重置时间语义、破坏非确定性动作**；恢复需要保存点。
5. **Saga 是应用层的失败透明**，代价是业务逻辑被状态机淹没。
6. **持久执行是平台层的失败透明**，通过日志重放或状态快照让代码保持干净。
7. **失败处理阶梯**：越往上，业务代码越不需要关心失败。

