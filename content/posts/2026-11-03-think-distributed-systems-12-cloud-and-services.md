---
title: "Think Distributed Systems（十二）：云、无服务器与服务——回到契约"
date: 2026-11-03T04:00:00Z
description: "弹性把静态拓扑换成动态拓扑；云原生强调 by construction 而非 by requirement；无服务器把资源获取从事件前挪到事件后；而服务的本质，是组件与系统其余部分之间的契约。"
category: distributed-systems
column: think-distributed-systems
tags:
  - "云计算"
  - "云原生"
  - "无服务器"
  - "微服务"
  - "弹性"
  - "契约"
---

# 第 12 章：云与服务

本章涵盖：

- 云计算（cloud computing）
- 云原生计算（cloud-native computing）
- 无服务器计算（serverless computing）
- 服务（services）

在当代分布式系统中，云计算、云原生、无服务器与微服务都已成为热词。但热度带来一个悖论：**这些词无处不在，含义却始终模糊**。作为全书的收尾，本章给出作者自己的心智模型。

## 12.1 从主动到被动

2008 年，作者在 SAP 申请一台虚拟机是一个缓慢的手工流程：提工单、等审批、等开通；机器上线后还要持续配置维护，几个月后再申请下线。

十年后离开 SAP 时，获取一组虚拟机已经是自动化、近乎瞬时的事：在云平台上快速创建，只受预算约束。机器不再是需要长期维护的固定资产，而是**按需出现、按需消失**。

从**静态**到**动态**的资源分配，重新定义了系统设计：

- **弹性（elasticity）**：系统通过按需获取与释放资源，来同时实现可扩展性与可靠性。

云出现之前，系统由**数量有限、长期存在、属性已知**的资源构成——身份、网络地址都长期不变。工程师**预测**负载与失败需求，并**主动**应对，系统拓扑是**静态**的。

云时代，系统由**大量短生命周期、属性短暂**的资源构成——最典型的是短命的网络地址。工程师**观察**负载与失败，并**被动**应对，系统可以自我调节，拓扑是**动态**的。这种动态环境既是云计算的背景，也是它的地基。

:::en
> **Original**: Elasticity refers to the ability of a system to achieve scalability and reliability by acquiring and releasing resources on demand to meet demand. ... Before the advent of the cloud, our systems consisted of a limited number of resources that were long-lived and well-known. ... Increasingly, our systems consist of many short-lived resources with short-lived properties, most prominently short-lived network addresses.

**📌 核心术语与语境解析**：
- **Elasticity**：*弹性*。按需伸缩，同时服务于可扩展性与可靠性。
- **Static vs. dynamic topology**：*静态 / 动态拓扑*。资源身份是否长期稳定，决定了运维范式。
:::

## 12.2 云计算

云计算的本质，是把世界分成**资源消费者**与**资源提供者**：

- 消费者可以按需从**云平台**获取与释放几乎无限的资源（虚拟机、存储等）；
- 平台可以是**公有云**（向组织外提供资源）或**私有云**（仅在组织内提供）。

公有云的典型代表是 AWS、Google Cloud、Azure；私有云的典型代表是企业自建的 OpenStack、Cloud Foundry、Kubernetes 集群。

云计算的标志就是这两点：**消费者与提供者的明确分离**，以及**按需获取与释放资源**的能力。这两个原语，是后面定义云原生与无服务器的基石。

:::en
> **Original**: In essence, cloud computing separates the world into resource consumers and resource providers. A resource consumer can acquire and release virtually unlimited resources on demand from a resource provider: the cloud platform. ... The hallmark of cloud computing is its distinct division between resource consumers and resource providers, coupled with the capability to acquire and release resources on demand.

**📌 核心术语与语境解析**：
- **Resource consumer / provider**：*资源消费者 / 提供者*。云的基本角色划分。
- **On demand**：*按需*。资源生命周期由需求驱动，而非预先规划。
:::

## 12.3 云原生计算

**云应用**是任何托管在云平台上的应用。按此定义，一个原版 WordPress 装在云上，也是云应用。但**并非每个云应用都是云原生应用**。

**云原生应用**是**在构造上（by construction）** 就可扩展、可靠的云应用，它利用云“按需获取与释放资源”的能力。

“by construction”与“by requirement”形成鲜明对比：

- **by requirement**：可扩展与可靠是**期望**，需要额外努力去争取；
- **by construction**：可扩展与可靠由设计与实现**保证**，是架构的自然结果。

云平台提供一组构件来支撑“构造上的可扩展与可靠”：

- **监督者（supervisor）**：监控资源集合，发现失败就补充新资源；
- **伸缩器（scaler）**：监控资源集合，按需求波动增减资源；
- **负载均衡器（load balancer）**：把请求分发到可用资源上。

在 Kubernetes 中，Deployment 可充当监督者，HorizontalPodAutoscaler 充当伸缩器，Service 充当负载均衡器。

但要注意：**仅仅把现有应用搬到带这些工具的云平台上，并不会自动让它变得可扩展、可靠。** 如全书反复强调的，可扩展与可靠需要**整体设计**——平台层与应用层都要参与。按此定义，前面那个原版 WordPress **不是**云原生应用，因为它缺少负载与失败的检测和缓解设施。

> **顿悟时刻：Lift and shift**
>
> “Lift and shift”指把原本不在云上的应用整体搬到云环境，通常几乎不改代码。但这种迁移的收益有限：要真正利用云的弹性，应用必须**为弹性而设计**。

> **顿悟时刻：云原生“技术栈”不等于定义**
>
> 常见定义强调云原生应用是“容器打包、面向微服务、动态编排”，再加些“声明式”“不可变”的修饰。这些特征确实常见，但**不足以定义云原生**：容器打包是技术选择，面向微服务是架构选择——换一种技术或架构，并不妨碍应用在构造上可扩展、可靠。

:::en
> **Original**: A cloud-native application is a cloud application that is scalable and reliable by construction, using the cloud's capability to acquire and release resources on demand. The concept of by construction stands in clear contrast to by requirement. Due to the design and implementation of a cloud-native application, scalability and reliability are guaranteed, not merely desired. ... Merely placing an existing application on a cloud platform equipped with tools for scalability and reliability doesn't automatically render the application scalable and reliable.

**📌 核心术语与语境解析**：
- **By construction / by requirement**：*构造上保证 / 需求上期望*。云原生的判定标准。
- **Supervisor / scaler / load balancer**：*监督者 / 伸缩器 / 负载均衡器*。云平台的三类基础构件。
:::

## 12.4 无服务器计算

用最小计算模型来推理：系统由一组资源（计算、网络、存储）构成，并处理一组应用事件（请求）。系统必须能做四件事：

- 获取资源；
- 释放资源；
- 接收事件；
- 处理事件。

**通用约束**：资源未获取，事件就不能被处理。

### 12.4.1 传统环境

传统环境中，操作者必须**预先（a priori）** 获取资源——在事件进入系统**之前**。顺序是：获取资源 → 接收事件 → 处理事件 → 释放资源。资源获取是**主动的**。

### 12.4.2 无服务器环境

无服务器环境中，系统可以**按需**获取资源——在事件进入系统**之后**。顺序是：接收事件 → 获取资源 → 处理事件 → 释放资源。资源获取是**被动的**。

由此产生一个必然要求：**系统必须能根据事件本身，判断需要哪些资源。**

### 12.4.3 冷路径与热路径

典型的无服务器实现不会在处理完事件后立刻释放资源，而是保留一段时间以等待后续事件：

- **冷路径（cold path）**：接收事件与处理事件之间**插入**了资源获取；
- **热路径（hot path）**：接收事件与处理事件之间**没有**资源获取，直接处理。

冷启动的延迟，正是“按需获取”的代价。

:::en
> **Original**: In a traditional computing environment, the operator of a system must acquire the necessary resources a priori—before the application event enters the system. In a serverless computing environment, the system may acquire the necessary resources on demand—after the application event has entered the system. Consequently, in a serverless environment, the system must be able to determine the necessary set of resources based on the application event itself.

**📌 核心术语与语境解析**：
- **Serverless**：*无服务器*。不是“没有服务器”，而是“开发者不预先管理服务器”。
- **Cold / hot path**：*冷路径 / 热路径*。是否插入资源获取，决定了启动延迟。
:::

## 12.5 服务

云原生分布式系统中，微服务既受追捧也备受争议。**“微服务”一词无处不在，心智模型却往往模糊。**

> **注**：讨论微服务常常演变成关于“什么才是优秀微服务”的激烈争论。作者的目标不是评判，而是澄清——因此使用情绪色彩更弱的 **service（服务）** 一词。

几乎任何服务架构讨论都从白板开始：矩形代表服务，线代表交互。随着讨论深入，矩形被复制，出现“负载均衡器”“自动伸缩器”，又加入数据库、队列、定时器。回头看，白板已是一幅复杂织锦：

- 服务边界在哪？
- 每个白色矩形真的是一个自治服务吗？
- 多个同标签矩形合起来算一个服务吗？
- 数据库、队列、定时器在服务边界内还是外？
- 负载均衡器与伸缩器扮演什么角色？

### 12.5.1 全局视角 vs. 局部视角

从**全局视角**看，我们能看到整个系统状态。组件没有这种奢侈，它只能看到自己的状态与自己通往网络的信道——**局部视角**。

关键洞察：**在局部视角下，组件 C1 并不是在与某个“服务”通信，而是在与“系统的其余部分”通信。**

因此，把服务映射为某个组件或某组组件，在局部视角下是讲不通的。**从 C1 的角度看，服务是一份契约（contract），规定 C1 与系统其余部分之间的交互。**

以 echo 服务为例：组件向 http://echo.io 发 POST，收到包含请求体的响应。按新视角，组件并不是在寻址 echo.io 上的某个组件，而是在**调用一份系统级契约**——它是在向**整个系统**请求服务。

**服务是组件与系统其余部分之间的契约，而不是实现该契约的组件集合。** 换句话说，我们关注的是**逻辑视图**，而非物理视图。

:::en
> **Original**: When it takes a limited local view, the component C1 does not talk to a service; it talks to the rest of the system. Simply mapping a service to a component or set of components does not make sense from that point of view. Instead, from the point of view of C1, a service is a contract, specifying the interaction between C1 and the rest of the system. ... The service is the contract between the component and the rest of the system; the service is not the set of components implementing the contract.

**📌 核心术语与语境解析**：
- **Contract**：*契约*。服务的唯一不变项，独立于实现它的组件。
- **Logical vs. physical view**：*逻辑视图 vs. 物理视图*。前者是接口，后者是部署。
:::

### 12.5.2 示例：推荐服务

推荐服务的契约只有一个操作：

$$Get: ID \rightarrow [ID]$$

输入一个电影 id，返回一组电影 id。

最朴素的实现是一个 Python 进程连数据库。功能正确，但**不可扩展也不可靠**——单进程本就如此。于是我们引入冗余：复制该进程。

如果数据库过载或故障呢？可以部署两组进程：

- **Primary**：数据库健康时返回真实推荐；
- **Backup**：数据库不健康时返回静态（假）推荐。

Primary 从有时不可用的数据库取数，Backup 从始终可用的本地文件取数。

接着需要负载均衡器分发请求。由于两组进程并不对等，需要**智能负载均衡器**：默认发往 Primary，若出错则重试到 Backup。同时两组都要**自动伸缩**以缓解负载与失败。

但负载均衡器与伸缩器本身也可能受负载与失败影响——于是再次冗余。最终模型里，负载均衡器、伸缩器、进程组之间甚至不是 1:1 关系：一个伸缩器实例可能负责多个进程组，甚至跨服务边界。

**推荐服务由一个动态、不断变化的组件集合及其交互实现**：有些组件只服务于它，有些同时服务于多个服务。但服务始终被其契约完美地体现——**契约是唯一的不变量**。消费者可以完全忽略这些复杂性，只向“系统其余部分”请求一组推荐。

:::en
> **Original**: The recommendation service is implemented by a dynamic, ever-changing set of components and their interactions. Some of these components contribute solely to the implementation of the recommendation service; others contribute to the implementation of multiple services. Yet the service is still perfectly embodied by its contract of returning a set of recommendations—the contract as the only constant.

**📌 核心术语与语境解析**：
- **Primary / backup**：*主 / 备*。用降级数据源换取可用性的经典模式。
- **Contract as the only constant**：*契约是唯一不变量*。实现可以千变万化，接口必须稳定。
:::

## 12.6 最后的思考

设想一支乐队，每个乐手对同一份乐谱有不同解读：一个人把某个音符读成 C，另一个读成 F。他们本想合奏出和声，结果却是**不协和**。

这与我们使用 cloud、cloud-native、serverless、microservices 这些词的体验如出一辙：词用得很多，理解却很浅，且彼此不一致。这会同时削弱我们作为工程师与沟通者的效能。

每个人对同一个概念都有自己的心智模型。**当“现实”“我的心智模型”“你的心智模型”三者交集很小时，沟通与协作就会困难；交集很大时，协作几乎不费力。**

“用分布式系统的方式思考”，本质上就是**不断扩大这个交集**——让模型更贴近现实，也让人与人之间的模型更接近。

> 我从未像完全理解一个概念时那样，感到如此有力量、如此自信。所以，请不遗余力地探索你遇到的每个概念的核心。**永远不要停止挖掘。**

:::en
> **Original**: Imagine a band in which each musician interprets the same musical sheet differently. When one musician reads a note as a C and another reads it as an F, their combined efforts, meant to produce harmony, create dissonance. ... Thinking in distributed systems aims to maximize the intersection of our mental models with reality and with one another's mental models.

**📌 核心术语与语境解析**：
- **Dissonance**：*不协和*。术语一致但模型不一致时，协作的必然结果。
- **Intersection of mental models**：*心智模型的交集*。沟通效率的度量。
:::

## 本章小结

1. **弹性 = 按需获取与释放资源**，把静态拓扑换成动态拓扑。
2. **云计算 = 消费者/提供者分离 + 按需资源**，这是定义其他概念的原语。
3. **云原生 = by construction 的可扩展与可靠**，而非容器或微服务等技术标签。
4. **无服务器 = 先收事件、再取资源**，代价是冷启动。
5. **服务是契约，不是组件集合**：局部视角下，组件只与“系统其余部分”交互。
6. **实现可以动态变化，契约必须保持不变**——这是服务设计的核心。
7. **术语的价值在于对齐心智模型**：交集越大，协作越顺。

