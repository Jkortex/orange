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

![图 1.1：心智模型与系统](/media/posts/think-distributed-systems/fig-p023-1-1.png)
*图 1.1：心智模型与系统（Mental model and system）*

图 1.1 揭示了心智模型与真实系统之间的映射关系。系统是客观存在的“基准真相（ground truth）”，而心智模型则是我们大脑对其抽提的“感知真相（perceived truth）”。

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

![图 1.2：同一系统的多种等价抽象模型](/media/posts/think-distributed-systems/fig-p025-1-2.png)
*图 1.2：同一系统的多种等价抽象模型（Different mental models）*

如图 1.2 所示，对于同一个物理或虚拟系统，工程人员可以根据不同的分析目的建立多种彼此等价或互补的心智模型。

### 1.3.1 描述同一方面的不同模型

考虑“在途消息（in-flight messages）”存在哪里：

- 模型 A：网络是消息的缓冲区（buffer）；
- 模型 B：组件是消息的缓冲区。

![图 1.3：模型 A —— 将网络建模为在途消息的缓冲区](/media/posts/think-distributed-systems/fig-p026-1-3.png)
*图 1.3：模型 A —— 将网络建模为在途消息的缓冲区（The network as the buffer of in-flight messages）*

图 1.3 中，网络本身被建模为一个拥有独立状态的有界或无界缓冲区，组件发送的消息脱离组件后进入网络缓冲区排队，等待被对端接收。

![图 1.4：模型 B —— 将各个并发组件建模为在途消息的缓冲区](/media/posts/think-distributed-systems/fig-p027-1-4.png)
*图 1.4：模型 B —— 将各个并发组件建模为在途消息的缓冲区（The components serve as the buffer for in-flight messages）*

而在图 1.4 的模型 B 中，网络被简化为即时传输介质，所有“在途”状态均由发送端 Outbox 或接收端 Inbox 本地缓冲区承担。两个模型都不错，都能捕捉“消息在途、丢失、重复、乱序”这些相关方面。选择往往只是偏好与推演便利性的问题。

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

## 1.4 思考分布式系统

**分布式系统是一组协作的、并发的组件，它们通过网络发送和接收消息进行通信。** 每个组件独占访问自己的本地状态，其他组件无法访问；网络也独占访问自己的本地状态，包括在途消息。

![图 1.6：分布式系统作为一组并发、通信的组件集合](/media/posts/think-distributed-systems/fig-p029-1-6.png)
*图 1.6：分布式系统作为一组并发、通信的组件集合（A distributed system as a set of concurrent, communicating components）*

如图 1.6 所示，系统由拥有独立状态的并发组件集合与承载通信的网络共同构成。描述系统行为最准确、最简洁的方式是**状态机（state machine）**——如果作者想强调状态之间的迁移步骤，也叫**状态-动作机（state action machine）**。系统行为被表示为一系列状态，每一步把系统从一个状态迁移到下一个状态。

![图 1.7：系统的行为表现为一系列状态迁移序列](/media/posts/think-distributed-systems/fig-p029-1-7.png)
*图 1.7：系统的行为表现为一系列状态迁移序列（Behavior of a system as a sequence of states）*

图 1.7 刻画了分布式系统的离散步进过程：系统从初始状态 $S_0$ 出发，每一步通过原子动作迁移到下一状态 $S_1, S_2, \dots$。每一步由某个组件或网络执行，可分为：

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

![图 1.8：安全性与活性保证的行为空间划分](/media/posts/think-distributed-systems/fig-p030-1-8.png)
*图 1.8：安全性与活性保证（Safety and liveness）*

图 1.8 直观展现了行为空间的拓扑：安全性规定系统必须停留在绿色安全区内，绝不能踏入红色坏状态；而活性则保证系统绝不会在中间灰色区域无限停滞，终将到达目标状态。

![图 1.9：两个参与者的分布式事务行为空间](/media/posts/think-distributed-systems/fig-p031-1-9.png)
*图 1.9：两个参与者的分布式事务行为空间（Behavior space of a distributed transaction with two participants）*

以图 1.9 所示跨两个键值存储 P1、P2 的分布式事务为例：安全性保证 P1 与 P2 不会一个提交、另一个回滚（这属于违背原子性的红色禁止状态）；活性保证二者最终都会做出决定（提交或回滚）。两者结合意味着：**最终 P1 与 P2 会达成同一个决定**——安全性防止系统进入不一致状态，活性防止系统卡死。

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

![图 1.10：分布式系统作为一组并发、通信的子系统](/media/posts/think-distributed-systems/fig-p033-1-10.png)
*图 1.10：分布式系统作为一组并发、通信的子系统（A distributed system as a set of concurrent, communicating subsystems）*

如图 1.10 所示，多个基本组件聚合为具备明确边界的子系统，子系统对外作为一个整体参与交互。

![图 1.11：子系统边界与内部消息交互](/media/posts/think-distributed-systems/fig-p034-1-11.png)
*图 1.11：子系统边界与内部消息交互（Subsystem boundaries and message flows）*

图 1.11 进一步区分了跨越子系统边界的外部消息流动与子系统内部组件之间的内部通信流。

匈牙利哲学家 Arthur Koestler 在 1967 年的《The Ghost in the Machine》中提出 **holon** 一词：既是自身完整的整体，又是更大整体的一部分。取决于观察层级，holon 既可以被看作原子实体，也可以被看作 holon 的组织（即更高阶实体）。这种由 holon 构成的层级结构称为 **holarchy**。

大多数复杂分布式系统并没有干净的层级，而是呈现出复杂、“凌乱”的组织形态。holon 与 holarchy 恰好能表达这种凌乱：让我们自由地分组、放大、缩小，准确而简洁地捕捉相关方面。

![图 1.12：表示同一系统的两种不同全阶层（Holarchies）划分](/media/posts/think-distributed-systems/fig-p035-1-12.png)
*图 1.12：表示同一系统的两种不同全阶层划分（Two different holarchies representing the same system）*

以图 1.12 所示的多租户复制数据库为例：两个租户、各一个数据库、三个数据库节点，通过 Paxos/Raft/Viewstamped Replication 复制数据。你可以把它看成**一个原子实体**（数据库集群），也可以看成**三个交互节点的更高阶实体**；可以看成**两个原子实体**（每租户一个数据库），也可以看成每个数据库由节点组成。**同一个系统，可以有不同的 holarchy。**

:::en
> **Original**: How should we approach the idea that a group of concurrent and communicating components exhibits a specific behavior and that when it's viewed at a higher level of abstraction, the group behaves as though it were a single component? In his 1967 book The Ghost in the Machine, Hungarian philosopher Arthur Koestler introduced the term holon to describe an entity that is both whole in itself and part of a larger whole. Depending on the level of observation, a holon can be viewed as either an atomic entity or an organization of holons, a higher-order entity. This hierarchical structure composed of holons is referred to as a holarchy.

**📌 核心术语与语境解析**：
- **Holon**：*子整体*。既是整体又是部分的存在，用于描述可递归组合的系统单元。
- **Holarchy**：*子整体层级*。由 holon 构成的、允许“凌乱”组织的层级结构。
:::

### 1.5.2 全局视角 vs. 局部视角

回到全局与局部视角。我们从**全知观察者**的视角审视系统：能观察整个系统的状态，这就是**全局视角**。

![图 1.13：全局视角（全知观察者视角）](/media/posts/think-distributed-systems/fig-p035-1-13.png)
*图 1.13：全局视角（Global point of view）*

图 1.13 中，上帝视角的观察者可以同时感知组件 C1、C2、C3 的本地状态以及网络信道中飞行的所有在途消息。但现实中，组件没有这种奢侈——它只能观察自己的状态与自己通往网络的信道，这就是**局部视角**。

![图 1.14：局部视角（组件 C1 的视角）](/media/posts/think-distributed-systems/fig-p036-1-14.png)
*图 1.14：局部视角（C1’s point of view）*

如图 1.14 所示，从局部视角看，组件 C1 只能确定自己的状态；对 C1 而言，世界被划分为“自己”和“系统的其余部分（rest of the system）”。要确定全局状态，它必须请求其他组件合作，让它们通过网络发送各自记录的本地状态。

这种信息不对称性意味着：**分布式系统中不存在自然的全局瞬时共识。任何全局认知，都必须付出消息传递与时延的代价。**

:::en
> **Original**: Coming back to the global and local points of view, we look at a system from the point of view of an omniscient observer: an observer who can observe the state of the entire system. We call this perspective the global point of view. A component does not have the luxury of an omniscient observer. A component can observe only its own state and its incoming and outgoing channels to the network. We call this perspective the local point of view.

**📌 核心术语与语境解析**：
- **Omniscient observer**：*全知观察者*。假想能够瞬间获知系统所有状态的实体，用于理论分析。
- **Local point of view**：*局部视角*。真实组件受限于物理网络所能获得的唯一视角。
:::

## 1.6 Distributed Systems Incorporated

为了建立稳固的物理直觉，作者提出了一个著名的形象化模型：**Distributed Systems Incorporated（分布式系统股份公司）**。

![图 1.15：Distributed Systems Incorporated 物理具象化模型](/media/posts/think-distributed-systems/fig-p037-1-15.png)
*图 1.15：Distributed Systems Incorporated 物理实体模型（Distributed Systems Incorporated）*

图 1.15 把无形、抽象的网络赛博系统映射为一个实体的办公大楼：

- **房间与人员代表并发组件**：每个房间及其内的员工代表一个并发组件。员工只能查看和修改房间内白板上的内容（私有本地状态），严禁跨入其他房间或直接偷看他人白板；
- **信使（Couriers）代表网络**：员工之间沟通的唯一途径是手写便签，由走廊里的信使传递。信使可能会慢、可能会弄丢信件、可能会误投多份、甚至可能按相反顺序送达；
- **办公室的物理隔离代表无共享内存（Share Nothing）**：组件之间绝无共享内存，唯一的耦合点就是消息本身。

这个类比忠实地保留了分布式系统的核心力学特征：异步性、局部状态隔离以及不可靠的通信信道。

## 1.7 驾驭复杂性

分布式系统的复杂性不是偶然的，而是其基本属性。我们需要学会与这种复杂性共处。

### 1.7.1 简单却复杂

就像国际象棋：规则只有几条，推演出的局面却超越宇宙原子总数。分布式系统也是如此：组件不过是执行几个简单状态转换，网络不过是收发几条字节流，但并发交错产生的状态空间爆炸却极难掌控。

### 1.7.2 涌现行为

**涌现行为（emergent behavior）** 是指整体呈现出部分所不具备的特质。系统的可靠性或不可靠性，都不是某个单独组件的代码决定的，而是在组件之间的持续交错交互中“涌现”出来的。

### 1.7.3 改变视角

面对复杂性，我们必须具备在黑盒模型与白盒模型之间自如切换视角的思维敏锐度。

![图 1.16：黑盒与白盒模型：全局视角](/media/posts/think-distributed-systems/fig-p039-1-16.png)
*图 1.16：黑盒与白盒模型：全局视角（Black-box versus white-box models: a global point of view）*

在图 1.16 的全局视角下，我们可以选择将一组紧密协作的组件群视为一个不透明的“黑盒”服务，仅关注其输入输出规范；也可以将其展开为“白盒”，审视其内部各节点间复杂的复制与共识流。

![图 1.17：黑盒与白盒模型：局部视角](/media/posts/think-distributed-systems/fig-p040-1-17.png)
*图 1.17：黑盒与白盒模型：局部视角（Local point of view）*

而在图 1.17 的局部视角下，白盒视角的展开能帮助组件开发者理解下游依赖的真实容灾边界，避免在接口契约之外做出危险的隐式时序假设。

### 1.7.4 全局思考，局部行动

分布式系统设计者的信条是：**全局思考，局部行动（Think globally; act locally）**。

作为架构师，你必须以全局视角审视系统的整体安全性与活性边界；但当你落实到每个组件的代码与状态机时，你必须严格以局部视角编写逻辑——绝不能在代码中假设“我知道对端现在是什么状态”。

## 1.8 在代码之上思考

许多工程师一遇到分布式系统问题，第一反应就是“打日志、加锁、看代码”。但分布式系统的大多数微妙 Bug（如死锁、活锁、脏写、脑裂）根本无法在单行代码层面被看清。

你必须学会在代码之上抽象推演系统的状态空间与时序交错（Interleaving）。

![图 1.19：并发竞态推演与交替步骤分析](/media/posts/think-distributed-systems/fig-p041-1-19.png)
*图 1.19：并发竞态推演（Reasoning about race conditions）*

图 1.19 展示了两个并发进程 $P$ 与 $Q$ 的步骤交错空间。即便 $P$ 只有步骤 $p_1, p_2$，$Q$ 只有 $q_1, q_2$，它们在网络与调度器的作用下所能产生的时间交织序列也包含了数种不同排列：
$$[p_1, p_2, q_1, q_2], \quad [p_1, q_1, p_2, q_2], \quad [q_1, p_1, q_2, p_2], \quad [q_1, q_2, p_1, p_2] \dots$$

![图 1.20：并发交替执行（P | Q）与顺序执行（P • Q 或 Q • P）的等价性判定](/media/posts/think-distributed-systems/fig-p042-1-20.png)
*图 1.20：并发交替执行与串行组合的等价性判定（(P | Q) interleavings vs sequential composition）*

图 1.20 揭示了并发正确性的终极判定法：**可串行化（Serializability）**。
并发交替执行 $(P \mid Q)$ 是正确的，当且仅当对于每一种可能的调度交错，其最终执行结果都在语义上等价于某种纯顺序执行：要么等价于 $P$ 先执行完、再执行 $Q$（即 $P ullet Q$）；要么等价于 $Q$ 先执行完、再执行 $P$（即 $Q ullet P$）。

如果某一种交织产生了一个既不符合 $P ullet Q$ 也不符合 $Q ullet P$ 的中间混乱状态，那么系统就存在竞态条件缺陷（Race Condition）。

:::en
> **Original**: Reasoning about race conditions requires us to think above the code. We must represent the system as a state machine and explore the behavior space. The concurrent composition of P and Q (P | Q) is correct if, for every possible interleaving, the result of the execution is equivalent to either (P • Q) or (Q • P). When we find the right mental model, we are able to reason about the systems we create with unparalleled clarity.

**📌 核心术语与语境解析**：
- **Concurrent composition**：*并发组合 $(P \mid Q)$*。两个过程非阻塞并发运行，其原子步骤任意交错。
- **Sequential composition**：*顺序组合 $(P ullet Q)$*。一个过程完全执行完毕后，另一个过程才启动执行。
:::

## 本章小结

1. **心智模型是第一生产力**：从模糊直觉走向准确、简洁的状态机表达，是攻克分布式系统不确定性的唯一途径。
2. **正确性的形式化定义**：系统正确性由安全性（坏事不发生）与活性（好事终发生）共同界定。
3. **两大支柱认知**：
   - **系统之系统（Holarchy）**：组件与子系统可递归组合，允许多种等价层级划分；
   - **全局 vs. 局部视角**：全知视角用于推演证明，局部视角用于编码落地。
4. **代码之上推演**：借助状态机与步骤交错模型，在动手编码前证明并发与失败下的等价性。
