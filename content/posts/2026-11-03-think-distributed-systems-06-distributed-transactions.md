---
title: "Think Distributed Systems（六）：分布式事务——跨资源管理器的两阶段提交"
date: 2026-11-03T02:55:00Z
description: "从单 RM 到多 RM 的质变；形式化推导原子提交的本质困境、参与者悬决阻塞期，以及 2PC 与 3PC 的协议边界与工程演进。"
category: distributed-systems
column: think-distributed-systems
tags:
  - "分布式事务"
  - "两阶段提交"
  - "2PC"
  - "3PC"
  - "原子提交"
  - "阻塞协议"
---

# 第 6 章：分布式事务

本章涵盖：

- 单资源管理器（RM）到多资源管理器的演进
- 原子提交问题（Atomic Commit Problem）
- 两阶段提交协议（2PC）的力学推导
- 协调者崩溃与参与者悬决阻塞
- 优化与替代：3PC 与 Saga

在单机系统中，事务的提交只需修改一个本地持久化状态；而在分布式系统中，数据分散在多个独立自治的节点上。本章将推导分布式计算中最著名的经典难题之一：**分布式原子提交（Distributed Atomic Commit）**。

## 6.1 原子提交：从单 RM 到多 RM

单机事务之所以简单，是因为它只受制于单个**资源管理器（Resource Manager, RM）**。

![图 6.1：单资源管理器 vs 多个独立资源管理器架构对照](/media/posts/think-distributed-systems/fig-p100-6-1.png)
*图 6.1：单 RM 与多 RM 架构（Single RM vs. multiple RMs）*

如图 6.1 所示：
- **单 RM 场景**：RM 独占对存储硬件的控制权，原子提交就是写入一条 COMMIT 日志记录并刷盘，成功即提交，掉电即回滚，非黑即白；
- **多 RM 场景**：涉及两个或更多独立的 RM（例如订单库 RM1 与库存库 RM2）。各 RM 位于不同物理主机上，通过不可靠网络通信。

![图 6.2：跨多个 RM 的原子提交挑战](/media/posts/think-distributed-systems/fig-p101-6-2.png)
*图 6.2：多 RM 原子提交困境（Atomic commit across multiple RMs）*

图 6.2 揭示了核心矛盾：**如何保证所有 RM 要么全部提交、要么全部回滚？** 绝不能出现 RM1 提交而 RM2 回滚的情况，否则系统的全局业务一致性将彻底瓦解。

### 6.1.1 阻塞与非阻塞

在存在网络故障与机器崩溃的环境中，原子提交协议可能面临**阻塞（Blocking）**：

![图 6.3：分布式事务中的悬决阻塞状态](/media/posts/think-distributed-systems/fig-p102-6-3.png)
*图 6.3：悬决阻塞状态（Blocking state in distributed transactions）*

如图 6.3 所示，当协调者失联后，参与者处于“不知道其他参与者投票结果”的状态。为了维护安全性，参与者**既不能擅自提交，也不能擅自回滚，只能继续持有本地数据行锁无限期等待**，导致系统资源耗尽。

:::en
> **Original**: The Atomic Commit Problem requires a group of autonomous resource managers to reach a unanimous decision: either all commit their local subtransactions, or all abort them. If an algorithm can cause components to wait indefinitely for recovery before reaching a decision, it is called a blocking protocol. In asynchronous systems with crash failures, nonblocking atomic commit is impossible.

**📌 核心术语与语境解析**：
- **Resource Manager (RM)**：*资源管理器*。管理本地数据并提供 ACID 支持的独立存储单元。
- **Blocking protocol**：*阻塞协议*。在通信或节点中断时，存活节点必须暂停推进等待故障恢复的协议。
:::

## 6.2 两阶段提交协议（2PC）

为了解决原子提交问题，Jim Gray 于 1978 年提出了著名的**两阶段提交协议（Two-Phase Commit, 2PC）**。

![图 6.4：协调者与多个参与者交互架构拓扑](/media/posts/think-distributed-systems/fig-p103-6-4.png)
*图 6.4：协调者与参与者角色架构（The coordinator and participants）*

如图 6.4 所示，2PC 引入了一个中心角色：**协调者（Coordinator）**，其余节点为**参与者（Participants / RMs）**。

### 6.2.1 阶段一：准备阶段（Prepare / Voting Phase）

![图 6.5：两阶段提交第一阶段：协调者发起 Prepare 轮询投票](/media/posts/think-distributed-systems/fig-p104-6-5.png)
*图 6.5：2PC 第一阶段：准备阶段（2PC: Prepare phase）*

如图 6.5 所示：
1. 协调者向所有参与者广播 `PREPARE` 消息；
2. 每个参与者执行本地事务的预检、锁资源、写入 Undo/Redo 日志；
3. 若参与者准备就绪且有能力提交，向协调者回复 `VOTE_COMMIT`（赞成）；若自身因故无法保证（如断电风险、约束违背），回复 `VOTE_ABORT`（否决）。

### 6.2.2 阶段二：提交阶段（Commit Phase）

![图 6.6：两阶段提交第二阶段：全员赞成触发 Global Commit 提交](/media/posts/think-distributed-systems/fig-p104-6-6.png)
*图 6.6：2PC 第二阶段：提交阶段（2PC: Commit phase）*

如图 6.6 所示（全票通过场景）：
1. 协调者收集到**所有**参与者的 `VOTE_COMMIT` 响应；
2. 协调者在本地持久化写入一条 `COMMIT` 记录；
3. 协调者向所有参与者广播 `GLOBAL_COMMIT` 指令；
4. 参与者完成最终提交、释放锁资源，并向协调者回复 `ACK`。

![图 6.7：两阶段提交第二阶段：任一否决触发 Global Abort 中止](/media/posts/think-distributed-systems/fig-p105-6-7.png)
*图 6.7：2PC 中止场景（2PC: Abort scenario）*

若在阶段一中**任意一个**参与者回复了 `VOTE_ABORT`，或者协调者等待超时，如图 6.7 所示：
- 协调者决定全局回滚，持久化记录 `ABORT`；
- 向全体参与者广播 `GLOBAL_ABORT` 指令；
- 所有参与者根据 Undo 日志回滚已执行操作并释放锁。

## 6.3 2PC 的致命死穴：协调者崩溃与悬决期

2PC 是一个**严格满足安全性、但在活性上极其脆弱的阻塞协议**。

![图 6.8：协调者在发出 Prepare 后崩溃引发的全局阻塞](/media/posts/think-distributed-systems/fig-p106-6-8.png)
*图 6.8：协调者崩溃故障（2PC failure: Coordinator crash）*

图 6.8 展现了 2PC 最臭名昭著的故障场景：
- 所有参与者均已回复 `VOTE_COMMIT`；
- 协调者在写完本地决策后、尚未发出 `GLOBAL_COMMIT` 前突发停电崩溃；
- 此时全体参与者陷入了**悬决期（In-Doubt Period）**。

![图 6.10：参与者的悬决时段与锁资源冻结风险](/media/posts/think-distributed-systems/fig-p106-6-10.png)
*图 6.10：参与者悬决窗口（In-doubt period for participants）*

如图 6.10 所示，处于悬决期的参与者面临着严酷的困境：
- 参与者不能单方面中止：因为协调者可能已经把 `GLOBAL_COMMIT` 发给了其他参与者；
- 参与者不能单方面提交：因为可能存在其他参与者投了否决票；
- **参与者只能原地死等协调者复活，期间所持有的数据库锁全部被锁死！**

![图 6.9：参与者自身崩溃与基于日志的恢复时序](/media/posts/think-distributed-systems/fig-p106-6-9.png)
*图 6.9：参与者崩溃恢复（2PC failure: Participant crash）*

图 6.9 展示了参与者故障恢复：参与者必须在回复投票前将决策刷入本地 WAL。重启后扫描日志：若发现自己投了 COMMIT 但未收到最终决策，必须主动向协调者轮询决策结果。

## 6.4 优化与演进

### 推导中止（Presumed Abort）

![图 6.11：推导中止优化消除了回滚决策的写盘开销](/media/posts/think-distributed-systems/fig-p107-6-11.png)
*图 6.11：推导中止优化（Presumed Abort optimization）*

图 6.11 介绍了**推导中止（Presumed Abort）**协议：在传统 2PC 中，中止决策也需要写盘。优化后规定：如果协调者崩溃重启，在日志中找不到某事务的记录，则**默认推定该事务已中止**。这大幅减少了回滚路径上的磁盘 I/O。

### 三阶段提交协议（3PC）

为了解决 2PC 的单点阻塞，Skeen 提出了**三阶段提交协议（Three-Phase Commit, 3PC）**。

![图 6.12：三阶段提交协议引入 PreCommit 状态打破阻塞](/media/posts/think-distributed-systems/fig-p108-6-12.png)
*图 6.12：三阶段提交协议（Three-Phase Commit）*

如图 6.12 所示，3PC 将 2PC 的提交阶段拆分为两步，共三阶段：
1. **Can-Commit（询问阶段）**；
2. **Pre-Commit（预提交阶段）**：引入超时推进机制；
3. **Do-Commit（正式提交阶段）**。

通过在准备态与提交态之间插入缓冲区，3PC 保证存活节点在协调者崩溃时可以通过超时机制自主做出一致决定。然而，**3PC 必须依赖同步系统模型**（有界延迟与无分区假设）。在异步网络发生网络分区时，3PC 依然会发生脑裂并违背安全性。因此在工程实践中，3PC 极少被直接采用，现代架构多采用基于 Raft/Paxos 的复制共识或 Saga 补偿模式。

:::en
> **Original**: 2PC is fundamentally a blocking protocol. Once a participant votes yes, it gives up the autonomy to decide the outcome unilaterally. If the coordinator crashes while participants are in the in-doubt state, those participants must wait holding locks. 3PC attempts to alleviate this by introducing a Pre-Commit phase, but it requires a synchronous network model to guarantee correctness in the presence of partitions.

**📌 核心术语与语境解析**：
- **In-doubt state**：*悬决状态*。参与者已投票赞成但尚未收到全局决议的不可抉择状态。
- **Presumed Abort**：*推导中止*。一种工业界优化，无记录时默认推定为中止以降低日志开销。
:::

## 本章小结

1. **分布式原子提交的核心挑战**：全员一致（Unanimity）在不可靠通信网络与独立自治节点之间的博弈。
2. **2PC 的力学权衡**：以中心化协调者为锚点，牺牲活性（悬决期锁死阻塞）换取绝对安全性（永不产生部分提交）。
3. **现代工程出路**：
   - 跨机强一致：将协调者与参与者部署在基于 Raft/Paxos 的高可用副本组之上；
   - 跨服务长事务：拥抱最终一致性，采用 Saga 逆向补偿与事件驱动架构。
