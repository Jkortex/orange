---
title: "Think Distributed Systems（二）：系统模型、顺序与时间"
date: 2026-11-03T02:20:00Z
description: "同步、异步与部分同步三种系统模型划定了算法的能力边界；happened-before、物理时钟与逻辑时钟决定了事件能否被正确排序。"
category: distributed-systems
column: think-distributed-systems
tags:
  - "系统模型"
  - "部分同步"
  - "happened-before"
  - "逻辑时钟"
  - "Lamport 时钟"
  - "时钟漂移"
---

# 第 2 章：系统模型、顺序与时间

本章涵盖：

- 同步系统与异步系统
- 组件与网络的行为
- 顺序、物理时间与逻辑时间

在带时间保证的**同步系统**中，如果消息没有在已知上界内到达，我们就知道发生了失败；而在没有任何时间保证的**异步系统**中，消息没到，我们**什么都不知道**——可能失败了，也可能只是延迟。本章的目标，就是理解那些决定并约束分布式系统行为的“局势”与“作用力”。

## 2.1 系统模型

讨论分布式算法或协议，无法绕开我们对底层系统的假设。这组假设就是**系统模型（system model）**，它涉及系统的组件、网络以及时间行为。

| 一种系统模型 | 另一种系统模型 |
| :--- | :--- |
| 组件不会失败 | 组件会失败 |
| 消息不会丢失 | 消息会丢失 |
| 时钟完美同步 | 时钟并非完美同步 |

系统模型为何关键？**在一个模型下正确的算法，换一个模型可能就不正确了**；任何一点偏差，都可能让算法失效。

> **顿悟时刻：棋盘游戏**
>
> 把系统模型想成一盘棋：棋盘与规则设定舞台，玩家必须在规则约束内达成目标。规则只要轻微改动，你苦心经营的策略就可能瞬间失效。

:::en
> **Original**: We can't reasonably talk about a distributed algorithm or protocol without talking about the assumptions we made about the underlying distributed system. This set of assumptions, known as the system model, is about the system's components, its network, and its timing behavior. ... Algorithms and protocols that are correct under one system model may not be correct under another system model; any deviation may render an algorithm or a protocol incorrect.

**📌 核心术语与语境解析**：
- **System model**：*系统模型*。关于组件、网络与时间的假设集合，是算法正确性的前提条件。
- **Deviation**：*偏差*。实际运行环境偏离模型假设的程度，偏差越大，算法保证越弱。
:::

### 2.1.1 理论与实践

系统模型从理论到实践呈连续谱：

- **理论模型**常用于推理“**不可能性**”：通过可行性分析，评估解所需的最少/最多组件数或消息数；
- **实践模型**常用于推理“**可能性**”：在开发成本、运维成本、可扩展性与可靠性之间权衡；
- **两者的交集**：既是理论也是实践的模型，例如 Viewstamped Replication、Paxos、Raft 等共识算法背后的模型。

### 2.1.2 同步分布式系统

**同步分布式系统**中，每个组件可访问的时钟要么与其他时钟完美同步，要么偏差有已知上界。不同的同步模型细节各异，但都假设了强物理时间概念：内部与外部事件在严格时间点发生，或延迟有界。有的模型把同步系统刻画为“时间上毫无不确定性”，有的则刻画为“时间不确定性有界”。

### 2.1.3 异步分布式系统

**异步分布式系统**中，组件无法访问全局物理时间。不同的异步模型细节各异，但都**没有任何时间保证**：处理延迟无上界、网络延迟无上界、时钟漂移无上界。

这里的“异步”描述的是**系统模型**，与“异步编程”（如事件驱动、非阻塞 I/O）截然不同：

- **异步系统模型**：不可改变的事实——系统在时间上毫无保证；
- **异步编程**：一种实现选择——你可以选择同步或异步编程。

### 2.1.4 部分同步系统

现实世界的大多数系统处于两者之间：大多数时候行为同步，偶发不可预测的延迟。这就是**部分同步分布式系统**。

![图 2.2：从同步系统到异步系统模型的连续谱](/media/posts/think-distributed-systems/fig-p046-2-2.png)
*图 2.2：从同步系统到异步系统模型（From synchronous to asynchronous system models）*

图 2.2 呈现了从强假设的同步模型到无假设的异步模型的过渡谱系。现实工业界分布式算法（如 Raft、Paxos）均建立在部分同步假设之上：系统通常表现良好，但在网络分区或垃圾回收暂停时退化为异步状态。

形式化上，部分同步通常通过**全局稳定时间（GST, Global Stabilization Time）**刻画：GST 之前系统完全异步，GST 之后网络和处理延迟出现已知上界。

:::en
> **Original**: Most distributed systems we encounter in practice are partially synchronous. Under normal operating conditions, these systems exhibit predictable timing behavior: network delays are bounded, message delivery is reliable, and component processing speeds are consistent. However, during periods of network congestion, component failure, or system maintenance, these timing guarantees can temporarily break down, causing the system to behave asynchronously.

**📌 核心术语与语境解析**：
- **Partially synchronous**：*部分同步*。平时具备时间上界、异常时无保证的实用折中模型。
- **Global Stabilization Time (GST)**：*全局稳定时间*。理论分析中假设时间延迟恢复有界约束的临界点。
:::

### 2.1.5 组件与网络行为

系统模型还要规定组件与网络在面对失败时的行为模式。

#### 组件故障模式

![图 2.3：崩溃-停止失败（Crash-Stop）](/media/posts/think-distributed-systems/fig-p047-2-3.png)
*图 2.3：崩溃-停止失败（Crash-Stop failure）*

![图 2.4：崩溃-停止失败时间线](/media/posts/think-distributed-systems/fig-p047-2-4.png)
*图 2.4：崩溃-停止时间线对比（Crash-Stop timeline）*

在图 2.3 与图 2.4 的**崩溃-停止（Crash-Stop）**模型中，组件在故障发生前完全按协议运行，一旦崩溃则立刻永久停止一切活动（Fail-Silent），既不发送也不响应任何消息，永不复活。

![图 2.5：遗漏失败（Omission Failure）](/media/posts/think-distributed-systems/fig-p047-2-5.png)
*图 2.5：遗漏失败（Omission failure）*

图 2.5 展示了**遗漏失败（Omission Failure）**：组件或其网络接口未能执行指定动作，例如接收队列丢弃消息、或发送缓冲区未能将数据包压入网卡。

![图 2.6：崩溃-恢复失败（Crash-Recovery）](/media/posts/think-distributed-systems/fig-p048-2-6.png)
*图 2.6：崩溃-恢复失败（Crash-Recovery failure）*

图 2.6 刻画了工业界最常见的**崩溃-恢复（Crash-Recovery）**模型：节点会发生崩溃停机，易失性内存（RAM）状态丢失，但持久化存储（Disk / WAL）保留。节点重启后，根据预写日志重放状态并重新加入集群。

![图 2.7：拜占庭失败（Byzantine Failure）](/media/posts/think-distributed-systems/fig-p048-2-7.png)
*图 2.7：拜占庭失败（Byzantine failure）*

图 2.7 则是最苛刻的**拜占庭失败（Byzantine Failure）**模型：节点可能发生任意（Arbitrary）恶意行为，包括伪造假消息、篡改投票、或对不同节点给出互相矛盾的答复。

#### 网络异常模式

除了组件失败外，网络信道也会产生不同程度的异常：

![图 2.8：网络消息乱序重排](/media/posts/think-distributed-systems/fig-p049-2-8.png)
*图 2.8：消息乱序（Message reordering）*

图 2.8 中，消息 $m_1$ 虽先于 $m_2$ 发出，但由于网络多路径路由或丢包重发，$m_2$ 却先于 $m_1$ 到达接收端。

![图 2.9：网络消息重复](/media/posts/think-distributed-systems/fig-p049-2-9.png)
*图 2.9：消息重复（Message duplication）*

图 2.9 中，由于底层链路抖动或超时重传，同一条业务请求被网络交付了多次。

![图 2.10：网络分区与消息丢弃](/media/posts/think-distributed-systems/fig-p049-2-10.png)
*图 2.10：消息丢弃与分区（Message loss and partitioning）*

图 2.10 显示网络完全丢弃在途消息，导致原本连通的节点彼此隔离，形成通信孤岛。

## 2.2 顺序与时间

为什么我们需要时间？在单机系统中，CPU 指令计数器与硬件时钟天然为所有事件提供了全序。但在无共享内存的分布式系统中，每个节点拥有独立的物理晶振，不存在全局单一时钟。

![图 2.11：提议者与接受者并发交互](/media/posts/think-distributed-systems/fig-p051-2-11.png)
*图 2.11：提议者与接受者（Proposers and acceptors）*

图 2.11 展现了多个提议者（Proposers）并发向接受者（Acceptors）发送提议的拓扑。由于网络延迟不可预测，不同接受者收到消息的顺序可能截然相反。

![图 2.12：协调者介入后的并发竞态协调](/media/posts/think-distributed-systems/fig-p052-2-12.png)
*图 2.12：引入协调者的竞态处理（Proposers, acceptors, and a coordinator）*

图 2.12 展示了引入协调者（Coordinator）后，系统试图对提议进行定序，但如果缺乏严格的因果时序工具，协调者自身的消息依然可能与节点发生竞态。

### 2.2.1 happened-before 关系

Leslie Lamport 在 1978 年划时代的论文《Time, Clocks, and the Ordering of Events in a Distributed System》中提出了著名的 **happened-before（因果先后）关系**，记作 $	o$。

`happened-before` 是一个**偏序（partial order）**关系，由三条基本公理定义：

1. **同组件内的程序顺序**：如果事件 $a$ 与 $b$ 发生于同一个组件内，且 $a$ 在 $b$ 之前发生，则 $a 	o b$；
2. **跨组件的消息因果**：如果事件 $a$ 是某个消息的发送，事件 $b$ 是该消息的接收，则 $a 	o b$；
3. **传递性**：如果 $a 	o b$ 且 $b 	o c$，则 $a 	o c$。

![图 2.13：单组件内部事件的 happened-before 关系](/media/posts/think-distributed-systems/fig-p053-2-13.png)
*图 2.13：组件内部 happened-before（Happened-before relationship, intracomponent）*

图 2.13 说明了公理 1：单组件内严格按指令流水线先后推进，$e_1 	o e_2$。

![图 2.14：跨组件消息传递的 happened-before 关系](/media/posts/think-distributed-systems/fig-p053-2-14.png)
*图 2.14：跨组件消息传递因果（Happened-before relationship, intercomponent）*

图 2.14 说明了公理 2：消息必须先由组件 C1 发送（Send），然后才能被组件 C2 接收（Receive），物理因果律决定了发送必然 happened-before 接收。

![图 2.15：happened-before 关系的传递性](/media/posts/think-distributed-systems/fig-p054-2-15.png)
*图 2.15：因果传递性（Happened-before, transitively）*

图 2.15 说明了公理 3：通过网络消息在多个节点间的接力，因果关系 $a 	o b 	o c 	o d$ 沿着时空锥体不断延伸。

如果两个事件 $x$ 与 $y$ 之间既没有 $x 	o y$，也没有 $y 	o x$，我们就称它们是**并发的（concurrent）**，记作 $x \parallel y$。**并发意味着不存在因果依赖，两者谁先谁后在物理上无法也无需分辨。**

:::en
> **Original**: The relation "$	o$" on the set of events of a system is the smallest relation satisfying the following three conditions: (1) If a and b are events in the same process, and a comes before b, then $a 	o b$. (2) If a is the sending of a message by one process and b is its receipt by another process, then $a 	o b$. (3) If $a 	o b$ and $b 	o c$ then $a 	o c$. Two distinct events a and b are said to be concurrent if $a 
ot	o b$ and $b 
ot	o a$.

**📌 核心术语与语境解析**：
- **Happened-before ($	o$)**：*因果先后*。刻画分布式事件潜在因果关联的偏序关系。
- **Concurrent ($\parallel$)**：*并发*。互不具备因果因果依赖的事件关系，其相对物理顺序不影响系统因果正确性。
:::

### 2.2.2 物理时钟

人类天生习惯用物理时钟（年、月、日、时、分、秒）思考。但在分布式系统中，依赖物理时钟存在致命陷阱。

每个计算机节点依靠石英晶体振荡器计时。制造公差、环境温度与硬件老化会导致晶体振荡频率出现微小偏差：

![图 2.16：物理时钟偏斜（Clock Skew）](/media/posts/think-distributed-systems/fig-p056-2-16.png)
*图 2.16：时钟偏斜（Clock skew）*

图 2.16 展示了**时钟偏斜（Clock Skew）**：在同一物理时刻，节点 A 的时钟读数为 12:00:01，而节点 B 的读数为 12:00:03，两者存在绝对读数差异 $\Delta t$。

![图 2.17：物理时钟漂移（Clock Drift）](/media/posts/think-distributed-systems/fig-p056-2-17.png)
*图 2.17：时钟漂移（Clock drift）*

图 2.17 展示了**时钟漂移（Clock Drift）**：随着时间推移，不同晶振的走时快慢不同，即使通过 NTP 协议对齐，时钟误差依然随时间线性或非线性发散。

物理时钟的不可靠性意味着：**你绝不能仅仅根据两台机器的本地时间戳来判定“哪个写入先发生”**，否则会导致数据丢失（如 Cassandra 或早年数据库中的 LWW 覆写 Bug）。

### 2.2.3 逻辑时钟

为了摆脱物理时钟的硬件缺陷，Leslie Lamport 提出了**逻辑时钟（Logical Clocks）**。

逻辑时钟不关心“现在是几点”，只关心**为所有事件赋予一个严格反映因果关系的单调递增计数器**。

![图 2.18：Lamport 逻辑时钟的步进与同步机制](/media/posts/think-distributed-systems/fig-p058-2-18.png)
*图 2.18：Lamport 逻辑时钟（Lamport clocks）*

如图 2.18 所示，Lamport 逻辑时钟算法运行规则如下：

1. 每个进程内部维护一个整数计数器 $L$；
2. 进程每发生一次内部事件或发送事件，计数器递增：$L := L + 1$；
3. 发送消息时，将当前时间戳 $L$ 附着在消息包内；
4. 接收消息时，接收方将自身时钟更新为自身当前时钟与消息时间戳的最大值加 1：
   $$L_{	ext{recv}} := \max(L_{	ext{local}}, L_{	ext{msg}}) + 1$$

通过这套机制，Lamport 证明了**时钟条件（Clock Condition）**：
$$a 	o b \implies L(a) < L(b)$$
即：如果事件 $a$ 因果先行于事件 $b$，则 $a$ 的逻辑时钟一定严格小于 $b$ 的逻辑时钟。

:::en
> **Original**: To introduce a total ordering on all events in a distributed system, Lamport introduced logical clocks. A logical clock is a monotonically increasing software counter maintained by each process. It does not measure physical time; instead, it establishes an ordering that respects causality. If an event a happened before event b, the logical clock of a will be less than the logical clock of b.

**📌 核心术语与语境解析**：
- **Logical clock**：*逻辑时钟*。用单调递增标量刻画因果偏序的软件机制。
- **Clock Condition**：*时钟条件*。因果先后必蕴含时钟单调性，是逻辑时钟正确性的理论基石。
:::

## 本章小结

1. **系统模型是契约的基石**：同步模型假设过强，异步模型几乎无法解决共识问题；工业界算法（Paxos、Raft）均根植于部分同步模型。
2. **故障与异常谱系**：组件从 Crash-Stop 到 Crash-Recovery 再到 Byzantine；网络从乱序、重复到分区。明确故障边界才能有的放矢。
3. **时空第一性**：物理时钟因偏斜与漂移不可全信；分布式定序必须依靠基于因果偏序的 `happened-before` 关系与逻辑时钟。
