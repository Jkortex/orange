---
title: "Think Distributed Systems（八）：复制——冗余是复制与协调的合体"
date: 2026-11-03T03:20:00Z
description: "从冗余逻辑门讲到软件复制：复制滞后为何不可避免，同步与异步复制如何权衡延迟与一致性，状态复制与日志复制、单领导者/多领导者/无领导者各自付出什么代价。"
category: distributed-systems
column: think-distributed-systems
tags:
  - "复制"
  - "冗余"
  - "复制滞后"
  - "法定人数"
  - "CRDT"
  - "一致性"
---

# 第 8 章：复制

本章涵盖：

- 冗余（redundancy）
- 复制（replication）

分布式系统中最复杂的部分往往与冗余有关，尤其是**失败下的冗余**。

先回忆 ACID 中的**持久性（durability）**：事务一旦提交，其效果就是永久的，不能反悔。很多业务流程都依赖这个承诺——电商发货依赖支付方“已收款”的承诺；如果支付方反悔，货已发出、钱却没到，后果可想而知。

在理论模型中，组件完全可靠，承诺必然兑现，不会反悔。但在实践模型中，组件会失败：负责处理事务的组件一旦崩溃，系统可能无法兑现承诺。**要消除单点失败，就要给系统加冗余。**

## 8.1 冗余

**冗余**指子系统的**复制**与**协调**，使得复制因子增加能带来可靠性（和/或可扩展性）的提升。

- **静态冗余（static）**：组件集合与交互集合在系统生命周期内**不变**，多见于硬件系统；
- **动态冗余（dynamic）**：组件集合与交互集合会**变化**，多见于软件系统。

> **顿悟时刻：冗余与可扩展性**
>
> 冗余提升可靠性，但它也**有助于**可扩展性：数据被分布到多个节点，配合轮询等负载均衡把请求摊到各副本上。不过后续章节会看到，冗余有时反而**降低**可扩展性。**冗余与可扩展性的关系并不直接**——真正提供可扩展性的是分区，复制只是把数据铺开。

> **顿悟时刻：复制与协调的对偶性**
>
> 我们的心智模型常常只包含“复制组件”，却很少包含“协调组件”。但**一堆组件不构成系统**，必须被组合成一个连贯整体，也就是必须协调。协调可以简单到轮询，也可以复杂到共识协议，但**它必须存在**。

看一个“Hello World”级的冗余硬件例子：冗余逻辑门。

一个逻辑门接收 n 个输入、产生 1 个输出，计算布尔函数 f。假设逻辑门一旦失败系统就失败——它是**单点失败**。

解决方法是复制 + 协调：

- **复制**：用三个逻辑门代替一个；
- **协调**：用一个多数门（majority gate）汇总三个副本的输出，取多数票。

$$R = (a \wedge b) \vee (b \wedge c) \vee (a \wedge c)$$

该式在三个输入中至少两个为真时为真。为避免多数门自己成为单点失败，它也应当被复制。

于是，我们用一组组件替换了单个组件，让这组组件**表现得像原来的单个组件**，同时能容忍一个组件失败——这就是冗余的魔力。

:::en
> **Original**: Redundancy refers to the duplication and coordination of subsystems so that an increase in the duplication factor results in increased reliability and/or scalability. ... In my experience, our mental models often involve duplicating components but rarely involve coordinating those components. But a collection of components is not a system; it must be composed into a coherent system, meaning that the components must be coordinated.

**📌 核心术语与语境解析**：
- **Redundancy**：*冗余*。复制 + 协调，二者缺一不可。
- **Single point of failure**：*单点失败*。系统可靠性的下限由它决定。
:::

## 8.2 思考复制与一致性

在进入形式化模型之前，先思考一个看似幼稚的问题：**什么是“一个东西”？**

William Kent 在《Data and Reality》中提出：这个问题揭示了我们的思维与语言中根深蒂固的歧义。

设想作者写了《SICP》，图书馆里有十本。这里的“书”指作者的作品（**逻辑条目**），还是馆藏的那十本（**物理条目**）？

再看版本：1984 年第一版、1996 年第二版、2022 年 JavaScript 版。它们算同一本书还是不同的书？第一、二版用 Scheme，JS 版用 JavaScript。那么馆藏里到底有几本 SICP？

- 认为“任何版本都覆盖了相关概念” → 10 本；
- 认为“只有 Scheme 版忠实表达” → 8 本；
- 认为“只有 JS 版才具体可用” → 2 本。

这个追问逼我们审视**同一性（identity）与等价性（equivalence）**：oneness 与 sameness。无论对象是书还是分布式软件系统，**理解这两条原则都是理解复制与一致性的基础。**

:::en
> **Original**: This question leads us to the core of replication and consistency. Replication and consistency is about not only the number of physical items that exist but whether these physical entities represent the logical item. The answer to this question depends on your perspective.

**📌 核心术语与语境解析**：
- **Logical / physical item**：*逻辑条目 / 物理条目*。副本数不等于“同一件事”的份数。
- **Identity / equivalence**：*同一性 / 等价性*。复制系统必须回答“什么算同一个”。
:::

## 8.3 复制

**复制**是最常见的复制实现方式：拥有同一事物的多个实例。它把数据分布到多个资源上，从而突破单个资源的可靠性限制。

## 8.4 复制的机制

### 8.4.1 系统模型

把网络看作组件之间的**点对点通信链路**：每个节点持有全部数据（本例为 x=1、y=2、z=3），客户端可以连接任意节点。

### 8.4.2 复制滞后

**复制滞后（replication lag）** 指变更在各副本之间传播的固有延迟。因为任何时刻只有一个组件或网络能走一步，更新**不可能同时**应用到所有副本，只能一个接一个地施加。

复制滞后不只是时间延迟，更是复制型分布式系统的**内在属性**，也是许多问题的根源（例如复制透明性丧失）。

可以区分两种滞后：

- **固有滞后（inherent）**：分布式系统本质决定，无法消除；
- **强加滞后（imposed）**：网络分区与组件失败造成，属于额外延迟。

### 8.4.3 同步复制 vs. 异步复制

- **同步复制**：变更被复制、且收到**所有**其他节点的确认后，操作才算完成。完成与复制**紧耦合**，复制发生在前台。它保证各节点立即一致，但延迟与可用性受制于每个节点的及时响应。
- **异步复制**：操作在初始节点处理完即算完成，不等复制与确认。完成与复制**松耦合**，复制发生在后台。它改善延迟与可用性，但可能牺牲一致性。

实践中，很多系统采用**混合策略**：变更需要**多数副本**确认（这个多数称为 **quorum**），quorum 内的复制在前台完成；quorum 之外的副本可以异步追赶。

:::en
> **Original**: In synchronous replication, an operation is not considered complete until the changes have been replicated and acknowledgments have been received from all other nodes. ... In asynchronous replication, the operation is considered complete as soon as it's processed on the initial node; there's no wait for the changes to be replicated and acknowledgments to be received from the other nodes. ... In practice, many systems employ a hybrid strategy for replication: When a change is replicated, a majority of replicas must acknowledge the operation.

**📌 核心术语与语境解析**：
- **Replication lag**：*复制滞后*。副本间传播的固有延迟，无法通过工程手段归零。
- **Quorum**：*法定人数*。多数派确认，是同步与异步之间的工程折中。
:::

### 8.4.4 基于状态 vs. 基于日志的复制

假设系统是**确定性状态机**，复制变更有两种选择：复制**当前状态**，或复制**导致该状态的操作序列**。

$$step: State \rightarrow Operation \rightarrow State$$

以计数器为例，初始 counter = 0，客户端依次执行 increment-by(2)、increment-by(3)：

- **基于状态**：直接把当前状态（或状态差分）发过去——消息是 counter = 2、counter = 5；
- **基于日志**：把操作序列发过去——消息是 increment-by(2)、increment-by(3)。

前者关注“现在是什么”，后者关注“怎么变成这样”。**实践中，基于日志的复制正成为业界主流。**

### 8.4.5 单领导者、多领导者与无领导者

- **单领导者（single-leader）**：只有一个领导者接受操作并传播给跟随者。指挥链清晰，但领导者本身可能成为单点失败——几乎抵消了复制的意义。
- **多领导者（multileader）**：多个领导者都能接受操作。消除了单点失败，但没有指挥链，并发操作可能冲突，需要**冲突解决**。
- **无领导者（leaderless）**：没有指定领导者，所有节点都能接受操作，冲突同样需要解决。

冲突解决策略从“最后写入胜出（last write wins）”到 **CRDT（无冲突复制数据类型）** 不等。看似简单的 LWW 也可能让客户端觉得“我的写入被莫名覆盖了”——选择策略时必须理解其语义。

> **顿悟时刻：领导者写、跟随者读？**
>
> 有些资料把领导者复制简化为“领导者处理写、跟随者处理读”。这种配置确实常见，但它忽略了复制滞后：跟随者可能尚未反映最新数据。**要读到最新数据，读请求必须发给领导者。**

:::en
> **Original**: In single-leader systems, one dedicated leader node coordinates operations. Only the leader node accepts operations and propagates changes to its followers. This creates a chain of command but can become a single point of failure, almost negating the reason for replication. ... A wide array of conflict resolution strategies exists, ranging from timestamp-based methods such as "last write wins" to techniques that use conflict-free replicated data types (CRDTs).

**📌 核心术语与语境解析**：
- **Leader / follower**：*领导者 / 跟随者*。写路径的集中点，也是冲突与瓶颈的来源。
- **CRDT**：*无冲突复制数据类型*。通过数学性质保证并发更新可合并。
:::

## 本章小结

1. **冗余 = 复制 + 协调**，只复制不协调只是一堆组件。
2. **复制滞后不可消除**：一步只能走一个组件，更新不可能瞬时同步。
3. **同步复制保一致、异步复制保延迟**；quorum 是二者的工程折中。
4. **状态复制传“现在”，日志复制传“过程”**；日志复制成为主流。
5. **单领导者简单但易成单点，多领导者/无领导者需要冲突解决**。
6. **“领导者写、跟随者读”忽略了滞后**：强一致读必须回到领导者。

