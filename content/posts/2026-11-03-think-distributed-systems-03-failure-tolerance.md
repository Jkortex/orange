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

![图 3.1：系统状态与状态迁移空间](/media/posts/think-distributed-systems/fig-p061-3-1.png)
*图 3.1：系统状态与状态迁移（System states and state transitions）*

如图 3.1 所示，形式化地看，系统可以处于三种状态：**合法状态（legal，好状态）**、**非法状态（illegal，坏状态）**、**不可容忍状态（intolerable，“一切都完了”状态）**；迁移分为两类：**正常迁移（normal）**与**失败迁移（failure）**。

- 合法状态 + 正常迁移 → 合法状态；
- 合法状态 + 失败迁移 → 非法状态；
- 非法状态 + 正常迁移 → 合法状态（这就是**失败恢复**）；
- 非法状态 + 失败迁移 → 另一个非法状态。

![图 3.2：失败容忍的恢复轨迹推演](/media/posts/think-distributed-systems/fig-p063-3-2.png)
*图 3.2：偏离轨迹与恢复机制示意（An illustration of failure tolerance）*

图 3.2 描绘了系统状态轨迹：系统从初始合法状态按预定轨迹推进；一旦突发故障将系统推入非法状态，失败容忍机制便被激活，通过一系列恢复步骤将系统重新拉回到合法状态空间内。

> **注意术语**：fault、error、failure 三个词在不同作者笔下含义混乱，并不存在公认定义。本书统一使用 **failure**，并用 **failure tolerance** 而非更常见的 fault tolerance，目的是减少歧义。

**不可容忍状态**通常被排除在讨论之外——按定义，我们不去容忍它，也不试图容忍它。常被引用的例子是“地球被陨石击中”：此时已无任何预案可言。

## 3.2 失败容忍的类型

合法与非法状态由安全性与活性刻画：

- **安全性**：坏事永远不会发生；
- **活性**：好事最终会发生。

无失败时，系统同时保证二者；有失败时，往往必须妥协。

| 容忍类型 | 安全性 | 活性 | 典型策略 |
| :--- | :--- | :--- | :--- |
| **屏蔽型（Masking）** | ✔️ 保持 | ✔️ 保持 | 错误对外部完全透明（如 Paxos 少数派崩溃） |
| **非屏蔽型（Nonmasking）** | ❌ 暂时违背 | ✔️ 保持 | 最终恢复一致性（如自稳定算法） |
| **故障安全型（Fail-safe）** | ✔️ 保持 | ❌ 暂时牺牲 | 停机以保安全（如断路器、2PC 阻塞） |

- **屏蔽型失败容忍**最理想：外部完全察觉不到内部故障；
- **非屏蔽型失败容忍**允许系统暂时偏离规范，随后自行恢复（自稳定算法）；
- **故障安全型失败容忍**宁可牺牲可用性（停机、挂起），也要守住安全性（绝不产生脏数据）。

:::en
> **Original**: Formally, a system can be in one of three states: legal, illegal, or intolerable. Transitions are either normal or failure transitions. In masking failure tolerance, the system remains in a legal state from an external observer's point of view despite internal failures. In nonmasking failure tolerance, the system may enter an illegal state but eventually returns to a legal state. In fail-safe failure tolerance, the system may sacrifice liveness to ensure safety is never violated.

**📌 核心术语与语境解析**：
- **Masking tolerance**：*屏蔽型容忍*。内部吸收故障，对外部完全隐匿。
- **Fail-safe**：*故障安全*。在活性与安全性冲突时，无条件保全安全性的保守防守策略。
:::

## 3.3 实践中

理论模型干净利落，但实践中失败处理要复杂得多。

![图 3.3：跨服务编排业务调用流](/media/posts/think-distributed-systems/fig-p065-3-3.png)
*图 3.3：服务编排拓扑（Service orchestration）*

考虑图 3.3 所示的典型电商编排场景：客户端发起下单请求，编排器需要依次协调库存服务、支付服务与物流服务。

![图 3.4：业务进程的离散步骤推进序列](/media/posts/think-distributed-systems/fig-p065-3-4.png)
*图 3.4：进程作为步骤序列（A process as a sequence of steps）*

如图 3.4 所示，编排器执行的业务进程本质上是一串离散的动作序列：
$$	ext{Step } 1 	o 	ext{Step } 2 	o 	ext{Step } 3$$

![图 3.5：中间崩溃导致的部分执行不一致状态](/media/posts/think-distributed-systems/fig-p066-3-5.png)
*图 3.5：部分执行失败（Partial execution failure）*

然而现实中，图 3.5 所示的**部分执行（Partial Execution）**无处不在：扣除库存成功（Step 1 完成），但在支付调用前节点崩溃或网络断开。此时系统停滞在半途，库存被锁死而订单未生成。

**完整性（Completeness / 全执行）之于分布式系统，就如同 ACID 之于数据库：它是多步骤执行正确的绝对前提。**

### 3.3.1 失败处理的两步

处理任何失败，都必须完整走过两个步骤：

![图 3.6：失败处理的双阶段架构：检测与缓解](/media/posts/think-distributed-systems/fig-p066-3-6.png)
*图 3.6：失败处理的两步（Failure handling: detection and mitigation）*

如图 3.6 所示：
1. **失败检测（Failure detection）**：识别出发生了失败（通过心跳、超时或显式错误码）；
2. **失败缓解（Failure mitigation）**：采取补救措施，消除或控制失败的影响。

### 3.3.2 失败分类：空间维度

在空间维度上，失败可以分为应用层失败与平台层失败：

![图 3.7：分层思考：平台层与应用层](/media/posts/think-distributed-systems/fig-p067-3-7.png)
*图 3.7：分层架构模型（Thinking in layers）*

![图 3.8：平台级与应用级失败检测](/media/posts/think-distributed-systems/fig-p067-3-8.png)
*图 3.8：失败检测的分层（Failure detection layers）*

![图 3.9：分层失败处理策略](/media/posts/think-distributed-systems/fig-p067-3-9.png)
*图 3.9：跨层失败处理联动（Failure handling in layers）*

![图 3.10：应用层与平台层职责边界](/media/posts/think-distributed-systems/fig-p068-3-10.png)
*图 3.10：应用层 vs 平台层（Application-level vs. platform-level）*

图 3.7 至图 3.10 清晰勾勒了职责边界：
- **平台层失败**：网络丢包、机器崩溃、操作系统 OOM，通常由底层平台（TCP、Kubernetes、服务网格）处理；
- **应用层失败**：业务不变量违背（如余额不足、商品下架），底层平台无法理解业务上下文，必须由应用层代码处理。

### 3.3.3 失败分类：时间维度

在时间维度上，失败表现为三种不同的模式：

![图 3.11：瞬态失败及其偶发特征](/media/posts/think-distributed-systems/fig-p069-3-11.png)
*图 3.11：瞬态失败（Transient failure）*

![图 3.12：瞬态失败通过重试迅速恢复](/media/posts/think-distributed-systems/fig-p069-3-12.png)
*图 3.12：重试解决瞬态失败（Transient failure with retry）*

图 3.11 与图 3.12 展现了**瞬态失败（Transient Failure）**：由网络毛刺、短时丢包或瞬时高负载引起，通常在毫秒级自愈。这类失败的最佳应对策略就是**指数退避重试（Exponential Backoff Retry）**。

![图 3.13：间歇性失败与链路抖动](/media/posts/think-distributed-systems/fig-p069-3-13.png)
*图 3.13：间歇性失败（Intermittent failure）*

图 3.13 展现了**间歇性失败（Intermittent Failure）**：周期性重现，例如网络链路频繁翻滚、硬件接触不良。盲目重试会加剧雪崩，必须结合**断路器（Circuit Breaker）**进行熔断隔离。

![图 3.14：永久性失败与节点彻底停机](/media/posts/think-distributed-systems/fig-p070-3-14.png)
*图 3.14：永久性失败（Permanent failure）*

图 3.14 展示了**永久性失败（Permanent Failure）**：硬盘损坏、证书过期或代码严重 Bug。系统在此类失败下绝不可能自动恢复，必须通过**故障转移（Failover）**或告警人工介入。

### 3.3.4 失败缓解策略

![图 3.15：失败缓解的三大核心武器：重试、降级与补偿](/media/posts/think-distributed-systems/fig-p072-3-15.png)
*图 3.15：失败缓解机制（Failure mitigation）*

图 3.15 总结了工程中最关键的三种缓解手段：
1. **重试（Retry）**：针对瞬态失败，通过重新发送请求实现自愈；
2. **降级（Fallback）**：针对间歇性失败或服务过载，返回静态默认值或降级功能保全核心链路；
3. **补偿（Compensation）**：针对部分执行失败，通过逆向回滚操作（如 Saga 逆向退款）消除已产生的副作用。

![图 3.16：服务编排场景下的综合失败处理全景决策流](/media/posts/think-distributed-systems/fig-p073-3-16.png)
*图 3.16：综合失败处理策略决策流（Failure-handling strategy in orchestration）*

图 3.16 给出了服务编排场景下的终极决策闭环：编排器向子服务发起调用，根据超时或响应判定故障；瞬态故障触发带抖动的重试，重试超限判定为永久故障，进而触发断路器并启动逆向补偿事务，确保分布式工作流全执行的原子一致性。

:::en
> **Original**: Effective failure mitigation requires a nuanced understanding of both the spatial and temporal dimensions of failure. Transient failures can often be addressed by retrying the failed operation. Intermittent failures may require more sophisticated strategies, such as circuit breakers. Permanent failures, however, cannot be resolved by retrying; they require either automated failover to redundant components or human intervention.

**📌 核心术语与语境解析**：
- **Circuit breaker**：*断路器*。监控调用失败率，在系统恶化时快速失败防止级联崩溃。
- **Compensation**：*补偿事务*。通过语义上的逆向业务动作抵消部分执行带来的副作用。
:::

## 本章小结

1. **失败是状态转移**：从合法到非法的状态迁移；失败容忍是使系统在坏状态下依然表现良好的能力。
2. **容忍的三种形态**：屏蔽型保全安全与活性，非屏蔽型暂时偏离，故障安全型牺牲活性守住安全红线。
3. **闭环治理架构**：明确区分平台层故障与业务层故障，根据瞬态、间歇、永久的时序特征，组合运用重试、断路器、降级与补偿机制。
