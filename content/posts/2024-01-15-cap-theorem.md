---
title: CAP 定理（Brewer's Theorem）
date: '2024-01-15'
tags:
  - 分布式
  - 数据库
  - 理论
  - 架构
  - 一致性
category: principles
description: 分布式系统的三选二困境——一致性、可用性与分区容错性的不可能三角
---
## 起源

CAP 定理由 **Eric Brewer** 在 2000 年 ACM PODC 主题演讲中提出，后由 **Seth Gilbert** 和 **Nancy Lynch** 在 2002 年从理论上证明。

> Brewer 的原话是："**You can't have all three** — you must choose two out of three."

但这句话后来被广泛误解——**"三选二"不是在任何时刻选两个，而是在网络分区发生时放弃一个。**

## 三个属性详解

### C — 一致性（Consistency）

**定义**：所有节点在同一时刻看到相同的数据。对客户端表现为"写后立即读"。

客户端写入 `X = 1` 后，无论访问哪个节点都必须读到 `X = 1`。如果任何节点还返回旧值，就不满足一致性。

**反面例**：DNS 系统——你更新 DNS 记录后，全球 DNS 缓存可能要数小时才生效，这就是放松了一致性。

### A — 可用性（Availability）

**定义**：每一个请求都能在合理时间内收到一个**非错误**的响应。注意：不保证响应包含最新数据。

即使某个节点宕机，其他节点也必须继续响应请求，不能因等待同步而挂起。可用性 ≠ 系统永远正常运行，它意味着系统不会因为某个节点故障而拒绝服务。

### P — 分区容错性（Partition Tolerance）

**定义**：系统在网络分区（节点间通信中断）时仍能继续运行。

网络分区是**必然发生**的（网络故障、交换机重启、光纤被挖断）。你不是选择要不要 P，而是选择**当 P 发生时，放弃 C 还是 A**。

## CAP 的正确理解

### 常见误解

| 误解 | 真相 |
|------|------|
| "三选二，任何场景都只能满足两个" | **只在分区发生时**需要权衡；无分区时可同时满足 C + A |
| "CA 系统不存在" | CA 系统存在（单机 RDBMS），但它在分布式语境下没有分区容错能力 |
| "CP 系统永远不可用" | CP 系统只是**在分区期间**牺牲可用性；分区恢复后恢复正常 |
| "AP 系统最终会一致" | AP 系统通常附加最终一致性机制（如 Dynamo 的矢量时钟） |

### 核心决策流程

发生网络分区了吗？

- **否** → C + A 同时满足（系统正常运行），例：单机 MySQL、未发生分区的集群
- **是** → 二选一：
  - **CP（牺牲可用性）**：停止写入 / 返回旧数据或错误，例：ZooKeeper、etcd、HBase
  - **AP（牺牲一致性）**：允许数据暂时不一致，例：Cassandra、DynamoDB、CouchDB

## 不同策略的系统行为

### CP 系统：ZooKeeper

ZooKeeper 使用 ZAB（Zookeeper Atomic Broadcast）协议保证强一致性：

- 写入必须由 Leader 确认，多数 Follower 同步后才返回成功
- 如果 Leader 与多数 Follower 失联（分区），Leader 自动退位，集群进入选举
- 选举期间**不可用**（无法处理读写请求）

### AP 系统：Cassandra

Cassandra 使用最终一致性 + hinted handoff：

- 写入成功只需少数节点确认（可配置）
- 分区期间各分区继续独立服务
- 分区恢复后通过读修复（Read Repair）和 hinted handoff 同步差异

## 实际系统的 CAP 定位

| 系统 | 分类 | 理由 |
|------|------|------|
| MySQL（单机） | CA | 无分区能力，强一致性 + 高可用 |
| PostgreSQL + Patroni | CP | 分区时停止写入，保持一致性 |
| Redis Cluster | CP | 分区时少数分区不可写 |
| Cassandra | AP | 分区时全部可写，最终一致 |
| DynamoDB | AP | 同 Cassandra 设计哲学 |
| MongoDB | CP（默认） | 副本集模式下主节点失联即重新选举 |
| Elasticsearch | CP | 分区时少数分区停止服务 |
| Kafka | CP | ISR 机制确保一致性 |

## 超越 CAP：理论演进

### PACELC 定理（2010）

CAP 只讨论**分区时**的行为。PACELC 扩展了"**正常时**"的权衡：

> **P**artition → **A**vailability vs **C**onsistency
> **E**lse → **L**atency vs **C**onsistency

即：即使没有分区，你也需要在**延迟**和**一致性**之间取舍。

| 场景 | 权衡 | 例 |
|------|------|----|
| 分区发生 | C vs A | ZooKeeper(CP) vs Cassandra(AP) |
| 正常运行 | L vs C | 同步复制(慢但一致) vs 异步复制(快但可能丢数据) |

### BASE 理论

BASE 是 AP 系统的设计哲学，与 ACID 形成对比：

| 特性 | ACID | BASE |
|------|------|------|
| 一致性 | 强一致 | 最终一致 |
| 锁 | 悲观锁 | 乐观锁 |
| 事务 | 复杂事务 | 简单查询 |
| 架构 | 集中式 | 分布式 |
| 读写性能 | 写入慢、读取快 | 写入快、读取可能慢 |

BASE 代表：
- **Basically Available** — 基本可用，允许部分降级（如返回缓存数据而非错误）
- **Soft State** — 软状态，数据可在一段时间内不一致
- **Eventually Consistent** — 最终一致，无写入后最终收敛

## 设计决策框架

### 选 CP 的场景

需要严格一致性时，考虑 CP 方案：
- 银行转账、库存扣减、用户唯一性检查
- 典型系统：ZooKeeper、etcd、Consul

### 选 AP 的场景

不可用比数据不一致更不可接受时，考虑 AP 方案：
- 社交信息流、商品评论、IoT 数据采集、CDN
- 典型系统：Cassandra、DynamoDB、S3

### 混合策略

现代系统在内部不同服务间混合使用：

- 订单服务 → 强一致（CP）→ MySQL / etcd
- 内容服务 → 最终一致（AP）→ Redis 缓存 / Cassandra
- 用户服务 → 强一致（CP）→ PostgreSQL

## CP vs AP 代码对比

CP 风格：写入必须等待多数节点确认后才返回，否则返回失败。

AP 风格：本地立即返回成功，后台异步同步到其他节点，分区时也能接受写入。

## 常见面试题

**Q：CAP 中的 C 和 ACID 中的 C 是同一回事吗？**

A：不是。ACID 的 Consistency 指事务完整性（约束、级联），CAP 的 Consistency 指副本间数据一致（linearizability）。

**Q：NoSQL 数据库一定放弃一致性吗？**

A：不一定。ZooKeeper 和 etcd 就是 CP 的 NoSQL 系统。

**Q：分区恢复后，AP 系统的数据会怎样？**

A：通过矢量时钟（Vector Clock）、读修复（Read Repair）或反熵（Anti-Entropy）协议合并冲突数据。Dynamo 使用 Last Write Win（LWW）策略。

**Q：三节点 ZooKeeper 挂了一个，还能用吗？**

A：能。多数派（2/3 节点存活）即可正常工作。挂两个则不可用。

## 参考

- Brewer, Eric. "Towards robust distributed systems" (PODC 2000)
- Gilbert & Lynch. "Brewer's conjecture and the feasibility of consistent, available, partition-tolerant web services" (2002)
- Kleppmann, Martin. *Designing Data-Intensive Applications* — Chapter 9
- Abadi, Daniel. "PACELC: Extending CAP" (2010)
