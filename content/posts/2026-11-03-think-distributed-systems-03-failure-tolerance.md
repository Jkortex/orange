---
title: "Think Distributed Systems（三）：失败、失败容忍与失败处理"
date: 2026-11-03T02:30:00Z
description: "用合法状态/非法状态/不可容忍状态定义失败，用安全性/活性区分屏蔽型、非屏蔽型与故障安全型容忍，并给出检测-分类-缓解的工程闭环。"
category: distributed-systems
column: think-distributed-systems
tags:
  - "失败容忍"
  - "安全性"
  - "活性"
  - "前向恢复"
  - "后向恢复"
  - "重试"
---

# 第 3 章：失败容忍

本章涵盖：

- 失败与失败容忍
- 失败检测与失败缓解
- 应用层失败与平台层失败
- 瞬态、间歇与永久失败
- 一种理想的失败处理策略

思考失败的首要目标，是保证**失败容忍（failure tolerance）**：即使发生失败，分布式系统仍以**定义良好的方式**运行。

## 3.1 理论上

非形式地说，**失败（failure）是系统一次不受欢迎但可能发生的状态迁移**：系统从好状态迁移到坏状态。失败容忍则是系统处于坏状态时仍能表现良好的能力。

形式化地看，系统可以处于三种状态：**合法状态（legal，好状态）**、**非法状态（illegal，坏状态）**、**不可容忍状态（intolerable，“一切都完了”状态）**；迁移分为两类：**正常迁移（normal）**与**失败迁移（failure）**。

- 合法状态 + 正常迁移 → 合法状态；
- 合法状态 + 失败迁移 → 非法状态；
- 非法状态 + 正常迁移 → 合法状态（这就是**失败恢复**）；
- 非法状态 + 失败迁移 → 另一个非法状态。

> **注意术语**：fault、error、failure 三个词在不同作者笔下含义混乱，并不存在公认定义。本书统一使用 **failure**，并用 **failure tolerance** 而非更常见的 fault tolerance，目的是减少歧义。

**不可容忍状态**通常被排除在讨论之外——按定义，我们不去容忍它，也不试图容忍它。常被引用的例子是“地球被陨石击中”：此时已无任何预案可言。

## 3.2 失败容忍的类型

合法与非法状态由安全性与活性刻画：

- **安全性**：坏事永远不会发生；
- **活性**：好事最终会发生。

无失败时，系统同时保证二者；有失败时，往往必须妥协。

| | 安全 | 不安全 |
| :--- | :--- | :--- |
| **有活性** | 屏蔽型（Masking） | 非屏蔽型（Nonmasking） |
| **无活性** | 故障安全型（Fail-safe） | 无（最坏情况） |

- **屏蔽型失败容忍**：失败时同时保证安全与活性，等价于**失败透明（failure transparency）**。这是最理想的形式，但代价可能过高，甚至不可能实现——第 9 章的 CAP 等不可能性结果会说明这一点。
- **非屏蔽型失败容忍**：失败时保证活性、不保证安全。通俗说：**不保证不犯错，但保证有进展。** 例如一个 FIFO 队列，失败期间仍继续投递消息，但可能乱序。
- **故障安全型失败容忍**：失败时保证安全、不保证活性。通俗说：**保证不犯错，但不保证有进展。** 同一个队列在失败期间停止投递，以避免乱序。
- **两者皆不保证**：根本谈不上失败容忍，多数场景下不可接受。

以单进程 P 为例，变量 x ∈ {0,1,2,3}，初始 1：

- 正常迁移：1 → 2、2 → 1；修复迁移：0 → 1；
- 失败迁移：x ≠ 0 → 0。

若定义安全性为“x 只能是 1 或 2”，活性为“未来某一刻 x 会等于 1，且未来某一刻 x 会等于 2”，则：

- x = 1 或 2：安全且活性；
- x = 0：不安全但仍活性 → **非屏蔽型**；
- x = 3：不可容忍，系统不保证能回到合法或非法状态。

:::en
> **Original**: Informally, a failure is an unwanted but possible state transition of a system. On failure, the system transitions from a good state to a bad state. Failure tolerance is the ability of a system to behave in a well-defined manner when the system is in a bad state. ... If a system guarantees both safety and liveness in the presence of failure, it provides masking failure tolerance. ... If a system guarantees liveness but does not guarantee safety in the presence of failure, it provides nonmasking failure tolerance. ... If a system guarantees safety but does not guarantee liveness in the presence of failure, it guarantees fail-safe failure tolerance.

**📌 核心术语与语境解析**：
- **Masking / Nonmasking / Fail-safe**：*屏蔽型 / 非屏蔽型 / 故障安全型*。三者构成失败容忍的能力谱系。
- **Failure transparency**：*失败透明*。屏蔽型容忍的另一种说法：外部观察不到失败。
:::

## 3.3 实践中

下面把视角切到**服务编排（service orchestration）**：一个服务消费者与一个或多个服务提供者，通过请求-响应式消息交换交互。

消费者执行一个**进程（process）**——一串步骤，每一步都是对提供者的请求。进程启动后有两种可能：

- **完整应用（total application）**：无失败时，每步都成功，系统从一个正确状态迁移到另一个正确状态；
- **部分执行（partial execution）**：失败导致进程只完成了一部分。

**部分执行是不可接受的**。因此失败后必须保证进程以两种方式之一结束：

- **正确且理想**：与成功完整执行在可观察层面等价（**前向恢复**）；
- **正确但不理想**：与从未执行在可观察层面等价（**后向恢复**）。

> **提示**：完整性之于分布式系统，正如 ACID 之于数据库——它是步骤序列正确执行的前提。序列不完整，就是不正确的。

以电商结账为例，其中一步是**扣款**：成功结账时必须**恰好扣一次**；结账失败则**一次都不能扣**。绝不能在商品未发货、票未出票的情况下扣款。

### 3.3.1 失败处理的两步

失败处理包含两步：**失败检测（detection）** 与 **失败缓解（mitigation）**——先发现不受欢迎的事件，再采取措施缓解它。

> **顿悟时刻：检测对应安全，缓解对应活性**
>
> 失败检测是保证**安全性**的基础：检测到失败后抑制危险动作，系统就维持了安全。失败缓解是保证**活性**的基础：缓解失败后系统恢复进展。
>
> 共识算法就是例证：Paxos、Raft、Viewstamped Replication 依赖法定人数（quorum）。当节点无法参与 quorum（检测）时，它必须停止响应请求以保证安全；当它重新加入 quorum（缓解）时，恢复响应、恢复活性。

:::en
> **Original**: Failure handling involves two main steps: failure detection and failure mitigation—that is, detecting an unwanted event and then taking steps to mitigate it. ... In general, failure detection is the basis for guaranteeing safety. ... Similarly, failure mitigation is the basis for guaranteeing liveness.

**📌 核心术语与语境解析**：
- **Failure detection**：*失败检测*。判断是否发生失败的机制，直接支撑安全性。
- **Failure mitigation**：*失败缓解*。消除或绕过失败的机制，直接支撑活性。
:::

### 3.3.2 失败分类：空间维度

失败可以按**发生位置**分类，前提是先引入**分层（layered architecture）**模型：高层组件向低层组件发起 downcall 并期待响应；低层偶尔通过预先注册的回调向高层发起 upcall。

> **顿悟时刻：应用层与平台层**
>
> “应按照事物在语境中扮演的角色来刻画它，而不是按某种内在属性。”——Eugenia Cheng
>
> 对任意一层而言，**它自己就是应用层，它下面的所有层都是平台层**。操作系统视自己为应用层、硬件为平台层；数据库管理系统视自己为应用层、操作系统与硬件为平台层。有时我们还会分三层：应用、平台、基础设施。

**端到端论证（end-to-end argument）**指出：在分层系统中，失败处理应放在**能够正确且完整地完成检测与缓解的最低层**。据此：

- **应用层失败**：**InsufficientFunds**（余额不足）——只有应用层能正确完整地解决，平台层无法解释其语义；
- **平台层失败**：**CouldNotConnect**（连接失败）——虽然应用层“或许”能处理，但能正确完整处理的最低层是平台层（重建连接）。

### 3.3.3 失败分类：时间维度

按**发生时间**，失败分为瞬态、间歇与永久，可用条件概率刻画——即在已发生一次失败的前提下，再次失败的概率。

- **瞬态失败（transient）**：P(F2 | F1) = P(F2)。第二次失败的概率不因第一次而升高；**自动修复**。例：路由器重启导致的连接失败。
- **间歇失败（intermittent）**：P(F2 | F1) > P(F2)。再次失败概率升高；**自动修复**，但会持续一段时间。例：过期的路由表，等路由器更新后恢复。
- **永久失败（permanent）**：P(F2 | F1) = 1.0。第二次失败必然发生；**需要人工修复**。例：证书过期，必须由运维更换有效证书。

:::en
> **Original**: Failures can be classified as transient, intermittent, or permanent. These classifications can be expressed as conditional probabilities—specifically, the probability that a second failure will occur, given that a first failure has already occurred. ... Transient and intermittent failures often repair automatically, whereas permanent failures usually require manual repair.

**📌 核心术语与语境解析**：
- **Transient / Intermittent / Permanent**：*瞬态 / 间歇 / 永久*。按复发概率与修复方式划分的失败时间谱系。
- **Autorepair**：*自动修复*。无需人工介入即可恢复，是瞬态与间歇失败的共同特征。
:::

### 3.3.4 失败检测

失败检测是失败处理的第一环。但分布式系统中的“失败检测器”概念本身就很微妙：多数文献聚焦于组件崩溃（Crash-Stop、Omission、Crash-Recovery）。

在部分同步或异步系统、不可靠网络中，**消息缺失并不必然意味着失败**——消息可能只是延迟（部分同步/异步）或丢失（不可靠网络）。因此：

- **完备性（completeness）**：最终能识别出每一个真实失败，即不漏报（无假阴性）；
- **准确性（accuracy）**：识别出的每个失败都是真实失败，即不误报（无假阳性）。

在部分同步/异步 + 不可靠网络的假设下，**同时做到完备且准确的失败检测器是不可能的**——因为无法区分“延迟”与“丢失”。

> **顿悟时刻：谁来监督监督者？**
>
> 当一个组件充当观察者去监控另一个组件时，问题随之而来：谁来监控观察者？实践中可以用多层监督策略，Erlang/OTP 的监督树（supervision tree）是最著名的例子。但监督终有尽头，最终仍需人类介入。

:::en
> **Original**: Failure detection is complete if the failure detector eventually identifies every actual failure, and it's accurate if every identified failure is an actual failure. In other words, completeness implies no misses (false negatives), and accuracy implies no mistakes (false positives). In a partially synchronous or asynchronous system communicating over an unreliable network, it is impossible to achieve a complete and accurate failure detector due to the inherent uncertainty about whether a message was delayed or lost.

**📌 核心术语与语境解析**：
- **Completeness / Accuracy**：*完备性 / 准确性*。分别对应“不漏报”与“不误报”，二者在异步不可靠网络中不可兼得。
- **False negative / positive**：*假阴性 / 假阳性*。漏掉真实失败 / 报告不存在的失败。
:::

### 3.3.5 失败缓解

失败缓解负责解决（疑似）失败，分为两类：

- **后向恢复（backward recovery）**：把系统从中间非法状态迁回**等价于初始合法状态**的位置，即“往回退”。经验法则：**不需要修复根因**，因为我们不打算越过它。它是应用层常见的缓解手段，典型形式是**补偿（compensation）**。
- **前向恢复（forward recovery）**：把系统从中间非法状态推进到**等价于最终合法状态**的位置，即“往前走”。经验法则：**必须修复根因**，因为我们要越过它。它是平台层常见的缓解手段，典型形式是**重试（retry）**。

:::en
> **Original**: Backward failure recovery refers to a failure-mitigation strategy that transitions the system from the intermediary, illegal state to a state that is equivalent to the initial, legal state: it moves the process backward. ... Forward failure recovery refers to a failure-mitigation strategy that transitions the system from the intermediary, illegal state to a state that is equivalent to the final, legal state: it moves the process forward. As a rule of thumb, forward failure recovery requires repairing the underlying cause of the failure because we try to push past it.

**📌 核心术语与语境解析**：
- **Backward recovery**：*后向恢复*。回滚到初始状态，靠补偿而非修复根因。
- **Forward recovery**：*前向恢复*。推进到最终状态，必须修复根因后才能越过失败。
:::

### 3.3.6 把一切串起来

一种理想的失败处理策略如下：

1. **能明确判定为应用层失败** → 应用层负责缓解。例如 InsufficientFundsException，用后向恢复补偿已发生的步骤。
2. **无法明确判定，或明确判定为平台层失败** → 平台层负责缓解，按三级升级：
   - 假设是**平台层 + 瞬态 + 自动修复** → 立即重试；
   - 假设是**平台层 + 间歇 + 自动修复** → 带退避（backoff）的多次重试；
   - 假设是**平台层 + 永久 + 人工修复** → 挂起进程、修复底层条件、恢复进程后重试。
3. **平台层缓解最终失败** → 升级为应用层失败，交由应用处理。
4. **后向恢复本身失败**（例如退款失败）→ 升级到**人类层**。最坏情况下，得有人签一张退款支票寄给客户。

:::en
> **Original**: A possible failure-mitigation strategy consists of three escalating steps: We assume that a failure is a platform-level, transient, autorepair failure; to mitigate the failure, we issue an immediate retry. We assume that a failure is a platform-level, intermittent, autorepair failure; to mitigate the failure, we schedule multiple retries with a backoff strategy. We assume that a failure is a platform-level, permanent, manual-repair failure; to allow for mitigation, we suspend the process, repair the underlying condition of the failure, and resume the process to retry.

**📌 核心术语与语境解析**：
- **Backoff**：*退避*。重试间隔递增，避免持续冲击已受损的下游。
- **Escalation**：*升级*。失败在层间逐级上抛，直到有层能正确完整处理。
:::

## 本章小结

1. **失败 = 不受欢迎但可能的状态迁移**；失败容忍 = 坏状态下仍定义良好地运行。
2. **三种容忍类型**：屏蔽型（安全+活性）、非屏蔽型（仅活性）、故障安全型（仅安全）。
3. **检测支撑安全，缓解支撑活性**——这是失败处理的结构性对称。
4. **空间分类**：应用层 vs. 平台层，判据是“能正确完整处理的最低层”。
5. **时间分类**：瞬态、间歇、永久，对应不同的重试与修复策略。
6. **完备且准确的检测器在异步不可靠网络中不可能存在**——所以失败处理必须容忍误判。
7. **后向恢复靠补偿，前向恢复靠修复根因**；平台层用重试，应用层用补偿。
8. **升级链**：平台层三级重试 → 应用层 → 人类层。

