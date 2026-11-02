---
title: "Think Distributed Systems（七）：分区——用多份资源突破单点上限"
date: 2026-11-03T03:10:00Z
description: "从百科全书的卷册类比出发，讲清水平/垂直分区、条目式与目录式分配、范围与哈希分区的方差与搬迁代价，以及一致性哈希与过度分区如何折中。"
category: distributed-systems
column: think-distributed-systems
tags:
  - "分区"
  - "分片"
  - "一致性哈希"
  - "再平衡"
  - "过度分区"
  - "可扩展性"
---

# 第 7 章：分区

本章涵盖：

- 分区的概念
- 静态分区与动态分区
- 垂直分区与水平分区
- 条目式查找 vs. 目录式查找
- 常见分区策略

保证分布式系统可扩展性与可靠性有两项关键技术：**分区（partitioning）** 与 **复制（replication）**。分区用来突破单个组件的**可扩展性**限制，复制用来突破单个组件的**可靠性**限制。本章讲分区，第 8 章讲复制。

## 7.1 百科全书与卷册

我少年时最珍爱的物品之一是一本小百科全书。它按字母排序，内容太多，装不进一本书，于是被拆成若干**卷**。

- **百科全书**是**逻辑对象**：逻辑上包含所有条目；
- **卷册**是**物理对象**：物理上各卷只包含互不相交的条目子集。

作者本可以把任意条目塞进随机一卷，但那样百科全书就废了——查一个条目得翻遍全书，甚至无法确认条目是否存在。

于是作者、出版方与我（消费者）约定了一个简单系统：每卷对应一个字母，收录以该字母开头的条目并按字母排序。出版方要**放入**条目就放进对应卷；我要**查找**条目就从对应卷取。

这个经典做法也暴露了三类挑战：

- **分布不均**：字母 E 的条目远多于 X，卷册厚薄悬殊；
- **需求不均**：我们翻 E 卷的次数也远多于 X 卷；
- **交叉引用**：P 卷里讲分区的条目可能引用 R 卷里的复制，一次查阅要动两卷。

软件系统同理：一个系统可能大到装不进单个**节点（node）**，于是被划分为互不相交的**分区（partition）**，并面临同样的分布、需求与交叉引用问题。

:::en
> **Original**: The encyclopedia represents a logical object, and the volumes represent physical objects. Logically, the encyclopedia contains all entries, but physically, the volumes contain disjoint subsets of entries. ... Just as an encyclopedia may be too extensive to fit in a single book, a software system may be too extensive to fit in a single component, called a node in this context. In such cases, the system can be divided into disjoint subsets or partitions.

**📌 核心术语与语境解析**：
- **Logical / physical object**：*逻辑对象 / 物理对象*。前者是完整视图，后者是承载片段。
- **Cross-reference**：*交叉引用*。跨分区访问，是分区设计中绕不开的代价。
:::

## 7.2 用分区思考

**分区**指用多个互不相交的物理对象表示一个逻辑对象。把逻辑对象拆成多个**分区**并分布到多个**节点**上，就能把需求分散到多个节点，避免撞上单节点的可扩展性天花板。

> **顿悟时刻：分布式系统天生就是分区的**
>
> 按第 1 章的定义，分布式系统由并发组件构成，每个组件独占自己的本地状态。**每个组件及其本地状态本身就是一个分区。** 我们通常把分区理解为“数据集太大装不下”，但它真正的含义是：**用多份资源突破任意单份资源的限制**——数据量是内在属性，请求量是外在属性，两者都能成为瓶颈。

> **顿悟时刻：大数据是相对的**
>
> “大数据”的务实定义是：**装不进一个节点的数据**。如果节点只是一个键值寄存器，那么两个键值对就已经是大数据了。树莓派上的大数据，在 MacBook Pro 上可能不值一提。

## 7.3 分区与均衡的机制

以键值存储为例：数据集被切成多个分区，每个分区托管在一个节点上，并可被复制到多个节点。

这里有两个相关但不同的关系：

- **数据项 → 分区**：哪个条目属于哪个分区（partitioning）；
- **分区 → 节点**：哪个分区放在哪个节点（balancing）。

两者合起来，构成从条目到节点的完整映射。

理论上分区很简单，实践中却极其复杂，因为要在相互竞争的需求之间做精细权衡：

- **社交媒体**：按用户分区，普通用户体验良好，但明星/网红会造成严重倾斜；
- **物联网**：按日期分区，数据分布完美均匀，但**写入**会全部集中到当天分区。

你还可以按传感器类型、测量类型、地域分区——每种方案都有优缺点。最终选择取决于系统的独特特征与需求。

而且分区很少“一次做对”：需求变化时，策略必须随之调整，这意味着系统要在**持续服务请求的同时**搬迁数据——这是一个不平凡、也不显然的过程。

:::en
> **Original**: Partitioning is used to improve the scalability of a distributed system. By dividing a logical object into multiple physical objects, called partitions, and distributing them across multiple components, the nodes, we can distribute demand across multiple nodes and avoid hitting the scalability limits of a single node. ... Partitioning is rarely a one-and-done process.

**📌 核心术语与语境解析**：
- **Partitioning / balancing**：*分区 / 均衡*。前者决定条目归属，后者决定分区落点。
- **Skew**：*倾斜*。数据或请求集中到少数分区，抵消分区的意义。
:::

## 7.4 （再）分区

**分区**是把数据项分配给分区；**再分区（repartitioning）**是把已分配的数据项重新分配到不同分区，例如分区数量变化时。

### 7.4.1 分区类型

以关系表为最直观的模型：

- **水平分区（horizontal partitioning，即分片 sharding）**：按**行**切分。一部分行在第 1 分区，另一部分在第 2 分区。
- **垂直分区（vertical partitioning）**：按**列**切分。一列（或一组列）在一个分区，另一列在另一个分区。

两者可以组合。以用户信息为例：

1. 先**垂直分区**：把文本资料（姓、名）与二进制大对象（头像）分开——文本适合关系库存储与检索，图片适合对象存储。
2. 再**水平分区**：文本资料分散到多个关系库，头像分散到多个文件存储。

这样，应用的不同方面可以**独立扩展**。

### 7.4.2 数据项到分区的分配策略

- **条目式（item-based）**：仅依据条目自身特征（键、键的哈希）决定分区。**无状态**，简单易运维。
- **目录式（directory-based）**：依据条目与一个独立组件（目录/查找表）共同决定。**有状态**，更复杂。

两种策略的优劣常以两个指标衡量：

- **方差（variance）**：条目在各分区间的均匀程度；
- **搬迁量（relocation）**：分区数量变化时需要迁移的条目数。

> **顿悟时刻：粗粒度 vs. 细粒度**
>
> **条目式**工作在粗粒度：无状态、基于范围或哈希，能平衡条目，但**无法把特定条目放到特定分区**。若两个热点条目被哈希到同一分区，没有简单的补救办法。
>
> **目录式**工作在细粒度：有状态、基于查找表，可以把条目放到指定分区——代价是目录本身可能成为瓶颈，**与分区的目标相冲突**。

:::en
> **Original**: Item-based assignment is a partitioning strategy that assigns each data item to a partition based solely on its own characteristics—in case of key-value pairs, for example, the key or a hash of the key. Item-based assignment is stateless and therefore simple to develop and operate. ... Because the directory is a stateful component, however, the directory itself may be a bottleneck—the limiting factor in the system's scalability and reliability.

**📌 核心术语与语境解析**：
- **Item-based / directory-based**：*条目式 / 目录式*。无状态粗粒度 vs. 有状态细粒度。
- **Relocation**：*搬迁量*。分区数变化时被迫迁移的条目比例。
:::

## 7.5 常见的条目式分配策略

以 /usr/share/dict/words（约 235,976 个英文单词）为实验对象，分成 5 个分区，理想情况下每区约 47,200 个词。

### 7.5.1 范围分区

按首字母划分区间：

| 分区 | 字母区间 | 条目数 |
| :--- | :--- | ---: |
| 0 | a–e | 67,730 |
| 1 | f–j | 33,203 |
| 2 | k–o | 35,829 |
| 3 | p–t | 73,432 |
| 4 | u–z | 25,782 |

结果明显不均：分区 0 与分区 3 是显眼的**热点**。

### 7.5.2 哈希分区

用 **hash(key) % 5** 分配：

| 分区 | 条目数 |
| :--- | ---: |
| 0 | 47,219 |
| 1 | 47,187 |
| 2 | 47,362 |
| 3 | 47,175 |
| 4 | 47,033 |

分布非常均匀，没有热点。

:::en
> **Original**: One possible assignment strategy is based on key range, with each partition responsible for hosting items with keys in a specific range of keys. ... Another possible assignment strategy is based on hash value. ... This distribution indicates that the partitions are well balanced. There are no hotspots in terms of uneven distribution of items across partitions.

**📌 核心术语与语境解析**：
- **Range partitioning**：*范围分区*。按键区间切分，利于范围查询，但易倾斜。
- **Hash partitioning**：*哈希分区*。打散分布，牺牲范围局部性。
:::

## 7.6 再分区

分区数从 5 增到 6 时，统计“留在原分区”与“必须搬迁”的条目：

- **范围分区**：留在原区 114,790（48.6%），搬迁 121,186（51.4%）——接近对半分；
- **哈希分区**：留在原区 39,443（16.7%），搬迁 196,533（83.3%）——**几乎全量搬迁**。

原因很直接：hash(key) % 5 与 hash(key) % 6 的结果几乎无关，分区数一变，映射整体失效。

| 策略 | 最小化方差 | 最小化搬迁 |
| :--- | :--- | :--- |
| 范围分区 | 否 | 否 |
| 哈希分区 | 是 | 否 |

:::en
> **Original**: Over time, things change, and the number of partitions may need to decrease or increase. As we will see, this change is particularly challenging for item-based assignment strategies because the number of partitions has an outsize effect on placement. ... In conclusion, hash partitioning performs well in terms of minimizing variance, but both range partitioning and hash partitioning perform poorly in terms of minimizing relocation.

**📌 核心术语与语境解析**：
- **Repartitioning**：*再分区*。分区数变化导致的重映射，是条目式策略的软肋。
- **Outsize effect**：*过大影响*。分区数这个参数对映射结果的影响远超其他因素。
:::

## 7.7 一致性哈希

**一致性哈希（consistent hashing）**同时追求最小方差与最小搬迁。其设计目标是：给定 n 个条目与 m 个分区，平均只有 **n/m** 个条目需要搬迁。

用 Python 的 uhashring 包做同样实验：

- 留在原区 192,243（81.5%），搬迁 43,733（18.5%）；
- 且各分区条目数依然相当均匀（约 4.4 万–4.9 万）。

这正是它被广泛用于分布式缓存与存储系统的原因。

> **顿悟时刻：从接口而非实现理解算法**
>
> 我喜欢系统思维，不喜欢算法思维。很多资料自底向上讲算法细节，逼我反向工程出整体图景。我更愿意**自顶向下**看算法的**规格（specification）**——用签名或接口来思考。所以在系统层面，我更关心一致性哈希**带来了什么效果**，而不是它**如何实现**。

:::en
> **Original**: Consistent hashing is a technique for achieving both minimal variance and minimal relocation when partitioning data. A consistent hashing algorithm is designed so that given n items and m partitions, only n/m items need to be relocated to a different partition on average. ... when thinking on a system level, I prefer to think about the effect of consistent hashing, not about how consistent hashing is implemented.

**📌 核心术语与语境解析**：
- **Consistent hashing**：*一致性哈希*。分区数变化时仅少量键重映射的哈希方案。
- **Specification vs. implementation**：*规格 vs. 实现*。前者定义“保证什么”，后者定义“怎么做”。
:::

## 7.8 （再）均衡与过度分区

**均衡（balancing）** 是把分区分配给节点；**再均衡（rebalancing）** 是把已分配的分区重新分配到不同节点，以应对需求变化。

**过度分区（overpartitioning）** 是一个变体：创建**远多于节点数**的分区，让每个节点承载多个分区。

- **分区数 = 节点数**：一对一锁定，需求波动时毫无弹性——既不能减节点，也不能加节点。
- **分区数 > 节点数**：每个节点承载多个分区。需求下降时下线节点、把分区重新分配；需求上升时加节点、摊薄分区。

但仍有上限：**分区数决定了最大节点数**。当所有分区都已分配，就再也加不进节点了。

:::en
> **Original**: Balancing refers to the assignment of partitions to nodes. Rebalancing refers to the reassignment of previously assigned partitions to different nodes—as a response to a change in demand, for example. ... A twist on partitioning is overpartitioning, which creates excess partitions for the number of nodes. ... There's a limit, however: the number of partitions determines the maximum number of nodes.

**📌 核心术语与语境解析**：
- **Rebalancing**：*再均衡*。分区在节点间的重新分配，弹性伸缩的实现手段。
- **Overpartitioning**：*过度分区*。用超额分区换取伸缩弹性，但锁定了节点上限。
:::

## 本章小结

1. **分区 = 用多个物理对象表示一个逻辑对象**，目的是突破单资源限制。
2. **分区 vs. 均衡**：前者决定条目归属，后者决定分区落点。
3. **水平按行、垂直按列**，两者组合可实现不同数据类型的独立扩展。
4. **条目式无状态但粗粒度，目录式细粒度但有状态**，目录本身可能成为瓶颈。
5. **范围分区易倾斜，哈希分区均匀但搬迁代价高**。
6. **一致性哈希兼顾方差与搬迁**：n 个条目、m 个分区，平均只搬迁 n/m。
7. **过度分区提供弹性**，但节点上限被分区数锁定。

