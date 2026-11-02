---
title: "Think Distributed Systems（六）：分布式事务与两阶段提交"
date: 2026-11-03T03:00:00Z
description: "从单资源管理器的原子提交走向多资源管理器，推导 2PC 的 Prepare/Commit 两阶段、失败下的阻塞行为，以及为什么它只能保证安全性而牺牲活性。"
category: distributed-systems
column: think-distributed-systems
tags:
  - "分布式事务"
  - "两阶段提交"
  - "原子提交"
  - "阻塞协议"
  - "协调者"
  - "资源管理器"
---

# 第 6 章：分布式事务

本章涵盖：

- 分布式事务的概念
- 无失败时的两阶段提交（2PC）
- 有失败时的两阶段提交
- 2PC 的可能改进

分布式事务跨越多个系统，参与者通常称为**资源管理器（resource manager, RM）**。这个词不仅包括数据库，也包括消息队列等能参与分布式事务的系统。本章中“资源管理器”与“数据库系统”互换使用。

## 6.1 原子提交：从单个 RM 到多个 RM

第 5 章的转账在**单个 RM** 上执行：两条 UPDATE 加一个 COMMIT，原子性由一次本地写入保证。

但如果源账户在 RM1、目标账户在 RM2 呢？两条独立事务分别提交，就可能出现“一个提交、一个回滚”的分歧。**如何保证两个事务要么都提交、要么都中止？** 换言之，**如何保证两个（子）事务的组合本身就是一个事务？** 答案是**原子提交协议（atomic commit protocol）**。

事务以恰好一次 commit 或恰好一次 abort 结束，并且是**原子的**：

- 若以 commit 结束，其执行在可观察层面等价于“执行一次”；
- 若以 abort 结束，其执行在可观察层面等价于“从未执行”。

单 RM 上，原子提交靠**一次本地状态写入**保证：提交或中止时，RM 用一步把 commit/abort 记录写入本地状态；若在写入前失败，恢复后按“存在 abort 记录”处理。

多 RM 上，原子提交靠**原子提交协议**保证。其正确性同样由安全性与活性规定：

- **安全性**：不存在两个参与者，一个处于 commit、另一个处于 abort：

$$S: \nexists\ rm_1, rm_2:\ state[rm_1] = commit \wedge state[rm_2] = abort$$

- **活性**：每个参与者最终都会做出决定：

$$L: \forall\ rm:\ \Diamond\Box\, state[rm] = commit \ \vee\ \Diamond\Box\, state[rm] = abort$$

即每个 RM 的状态最终会永远保持 commit 或永远保持 abort。

### 6.1.1 阻塞与非阻塞

- **阻塞协议（blocking）**：参与者失败时只保证安全性，不保证活性；
- **非阻塞协议（nonblocking）**：**单个**参与者失败时，同时保证安全性与活性。

要让协议非阻塞，单个参与者的失败就不能阻止其他参与者判断事务该提交还是中止。

:::en
> **Original**: There are two types of atomic commit protocols: blocking and nonblocking. Blocking protocols guarantee safety but not liveness in the presence of participant failure. Nonblocking protocols guarantee both safety and liveness in the presence of a single participant failure. For a commit protocol to be nonblocking, a single participant's failure does not prevent other participants from deciding whether the transaction is committed or aborted.

**📌 核心术语与语境解析**：
- **Blocking protocol**：*阻塞协议*。参与者失败会卡住整个决策，安全性仍在，活性丢失。
- **Nonblocking protocol**：*非阻塞协议*。容忍单点失败，仍能达成决定。
:::

## 6.2 分布式事务的本质

**分布式事务（全局事务）由两个或更多非分布式事务（本地事务）组成。**

本地事务有四个状态：

- **Working（工作中）**：正在执行操作。可能转为 Aborted（例如违反一致性约束），也可能转为 Prepared 并等待提交/中止指令。
- **Prepared（已准备）**：不再执行操作，但尚未提交或中止。收到 commit 请求则提交，收到 abort 请求则中止。
- **Committed / Aborted**：到达最终、不可逆的状态。

分布式事务的状态是一个**状态向量**，包含各本地事务的状态，以及网络中尚未送达的消息。

:::en
> **Original**: A distributed transaction, also referred to as a global transaction, consists of two or more nondistributed transactions, also referred to as local transactions. ... We can think of a nondistributed transaction as being in one of four states: working, prepared, committed, or aborted.

**📌 核心术语与语境解析**：
- **Global / local transaction**：*全局事务 / 本地事务*。前者是后者的组合，后者是前者的组成单元。
- **State vector**：*状态向量*。全局事务的状态 = 各本地状态 + 在途消息。
:::

## 6.3 两阶段提交协议（2PC）

2PC 是最著名、被研究最多的原子提交协议。它在**无参与者失败**时保证安全性与活性；但只要出现**特定参与者的失败**，它就只保证安全性，不保证活性——因此它是一个**阻塞协议**。

### 6.3.1 无失败时

系统被划分为**恰好一个事务协调者（transaction coordinator, TC）**与**两个或更多 RM**，协议分两阶段执行：Prepare 与 Commit。

客户端先在各个 RM 上执行标准读写操作，然后不再直接要求 RM 提交，而是请求 TC 提交——2PC 由此开始。

**阶段一：Prepare**

1. TC 把 ⟨Prepare, Timeout⟩ 持久化写入日志，并向所有 RM 发送 ⟨Prepare⟩。
2. 若 RMi 决定提交，持久化写入 ⟨Vote-to-Commit⟩ 并发送给 TC；若决定中止，则持久化写入 ⟨Abort⟩、发送给 TC，并中止本地事务。

**阶段二：Commit**

1. 若 TC 收到**全部** RM 的 ⟨Vote-to-Commit⟩，持久化写入 ⟨Commit⟩ 并向所有 RM 发送 ⟨Commit⟩。
2. 若 TC 收到**至少一个** ⟨Abort⟩ 或发生超时，持久化写入 ⟨Abort⟩ 并向所有 RM 发送 ⟨Abort⟩。
3. 各 RM 收到指令后持久化写入 ⟨Commit⟩ 或 ⟨Abort⟩，并提交或中止本地事务。

> **顿悟时刻：Vote-to-Commit 与 Abort 的不对称**
>
> Prepare 阶段不是 ⟨Vote-to-Commit⟩/⟨Vote-to-Abort⟩ 这一对，也不是 ⟨Commit⟩/⟨Abort⟩ 这一对，而是 **⟨Vote-to-Commit⟩ 与 ⟨Abort⟩** 这一对。也就是说：**RM 不能单方面提交，但可以单方面中止。**

:::en
> **Original**: The 2PC protocol partitions the system into exactly one transaction coordinator (TC) and two or more RMs. The protocol executes in two phases: Prepare and Commit. ... During the protocol's first phase, the TC asks all participating RMs whether they vote to commit or abort their local transactions. In the second phase, the TC instructs all participating RMs to commit or abort.

**📌 核心术语与语境解析**：
- **Transaction coordinator (TC)**：*事务协调者*。唯一决策者，负责汇总投票并广播决定。
- **Vote-to-Commit**：*提交票*。RM 的承诺：一旦投出，就必须等待 TC 的最终决定。
:::

### 6.3.2 有失败时

#### RM 失败

**一个或多个 RM 失败不会阻塞协议**，2PC 仍能同时保证安全性与活性。恢复行为取决于失败发生在哪个日志点之后：

- 在持久化 ⟨Vote-to-Commit⟩ 或 ⟨Abort⟩ **之前**失败 → 恢复后写 ⟨Abort⟩ 并通知 TC（**尚未承诺**）；
- 在持久化 ⟨Vote-to-Commit⟩ **之后**失败 → 恢复后必须向 TC 询问决定（**已经承诺**）；
- 在持久化 ⟨Commit⟩ **之后**失败 → 恢复后执行 **REDO**，确保操作生效；
- 在持久化 ⟨Abort⟩ **之后**失败 → 恢复后执行 **UNDO**，确保操作不生效。

#### TC 失败

**TC 失败会阻塞协议**：只保证安全性，不保证活性。

若某个 RM 已持久化 ⟨Vote-to-Commit⟩ 而 TC 失败，该 RM 就被**卡住**——它不能提交（怕别人中止），也不能中止（怕别人提交），只能等 TC 修复。

设想所有 RM 都投了提交票，TC 在通知 RM1 提交之后崩溃：RM2 既不能提交也不能中止，因为它不知道其他 RM 是否已经提交。

:::en
> **Original**: The 2PC protocol guarantees safety but not liveness in case the TC fails. A failure of the TC may block the protocol. If the TC fails after a participating RM persistently records ⟨Vote-to-Commit⟩, the RM is stuck. ... RM2 can neither commit nor abort the transaction because it does not know whether any other RMs have already committed or aborted.

**📌 核心术语与语境解析**：
- **Blocked**：*被阻塞*。参与者已投票但未收到决定，只能等待协调者恢复。
- **REDO / UNDO**：*重做 / 撤销*。已提交则确保生效，已中止则确保不生效。
:::

### 6.3.3 改进方向

2PC 的许多变体都以**提升活性**为目标：减少阻塞执行的数量。但注意——它们只是**减少**，并没有**消除**阻塞。

常见的改进思路包括：

- **协调者复制**：把 TC 的状态复制到多个节点，TC 失败时由备节点接管，避免单点阻塞；
- **三阶段提交（3PC）**：在 Prepare 与 Commit 之间加入 PreCommit 阶段，使参与者在超时后能推断出决定，从而在**无网络分区**假设下非阻塞；
- **共识驱动的提交**：用 Raft/Paxos 复制协调者日志，把“决定”本身变成共识问题（第 10 章）。

这些方案共同揭示了 2PC 的结构性代价：**“已投票但未决定”的窗口天然存在**，而这个窗口正是阻塞的来源。

## 本章小结

1. **单 RM 的原子性靠一次本地写入**；多 RM 的原子性必须靠原子提交协议。
2. **安全性 = 不会出现一提交一中止**；**活性 = 每个参与者最终都会决定**。
3. **2PC 两阶段**：Prepare 收集投票，Commit 广播决定；所有日志写入都必须持久化。
4. **RM 失败不阻塞，TC 失败会阻塞**——这是 2PC 被称为阻塞协议的根本原因。
5. **Vote-to-Commit 是不对称的承诺**：可以单方面中止，不能单方面提交。
6. **改进只能减少阻塞，不能消除阻塞**；真正非阻塞需要更强的假设或共识机制。

