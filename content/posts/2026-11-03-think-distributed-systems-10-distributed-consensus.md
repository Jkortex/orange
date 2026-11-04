---
title: "Think Distributed Systems（十）：分布式共识——从状态机复制到 Raft"
date: 2026-11-03T03:30:00Z
description: "共识算法的核心是状态机复制（SMR）；从 Paxos 的理解困境走向 Raft，拆解任期、选举安全与日志匹配三大不变式。"
category: distributed-systems
column: think-distributed-systems
tags:
  - "共识算法"
  - "Raft"
  - "Paxos"
  - "状态机复制"
  - "SMR"
  - "领导者选举"
---

# 第 10 章：分布式共识

本章涵盖：

- 达成一致（consensus）的本质难题
- 状态机复制（State Machine Replication, SMR）
- 法定人数（Quorum）相交性质
- Raft 共识协议的解构与三大不变式
- 分区与网络故障下的共识谜题解析

**共识（Consensus）是分布式系统的圣杯。** 它解决的问题看似极其简单：**让一组相互独立的节点就某一个值或某一组操作序列达成完全一致的决定，即使其中部分节点发生崩溃或网络发生中断。**

## 10.1 达成一致的挑战

在单节点上，达成一致无需算法，因为只有一个意志；而在分布式系统中，根据 FLP 不可能性定理（Fischer, Lynch, Paterson, 1985）：**在完全异步的系统模型中，只要有一个节点可能崩溃，就不存在任何确定性的算法能够保证达成共识。**

因此，所有实用的共识协议（Paxos, Raft, Viewstamped Replication）都建立在**部分同步模型（Partially Synchronous）**之上：平时依赖随机超时与活性推进，在网络恢复后稳定达成共识。

## 10.2 状态机复制（SMR）

共识算法最强大的落地形态是**状态机复制（State Machine Replication, SMR）**。

![图 10.1：状态机复制架构全景图：客户端、共识引擎、日志与确定性状态机](/media/posts/think-distributed-systems/fig-p154-10-1.png)
*图 10.1：状态机复制（State machine replication architecture）*

![图 10.2：状态机复制运行流：共识日志定序驱动确定性状态迁移](/media/posts/think-distributed-systems/fig-p154-10-2.png)
*图 10.2：状态机复制运行机制（State machine replication in action）*

如图 10.1 与图 10.2 所示，SMR 的理论基石是确定性状态机原理：
1. **确定性状态机（Deterministic State Machine）**：如果多个完全相同的状态机从完全相同的初始状态 $S_0$ 出发，按照**完全相同的顺序**执行完全相同的一组操作输入序列：
   $$[e_1, e_2, e_3, \dots, e_n]$$
   那么它们在每一步之后产生的内部状态与输出结果必然完全相同。
2. **共识引擎的唯一任务**：**为这组操作日志（Log）的顺序达成共识！** 只要日志项的编号与内容在所有副本节点上达成一致，状态机自身的执行便无需再进行网络协商。

:::en
> **Original**: State Machine Replication (SMR) is a general technique for implementing a fault-tolerant service by replicating servers and coordinating client interactions with server replicas. The key insight is that a deterministic state machine will produce identical outputs and transitions if fed an identical sequence of inputs. The consensus problem is thus reduced to agreeing on the sequence of inputs in a shared, replicated log.

**📌 核心术语与语境解析**：
- **State Machine Replication (SMR)**：*状态机复制*。通过跨节点全序日志驱动确定性状态机的一致性技术。
- **Replicated Log**：*复制日志*。由共识协议保证内容与顺序完全一致的核心数据结构。
:::

## 10.3 法定人数（Quorum）数学原理

为什么系统可以在少数节点挂掉时继续安全工作？答案在于**法定人数（Quorum）**。

在包含 $N$ 个节点的系统中，一个法定人数定义为任意严格大于半数的节点集合：
$$Q = \left\lfloor \frac{N}{2} \right\rfloor + 1$$

根据鸽巢原理（Pigeonhole Principle），**任意两个多数派法定人数必定至少存在一个公共重叠节点**：
$$\forall Q_1, Q_2: Q_1 \cap Q_2 \neq \emptyset$$

以 3 节点系统为例，法定人数为 2。任何两个包含 2 个节点的集合（如 $\{p_1, p_2\}$ 与 $\{p_2, p_3\}$）必然至少共享一个节点 $p_2$。**这个公共节点就是历史事实的守护者，确保任何已提交的决定绝不会被下一次选举遗忘。**

## 10.4 Raft 共识协议解构

长期以来，Leslie Lamport 的 Paxos 协议以晦涩难懂著称于世。2014 年 Diego Ongaro 与 John Ousterhout 提出了 **Raft 协议**，其核心设计理念就是**可理解性（Understandability）**。

![图 10.3：Raft 协议的两大子问题分解：领导者选举与日志复制](/media/posts/think-distributed-systems/fig-p157-10-3.png)
*图 10.3：Raft 协议分解（Raft’s decomposition）*

如图 10.3 所示，Raft 将共识大问题彻底分解为两个高度独立的子问题：
1. **领导者选举（Leader Election）**；
2. **日志复制（Log Replication）**。

### 10.4.1 任期（Terms）机制

![图 10.4：Raft 逻辑时间轴上的任期（Term）递进流](/media/posts/think-distributed-systems/fig-p158-10-4.png)
*图 10.4：Raft 任期时间线（The Raft consensus protocol advances in terms）*

如图 10.4 所示，Raft 用**任期（Term）**充当分布式逻辑时钟：
- 任期用连续单调递增的整数编号；
- 每个任期以一次选举开始（Election）；
- 若选举成功，该任期由唯一的领导者统辖，负责处理请求直至任期结束；
- 若出现选票瓜分（Split Vote），该任期在无领导者状态下超时终结，立刻递增任期发起下一次选举。

### 10.4.2 节点状态机

![图 10.5：Raft 节点的角色转换状态机](/media/posts/think-distributed-systems/fig-p159-10-5.png)
*图 10.5：Raft 节点角色流转状态机（Node states and transitions of Leader Election）*

如图 10.5 所示，任何时刻每个节点处于以下三种角色之一：
- **Follower（跟随者）**：完全被动，只响应来自 Leader 与 Candidate 的 RPC；若在心跳超时窗口内未收到任何心跳，转变为 Candidate；
- **Candidate（候选人）**：递增任期、给自己投票，并向集群广播 `RequestVote` RPC 竞选；若赢得半数以上赞成票，晋升为 Leader；若发现其他 Leader 已产生，回退为 Follower；
- **Leader（领导者）**：统辖全局，处理所有客户端写入，周期性向所有 Follower 发送心跳维持权威，驱动日志同步。

### 10.4.3 日志复制与提交推进

![图 10.6：日志复制 RPC 交互与提交点（commitIndex）推进时序](/media/posts/think-distributed-systems/fig-p160-10-6.png)
*图 10.6：日志复制消息交互流（Message flow of Log Replication protocol）*

如图 10.6 所示，一次标准写入的推进流程：
1. 客户端向 Leader 发送业务指令；
2. Leader 将指令包装为日志项，追加写入本地日志；
3. Leader 向所有 Follower 发送 `AppendEntries` RPC；
4. 当多数派 Follower 成功将该日志写入本地并回复确认后，**Leader 将该日志标记为已提交（Committed）**，并将指令应用到本地状态机；
5. Leader 向客户端返回成功；
6. 在后续的心跳包中，Leader 将最新的 `commitIndex` 告知各 Follower，各 Follower 随后将已提交日志应用到各自本地状态机。

## 10.5 经典共识谜题与安全性证明

### 谜题 1：未提交日志的覆写

![图 10.7：共识谜题 1：网络分区导致旧 Leader 未提交日志被安全覆写](/media/posts/think-distributed-systems/fig-p162-10-7.png)
*图 10.7：共识谜题 1（Puzzle 1: Uncommitted log overwrite）*

如图 10.7 所示：旧 Leader 写入了日志但尚未同步给多数派即遭遇网络分区。新多数派选举出新 Leader 并产生了新写入。当网络恢复后，旧 Leader 的未提交日志被新 Leader 的权威日志无条件覆盖。这是绝对安全的，因为未提交的日志从未向客户端作出过持久化承诺。

### 谜题 2：已提交日志的绝对持久性

![图 10.8：共识谜题 2：已提交日志在新任期中的持久性保全](/media/posts/think-distributed-systems/fig-p163-10-8.png)
*图 10.8：共识谜题 2（Puzzle 2: Committed log preservation）*

如图 10.8 所示：一旦一条日志被多数派确认提交，Raft 的**选举限制（Election Restriction）**保证了任何候选人要想赢得多数派选票，其本地日志必须**至少与多数派中最新的一份日志一样新**。由于法定人数相交，新 Leader 必然包含所有已提交的日志条目，绝不可能丢失！

### 谜题 3：脑裂防范

![图 10.9：共识谜题 3：法定人数严格过半防范双主脑裂](/media/posts/think-distributed-systems/fig-p163-10-9.png)
*图 10.9：共识谜题 3（Puzzle 3: Split brain avoidance）*

图 10.9 说明了脑裂防范机制：网络分裂为两个孤岛时，只有包含超过半数节点的孤岛（如 5 节点集群中的 3 节点分区）才具备法定人数资格选出 Leader 并继续写入；少于半数的孤岛只能处于只读或失联阻塞状态，绝不可能产生“双主脑裂”。

:::en
> **Original**: Raft guarantees that once a log entry has been committed by a majority of nodes, it will be preserved across all future terms. This is enforced by the Election Restriction: a voter rejects a candidate whose log is less up-to-date than its own. Because any winning candidate must receive votes from a majority, its log is guaranteed to contain every committed entry from previous terms.

**📌 核心术语与语境解析**：
- **Election Restriction**：*选举限制*。只有持有最完整最新日志的节点才有资格当选 Leader 的关键安全不变式。
- **Split vote**：*分票*。多个候选人同时发起选举平分选票导致无人过半的现象，通过随机超时消除。
:::

## 本章小结

1. **共识归结为日志定序**：状态机复制（SMR）使我们只需为离散日志的顺序达成共识，即可获得完全一致的分布式服务。
2. **法定人数相交是不变式基石**：依靠严格过半数重叠，新领导者必然接力历史已提交的全部真相。
3. **Raft 的优雅力学**：任期时钟、强主控制、选举限制三位一体，兼具极高的数学严谨性与卓越的工程可实现性。
