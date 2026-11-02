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

异步模型同样细节各异，但差异更为根本：

- 有的模型假设**完全没有时间概念**；
- 有的模型假设**弱时间概念**。

有些问题在“无时间”假设下无解，在“弱时间”假设下却有解。看到“异步系统”时，先确定它采用哪种时间概念，再判断该概念在此语境下是否重要。

**无时间概念**：组件无法访问任何时钟，事件在任意时刻发生或延迟任意长。时间概念不存在，最重要的后果是**组件无法使用超时（timeout）**——而超时正是失败检测与缓解的关键机制。

**弱时间概念**：组件可访问一个与其他时钟不同步、偏差未知的时钟。时间概念存在，因此**可以使用超时**。

### 2.1.4 部分同步系统

同步与异步都是**理论**模型。现实中，没有系统完全同步或完全异步，真实行为落在两者之间。

**部分同步模型（partially synchronous）**承认这一现实：系统**大多数时候同步，某些时候异步**。这符合我们的经验——组件与网络通常表现良好，偶尔抽风。家庭宽带就是贴切的例子：多数时候访问很快，偶尔变慢甚至超时，然后恢复正常。

一种典型的协议设计策略是：**系统同步时保证安全性与活性；系统异步时优先保证安全性、牺牲活性**——即使“好事”不发生，也绝不让“坏事”发生。第 3 章会详细讨论失败容忍。

:::en
> **Original**: Both synchronous and asynchronous system models are theoretical system models. In reality, no distributed system displays entirely synchronous or entirely asynchronous behavior; the system's behavior lies somewhere in between. The partially synchronous system model acknowledges this reality and postulates that a distributed system is synchronous most of the time and asynchronous at other times. ... A typical approach to designing protocols is to ensure safety and liveness guarantees when the system operates synchronously and to prioritize safety over liveness when the system operates asynchronously, thus ensuring that nothing bad will happen even if something good won't happen.

**📌 核心术语与语境解析**：
- **Partially synchronous**：*部分同步*。介于同步与异步之间的现实模型，是工程系统的默认假设。
- **Safety over liveness**：*安全优先于活性*。异步期间宁可“不响应”，也不“给出错误答案”。
:::

### 2.1.5 组件与网络行为

组件与网络常以其失败行为来刻画。

**组件失败模型**（由弱到强）：

- **Crash-Stop（崩溃停止）**：最基础的模型。组件在任意时刻停止执行任何内部或外部步骤，此后永不再执行——**组件不复存在**。
- **Omission（遗漏）**：组件在任意时刻停止执行，持续任意时长，然后**从失败时的状态恢复**继续执行——**组件只是打了个盹**，不会丢失内存。
- **Crash-Recovery（崩溃恢复）**：组件停止执行任意时长后恢复，但**可能丢失状态**——部分或全部内存丢失。
- **Byzantine（拜占庭）**：组件以任意方式行为，包括故意偏离算法的欺骗行为——**什么都可能发生**。

**网络失败模型**：

- **消息重排（reordering）**：投递顺序与接收顺序不一致；
- **消息重复（duplication）**：同一消息被投递多次；
- **消息丢失（loss）**：消息根本没有投递。

我们假设网络**不会撒谎**：如果网络把消息投递给某组件，就认为该消息确实由系统中的某个组件发出。同时具备重排、重复、丢失的网络，通常称为**不可靠网络（unreliable network）**。

### 2.1.6 现实的系统模型

综合以上，可以给出一个务实的系统模型：

- 系统**大部分时间同步，某些时刻异步**（部分同步）；
- 组件可能因崩溃失败，也可能恢复，**易失状态丢失、持久状态保留**（Crash-Stop / Omission / Crash-Recovery）；
- 网络可能重排、丢弃、重复消息（不可靠网络）。

更形式化地说：分布式系统是**部分同步的**，由可能发生 Crash-Stop、Omission、Crash-Recovery 失败的组件组成，通过不可靠网络通信。拜占庭失败在加密货币等领域很重要，但本书基本不涉及。**这就是我思考分布式系统时默认的模型。**

:::en
> **Original**: In practical terms, distributed systems are synchronous most of the time and asynchronous at certain times. Components may fail due to crashes but may also recover, forgetting some state (volatile) but remembering other state (durable). The network may reorder, drop, or duplicate messages. More formally, distributed systems are partially synchronous, consisting of components subject to Crash-Stop failure, Omission failure, and Crash-Recovery failure communicating over an unreliable network.

**📌 核心术语与语境解析**：
- **Volatile / durable state**：*易失/持久状态*。崩溃恢复后是否仍然存在，是区分失败模型的关键。
- **Unreliable network**：*不可靠网络*。允许重排、重复、丢失，但不会凭空捏造消息。
:::

## 2.2 顺序与时间

组件不仅在通信，还在**协作与协调**。协作与协调的本质，是管理组件各步骤之间的**依赖关系**。

一般而言，动作**不可交换（not commutative）**：协作与协调的结果取决于动作施加的顺序。因此，确定正确的顺序至关重要。那么问题来了：**我们如何确定正确的顺序？**

考虑两个提议者 P1、P2 与两个接受者 A1、A2，初始状态 A1 = A2 = 0。提议者向接受者广播简单算术操作，如 (+2) 或 (×2)，接受者按接收顺序把请求施加到本地状态。

- 若 P1、P2 都广播 (+2)，顺序不影响结果（可交换）；
- 若 P1 广播 (+2)、P2 广播 (×2)，顺序就影响结果（不可交换）。

即使作为全知观察者，我们也无法立刻判断哪种顺序正确，因为 P1、P2 同时广播。但直觉告诉我们这不对：我们期望 A1 与 A2 得到相同的值，并以相同顺序施加操作。既然二者同时广播，那么**只要保证顺序一致，具体是哪种顺序并不重要**。

> **顿悟时刻：竞态条件**
>
> 本书的定义是：**若系统存在多种可能的执行，其中一些被认为是正确的、一些被认为是错误的，则系统存在竞态条件。** 若 P1、P2 只能广播 (+n) 或只能广播 (×n)，则不存在竞态；若能同时广播两种操作，则存在竞态，因为只有特定投递顺序才能让接受者得到一致结果。这可能是最抽象、最普适的竞态定义。

引入协调者 C 可以解决这个问题：P1、P2 不再直接广播，而是把请求发给 C（初始 C = 0）。C 收到请求后，用当前状态给请求打标签，广播给 A1、A2，再把值加 1。接受者记录已施加的最新请求；若收到标签更大的请求，就知道自己漏了步骤，可以延迟施加直到补齐。

注意：作为全知观察者，我们看到 P1 先发出 (+2)、P2 后发出 (×2)，但网络先投递了 (×2)。这有问题吗？P1 与 P2 没有协调过，谁也无法观察对方，因此**任何投递顺序都是可接受的**。C 把 (×2) 标为 0、(+2) 标为 1，接受者据此重排后再施加。**顺序，以及建立顺序的能力，是分布式系统许多问题与解法的基础。**

:::en
> **Original**: In general, actions are not commutative. The result of collaboration and coordination depends on the order in which actions are applied. Therefore, establishing the correct order of actions is crucial for correct results. ... Both order and the ability to establish order are fundamental to many distributed system problems and their solutions.

**📌 核心术语与语境解析**：
- **Commutative**：*可交换*。施加顺序不影响结果的性质；不可交换是排序问题的根源。
- **Coordinator**：*协调者*。为请求赋予全序标签的组件，是后续共识算法的雏形。
:::

### 2.2.1 happened-before 关系

Leslie Lamport 在 1978 年的经典论文《Time, Clocks, and the Ordering of Events in a Distributed System》中，提出了至今仍被广泛使用的形式化框架：**happened-before 关系**，从组件内与组件间两个维度定义事件的先后。

- **组件内（intracomponent）**：若事件 a、b 发生在同一组件，且 a 先于 b 发生，则 a happened-before b。
- **组件间（intercomponent）**：若 a、b 发生在不同组件，a 是“发送消息”事件、b 是对应的“接收消息”事件，则 a happened-before b。

happened-before 是一种**偏序（partial order）**：对任意事件对 a、b，要么 a→b，要么 b→a，要么 a 与 b **并发（concurrent）**，记作 a || b。

它还具有**传递性**：若 a→b 且 b→c，则 a→c。

**因果关系（causality）**：happened-before 捕捉的是事件间的因果性——这里的“因果”指 a **可能**影响了 b，而不是 a 确实影响了 b。思考分布式系统时，永远要考虑事件的因果性，并仔细判断系统违反该因果性的可能性。

:::en
> **Original**: In this paper, Lamport introduces a formal framework that is widely used today: the happened-before relationship. Lamport defines the happened-before relationship in terms of intra- and intercomponent relations of events. ... The happened-before relationship is a partial order. For each pair of events a and b, a happened before b, b happened before a, or a and b are concurrent. ... Here, causal refers to the fact that an event a potentially influenced an event b, not that a actually influenced event b.

**📌 核心术语与语境解析**：
- **Happened-before**：*先于发生关系*。事件间的偏序，是逻辑时钟与一致性模型的基础。
- **Causality**：*因果性*。可能的影响关系，而非确定的影响事实。
:::

> **顿悟时刻：并发 vs. 并行**
>
> 并发（concurrency）以**事件**定义——事件是时间点；并行（parallelism）以**操作**定义——操作是时间段。把操作看作“开始事件 + 结束事件”即可弥合差异：
>
> - 若 a 不先于 b、b 也不先于 a，则事件 a、b 并发；
> - 若 o1 的结束事件不先于 o2 的开始事件，且 o2 的结束事件不先于 o1 的开始事件，则操作 o1、o2 并发；
> - 若两个操作在时间上重叠，则它们**并行**。
>
> 结论：**并发由逻辑时钟与逻辑时间判定，并行由物理时钟与物理时间判定。**

### 2.2.2 时间与时钟

分布式系统依赖时钟作为时间戳来源。要让时钟能准确排序事件，必须保证**时钟一致性（clock consistency）**：若事件 a happened-before 事件 b，则 a 的时间戳小于 b 的时间戳。

$$a \rightarrow b \Rightarrow C(a) < C(b)$$

只要时钟一致，即使事件发生在不同组件上，也能据此推理因果顺序。

### 2.2.3 物理时间与物理时钟

物理时钟是用物理时间为事件打时间戳的物理设备。但在分布式系统中，比较不同时钟的时间戳非常困难，因为存在**时钟偏移（clock skew）**与**时钟漂移（clock drift）**——物理时钟既不完美，也不同步。

> **顿悟时刻：挂钟（wall clock）**
>
> 作为拥有全局视角的全知观察者，我们可以假设自己有一个“挂钟”——假想的完美物理时钟。现实中没有任何组件能访问它；组件要测时间，只能用自己的物理时钟。挂钟只是讨论的参考基准。

- **时钟偏移**：两个时钟之间的时间差。例如两个时钟一开始就差 5 分钟，并保持这个固定偏移。
- **时钟漂移**：两个时钟走时频率不同，起初一致，随时间逐渐发散。

**缓解手段**：NTP（Network Time Protocol）等时钟同步协议——NTP 服务器广播自己的读数，客户端调整时钟以匹配，从而缓解偏移与漂移。

**墙上时钟 vs. 单调时钟**：

- **Time-of-day（墙上时钟）**：尽量贴近真实时间，但同步时可能**回拨**，因此即使与自身比较也可能违反时钟一致性；
- **Monotonic（单调时钟）**：与墙上时间无关，但保证**不会倒退**，与自身比较时满足时钟一致性。

由于单调时钟独立于墙上时间，它只能在**组件内**比较，不能跨组件比较。

:::en
> **Original**: Physical clocks are physical devices that use physical time to timestamp events. But physical clocks in distributed systems face a major challenge: comparing timestamps from different clocks can be difficult due to clock skew and drift. These problems arise because physical clocks are neither perfect nor perfectly synchronized. ... Time-of-day clocks provide a timestamp as close as possible to wall-clock time but may move backward due to clock synchronization. ... Monotonic clocks provide a timestamp independent of wall-clock time but guarantee that time will not move backward.

**📌 核心术语与语境解析**：
- **Clock skew**：*时钟偏移*。两个时钟读数之间的固定或缓变差值。
- **Clock drift**：*时钟漂移*。走时频率不同导致的持续发散。
- **Monotonic clock**：*单调时钟*。保证不倒退、仅可组件内比较的时钟。
:::

### 2.2.4 逻辑时间与逻辑时钟

Lamport 同时提出了**逻辑时间**与**逻辑时钟**：让事件按其 happened-before 关系排序。逻辑时钟是用逻辑时间为事件打时间戳的逻辑设备，其中最著名的是 **Lamport 时钟**。

每个组件维护一个 Lamport 计数器，每次内部或外部步骤递增，并用当前值为事件打标签。组件发送消息时，接收方把自己的 Lamport 值更新为 **max(本地时间戳, 收到的时间戳) + 1**。这保证因果相关的事件被赋予严格递增的逻辑时间值。

Lamport 时钟广为人知、被广泛讨论，但未必被广泛实现——我本人从未用 Lamport 时钟捕捉事件顺序。但逻辑时钟并不只有这一种形态，它无处不在：

- **Kafka**：每个分区内的消息被赋予 offset。分区可视为逻辑时钟，offset 可视为逻辑时间戳；同一分区内 a 先入队则 offset(a) < offset(b)，但**跨分区的 offset 不可比较**。
- **etcd**：每个键有一个序列号（sequence number），更新时递增，支撑 compare-and-swap 等操作。键可视为逻辑时钟，序列号可视为逻辑时间戳；对同一键，a 先于 b 则 seq(a) < seq(b)，但**跨键的序列号不可比较**。

即使你看不到 Lamport 时钟或向量时钟，只要眯起眼睛，总能看到类似逻辑时钟与逻辑时间戳的东西。

:::en
> **Original**: In the paper mentioned in section 2.2.1, Lamport proposed logical time and logical clocks to establish the order of events. Logical time allows events to be ordered by their happened-before relationship. ... Each component in the distributed system maintains a Lamport clock, a counter that is incremented with every internal or external step. ... When a component sends a message to another component, the receiving component updates its own Lamport clock value to the maximum of its current timestamp and the received timestamp plus 1.

**📌 核心术语与语境解析**：
- **Logical clock**：*逻辑时钟*。以计数器刻画因果顺序的设备，与物理时间无关。
- **Offset / sequence number**：*偏移量 / 序列号*。Kafka 与 etcd 中逻辑时间戳的工程化身。
:::

### 2.2.5 物理时钟 vs. 逻辑时钟

两者通常配合使用：**物理时钟用于度量组件内事件的持续时间，逻辑时钟用于建立跨组件事件的顺序。** 物理时钟受漂移、偏移与同步问题困扰，可能导致全局排序不一致；逻辑时钟则即使物理时钟失步，也能提供一致的顺序。

:::en
> **Original**: Physical clocks and logical clocks are commonly used in tandem to create a sense of order and time in distributed systems. Physical clocks are employed to measure the duration between events within a component, whereas logical clocks are employed to establish the order of events across components.

**📌 核心术语与语境解析**：
- **In tandem**：*协同使用*。物理时钟负责“多久”，逻辑时钟负责“先后”。
:::

## 本章小结

1. **系统模型 = 假设集合**：组件是否失败、消息是否丢失、时钟是否同步，决定了算法的能力边界。
2. **同步 / 异步 / 部分同步**：前两者是理论极端，后者是现实常态——大多数时候同步，偶尔异步。
3. **失败模型**：Crash-Stop、Omission、Crash-Recovery、Byzantine，从“不复存在”到“什么都可能发生”。
4. **顺序不可回避**：动作通常不可交换，因此必须建立顺序；协调者通过标签赋予全序。
5. **happened-before**：偏序、传递、刻画因果；并发与并行的分界由此清晰。
6. **时钟一致性**：a→b ⇒ C(a) < C(b)，这是用时间戳推理因果的前提。
7. **物理时钟不完美**：偏移与漂移无法消除，只能缓解；单调时钟可保证不倒退，但仅限组件内。
8. **逻辑时钟无处不在**：Kafka offset、etcd 序列号，都是逻辑时间戳的工程形态。

