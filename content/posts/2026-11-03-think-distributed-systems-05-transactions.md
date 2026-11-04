---
title: "Think Distributed Systems（五）：事务——并发与失败的双重抽象"
date: 2026-11-03T02:50:00Z
description: "把事务拆为对并发（可串行化）与对失败（完整性）的抽象；用状态机模型刻画事务生命周期，并厘清可串行化与 ACID 的真正边界。"
category: distributed-systems
column: think-distributed-systems
tags:
  - "事务"
  - "ACID"
  - "可串行化"
  - "完整性"
  - "状态机"
  - "前向恢复"
---

# 第 5 章：事务

本章涵盖：

- 抽象（abstraction）的概念
- 事务作为并发与失败的抽象
- 事务的模型：单机与分布式
- 正确性：可串行化与完整性
- ACID 与面向对象系统的对照

**事务（transaction）是计算机科学中最成功的抽象之一。** 它的魔力在于：让开发者在编写并发与可能发生崩溃的复杂程序时，能够**表现得好像既没有并发、也没有失败一样**。

## 5.1 抽象

抽象并不是“模糊”，恰恰相反，**抽象是一种精准的简化**：通过刻意忽略特定细节，突出真正重要的结构。

![图 5.1：事务抽象作为开发者与复杂物理世界之间的认知屏障](/media/posts/think-distributed-systems/fig-p088-5-1.png)
*图 5.1：事务抽象（The transaction abstraction）*

如图 5.1 所示，事务抽象扮演了一层厚重而坚固的屏障。屏障上方是开发者简洁优雅的业务逻辑，而屏障下方则是残酷的硬件现实：微秒级的并发读写冲突、宕机、断电与死锁。

## 5.2 事务的魔力：两大维度

事务的魔力由两个完全独立的维度交织而成：

![图 5.2：多进程并发操作交织产生的读写冲突](/media/posts/think-distributed-systems/fig-p089-5-2.png)
*图 5.2：并发操作交织（Concurrent interleavings of operations）*

![图 5.3：执行中断导致系统处于半途中断的非一致状态](/media/posts/think-distributed-systems/fig-p089-5-3.png)
*图 5.3：部分执行故障（Partial execution failure）*

### 5.2.1 针对并发的抽象：可串行化

如图 5.2 所示，当多个进程并发操作共享数据时，其指令会发生任意粒度的交错（Interleaving），产生诸如脏读、不可重复读、幻读或更新丢失等异常。

事务通过**隔离性（Isolation）**屏蔽了并发：系统保证无论底层的交错多么混乱，最终产生的结果都等价于某种串行执行——这就是**可串行化（Serializability）**。

### 5.2.2 针对失败的抽象：完整性（原子性）

如图 5.3 所示，在没有事务保护时，一个由多个步骤组成的业务过程若中途崩溃，会遗留灾难性的部分状态。

事务通过**原子性（Atomicity）**屏蔽了失败：要么全部步骤执行成功（Commit），要么像从未发生过一样完全回滚（Abort）。全执行保证系统永远不会停留在破损的中间状态。

:::en
> **Original**: The magic of transactions is twofold: it provides an abstraction over concurrency and an abstraction over failure. Over concurrency, it guarantees that concurrent transactions behave as though they executed sequentially—a property known as serializability. Over failure, it guarantees that a transaction either completes entirely or has no effect at all—a property known as atomicity or completeness.

**📌 核心术语与语境解析**：
- **Serializability**：*可串行化*。并发执行的最终状态等价于某种串行顺序执行，是隔离性的最高级别。
- **Completeness (Atomicity)**：*完整性（原子性）*。全有或全无（All-or-Nothing）的执行保证。
:::

## 5.3 事务的状态机模型

为了严格推理事务的行为，必须建立精确的状态机模型。

![图 5.4：单机事务的完整生命周期状态机](/media/posts/think-distributed-systems/fig-p091-5-4.png)
*图 5.4：单机事务状态机模型（State machine model of a transaction）*

如图 5.4 所示，单个资源管理器（RM）上的事务生命周期经历以下状态流转：

1. **Active（活动态）**：事务初始状态，正在执行一系列读写操作；
2. **Partially Committed（部分提交态）**：所有业务操作执行完毕，但写入的数据尚未持久化刷盘到 WAL（预写日志）；
3. **Committed（已提交态）**：日志成功刷盘，事务获得永久生效保证，向客户端返回成功；
4. **Failed（失败态）**：在活动或部分提交时检测到约束违背、死锁或硬件异常；
5. **Aborted（已中止态）**：事务执行 Undo 操作，回滚所有修改，恢复到事务开始前的镜像状态。

### 5.3.1 正确性：可串行化判定

![图 5.5：并发交替执行与串行历史等价性判定](/media/posts/think-distributed-systems/fig-p091-5-5.png)
*图 5.5：可串行化等价判定（Serializability equivalence）*

图 5.5 说明了可串行化的数学判定：对于任意并发历史 $H$，若存在一个合法的串行历史 $H_{\text{serial}}$，使得 $H$ 中所有冲突操作的因果偏序与 $H_{\text{serial}}$ 相同，则历史 $H$ 是冲突可串行化的（Conflict Serializable）。

### 5.3.2 业务不变量与一致性

![图 5.6：事务执行前后的业务不变量保持](/media/posts/think-distributed-systems/fig-p093-5-6.png)
*图 5.6：不变量保持（Invariant preservation）*

图 5.6 展现了**一致性（Consistency）**的内涵：一致性是指数据不违背预定义的业务约束（例如“账户余额不得为负” `balance >= 0`）。事务在起点接收一个一致的数据库状态，通过一系列合法变迁，在终点必须将数据库交还给另一个一致的状态。

## 5.4 ACID 的真正内涵

经典的 ACID 缩写常常引起混淆，让我们用第一性原理解构它：

![图 5.7：ACID 四大支柱之间的正交与依赖关系](/media/posts/think-distributed-systems/fig-p094-5-7.png)
*图 5.7：ACID 概念图谱（Atomicity, Consistency, Isolation, Durability）*

- **A（Atomicity，原子性）**：防范失败。全有或全无（图 5.7 左上）；
- **C（Consistency，一致性）**：防范违背不变量。由应用逻辑与数据库约束共同守卫（图 5.7 右上）；
- **I（Isolation，隔离性）**：防范并发。串行化执行（图 5.7 左下）；
- **D（Durability，持久性）**：防范掉电。日志持久化到非易失介质，崩溃后可恢复（图 5.7 右下）。

### 恢复机制：前向恢复与后向恢复

系统如何保证持久性与原子性？依赖于底层的日志恢复协议：

![图 5.8：基于 Redo 日志的前向恢复机制](/media/posts/think-distributed-systems/fig-p095-5-8.png)
*图 5.8：前向恢复（Complete execution traces and forward recovery）*

图 5.8 展示了**前向恢复（Forward Recovery / Redo）**：对于在崩溃前已经进入 Committed 状态但脏页尚未刷入数据文件的事务，重启时读取 WAL 日志中的重做记录，将操作重新应用到磁盘。

![图 5.9：基于 Undo 日志的后向恢复回滚机制](/media/posts/think-distributed-systems/fig-p096-5-9.png)
*图 5.9：后向恢复（Incomplete execution traces and backward recovery）*

图 5.9 展示了**后向恢复（Backward Recovery / Undo）**：对于崩溃前停留在 Active 或 Partially Committed 的未完结事务，重启时读取撤销记录，执行逆向操作，消除未提交数据对磁盘的污染。

### 隔离级别谱系

![图 5.10：SQL 隔离级别层级与其防范的并发异常谱系](/media/posts/think-distributed-systems/fig-p097-5-10.png)
*图 5.10：隔离级别谱系（Isolation levels and anomalies）*

可串行化虽然完美，但开销巨大。如图 5.10 所示，工程界通过放宽隔离性换取性能，构建了四大标准隔离级别：
1. **Read Uncommitted（读未提交）**：允许脏读、不可重复读、幻读；
2. **Read Committed（读已提交）**：杜绝脏读，允许不可重复读与幻读；
3. **Repeatable Read（可重复读）**：杜绝脏读与不可重复读，可能存在幻读（MVCC 快照读）；
4. **Serializable（可串行化）**：杜绝一切并发异常，保证等价于串行执行。

:::en
> **Original**: Atomicity and durability are achieved through logging. Forward recovery (redo logging) ensures that committed changes persist across crashes. Backward recovery (undo logging) ensures that aborted or uncommitted changes are rolled back. Isolation prevents anomalies arising from concurrent execution, with varying isolation levels offering different trade-offs between concurrency and safety.

**📌 核心术语与语境解析**：
- **Redo logging**：*重做日志*。记录修改后的新值，用于在前向恢复中重放已提交修改。
- **Undo logging**：*撤销日志*。记录修改前的前镜像旧值，用于在后向恢复中回滚脏写。
:::

## 本章小结

1. **事务是双重抽象**：用隔离性（可串行化）屏蔽并发时序的混乱，用原子性（完整性）屏蔽硬件停机崩溃的风险。
2. **ACID 落地力学**：通过 Write-Ahead Logging (WAL) 配合 Redo 保证持久性，配合 Undo 保证原子性。
3. **工程取舍谱系**：完全可串行化是安全性的极点，隔离级别是业务吞吐量与时序异常容忍度之间的权衡。
