---
title: "Think Distributed Systems（八）：复制——用冗余换取可靠性的力学"
date: 2026-11-03T03:10:00Z
description: "从物理多副本到单一逻辑对象；剖析复制滞后（replication lag）、同步/异步复制，以及单主、多主与无主复制拓扑的权衡。"
category: distributed-systems
column: think-distributed-systems
tags:
  - "复制"
  - "冗余"
  - "可靠性"
  - "复制滞后"
  - "主从复制"
  - "无主复制"
---

# 第 8 章：复制

本章涵盖：

- 冗余（redundancy）与复制（replication）
- 逻辑对象与物理对象
- 复制滞后（replication lag）与数据陈旧
- 同步复制与异步复制
- 单领导者、多领导者与无领导者复制拓扑

如果说**分区**的目标是用切分换取**可扩展性**，那么**复制（Replication）**的目标则是用冗余换取**可靠性（Reliability）**与**可用性（Availability）**。

## 8.1 冗余：生存的本能

硬件终将损坏，光缆终将断裂。在不可靠的物理世界中，任何单一实体都是脆弱的。

![图 8.1：冗余机制——通过物理副本复制抵御单点崩溃](/media/posts/think-distributed-systems/fig-p128-8-1.png)
*图 8.1：冗余机制（Redundancy as duplication）*

如图 8.1 所示，冗余的本质是在系统中保留超出最低功能需求的额外物理资源。当一个物理组件损毁时，其余同构组件能够无缝接管，确保服务生命周期的延续。

## 8.2 逻辑对象与物理对象

![图 8.2：图书馆藏书副本比拟单一逻辑知识载体](/media/posts/think-distributed-systems/fig-p129-8-2.png)
*图 8.2：图书馆藏书类比（Library copies analogy）*

考虑图 8.2 所示的图书馆：逻辑上，《算法导论》是一部唯一的经典著作；但物理上，图书馆的书架上摆放着 10 本一模一样的纸质印本。读者借走或损毁一本，并不影响该书作为知识载体的存在。

![图 8.3：复制——单一逻辑对象由多个相同的物理对象共同具象化](/media/posts/think-distributed-systems/fig-p130-8-3.png)
*图 8.3：复制的概念抽象（Replication: single logical object represented by multiple physical objects）*

如图 8.3 所示，复制的本质就是建立一个映射：**对外呈现为一个单一的逻辑对象（Logical Object），对内由多个物理对象（Physical Objects / Replicas）共同承载。**

![图 8.4：复制型键值存储的读写交互拓扑](/media/posts/think-distributed-systems/fig-p131-8-4.png)
*图 8.4：复制型键值存储（A replicated key-value store）*

图 8.4 展示了一个典型的复制型键值存储：客户端透明地向抽象存储层发出读写请求，存储层内部负责协调各物理副本之间的数据同步。

## 8.3 复制滞后与数据陈旧

由于物理网络的传输延迟，写入主副本的数据不可能瞬间同步给所有物理副本。

![图 8.5：主副本与从副本之间的同步延迟](/media/posts/think-distributed-systems/fig-p132-8-5.png)
*图 8.5：副本延迟状态（Replication lag between primary and replica）*

![图 8.6：复制滞后时间线与并发读取导致脏读的时序分析](/media/posts/think-distributed-systems/fig-p132-8-6.png)
*图 8.6：复制滞后时间线（Replication lag timeline）*

如图 8.5 与图 8.6 所示：
- 客户端在时间 $t_1$ 向主副本（Primary）写入 $x = 100$；
- 主副本更新成功并向客户端返回成功；
- 此时更新报文正在网络中飞向从副本（Replica），从副本上的值仍为旧值 $x = 50$；
- 若另一客户端在时间 $t_2$（$t_1 < t_2 < t_3$）向从副本读取，将读到陈旧的数据 $x = 50$！

主副本与从副本数据完全收敛对齐之间的时间差，称为**复制滞后（Replication Lag）**。复制滞后是引发分布式读取不一致的罪魁祸首。

:::en
> **Original**: Replication creates multiple identical copies of a physical object to represent a single logical object. Because network transmission is not instantaneous, replicas fall behind the primary, creating replication lag. During this lag window, clients reading from replicas will observe stale data, violating linearizability unless appropriate synchronization mechanisms are in place.

**📌 核心术语与语境解析**：
- **Replication lag**：*复制滞后*。主副本完成写入到从副本完全追平之间的物理时间差。
- **Stale read**：*陈旧读（脏读）*。客户端因复制滞后读取到已被最新写入覆写的旧版本数据。
:::

## 8.4 同步复制 vs 异步复制

面对复制滞后，架构师必须在性能与安全性之间做出取舍：

![图 8.7：同步复制交互时序——主节点必须等待从节点确认回执](/media/posts/think-distributed-systems/fig-p133-8-7.png)
*图 8.7：同步复制（Synchronous replication）*

![图 8.8：异步复制交互时序——主节点写入本地后立刻响应客户端](/media/posts/think-distributed-systems/fig-p133-8-8.png)
*图 8.8：异步复制（Asynchronous replication）*

### 同步复制（Synchronous Replication）
如图 8.7 所示：
- 主节点收到写请求，写入本地存储，同时向从节点广播；
- **主节点挂起等待，直到所有从节点回复 ACK，才向客户端返回成功**。
- **优点**：杜绝复制滞后，强一致性，任一节点崩溃绝不丢数据。
- **缺点**：写延迟取决于最慢的副本；若任一从节点网络断开或宕机，写操作将**全线阻塞**，可用性急剧恶化。

### 异步复制（Asynchronous Replication）
如图 8.8 所示：
- 主节点写入本地存储后，**立刻向客户端返回成功**；
- 随后后台异步将日志流同步给从节点。
- **优点**：极低写延迟，高吞吐量；从节点宕机完全不影响主节点对外服务。
- **缺点**：若主节点在异步报文尚未飞抵从节点时突然掉电崩溃，**尚未同步的写入将永久丢失**！

### 实用折中：半同步复制（Semi-synchronous）
现代系统（如 MySQL Semi-sync、Kafka `min.insync.replicas`）广泛采用折中方案：只要主节点加上至少一个（或多数派 Quorum）从节点确认，即视为提交成功。

## 8.5 复制拓扑模式

复制节点以何种拓扑组织？工业界演化出三大经典范式：

![图 8.9：单领导者、多领导者与无领导者复制拓扑对照](/media/posts/think-distributed-systems/fig-p135-8-9.png)
*图 8.9：三大复制拓扑（Single-leader, multileader, and leaderless configurations）*

如图 8.9 所示：

### 1. 单领导者（Single-Leader / Master-Slave）
- **拓扑**：唯一主节点接收所有写入，只读流量分摊给多个从节点。
- **代表**：MySQL 主从、PostgreSQL、Redis、Kafka 分区 Leader。
- **特点**：写入全局定序极其简单；缺点是主节点成为写入性能与高可用单点瓶颈。

### 2. 多领导者（Multi-Leader / Active-Active）
- **拓扑**：多个数据中心各自拥有一个主节点，各自接收本地写入，随后跨城异步双向同步。
- **代表**：跨地域多活系统、协同文档编辑（Google Docs）。
- **特点**：容忍跨地域骨干网中断；缺点是并发冲突解决极其复杂（需要 CRDT 或版本向量）。

### 3. 无领导者（Leaderless / Quorum）
- **拓扑**：不存在中心主节点。客户端直接向多个副本并行发起读写。
- **代表**：Amazon Dynamo、Apache Cassandra、Riak。
- **特点**：依靠法定人数机制保证读写相交：
  $$W + R > N$$
  其中 $N$ 为总副本数，$W$ 为写确认数，$R$ 为读确认数。只要满足上述不等式，读操作必然至少命中一个包含最新写入的物理副本。

## 本章小结

1. **复制的根本使命**：用空间冗余换取系统抗击节点故障的生存能力。
2. **复制滞后是一致性死穴**：光速与物理网络决定了异步复制下陈旧读与数据丢失的潜在风险。
3. **拓扑决定架构性格**：
   - 单主架构：模型简单，强一致性偏好；
   - 多主架构：跨城多活，拥抱冲突合并；
   - 无主架构：去中心化 Quorum，高可用与分区容忍优先。
