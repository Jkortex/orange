---
title: "Think Distributed Systems（九）：一致性模型与 CAP 的真相"
date: 2026-11-03T03:30:00Z
description: "一致性模型是历史之上的谓词；线性一致性用顺序等价与实时序约束副本行为，最终一致性用收敛换取可用性；CAP 不是三选二，而是分区发生时在 C 与 A 之间二选一。"
category: distributed-systems
column: think-distributed-systems
tags:
  - "一致性模型"
  - "线性一致性"
  - "最终一致性"
  - "CAP"
  - "CRDT"
  - "Jepsen"
---

# 第 9 章：一致性

本章涵盖：

- 一致性（consistency）
- 线性一致性（linearizability）
- 最终一致性（eventual consistency）
- CAP 猜想与 CAP 定理

在数据库系统中，一致性有非常具体的含义：事务把数据库从一个合法状态迁移到另一个合法状态，合法性由应用层约束定义（例如余额不得为负）。

在分布式系统中，组件会失败、消息会延迟/重排/丢失，**一致性因此有多种解释**。本章讨论几种一致性模型及其典型场景。

## 9.1 一致性模型

为聚焦一致性，本章把分布式系统看作**一组并发进程操作一组对象**：

- **进程（process）**：对象上操作的序列；
- **对象（object）**：其类型定义了可能的值集合与操作集合；
- **操作（operation）**：并非瞬时完成，而是由**调用（invocation）**与**完成（completion）**界定。

$$Operation = Invocation \cdot Completion$$

进程是**严格顺序**的：发出调用、等待响应，再发下一个。

系统的**历史（history）** 是操作序列，包含其并发结构，即按真实时间排序的调用与完成事件：

$$H = [I_{A.1}, I_{B.1}, C_{A.1}, I_{A.2}, C_{B.1}, C_{A.2}]$$

**一致性模型是一组历史**：它定义哪些历史是好的/合法的/有效的，哪些是坏的/非法的/无效的。换言之，**一致性模型是定义在历史之上的谓词**。若系统的所有可能历史都符合该模型，则系统关于该模型是一致的。

> **顿悟时刻：什么叫做“违反一致性”？**
>
> 一个常见误解是“系统违反了一致性”。严格地说，系统**不可能违反“一致性”这个概念**，它只能**违反某个具体一致性模型的条款**。

### 9.1.1 常见的一致性模型

正确性是应用相关的，**你可以定义哪些历史是好的**。不过几十年来已形成一组公认的模型（Jepsen 有一张著名的关系图）：

- 强端：**严格可串行化（strict serializable）**、**可串行化（serializable）**、**线性一致性（linearizable）**；
- 中间：**顺序一致性（sequential）**、**快照隔离（snapshot isolation）**、**可重复读（repeatable read）**；
- 弱端：**因果一致性（causal）**、**PRAM**、**单调读/单调写**、**读你所写（read your writes）**、**最终一致性**。

### 9.1.2 优点与局限

一致性模型之间可能是**不相交**、**重叠**或**子集**关系。子集关系（有效历史更少）的模型更强，超集关系（有效历史更多）的模型更弱——由此形成一致性模型的**层级**。

现代系统通常提供多个一致性级别供选择（例如 CosmosDB 的 Strong / Bounded staleness / Session / Consistent prefix / Eventual）。

如何在强弱之间权衡？

- 向左（更强）：**牺牲可用性与延迟**，换来更好的**开发者体验**——更多分布复杂性被掩盖；
- 向右（更弱）：**获得可用性与低延迟**，代价是把分布的影响暴露给开发者。

本质上，**你是在用可用性与延迟换开发者体验**。更强的模型需要更多组件间协调，因而限制可用性、增加延迟。

什么算“好的开发者体验”？直观、易推理、没有意外。设想进程 A 把 x 从 0 写成 10 并收到 OK，随后读 x 却得到 0——这就是“意外且不受欢迎”的结果。

:::en
> **Original**: In essence, you have to trade availability and latency for developer experience. On one hand, a stronger consistency model improves the developer experience by mitigating more of the effects of distribution. But this mitigation requires more coordination among components, which limits availability and increases latency. On the other hand, a weaker consistency model exposes more of the effects of distribution but requires less coordination between components, allowing for better availability and lower latency.

**📌 核心术语与语境解析**：
- **Consistency model**：*一致性模型*。历史之上的谓词，划分合法与非法执行。
- **Stronger / weaker**：*更强 / 更弱*。以有效历史集合的子集关系定义强弱。
:::

## 9.2 线性一致性

线性一致性是分布式系统中最常被引用的强一致性模型。直观上，它要求系统**表现得像只有一个副本**，且所有操作按实时顺序原子地生效。

形式化定义：历史 H 是线性一致的，当且仅当存在一个顺序历史 H′，满足：

- **顺序等价（sequential equivalence）**：H′ 与 H 产生相同结果；
- **实时序（real-time ordering）**：H′ 中操作的顺序尊重 H 中**非并发**操作的实时顺序——即后发起的操作必须看到已完成操作的效果。

线性一致性按对象类型定义（不同类型语义不同），但这两条核心原则不变。

看一个复制型自增计数器的反例：计数器初始 0。进程 B 执行 inc 并收到 OK，随后进程 A 读 x 却得到 1 而非 2。若系统线性一致，A 的读必须看到 B 的写（因为 A 的读在 B 的写完成之后发起）。返回 1 说明**系统暴露了多副本与复制滞后的存在**。

> **顿悟时刻：线性一致的历史 vs. 线性一致的系统**
>
> 说“历史是线性一致的”，断言的是**存在等价的顺序历史**——这是关于历史的事实。
>
> 说“系统是线性一致的”，断言的是**系统的每一种可能历史都是线性一致的**——这是关于系统的保证。

如何实现线性一致的复制系统？第 10 章的**共识算法**是最主流的答案。

:::en
> **Original**: A history H is linearizable if Sequential equivalence—There exists a sequential history H' such that H' is equivalent to H—that is, H' and H yield the same results. Real-time ordering—The ordering of operations in H' respects the real-time ordering of nonconcurrent operations in H. ... If we say a history is linearizable, we assert that an equivalent sequential history exists. ... If we say a system is linearizable, we assert that every possible history of the system is linearizable.

**📌 核心术语与语境解析**：
- **Linearizability**：*线性一致性*。顺序等价 + 实时序，等价于“单副本 + 原子生效”的直觉。
- **Sequential equivalence**：*顺序等价*。并发历史可以重排成某个顺序历史而不改变结果。
:::

## 9.3 最终一致性

最终一致性是最弱的一致性模型之一，它只提供**收敛保证**：最终所有节点会处于相同状态。AWS CTO Werner Vogels 用它描述 DynamoDB 的一致性模型。

### 9.3.1 购物车

两个副本初始都只有商品 A。网络分区后，一个客户端在副本 1 删除 A、加入 B；另一个客户端在副本 2 加入 C。网络恢复后，副本需要收敛。

但**同一个购物车被改成了不同样子**，产生冲突，必须解决——而解决方式由工程师决定。

Amazon 的取舍很明确：**优先保留用户新增的商品，而不是用户删除的商品。** 这样新增的商品不会消失，代价是偶尔“已删除的商品复活”。这正体现了**可用性与开发者体验之间的权衡**。

### 9.3.2 最终一致性的两种变体

- **基本最终一致性（basic）**：
  - **最终交付**：对某个非故障副本的更新，最终会交付给每个其他非故障副本；
  - **弱收敛**：不再有更新后，所有副本最终收敛到相同状态。
  
  它**不约束**持续更新时的行为，也不约束收敛前读操作可以返回什么。

- **强最终一致性（strong）**：
  - **最终交付**：同上；
  - **强收敛**：任何收到**相同更新集合**的两个副本，处于相同状态。

### 9.3.3 实现

最终一致性必须做冲突解决，因为客户端可以在任意副本上并发修改。

- **应用相关协调**：历史上由应用层处理。购物车例子中，应用规定“新增优先于删除”。
- **算法化协调**：**CRDT（无冲突复制数据类型）** 近年来成为主流。它允许副本独立并发更新，并保证最终收敛。

CRDT 的两种形态：

| | 基于操作（commutative） | 基于状态（convergent） |
| :--- | :--- | :--- |
| 复制内容 | 单个操作 | 完整状态 |
| 合并方式 | 本地应用操作 | 本地合并状态 |
| 收敛条件 | 不丢操作、恰好一次、apply 可交换 | merge 满足结合律、交换律、幂等律 |
| 例子 | grow-only set 的 add | grow-only set 的并集合并 |

今天 CRDT 仍是活跃的研究领域，Riak 等系统已采用其原理来获得高可用与低延迟。

:::en
> **Original**: Eventual consistency provides a convergence guarantee: eventually, all nodes are in the same state. ... Basic eventual consistency is defined in terms of these two guarantees: Eventual delivery ... Weak convergence ... Strong eventual consistency ... Strong convergence—Any two replicas that received the same set of updates are in the same state.

**📌 核心术语与语境解析**：
- **Eventual delivery**：*最终交付*。更新不会永久丢失，终将到达每个健康副本。
- **Convergence**：*收敛*。弱收敛只看“最终相同”，强收敛要求“相同输入必得相同状态”。
:::

## 9.4 一致性、可用性与分区容忍

CAP 是理解**复制型分布式系统**三个关键性质之间权衡的框架。它可能是最著名、也被误解最深的原则。

### 9.4.1 历史

必须区分 **CAP 猜想**与 **CAP 定理**：

- 2000 年，Eric Brewer 在 PODC 主题演讲《Towards Robust Distributed Systems》中提出**猜想**：分布式系统无法同时满足一致性、可用性、分区容忍；
- 2002 年，Seth Gilbert 与 Nancy Lynch 在论文中给出**形式化证明**，猜想才成为**定理**。

Brewer 的猜想是**尝试表述**一致性与可用性的冲突；Gilbert 与 Lynch 的定理是**尝试形式化**这一冲突。

> **顿悟时刻：“三选二”已经过时**
>
> CAP 最初被表述为“三选二”，这一解读如今已不再受青睐，因为它暗示**网络分区是可选的**。但在现实模型中，网络分区是**不可避免**的。
>
> 因此，分区容忍不是可选项，而是**前提**。真正要选的，是分区发生时**要 C 还是要 A**——CAP 由此把世界分成 **CP 系统**与 **AP 系统**。

### 9.4.2 猜想与定理

**猜想 vs. 定理**的差别在于是否被证明。Brewer 的贡献是提出了一个值得证明的命题；Gilbert 与 Lynch 的贡献是把它变成可检验的形式化结论。

### 9.4.3 CAP 定理

在**异步网络模型**下，一个分布式系统不可能同时满足：

- **一致性（C）**：线性一致性；
- **可用性（A）**：每个请求都能收到非错误响应；
- **分区容忍（P）**：网络分区时系统继续运行。

由于 P 不可避免，系统只能在 C 与 A 之间取舍：

- **CP**：分区时拒绝服务，保证不返回错误数据（如 etcd、ZooKeeper）；
- **AP**：分区时继续服务，接受可能过期的数据（如 DynamoDB、Cassandra）。

:::en
> **Original**: CAP was originally presented as a "pick two out of three" framework, an interpretation that has since fallen out of favor. This interpretation implies that network partitions are optional. As discussed in chapter 1, however, network partitions are inevitable in a realistic system model. Therefore, the ability to tolerate partitions is non-negotiable rather than optional. Because you have to account for network partitions, you have to choose between consistency and availability if and when a partition occurs.

**📌 核心术语与语境解析**：
- **CAP conjecture / theorem**：*CAP 猜想 / 定理*。前者是命题，后者是被证明的版本。
- **CP / AP**：*一致性优先 / 可用性优先*。分区发生时的两种工程立场。
:::

## 本章小结

1. **一致性模型是历史之上的谓词**，系统只能违反具体模型，不能违反“一致性”本身。
2. **强弱由子集关系定义**：有效历史越少越强。
3. **线性一致性 = 顺序等价 + 实时序**，直觉上等价于“单副本 + 原子生效”。
4. **最终一致性用收敛换可用性**；基本版只保证“最终相同”，强版要求“同输入同状态”。
5. **CRDT 把冲突解决算法化**：操作型靠可交换，状态型靠结合/交换/幂等。
6. **CAP 不是三选二**：P 是前提，真正的选择是分区时的 C 与 A。

