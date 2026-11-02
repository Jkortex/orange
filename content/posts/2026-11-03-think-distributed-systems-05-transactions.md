---
title: "Think Distributed Systems（五）：事务——把并发与失败关进抽象里"
date: 2026-11-03T02:50:00Z
description: "从事务作为抽象入手：一个不感知并发与失败的定义，如何被数据库翻译成感知并发、感知失败且可容忍失败的执行；并给出可串行化与完整性的形式化判据。"
category: distributed-systems
column: think-distributed-systems
tags:
  - "事务"
  - "可串行化"
  - "ACID"
  - "Undo"
  - "抽象"
  - "一致性模型"
---

# 第 5 章：事务

本章涵盖：

- 抽象（abstraction）的概念
- 事务的概念
- 事务的意义
- 事务的实现

事务是软件工程史上最流行、最强大的抽象，它诞生于数据库领域，却在分布式系统中被广泛采纳。原因很简单：**事务让你可以假装并发与失败不存在。**

多数教材用 ACID 解释事务，但 ACID 把事务的性质呈现为四个彼此独立的概念。本章换一个视角：**从正确性（correctness）与完整性（completeness）的角度**理解事务。

## 5.1 抽象

在计算机科学最基础的著作《计算机程序的构造和解释》（SICP）中，抽象与“基本表达式”“组合手段”并列为程序设计的三大基本构件。但那个定义只说明了抽象的构成，没有强调它的本质：**抽象拥有改造话语域的力量，它能重塑整个世界。**

Tanenbaum 与 Bos 在《现代操作系统》中用“丑陋接口 → 美丽接口”说明这种转化：操作系统把 CPU、内存、磁盘这些“丑陋实体”转化为进程、内存、文件这些“美丽实体”。

但美丑取决于观察者。从数据库系统的视角看，操作系统的进程、内存、文件反而是“丑陋”的，数据库把它们转化为表（行与列）与事务。

Pat Helland 在《Life beyond Distributed Transactions》中用 **agnostic（无感知）** 与 **aware（有感知）** 替代美丑，并强调 **API 是跨越世界边界的翻译器**。

- **自顶向下**看，是**归约（reduction）**：使用高层抽象的实体，被转换、编译为使用低层抽象的实体；
- **自底向上**看，是**组合（composition）**：使用低层抽象的实体组合成高层实体，高层实体由此**涌现**。

无论从哪个方向推理，都存在一种**等价性**：用高层抽象推理与用低层抽象推理，系统给出相同结果。

本章把事务看作这样一种抽象：**把“无感知并发、无感知失败”的定义，转化为“感知并发、感知失败且可容忍失败”的执行。**

:::en
> **Original**: This chapter explores transactions as abstractions that transform concurrency-agnostic and failure-agnostic definitions into concurrency-aware, failure-aware, and failure-tolerant executions. In other words, we will explore transactions as abstractions that enable us to pretend that concurrency and failure are nonexistent.

**📌 核心术语与语境解析**：
- **Abstraction**：*抽象*。把低层实体的复杂性归约为高层可操作的实体。
- **Agnostic / aware**：*无感知 / 有感知*。定义层不关心并发与失败，执行层必须处理它们。
:::

## 5.2 事务的魔力

Web 应用就是分布式应用。我刚开始写 Web 时并未意识到这一点——之所以没意识到，正是因为**事务**。

事务保证正确性与完整性。如果你把应用建立在事务型数据库之上，事务保证就从数据库延伸到整个系统。事务**掩盖**了一个事实：你正在构建一个并发的、部分同步的分布式系统，组件会失败，网络不可靠。

看一个简化的转账 API：/transfer 接收源账户、目标账户与金额，执行两条 UPDATE 后 COMMIT。

**你注意到这个 handler 里缺了什么吗？** 它没有任何可见的护栏：没有并发检测或缓解，也没有失败检测或缓解。

### 5.2.1 并发

单账户余额更新天然易受竞态影响：更新由“读”与“写”两个操作组成，并发转账的交错会导致不同结果。

设想源账户初始 50，两笔并发转账各转 10。若读写交错为 r=50 → r=50 → w(40) → w(40)，最终余额 40，而期望是 30。

但事务保证**正确性**。尽管查询里看不到任何检测、缓解或阻止竞态的动作，事务却**表现得好像并发不存在**。

### 5.2.2 失败

更新两个账户余额由两次写操作组成。若第一次写之后、第二次写之前执行失败，转账就只应用了一半。

设想源账户与目标账户初始都是 50，转 10。若在两次写之间失败，最终是 40 与 50，而期望是 40 与 60。

但事务保证**完整性**。尽管看不到任何失败检测或缓解，事务却**表现得好像失败不存在**。

:::en
> **Original**: Transactions guarantee correctness and completeness. If you build your application on top of a transactional database system, transactional guarantees extend from the database to your entire system. Transactions obfuscate the fact that you are building a concurrent, partially synchronous distributed system consisting of components that are subject to failure and communicating over an unreliable network. ... A concurrency and failure-agnostic definition guarantees a concurrency and failure-aware and tolerant execution.

**📌 核心术语与语境解析**：
- **Guardrail**：*护栏*。显式的检测、限制与恢复逻辑；事务的价值就在于“看不见护栏”。
- **Partially applied**：*部分应用*。只完成一半的更新，正是完整性要排除的状态。
:::

## 5.3 事务的模型

先看 ACID 的定位差异：

- **原子性、隔离性、持久性**是**平台层**保证，不受应用语义影响；
- **一致性**是**应用层**保证，随应用需求而不同——余额低于零时是提交还是回滚，由开发者决定。

> **注**：最初，隔离性保证事务“如同没有其他事务在并发执行”，即**可串行化**。现代数据库提供多种隔离级别，超出本书范围。

为便于推理，我们把数据库抽象为**对象（object）的集合**，每个对象用名字-值对表示。

- **程序（program）**：对一组名字执行的操作序列——这是**定义**；
- **事务（transaction）**：对一组对象执行的动作序列，且以恰好一次 commit 或恰好一次 abort 结束——这是**执行**。

| 设计期/定义 | 运行期/执行 |
| :--- | :--- |
| 程序 P | 事务 t |
| 操作 A | 动作 a |
| 名字 N | 对象 o |

事务被建模为**轨迹（trace）**：由三元组 ⟨tx, ai, oi⟩ 构成的序列。数据库可以把多个事务的执行交错，这组事务的执行称为**历史（history）**。

数据库系统的职责，就是把**无感知失败的定义**翻译成**感知失败、可容忍失败的执行**。

### 5.3.1 正确性

事务把数据库从一个一致状态迁移到另一个一致状态，可用 Hoare 三元组表示：

$$\{ C \}\ t_x\ \{ C \}$$

但要注意：**事务执行期间，一致性可能被暂时违反**。转账时，源账户已扣、目标账户未入账的瞬间，就是不满足一致性谓词的时刻。

非并发场景下，每个事务从一致状态出发、到一致状态结束。并发执行时，一个事务可能观察到另一个事务引入的不一致。由此可得：

$$\{ C \}\ t_1\ \{ C \} \wedge \{ C \}\ t_2\ \{ C \} \Rightarrow \{ C \}\ t_1; t_2\ \{ C \}$$

也就是说，**串行历史（serial history）不会出现并发异常**。于是：两个并发事务 t1、t2 的执行是正确的，当且仅当其并发执行的效果，等价于“先 t1 后 t2”或“先 t2 后 t1”：

$$\{ C \}\ t_1 \| t_2\ \{ C \} \Rightarrow \{ C \}\ t_1; t_2\ \{ C \} \vee \{ C \}\ t_2; t_1\ \{ C \}$$

这就是**可串行化（serializability）**：只有在不引入不一致的前提下，才允许并发。

### 5.3.2 可串行化

可串行化是一种**一致性模型**：一致性模型是定义在执行历史之上的谓词，把历史划分为“好的/合法的/有效的”与“坏的/非法的/无效的”两类。

一致性模型代表正确性保证，而**你有权为系统定义一致性模型**。Edgar Codd 提出的可串行化，是一组事务并发执行的一致性模型，其基础是“并发执行等价于某个串行执行”。

对 t1、t2 的并发执行，若（事务结果, 数据库状态）等价于下列之一，则执行是可串行化的：

- t1 • t2 的顺序执行；
- t2 • t1 的顺序执行。

> **注意**：可串行化**不要求**等价于某个**特定**的串行执行，只要求等价于**某个**串行执行。

> **顿悟时刻：实现可串行化**
>
> 实现可串行化很简单，**高效地**实现可串行化很难。最朴素的做法是用一把大锁保护所有对象——这强制了串行调度。然后逐步细化锁粒度，保护对象子集，允许仍具串行语义的并发调度。目标始终是：**在保证串行语义的前提下，最大化并发度。**

:::en
> **Original**: This observation leads to a straightforward conclusion: if transaction t1 transitions the database from a consistent state to a consistent state and transaction t2 also transitions the database from a consistent state to a consistent state, the sequential composition of t1 and t2 also ensures the transition from a consistent state to a consistent state. ... This guarantee of correctness is referred to as serializability, in which concurrency is allowed only if it does not introduce inconsistencies in the database.

**📌 核心术语与语境解析**：
- **Serializability**：*可串行化*。并发执行等价于某个串行执行的一致性模型。
- **Serial history**：*串行历史*。无交错的执行历史，天然不产生并发异常。
:::

### 5.3.3 完整性

数据库系统如何保证完整性？即如何把无感知失败的定义，翻译成感知失败、可容忍失败的执行。

数据库使用第 3 章的两种技术：**后向恢复**与**前向恢复**，在数据库语境下分别称为 **Undo** 与 **Redo**。实际数据库往往二者兼用，这里聚焦 Undo。

Undo 的思路很直接：**每个操作都配一个 Undo 操作**。数据库维护**事务 Undo 日志**（对象 ou）。在执行某对象的操作之前，先把对应的 Undo 操作记入日志。

于是系统不再直接执行 ⟨t, ai, oi⟩，而是执行两个操作：记录 Undo（⟨t, w, ou + ⟨¬ai, oi⟩⟩）与原始操作（⟨t, ai, oi⟩）。事务由此有两条合法轨迹：

- **提交轨迹（commit trace）**：无失败时展开，执行全部常规操作；
- **中止轨迹（abort trace）**：有失败时展开，执行部分常规操作及其 Undo 操作，把系统恢复到事务之前的状态。

### 5.3.4 应用层中止

应用层中止很直接：应用主动决定回滚（例如余额不足），数据库执行 Undo，返回失败。**语义清晰，代价可控。**

平台层中止则复杂得多：崩溃可能发生在任意时刻——Undo 日志写了一半、副作用已生效但日志未落盘、恢复过程中再次崩溃……这正是第 6 章分布式事务要处理的问题。

:::en
> **Original**: Database systems employ various strategies for failure detection and mitigation. As discussed in chapter 3, there are two broad techniques: backward recovery and forward recovery. In the context of database systems, backward recovery is referred to as Undo, and forward recovery is referred to as Redo. ... The concept of Undo is straightforward: every operation is accompanied by an Undo operation.

**📌 核心术语与语境解析**：
- **Undo / Redo**：*撤销 / 重做*。后向恢复与前向恢复在数据库中的具体形态。
- **Commit trace / Abort trace**：*提交轨迹 / 中止轨迹*。事务在无失败与有失败下的两条合法执行路径。
:::

## 本章小结

1. **抽象的本质是转化**：把“丑陋”的低层实体转化为“美丽”的高层实体，并通过 API 翻译两个世界。
2. **事务是并发与失败的抽象**：定义层无感知，执行层有感知且可容忍。
3. **正确性靠可串行化**：并发执行必须等价于某个串行执行。
4. **完整性靠 Undo/Redo**：每个操作配一个逆操作，失败时回滚或前推。
5. **一致性是应用层的**：提交还是回滚，由业务规则决定；原子性、隔离性、持久性则是平台层保证。
6. **ACID 不是四个独立概念**：从正确性与完整性的角度看，它们是一体两面。

