---
title: "Think Distributed Systems（九）：一致性模型与 CAP 定理的真相"
date: 2026-11-03T03:20:00Z
description: "梳理线性一致性、因果一致性与最终一致性的严格谱系；形式化定义调用/响应时序区间，并廓清 CAP 从猜想到定理的真实内涵。"
category: distributed-systems
column: think-distributed-systems
tags:
  - "一致性模型"
  - "线性一致性"
  - "最终一致性"
  - "CAP定理"
  - "因果一致性"
  - "CRDT"
---

# 第 9 章：一致性

本章涵盖：

- 一致性模型（consistency model）的本质：契约
- 线性一致性（linearizability）的形式化推导
- 最终一致性（eventual consistency）与冲突收敛
- CAP 猜想与 CAP 定理的历史演进与真实含义

“一致性（Consistency）”大概是分布式系统领域被滥用最严重的概念。ACID 中的 C 指业务不变量；Raft/Paxos 中的共识保证状态机同步；而本章的一致性模型讨论的是：**多副本分布式系统在面临并发读写时，对外表现出的行为契约。**

## 9.1 一致性模型：系统与调用者的契约

![图 9.1：进程操作的生命周期与调用-响应时序区间](/media/posts/think-distributed-systems/fig-p138-9-1.png)
*图 9.1：操作时序区间（A process is a sequence of operations on objects）*

如图 9.1 所示，客户端对分布式存储发起一个操作 $op$，并不是物理瞬时的点，而是包含一个**时间区间**：
- **调用点（Invocation, $t_{\text{inv}}$）**：客户端将请求压入网络信道的时间点；
- **完成点（Response / Completion, $t_{\text{res}}$）**：客户端收到对端返回确认的时间点。

两个操作如果时间区间重叠，它们在物理上就是并发的。

![图 9.2：一致性模型作为抽象契约划分合法与非法系统行为](/media/posts/think-distributed-systems/fig-p138-9-2.png)
*图 9.2：一致性模型契约（A consistency model）*

图 9.2 揭示了一致性模型的本质：**一致性模型是一份行为契约**。它向应用开发者规定：当你在并发与多副本环境下执行读写时，系统保证你能读到什么、绝不会读到什么。

### 一致性模型谱系

![图 9.3：主流一致性模型的偏序包含与因果强度层级全景图](/media/posts/think-distributed-systems/fig-p139-9-3.png)
*图 9.3：一致性模型层级（Common consistency models and their relationship）*

如图 9.3 所示（参考 Jepsen 经典谱系）：
- **严格可串行化（Strict Serializability）**：事务可串行化 + 线性一致性，一致性的圣杯；
- **线性一致性（Linearizability）**：单对象、强实时间全序；
- **顺序一致性（Sequential Consistency）**：保持程序序，但允许整体滞后于真实物理时间；
- **因果一致性（Causal Consistency）**：保持因果偏序，允许并发操作乱序；
- **最终一致性（Eventual Consistency）**：停止写入后系统最终收敛，并发期无任何时序保证。

![图 9.4：一致性模型之间的相交、重叠与子集关系](/media/posts/think-distributed-systems/fig-p140-9-4.png)
*图 9.4：模型集合拓扑（Disjoint, overlapping, and subset consistency models）*

![图 9.5：微软 Azure Cosmos DB 提供的五档商业级一致性级别](/media/posts/think-distributed-systems/fig-p140-9-5.png)
*图 9.5：Azure Cosmos DB 一致性层级（Consistency levels of Azure Cosmos DB）*

图 9.4 与图 9.5 展示了现代工业界云数据库（如 Cosmos DB）如何将理论模型转化为工程参数：从强一致性（Strong）、有限陈旧度（Bounded Staleness）、会话一致性（Session）、单调前缀（Consistent Prefix）到最终一致性（Eventual）。

![图 9.6：强弱一致性权衡谱系：安全性与性能的永恒博弈](/media/posts/think-distributed-systems/fig-p140-9-6.png)
*图 9.6：一致性强弱连续谱（Stronger and weaker consistency models）*

![图 9.7：一致性、可用性与开发心智负担的工程权衡三角](/media/posts/think-distributed-systems/fig-p141-9-7.png)
*图 9.7：可用性与工程代价的权衡（Availability and latency trade-off in consistency models）*

如图 9.6 与图 9.7 所示：一致性越强，开发者心智负担越低（不用处理各种时序幽灵 Bug），但系统需要更多的跨节点同步协商，导致延迟增加、可用性降低；一致性越弱，系统吞吐量越高、分区容忍度越好，但业务代码必须承担复杂的冲突合并与容错逻辑。

## 9.2 线性一致性（Linearizability）

Maurice Herlihy 与 Jeannette Wing 在 1990 年形式化提出了**线性一致性（也称强一致性，External Consistency）**。

线性一致性是单对象可达的最强一致性保证。它的定义要求：
1. **每个操作在调用点与完成点之间的某一个瞬间生效（原子生效点，Linearization Point）**；
2. **所有客户端观察到的操作全序，必须与物理真实时间流向严格一致**。
   若操作 $A$ 的响应时间点先于操作 $B$ 的调用时间点（即 $A$ 在实时间上先于 $B$ 完成），则在系统历史上 $A$ 必须排列在 $B$ 之前。

### 反例剖析：为什么复制计数器容易违背线性一致性？

![图 9.8：复制型自增计数器违背线性一致性的执行历史反例](/media/posts/think-distributed-systems/fig-p144-9-8.png)
*图 9.8：非线性一致历史反例（Nonlinearizable history of a replicated counter）*

考虑图 9.8 所示的反例：
- 计数器初值为 0；
- 进程 B 执行 `inc()`，将计数器递增为 1 并收到确认 `OK`；
- 随后，系统内部又发生了一次写入将计数器更新为 2 并完成；
- 进程 A 在上述两次写入**完全完成之后**，发起读取 `read(x)`；
- 然而由于底层的复制滞后，进程 A 命中的副本尚未追赶上最新写入，返回了旧值 1！

在这个历史中，进程 A 的读发生在写入递增到 2 之后，却读到了过期的旧值 1。**系统把多副本的存在与时钟延迟暴露给了外部调用者，违背了线性一致性。**

:::en
> **Original**: Linearizability is a safety property. It provides the illusion that there is only a single copy of the data item, and that all operations execute instantaneously at a specific serialization point between their invocation and response. If operation A completes before operation B begins in real physical time, then B must see the effects of A or a subsequent operation.

**📌 核心术语与语境解析**：
- **Linearizability**：*线性一致性*。保证并发操作在实时间调用-响应窗口内瞬间单点原子生效的强一致性模型。
- **Linearization point**：*线性化点*。在操作调用与返回之间，操作对全局所有后续读取立即可见的物理生效瞬间。
:::

## 9.3 最终一致性（Eventual Consistency）

与线性一致性相对的另一极端是**最终一致性**：若不再对对象注入新的写操作，所有副本最终必将收敛到完全一致的相同状态。

### 购物车冲突与 CRDT 收敛

![图 9.9：无主多副本环境下基于最终一致性的购物车状态收敛](/media/posts/think-distributed-systems/fig-p144-9-9.png)
*图 9.9：最终一致性购物车（Eventual-consistent shopping cart）*

图 9.9 呈现了经典的亚马逊 Dynamo 购物车案例：
- 用户在手机端将商品 A 加入购物车；
- 同时在电脑端将商品 B 加入购物车；
- 两个写操作被路由到两个不同数据中心的不同副本；
- 此时两副本状态分叉：副本 1 包含 `{A}`，副本 2 包含 `{B}`；
- 后台通过抗熵（Anti-entropy）机制交换状态：根据预定义的收敛策略执行并集操作，最终收敛为 `{A, B}`。

为了杜绝人工合并冲突的脆弱性，现代系统广泛采用**无冲突复制数据类型（CRDT, Conflict-free Replicated Data Types）**，利用半格（Semilattice）的交换律、结合律与幂等性实现数学证明上的自动无锁收敛。

## 9.4 CAP 定理的真相：从猜想到定理

1999 年 Eric Brewer 提出 CAP 猜想；2002 年 Seth Gilbert 与 Nancy Lynch 发表了严格的数学证明，使其成为正式定理。

![图 9.10：Gilbert 与 Lynch 证明 CAP 定理的形式化系统模型](/media/posts/think-distributed-systems/fig-p148-9-10.png)
*图 9.10：Gilbert 与 Lynch 的 CAP 形式化模型（Gilbert and Lynch’s system model）*

图 9.10 揭示了 CAP 定理在数学证明中的确切力学：
- 节点被划分为不相交的两组 $G_1$ 与 $G_2$；
- 网络发生**不可恢复的分区（Partition）**，从 $G_1$ 到 $G_2$ 的所有消息全部丢失；
- 客户端向 $G_1$ 的节点发出写请求 $v_1$；
- 随后客户端向 $G_2$ 的节点发出读请求；
- 此时 $G_2$ 处于绝对的两难死局：
  - **若选择保持可用性（Availability）**：$G_2$ 必须响应客户端，但它不可能知道 $v_1$ 的存在，只能返回旧值，从而**违背线性一致性（C）**；
  - **若选择保持一致性（Consistency）**：$G_2$ 必须拒绝响应或无限等待，直到网络分区恢复，从而**牺牲可用性（A）**。

### CAP 常见误区澄清

1. **CAP 不是“三选二”，而是“二选一”**：网络分区（P）是物理规律，不是架构师可以“选择放弃”的选项。光缆一定会被挖断，路由器一定会丢包。架构师真正面对的选择是在分区发生时，选择 **CP** 还是 **AP**。
2. **C 指的是强实时间的线性一致性（Linearizability）**，而不是最终一致性，也不是 ACID 中的 C。
3. **A 指的是 100% 成功返回非错响应的活性**，而不是 99.99% 的 SLA。

## 本章小结

1. **一致性模型是契约**：明确调用-响应时间区间，规定并发读写下的合法观察序列。
2. **线性一致性的极高门槛**：单对象、强原子点、遵守物理时钟因果，开销巨大。
3. **CAP 的终极铁律**：网络分区必然发生；在不可靠物理信道上，强一致性与不间断可用性不可兼得。
