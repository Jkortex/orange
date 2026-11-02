---
title: "Think Distributed Systems（十）：分布式共识与 Raft"
date: 2026-11-03T03:40:00Z
description: "共识是状态机复制的基石：用有效性、完整性、一致性三个安全性质与终止性一个活性性质刻画问题，用领导者加法定人数实现，用 Raft 的任期、选举与日志复制落地。"
category: distributed-systems
column: think-distributed-systems
tags:
  - "共识"
  - "Raft"
  - "Paxos"
  - "状态机复制"
  - "法定人数"
  - "FLP"
---

# 第 10 章：分布式共识

本章涵盖：

- 共识（consensus）
- 状态机复制（state machine replication）
- Raft 共识协议

分布式共识是分布式系统的基础抽象。它曾长期被认为无法实现，如今却是构建可靠、可扩展系统的基石：它让一组冗余进程**步调一致地行动，如同一个进程**，从而在任意时刻都能用组内其他进程补偿失败者。

无法达成共识往往是灾难性的：事务到底提交了还是中止了？操作 A 是否先于 B？锁被组件 1 还是组件 2 获取？这些问题一旦出现分歧，系统立刻表现错误。

## 10.1 达成一致的挑战

问题陈述很简单：一组并发进程通过网络收发消息，就**单个值**达成一致。

但难度全在模型里：

- 理论模型中，组件不失败、网络恰好一次且按序投递——共识**平凡可解**；
- 现实模型中，组件会失败、网络会重排/延迟/丢失/重复——共识**出了名地难**。

第 8 章的原子提交就是一个共识问题：一组资源管理器必须就“提交还是中止”达成一致。2PC 的教训是：协调者失败会**阻塞**协议——保证安全性，牺牲活性。

**共识算法保证安全性，并力图（但不保证）提供活性；任何单点失败都不能让系统停摆。**

> **顿悟时刻：FLP 不可能性定理**
>
> Fischer、Lynch、Paterson 证明：在**没有时钟的异步系统**中，即使只有一个节点可能失败，也无法在所有情况下保证共识。
>
> 但这个定理主要针对“在无时钟异步系统中保证活性”的固有限制，**并不排除在更受限的模型下实现共识**——例如带时钟的异步模型，共识是可能的。

:::en
> **Original**: Consensus is trivial to achieve in a theoretical system model, where components are not subject to failure and the network delivers messages exactly once and in order. But consensus is difficult to achieve in a realistic system model, where components may fail and the network may reorder, delay, lose, or duplicate messages. ... Consensus algorithms guarantee the safety of a system and aim to provide—but do not guarantee—the liveness of the system.

**📌 核心术语与语境解析**：
- **FLP impossibility**：*FLP 不可能性*。无时钟异步系统中共识活性不可保证。
- **Lockstep**：*步调一致*。多个副本按相同顺序执行相同操作，是状态机复制的核心。
:::

## 10.2 系统模型

系统由**进程集合（Processes）** 与**值集合（Values）** 构成。进程 p 可能发生**崩溃失败**（直接停机）。进程可以提出值，记作 Propose(p, v)；也可以决定值，记作 Decide(p, v)。

共识算法必须保证三个安全性质与一个活性性质：

- **有效性（validity）**：若进程决定了值 v，则 v 必须由某个进程提出过。

$$\forall p \in Processes,\ \exists q \in Processes,\ \forall v \in Values: Decide(p, v) \Rightarrow Propose(q, v)$$

- **完整性（integrity）**：决定是永久的——进程不会对同一个决定反悔。

$$\forall p \in Processes,\ \forall v, v' \in Values: Decide(p, v) \wedge Decide(p, v') \Rightarrow v = v'$$

- **一致性（agreement）**：没有两个正确进程决定不同的值。

$$\forall p, q \in Processes,\ \forall v, v' \in Values: Decide(p, v) \wedge Decide(q, v') \Rightarrow v = v'$$

- **终止性（termination）**：每个未失败进程最终都会决定某个值。

$$\forall p \in \{p \in Processes \mid alive(p)\},\ \exists v \in Values: \Diamond\Box\, Decide(p, v)$$

有效性与终止性略显学术，而**一致性与完整性恰好抓住了直觉**：大家认同一个值，且不反悔。

:::en
> **Original**: A consensus algorithm is any algorithm that ensures the safety properties of validity, integrity, and agreement and the liveness property of termination. Although validity and termination feel a bit academic, agreement and integrity neatly capture our intuition of consensus: all processes agree on the same value and do not go back on their word.

**📌 核心术语与语境解析**：
- **Agreement / Integrity**：*一致性 / 完整性*。前者要求“同一个值”，后者要求“不反悔”。
- **Termination**：*终止性*。活性性质，正是 FLP 指出无法无条件保证的部分。
:::

## 10.3 状态机复制

共识之所以重要，是因为它是**状态机复制**的基础——把单个进程机械地转化为**容错的进程组**。

原理只有一句：**两个相同的确定性进程，从相同状态出发、按相同顺序接收相同输入，就会产生相同输出、到达相同状态。**

于是，“保证多个进程步调一致”就被归约为“**就提供输入的日志达成共识**”。

以复制型键值存储为例：共识协议保证每个副本按相同顺序收到相同命令（x := 0、y := 1、z := 2），从而得到一个能在节点崩溃时自我补偿的可靠存储。

:::en
> **Original**: State machine replication operates on a simple principle: if two identical, deterministic processes begin in the same state and receive the same inputs in the same order, they will produce the same output and reach the same state. In other words, the challenge of ensuring that multiple processes progress in lockstep can be reduced to the challenge of reaching consensus on the log that supplies their inputs.

**📌 核心术语与语境解析**：
- **Deterministic**：*确定性的*。相同输入必得相同状态，是状态机复制的前提。
- **Log**：*日志*。输入的全序载体，共识的对象。
:::

## 10.4 共识的起源与讽刺

Leslie Lamport（2013 年图灵奖得主）最初想证明“容错共识不可能”。结果 1989 年，他反而设计并发表了通常被视为**第一个容错共识算法**的 **Paxos**：把共识表述为**单次决定**，让一组 write-once 寄存器在失败与不可靠网络下被设成同一个值。

Paxos 有局限：它解决的是“单个决定”，而真实系统需要**一系列决定**的一致性。**Multi-Paxos** 在 Paxos 基础上实现一系列决定的共识，从而适用于状态机复制。

> **顿悟时刻：Viewstamped Replication**
>
> 1988 年，Brian Oki 与 Barbara Liskov 发表了 Viewstamped Replication。它没有 Paxos 那样的名气，论文也没用“共识”一词，但解决的是同一个问题。因此，**第一个公开发表的共识算法其实是 Viewstamped Replication，而不是 Paxos。**

## 10.5 实现共识

Multi-Paxos、Raft、Viewstamped Replication 等著名算法，都结合了两个想法：**领导者（leader）** 与 **法定人数（quorum）**。

- **基于领导者**：在理论模型中，指定一个“终身仁慈独裁者（BDFL）”即可——一个人说了算，共识唾手可得。但领导者一旦失败，就需要重新选主。
- **基于法定人数**：不依赖单一领导者，而要求多数派同意，从而在少数节点失败时仍能推进。
- **二者结合**：领导者负责**排序**（决定日志条目的顺序），法定人数负责**提交**（决定条目是否进入日志）。

:::en
> **Original**: Many well-known consensus algorithms, including Multi-Paxos, Raft, and Viewstamped Replication, combine the idea of a leader with the idea of a quorum. ... the leader is responsible for ordering (determining the order of log entries) and a quorum to ensure message commitment (deciding the inclusion of entries in the log).

**📌 核心术语与语境解析**：
- **Leader**：*领导者*。负责给请求排序，避免并发冲突。
- **Quorum**：*法定人数*。多数派确认，保证决定不可被推翻。
:::

## 10.6 Raft

Raft 以**可理解性**为设计目标，但依然是复杂算法。它用**领导者 + 法定人数**实现日志复制。

### 10.6.1 日志

Raft 的目标是保证集群内所有节点的**日志一致性**：对任意两个节点 n1、n2，其日志 l1、l2 在**提交索引（commit index）** 之前，必有一个是另一个的子序列。

提交索引是“已知被复制到法定人数、因而视为已提交”的最高条目索引。**日志一致性是状态机安全（state machine safety）的前提**：已提交的条目永不丢失，可以安全地应用到应用层状态机。

Raft 用日志本身来保证日志一致性：**选举时，只有日志最新的候选者才有资格成为领导者。**

> **顿悟时刻：应用层与平台层**
>
> Raft 有两层操作：平台层运行核心协议（选举、复制、提交），条目提交后交给应用层；应用层有自己的状态机，把条目应用到应用状态。因此 Raft 保证的不只是平台层共识，还有**应用层行为的一致性**。

### 10.6.2 任期

Raft 用**单调递增的任期（term）** 划分时间，构成一个逻辑时钟，是协议正确性的核心。每个任期包含两个阶段：

- **领导者选举**（Request Vote 协议）：保证任意时刻只有一个领导者处于活动状态，并在领导者失败时迅速选出新领导者；
- **日志复制**（Append Entries 协议）：处理客户端请求，管理日志条目在集群中的传播。

每个任期：先选主，再把管理复制日志的权力委托给领导者。领导者接收条目、复制到其他节点、并决定何时可以应用。

> **顿悟时刻：任期即围栏令牌（fencing token）**
>
> 我们常说“Raft 保证只有一个领导者”，但需要澄清：Raft **不保证**任意时刻只有一个节点**自认为**是领导者，它保证的是**只有一个节点能实际行使领导者职权**。
>
> 若两个节点都自认为是领导者，关键在于**任期号**：旧领导者的任期必然更低。任期号充当围栏令牌——节点把收到消息的任期与自己的当前任期比较，任期更低的消息被立即拒绝。

:::en
> **Original**: In Raft, time is delineated in monotonically increasing terms, creating a logical clock that is central to the protocol's correctness. ... Raft does not guarantee that only one node believes itself to be the leader at any given time, but it does guarantee that only one node may act as the leader. ... The term number acts as a fencing token.

**📌 核心术语与语境解析**：
- **Term**：*任期*。单调递增的逻辑时钟，兼作领导者合法性的判据。
- **Fencing token**：*围栏令牌*。用单调编号拒绝过期领导者的请求。
:::

### 10.6.3 领导者选举

节点有三种状态：**Follower**、**Candidate**、**Leader**。

- **Follower**：节点启动或崩溃恢复后从 Follower 开始，监听 Leader 的消息。每个 Follower 有一个**随机超时**的选举定时器，收到消息即重置；超时即怀疑 Leader 失败，发起选举。
- **Candidate**：Follower 递增当前任期、转为 Candidate，给自己投票并向其他节点发 RequestVote。三种结果：
  - **获得法定票**：成为该任期的 Leader；
  - **选票分裂**：未获法定票，发起新一轮选举，直到当选或得知新任期/新 Leader；
  - **被降级**：得知新任期与新 Leader，退回 Follower。
- **Leader**：当 Leader 得知更高的任期与新 Leader 时，退回 Follower。

### 10.6.4 日志复制

1. **接受（Accept）**：Leader 接受客户端的新条目；
2. **追加（Append）**：Leader 把条目追加到自己的日志；
3. **传播（Propagate）**：Leader 通过 AppendEntries 把条目发给其他节点；
4. **提交（Commit）**：Follower 追加并回 Ack；当 Leader 收到**法定人数**（含自身）的 Ack，就推进提交索引。

### 10.6.5 状态机安全

Raft 的关键安全性质是：**若某进程已把某索引处的条目应用到状态机，则其他进程永远不会在该索引处应用不同的条目。**

实现方式是对“谁能当选”施加限制：**只有日志最新的候选者才能当选。** 比较两条日志的新旧，先比最后条目的**任期**，任期相同再比**索引**——任期更大者更新，任期相同则索引更大者更新。

:::en
> **Original**: The key safety property for Raft is state machine safety. If a process has applied a log entry at a given index to its state machine, no other process will ever apply a different log entry for the same index. Raft guarantees state machine safety by placing restrictions on which process may be elected leader: only a candidate with the most up-to-date log may be elected leader.

**📌 核心术语与语境解析**：
- **State machine safety**：*状态机安全*。同一索引不会被应用成不同条目。
- **Up-to-date log**：*最新日志*。选举资格的判据，保证已提交条目不被覆盖。
:::

## 本章小结

1. **共识 = 就单个值达成一致**，需满足有效性、完整性、一致性、终止性。
2. **FLP 说明无时钟异步系统无法无条件保证活性**，但换模型即可实现。
3. **状态机复制把“步调一致”归约为“日志共识”**，是共识最重要的应用。
4. **Paxos 解决单次决定，Multi-Paxos 解决一系列决定**；Viewstamped Replication 更早。
5. **领导者负责排序，法定人数负责提交**——两者结合是所有现代共识算法的骨架。
6. **Raft 用任期作逻辑时钟与围栏令牌**，用日志新旧限制选举资格，保证状态机安全。

