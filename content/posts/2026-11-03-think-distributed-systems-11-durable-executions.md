---
title: "Think Distributed Systems（十一）：持久执行——故障透明的恢复范式"
date: 2026-11-03T03:40:00Z
description: "部分执行是微服务长流程的梦魇；从 Saga 补偿走向持久执行（Durable Execution），让代码在崩溃后像什么都没发生过一样原地继续。"
category: distributed-systems
column: think-distributed-systems
tags:
  - "持久执行"
  - "Durable Execution"
  - "Saga"
  - "状态恢复"
  - "故障透明"
  - "Temporal"
---

# 第 11 章：持久执行

本章涵盖：

- 部分执行（partial execution）的灾难性后果
- 分布式执行的原子性困境
- 失败透明（failure-transparent）恢复机制
- 持久执行（Durable Execution）的核心原理
- 事件日志与确定性重放（deterministic replay）

在单体程序中，若一个函数包含两个步骤 `stepA(); stepB();`，如果进程崩溃，整个内存清空，下次重启直接重新运行。但在微服务与分布式工作流中，`stepA()` 往往调用了第三方支付扣款，而 `stepB()` 负责发货。一旦机器在两步之间崩溃，系统就会遗留毁灭性的中间坏账。

**持久执行（Durable Execution，如 Temporal、Cadence、Resonate）彻底改写了这一游戏规则：它把“代码的执行过程本身”变成可以持久化、可故障自愈的一等公民。**

## 11.1 部分执行的陷阱

在多服务编排与长事务流中，部分执行无处不在。

![图 11.1：分布式工作流中部分执行导致的资产悬挂与状态不一致](/media/posts/think-distributed-systems/fig-p166-11-1.png)
*图 11.1：部分执行的陷阱（The pitfalls of partial executions）*

如图 11.1 所示：
- 客户预订行程：包含航班预订、酒店预订、租车预订；
- 航班和酒店预订成功，但租车接口在调用时节点遭遇 OOM 崩溃；
- 客户信用卡被扣除部分费用，但行程单残缺不全，资金与库存两端陷入孤立悬挂状态。

传统上，工程师只能手工编写极其繁琐且极易出错的逆向回滚代码（Saga 模式）：为每一个操作编写对应的 Undo 补偿。但若补偿操作本身在执行时又崩溃了呢？复杂度将呈指数级爆炸。

## 11.2 分布式执行的原子性困境

为了严格建模执行过程，我们将进程看作步骤序列。

![图 11.2：分布式工作流的全执行原子性定义](/media/posts/think-distributed-systems/fig-p167-11-2.png)
*图 11.2：工作流原子性（Definition of atomicity across workflow steps）*

如图 11.2 所示，业务对长流程的终极诉求依然是**原子性（Atomicity）**：要么全流程执行完毕，要么在语义上完全回滚。

![图 11.3：单步骤进程崩溃后的平凡恢复重试](/media/posts/think-distributed-systems/fig-p168-11-3.png)
*图 11.3：单步骤进程执行（A process P consists of one step: a）*

如图 11.3 所示，若进程 $P$ 仅包含单个原子步骤 $a$：若 $a$ 执行中崩溃，恢复策略非常平凡——只需重新执行 $a$（配合幂等键防重）。

![图 11.4：多步骤进程在跨步骤边界崩溃带来的重入危机](/media/posts/think-distributed-systems/fig-p168-11-4.png)
*图 11.4：多步骤进程执行（A process P consists of two steps: a and b）*

然而如图 11.4 所示，若进程 $P$ 包含两个步骤 $a$ 与 $b$：
- 步骤 $a$ 执行完成，产生不可逆的外部物理副作用（例如发出资金）；
- 在进入步骤 $b$ 之前，运行宿主崩溃；
- 重启后，若简单粗暴地从头重跑进程，步骤 $a$ 将被重复执行，产生**双重扣款**灾难；若直接跳过，步骤 $a$ 的局部返回值将丢失，步骤 $b$ 无法获得必要入参！

:::en
> **Original**: Partial executions are the bane of distributed workflows. When a multi-step process crashes mid-flight, restarting from the beginning risks duplicating side effects, while resuming from the point of failure requires knowing the exact local state prior to the crash. Durable Execution resolves this dilemma by persisting the sequence of completed steps into an immutable event log.

**📌 核心术语与语境解析**：
- **Partial execution**：*部分执行*。多步骤业务流程在中间某个步骤突发中断的病态状态。
- **Durable Execution**：*持久执行*。执行过程与局部变量被透明持久化，故障后可无缝断点续传的现代计算范式。
:::

## 11.3 故障透明恢复的架构力学

持久执行是如何做到让开发者像写普通单机代码一样，天然免疫宕机崩溃的？

答案是：**持久化事件历史日志 + 确定性重放（Deterministic Replay）**。

![图 11.5：持久执行引擎通过事件日志重放实现故障透明的断点自愈](/media/posts/think-distributed-systems/fig-p172-11-6.png)
*图 11.6：故障透明恢复架构（Failure-transparent recovery architecture）*

如图 11.6 所示，持久执行引擎（如 Temporal / Resonate）的运行力学如下：

1. **步骤结果持久化**：
   - 开发者编写的代码中的每个耗时或带副作用的调用（称为 Activity / Task），都由引擎接管；
   - 步骤 $a$ 完成后，引擎将其输入、输出与执行结果写入持久化的分布式共识日志中。
2. **崩溃与漂移**：
   - 运行该工作流的工作机发生硬件掉电，进程彻底终止。
3. **确定性重放与断点自愈**：
   - 调度集群感知到节点失联，将该工作流调度到另一台健康工作机上重新启动代码；
   - 代码再次从第一行开始执行：当执行到步骤 $a$ 时，引擎拦截调用，发现历史日志中已经记录了步骤 $a$ 的执行结果；
   - **引擎直接从日志中取出先前保存的返回值立即注入，不真正向外部发起物理网络调用！**
   - 代码瞬间飞跃到步骤 $b$ 的起点，继续向下执行真实物理调用。

对于外部观察者与业务代码而言，**崩溃仿佛从未发生过**，整个工作流透明地跨越了机器宕机，实现了真正的“故障透明性（Failure Transparency）”。

## 本章小结

1. **部分执行是微服务分布式调用的最大痛点**：缺乏原子边界使得复杂工作流极易陷入悬挂脏状态。
2. **Saga 补偿的局限性**：手工编写逆向动作维护成本极高，无法应对补偿自身崩溃的二次故障。
3. **持久执行的革命性跨越**：以不变的事件日志为镜像，通过确定性重放让分布式长流程获得如本地进程般的断点续传能力。
