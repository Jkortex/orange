---
title: "Think Distributed Systems（一）：模型、心态与机制——为什么“知道”不等于“理解”"
date: 2026-11-03T02:10:00Z
description: "从心智模型的正确定义出发，用状态与步骤刻画分布式系统的行为，并用安全性/活性、可扩展性/可靠性、系统之系统与全局-局部视角搭建全书的概念地基。"
category: distributed-systems
column: think-distributed-systems
tags:
  - "分布式系统"
  - "心智模型"
  - "安全性"
  - "活性"
  - "系统之系统"
  - "状态机"
---

# 第 1 章：分布式系统中的思考方式——模型、心态与机制

本章要解决的问题只有一个：**在你动手写任何代码之前，先把“分布式系统”变成可以被推演的对象。**

本章涵盖：

- 知道（knowing）与理解（understanding）的区别
- 心智模型（mental model）的作用
- 分布式系统的结构与行为
- 分布式系统的正确性、可扩展性与可靠性
- 为什么我们必须构建分布式系统

## 1.1 软件工程与心智模型

软件工程既可以是令人愉悦的职业，也可以是令人痛苦的职业。这种张力在复杂分布式系统中体现得最为明显。

对我而言，软件工程最痛苦的时刻是**困惑**。不幸的是，在这个行业里，困惑几乎是一种常态。土木工程依赖根植于物理学的模型、用数学表达、用标准图式沟通；而软件工程至今仍在为“微服务是什么”“云是什么”“云原生是什么”“无服务器是什么”这类日常词汇挣扎——你确定自己的答案吗？就算确定，其他工程师会同意吗？

我们常常只有一个模糊的直觉，既无法有效沟通，也无法高效传递。我不想要“拿根棍子戳一戳系统、观察它的反应、再为它的行为编一套解释”这种工作方式——因为下一次戳，可能就把你自以为知道的东西推翻了。

我需要的是一个**准确而简洁的心智模型**：一个能让我对系统做出自信推理的内部表示。

:::en
> **Original**: For me, software engineering is most dreadful when I experience confusion. Unfortunately, in this industry, confusion is a constant state of mind. Other professions have developed robust mental models and means of communication, but software engineering is still catching up. Civil engineering, for example, relies on mental models rooted in physics, expressed mathematically, and communicated by standardized diagrams. But in software engineering, we struggle with the concepts and terms we use every day.

**📌 核心术语与语境解析**：
- **Mental model**：*心智模型*。对目标系统的内部表示，是理解与沟通的基础。
- **Catching up**：*仍在追赶*。指软件工程尚未形成像土木工程那样成熟的模型与表达体系。
:::

> **顿悟时刻：从“知道”到“理解”**
>
> 知道复杂分布式系统，与理解复杂分布式系统，是两回事。就像国际象棋：学会规则只要很短时间，但真正掌握策略与战术却需要长期投入。规则极简（一块棋盘、六种棋子、两名棋手），博弈却极其复杂——这正是棋类被视为智能标尺的原因。分布式系统同理：本书的目标不是让你多知道几个名词，而是建立**可靠的心智模型**。

### 1.1.1 心智模型：推理的基础

**模型（model）是目标系统的一种表示；心智模型则是目标系统的内部表示**，是理解（理解的能力）与沟通（传达理解的能力）的基础。

一种具象的理解方式，是把模型与系统都看作“事实的集合”：

- **系统**：构成**基准真相（ground truth）**的事实集合；
- **心智模型**：构成**我们感知到的真相**的事实集合。

一个好的心智模型必须同时满足两点：

- **正确性（correctness）**：模型中的每个事实都是系统的事实，即模型不含谬误；
- **完整性（completeness）**：系统中每个**相关**事实都是模型的事实，即模型不含遗漏。

:::en
> **Original**: A model is a representation of a target system. A mental model is the internal representation of the target system and the basis of comprehension (ability to understand) and communication (ability to convey understanding). ... A good mental model is a mental model that is correct and complete: Correctness—In a correct mental model, every fact of the model is a fact of the system. In other words, a correct mental model does not contain falsehoods. Completeness—In a complete mental model, every relevant fact of the system is a fact of the model. In other words, a complete mental model does not contain omissions.

**📌 核心术语与语境解析**：
- **Ground truth**：*基准真相*。系统客观存在的事实集合，独立于观察者的认知。
- **Relevance**：*相关性*。完整性是相对于目标而言的，相关性取决于观察者想解决什么问题。
:::

### 1.1.2 正确的心智模型

若图 1.1 中的灯泡电阻为 3.0 欧姆，而模型也写着 3.0 欧姆，则模型正确；若模型写成 2.0 欧姆，则模型错误。正确性讨论的是**模型与系统之间的一致性**。

### 1.1.3 完整的心智模型

没有任何模型能捕捉系统的全部事实，因此完整性被定义为“捕捉系统的每个**相关**事实”。相关性是应用相关的——换句话说，**相关性取决于观察者的目的**。

如果你的目标是计算流过灯泡的电流，这个模型既正确又完整；但如果你关心的是灯泡有多亮，模型就不完整了，因为它缺少发光效率（把电能转换为可见光的能力）。

## 1.2 软件系统的心智模型

软件系统是**虚拟构造物**，不是物理构造物。我们可以把分布式软件系统想成“一组通过网络交换消息的组件”，但无论你怎么找，都找不到这些构造物的物理实体——它们只是**表现得好像**由这些构造物组成。

软件系统的可观察行为，与我们对软件系统的模型是等价的；但会存在多个等价模型，它们并不比彼此更好地描述可观察行为。**不同的模型都是有效的。**

:::en
> **Original**: Software systems are virtual constructs, not physical constructs. ... Instead, a software system behaves as though it were made from these constructs. The observable behavior of a software system and our model of a software system are equivalent, but we will see multiple equivalent models that don't describe the observable behavior better than the others. Different models are valid!

**📌 核心术语与语境解析**：
- **Virtual construct**：*虚拟构造物*。只在行为层面存在、没有物理对应的抽象结构。
- **Observable behavior**：*可观察行为*。系统对外表现出的状态迁移序列，是模型的唯一检验标准。
:::

> **警惕类比**
>
> 类比是流行的教学工具，它承诺“可迁移性”——用电路类比水路，可以快速解释电流、电压、电阻。但教师通常清楚类比在哪里失效，学生却未必。于是“电像水一样流动”这类过度简化，会固化成错误认知。类比本质上是**另一个概念的模型**，使用它时必须批判性地评估其边界。

## 1.3 不同类型的模型

多年来我读遍分布式系统的博客、书籍与论文，却越来越沮丧：每个来源对分布式系统的定义都不一样。后来我意识到，**描述分布式系统从来没有唯一正确的方式**，只存在许多各有侧重的描述。

### 1.3.1 描述同一方面的不同模型

考虑“在途消息（in-flight messages）”存在哪里：

- 模型 A：网络是消息的缓冲区（buffer）；
- 模型 B：组件是消息的缓冲区。

两个模型都不错，都能捕捉“消息在途、丢失、重复、乱序”这些相关方面。选择往往只是偏好问题。

### 1.3.2 描述不同方面的不同模型

有时不同描述并不等价，因为它们关注的方面不同：有的描述表达了另一些描述刻意省略的内容。

Leslie Lamport 在 TLA+ 课程中对比过 **Transaction Commit 协议**（所有分布式事务协议的抽象）与 **两阶段提交（2PC）**（一种具体实现）。前者忽略消息交换，因此无法表示消息丢失、重复或重排；后者把消息交换纳入模型，于是可以表示这些情况。第 6 章会深入讨论。

:::en
> **Original**: My second realization was that sometimes, different ways of describing a distributed system are not equivalent because they have a different focus. Some descriptions express certain aspects of a system that others deliberately omit. ... The first model ignores message exchange, whereas the second model takes message exchange into account. As a result, the first model is unable to represent messages that are lost, duplicated, or rearranged, and the second model is able to do so.

**📌 核心术语与语境解析**：
- **Transaction Commit protocol**：*事务提交协议*。对分布式事务行为的抽象模型，不涉及具体消息交互。
- **Two-Phase Commit (2PC)**：*两阶段提交*。把消息交换纳入模型的具体实现，因而能刻画失败场景。
:::

> **盲人摸象**
>
> 六个盲人分别摸到象鼻、象耳、象尾，各自给出不同描述。寓意不是“有人错了”，而是**每个人的理解都被自己的视角所限**；只有把多个视角合并，才能得到更完整的认识。研究多个心智模型，同样能帮你发现自身思维中的误区。

遇到不同的模型时，不要急着判断谁对谁错。试着理解作者**为什么**选择这个模型：它适合说明什么问题？这个练习可能相当痛苦——你不得不暂时放下自己辛苦建立的模型——但回报是更整体的理解。

## 1.4 思考分布式系统

**分布式系统是一组协作的、并发的组件，它们通过网络发送和接收消息进行通信。** 每个组件独占访问自己的本地状态，其他组件无法访问；网络也独占访问自己的本地状态，包括在途消息。

描述系统行为最准确、最简洁的方式是**状态机（state machine）**——如果作者想强调状态之间的迁移步骤，也叫**状态-动作机（state action machine）**。系统行为被表示为一系列状态，每一步把系统从一个状态迁移到下一个状态。

系统以离散步骤推进，每一步由某个组件或网络执行，可分为：

- **外部步骤（external steps）**：接收消息、发送消息；
- **内部步骤（internal steps）**：执行本地计算、访问本地状态。

概括起来：**任何时刻，恰好一个组件或网络恰好完成一步。**

:::en
> **Original**: A distributed system is a collection of collaborating, concurrent components that communicate with one another by sending and receiving messages over a network. Each component has exclusive access to its own local state, which other components cannot access. The network has exclusive access to its own local state, including messages that are in flight. ... An accurate, concise way to think about the behavior of a distributed system is as a state machine ... To summarize, we will think about the system as one in which at any moment, exactly one component or the network will complete exactly one step.

**📌 核心术语与语境解析**：
- **In-flight messages**：*在途消息*。已发送但尚未被接收的消息，属于网络的本地状态。
- **Exactly one step**：*恰好一步*。这是本书全部推理的原子假设，交错（interleaving）由此定义。
:::

### 1.4.1 正确性

我职业生涯早期对“正确”的理解非常模糊：系统做了它该做的事，就是正确的。但这个定义没有给出任何可判定的标准。我需要能够严格推理系统的保证、能力与局限。

Leslie Lamport 在《Proving the Correctness of Multiprocess Programs》中给出了我最喜欢的定义：用**安全性（safety）**与**活性（liveness）**来定义正确性。

- **安全性**：通俗地说，保证“坏事永远不会发生”；
- **活性**：通俗地说，保证“好事最终会发生”。

**当系统的每一种可能行为都满足安全性与活性保证时，系统才是正确的。**

以跨两个键值存储 P1、P2 的分布式事务为例：安全性保证 P1 与 P2 不会一个提交、另一个回滚；活性保证二者最终都会做出决定（提交或回滚）。两者结合意味着：**最终 P1 与 P2 会达成同一个决定**——安全性防止系统进入不一致状态，活性防止系统卡死。

:::en
> **Original**: Leslie Lamport coined my favorite definition in "Proving the Correctness of Multiprocess Programs". Lamport defines the correctness of a system in terms of its safety and liveness properties: Safety—Informally, a safety property guarantees that something bad will never happen. Liveness—Informally, a liveness property guarantees that something good will eventually happen. A system is correct if every possible behavior of the system is correct—that is, if every possible behavior meets the system's safety and liveness guarantees.

**📌 核心术语与语境解析**：
- **Safety**：*安全性*。形如“绝不会到达某个坏状态”的性质，对应行为空间中的禁区。
- **Liveness**：*活性*。形如“最终一定会到达某个好状态”的性质，对应行为空间中不能停留的区域。
:::

> **注意这个建模选择**：我们有两个键值存储，却不以“键和值”为思考单位，只关心事务在 P1、P2 上的状态，忽略键、值甚至锁。这不是唯一正确的模型——你也可以把锁纳入模型。作者只是在主张：**对这些讨论而言，其他方面不相关**。你不必同意，但你们的关注点确实不同。

### 1.4.2 可扩展性与可靠性

Bowen Alpern 与 Fred Schneider 在《Defining Liveness》中证明：系统的每个性质都可以表示为安全性性质与活性性质的交集。但我并不用安全/活性去思考所有方面，比如可扩展性与可靠性。

这很常见：不同的心智模型在争夺注意力。即便它们等价，我们也常常偏爱其中一个。因此我更愿意用**响应性（responsiveness）**来思考可扩展性与可靠性——即系统满足其服务级别目标（SLO）的能力：

- **可扩展性**：系统在**负载**下保持响应性的能力；
- **可靠性**：系统在**失败**下保持响应性的能力。

### 1.4.3 响应性

响应性由四个相关概念形式化定义：

- **服务级别指标（SLI）**：对系统行为的定量观测；
- **服务级别目标（SLO）**：定义在 SLI 之上的谓词，判定系统行为是否达标；
- **错误率（error rate）**：在固定时间区间内，未达标观测数占总观测数的比例；
- **错误预算（error budget）**：我们可以接受的错误率上限。

于是：**响应性 = 系统把错误率维持在错误预算之下的能力。**

:::en
> **Original**: That situation is not uncommon: different mental models compete for our attention. Even when these mental models are equivalent, capable of expressing the same aspects but in different ways, we often gravitate toward one over the other. So I find myself thinking about scalability and reliability guarantees in terms of responsiveness, informally defined as a system's ability to meet its service-level objectives: Scalability of a system is defined as its ability to be responsive in the presence of load. Reliability of a system is defined as its ability to be responsive in the presence of failure.

**📌 核心术语与语境解析**：
- **Responsiveness**：*响应性*。以 SLO 达标能力衡量的系统健康度，是本书统一的可扩展性/可靠性语言。
- **Error budget**：*错误预算*。把“可接受的不达标比例”显式化的工程契约。
:::

> **顿悟时刻：正确性保证是应用相关的**
>
> 作为工程师，你有权定义系统的保证，决定哪些行为是可取的、可容忍的、不可容忍的。换言之：**你认为坏掉的，我可能认为可以接受。**
>
> **顿悟时刻：正确性保证是涌现的**
>
> 正确性、可扩展性、可靠性都无法追溯到单个组件。单个组件无法抵御无限负载，也无法抵御一次崩溃。它们是**一组组件及其交互的结果**。

## 1.5 两个大想法

有两个深刻影响我思考方式的大想法：**系统之系统（systems of systems）** 与 **全局视角 vs. 局部视角（global view vs. local view）**。它们将成为本书后面清晰定义“服务”乃至“微服务”的基础。

### 1.5.1 系统之系统

“分布式系统是一组并发的、通信的组件”——这个定义暗示组件是**原子的（atomic）**，即不可再分。但在软件系统中，大多数组件并非原子实体，而是**更高阶实体（higher-order entities）**，也就是**子系统（subsystems）**。

匈牙利哲学家 Arthur Koestler 在 1967 年的《The Ghost in the Machine》中提出 **holon** 一词：既是自身完整的整体，又是更大整体的一部分。取决于观察层级，holon 既可以被看作原子实体，也可以被看作 holon 的组织。这种由 holon 构成的层级结构称为 **holarchy**。

大多数复杂分布式系统并没有干净的层级，而是呈现出复杂、“凌乱”的组织形态。holon 与 holarchy 恰好能表达这种凌乱：让我们自由地分组、放大、缩小，准确而简洁地捕捉相关方面。

以多租户复制数据库为例：两个租户、各一个数据库、三个数据库节点，通过 Paxos/Raft/Viewstamped Replication 复制数据。你可以把它看成**一个原子实体**（数据库集群），也可以看成**三个交互节点的更高阶实体**；可以看成**两个原子实体**（每租户一个数据库），也可以看成每个数据库由节点组成。**同一个系统，可以有不同的 holarchy。**

:::en
> **Original**: How should we approach the idea that a group of concurrent and communicating components exhibits a specific behavior and that when it's viewed at a higher level of abstraction, the group behaves as though it were a single component? In his 1967 book The Ghost in the Machine, Hungarian philosopher Arthur Koestler introduced the term holon to describe an entity that is both whole in itself and part of a larger whole. Depending on the level of observation, a holon can be viewed as either an atomic entity or an organization of holons, a higher-order entity. This hierarchical structure composed of holons is referred to as a holarchy.

**📌 核心术语与语境解析**：
- **Holon**：*子整体*。既是整体又是部分的存在，用于描述可递归组合的系统单元。
- **Holarchy**：*子整体层级*。由 holon 构成的、允许“凌乱”组织的层级结构。
:::

### 1.5.2 全局视角 vs. 局部视角

回到全局与局部视角。我们从**全知观察者**的视角审视系统：能观察整个系统的状态，这就是**全局视角**。组件没有这种奢侈——它只能观察自己的状态与自己通往网络的信道，这就是**局部视角**。

从局部视角看，组件只能确定自己的状态；要确定全局状态，它必须请求其他组件合作，让它们通过网络发送各自记录的本地状态。

我们通常把通信想成 C1 与 C2 之间的直接消息交换。但必须理解：**C1 并不是直接与 C2 通信，而是与“系统的其余部分”通信。** C1 把一条寻址到 C2 的消息发给网络，网络是否转发给 C2、或者转发给别的组件，C1 无从知晓。

:::en
> **Original**: Let's return to the idea of a global view and a local view. Recall that we are considering the system from the perspective of an all-knowing observer, meaning that we are able to observe the state of the entire system: we have a global view. A component does not have the same luxury; a component can observe only its own state and its own channel to the network, giving it a limited local view. ... It is important to understand, however, that C1 is not communicating directly with C2 but with the rest of the system.

**📌 核心术语与语境解析**：
- **Global view**：*全局视角*。全知观察者可见的完整系统状态。
- **Local view**：*局部视角*。单个组件可见的有限信息，是分布式系统一切困难的根源。
:::

## 1.6 Distributed Systems Incorporated

我建议你把分布式系统想象成一栋办公楼里的公司——**Distributed Systems Incorporated**。

- **组件即房间**：每个房间及其成员代表一个并发组件，拥有本地状态、收发消息、执行任务；
- **网络即气动管道**：连接房间的气动管道（pneumatic tubes）经由收发室，代表消息传输的网络；
- **外部接口即信箱**：处理所有进出消息的信箱，代表系统与外部世界通信的边界。

这个模型能表达大量关注点：

- **崩溃语义（crash semantics）**：员工短暂离开 = 瞬态失败；休假 = 间歇性失败；离职 = 永久失败。
- **消息交付语义（message-delivery semantics）**：收发员丢失 = 消息未送达；重复投递 = 消息重复；重新排序 = 消息乱序。

设想一名员工发出请求却未收到回复：是请求丢了，还是回复丢了？如果重发，请求可能被处理两次，导致不一致。除非小心缓解，否则公司对客户的服务承诺就会受损。

这个模型能带你走得很远。如果你用 Kubernetes，不妨建模一个 “Kubernetes Incorporated”；如果你用 Kafka，不妨建模一个 “Kafka Incorporated”。每项技术都可以映射到办公楼类比，让抽象概念变得具体。

:::en
> **Original**: As we dive into the topic of distributed systems, I encourage you to picture them as a corporation situated in an office building. ... Components as rooms—Each room and its occupant represent a concurrent component in the distributed system. ... The network as pneumatic tubes ... The external interface as a mailbox ... In addition, this model can represent a wide range of concerns. What happens to Distributed Systems Incorporated if Bob, the mailroom attendant, loses messages, duplicates messages, or rearranges messages? What happens when employees take a 15-minute break, go on vacation, or leave the company?

**📌 核心术语与语境解析**：
- **Crash semantics**：*崩溃语义*。把失败按持续时间分类：瞬态、间歇、永久。
- **Message-delivery semantics**：*消息交付语义*。消息丢失、重复、乱序三类基本异常。
:::

## 1.7 驾驭复杂性

即使不深入细节，也可以先获得几个顿悟。

### 1.7.1 简单却复杂

每个员工可能只处理一组简单任务、遵循一组简单规则，但公司的整体行为却可以很复杂。**把简单组件组合起来，并不必然得到简单的系统。**

### 1.7.2 涌现行为

公司里那些有趣的行为，无法追溯到某个员工。单个员工无法为公司的可扩展性负责——一个人一天能干的活有上限；也无法为可靠性负责——他可能生病、休假或离职。

这些行为是**涌现的（emergent）**：由个体行为及其交互产生。这正是“**用不可靠组件构建可靠系统**”这一思想的基础。

### 1.7.3 改变视角

我们常常本能地在黑盒与白盒之间切换。但从黑盒到白盒，改变的是**分辨率**，不是**视角**：无论黑盒还是白盒，我们仍是全知观察者，仍在看整个系统——仍是全局视角。

而系统内部的组件没有这种奢侈，它只能看到自己的状态——局部视角。切换到这一视角，分布式系统的核心挑战便浮现出来：**全局地思考，局部地行动。**

### 1.7.4 全局思考，局部行动

构建分布式系统的核心挑战是：**设计一个全局算法，而每个组件只实现一个局部算法。**

以**脑裂（splitbrain）**为例：全局正确性要求“只有一个人是领导者并做决策”，但如何保证只有一个人相信自己是团队负责人？参与者是谁、各自掌握什么局部知识、采取哪些局部步骤，才能保证全局性质？换言之，**如何让每个只掌握局部信息的组件，共同表现得像一个连贯的整体。**

:::en
> **Original**: The core challenge of creating distributed systems is designing a global algorithm with each component of the system implementing a local algorithm. ... In this scenario, global correctness depends on one person being the leader and making decisions. But how can you ensure that only one person believes that they are the team lead? ... In other words, the challenge is creating a system that functions as a cohesive whole even though each component is aware of and able to access only local information.

**📌 核心术语与语境解析**：
- **Splitbrain**：*脑裂*。网络分区导致多个节点同时自认为领导者，破坏全局唯一性。
- **Think globally; act locally**：*全局思考，局部行动*。分布式算法的设计范式：全局不变量由局部规则共同保证。
:::

## 1.8 在代码之上思考

翻这本书你会发现几乎没有代码。这不是疏忽，而是刻意选择：**简单、静态的代码片段，无法捕捉复杂、动态的系统。** 我们要在代码之上思考，构造能捕捉系统本质的定制模型。

以竞态条件（race condition）为例。常见讲法是展示两个线程同时更新同一变量，但这会让人误以为竞态只与单变量更新有关，把理解负担丢给读者。

更好的做法是构造一个不依赖代码的最小模型：

- **进程是一个原子动作序列**：进程 P 是 a、b、c，进程 Q 是 x、y、z；进程执行即依次完成序列中的动作。
- **两个进程的并发组合（P | Q）** 是 P 与 Q 动作的**所有可能交错**的集合。
- **竞态条件**：当 (P | Q) 的某个子集——即某些交错——被认为是错误的。

最关键的是：**你是正确性的仲裁者**。什么算错误，由你定义。

:::en
> **Original**: If you flip through this book, you'll notice a distinct lack of code samples. This lack is not an oversight but a deliberate choice because simple, static code snippets are poor at capturing complex, dynamic systems. Instead, we'll think above the code and construct tailored mental models that capture the essence of the systems we aim to understand. ... A process is a sequence of atomic actions. ... The concurrent composition of two processes (P | Q) is the set of all possible interleavings of the actions from P and Q. ... A race condition is a situation in which a subset of (P | Q)—that is, a subset of the set of all possible interleavings—is considered incorrect.

**📌 核心术语与语境解析**：
- **Interleaving**：*交错*。并发进程动作的所有可能排列，是并发语义的数学载体。
- **Atomic action**：*原子动作*。不可被打断的最小执行单元，对应“恰好一步”的假设。
:::

## 本章小结

1. **模型是推理的基础**：正确（无谬误）且完整（无相关遗漏）的心智模型，才能支撑可靠判断。
2. **分布式系统 = 并发组件 + 网络**：每个组件独占本地状态，网络独占在途消息。
3. **行为即状态序列**：任何时刻恰好一个组件或网络完成恰好一步。
4. **正确性 = 安全性 ∩ 活性**：坏事不发生、好事终将发生。
5. **可扩展性与可靠性 = 负载/失败下的响应性**：以 SLI、SLO、错误预算度量。
6. **系统之系统**：组件既可以是原子实体，也可以是 holon；视角决定边界。
7. **全局思考，局部行动**：这是分布式系统全部难度的浓缩表达。

