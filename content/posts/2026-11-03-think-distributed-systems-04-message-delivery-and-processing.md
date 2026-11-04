---
title: "Think Distributed Systems（四）：消息交付与处理的不确定性原理"
date: 2026-11-03T02:40:00Z
description: "发送请求后、收到响应前，发送方无法区分丢失、崩溃、变慢；由此推导 at-most-once / at-least-once / exactly-once 语义、幂等性与事务性去重。"
category: distributed-systems
column: think-distributed-systems
tags:
  - "消息交付"
  - "exactly-once"
  - "幂等性"
  - "TCP"
  - "重试"
  - "分布式事务"
---

# 第 4 章：消息交付与处理

本章涵盖：

- 消息交付（delivery）与消息处理（processing）
- at-most-once、at-least-once、exactly-once 三种语义
- 等价性（equivalence）与幂等性（idempotence）

讨论消息交付与处理时，误解与“近乎欺骗”的说法随处可见，它们会污染你的心智模型。例如，有工程师说 **exactly-once processing**，实际想说的是 **exactly-once processing semantics**：

- **exactly-once processing**：每条消息只被处理一次——这是理想场景，现实中无法保证；
- **exactly-once processing semantics**：尽管底层可能重试、可能重复，系统**表现得好像**每条消息只被处理了一次。

还有营销材料宣称产品“保证 exactly-once 处理语义”，却不披露该保证的适用边界。若你已建立准确的模型，这些说法伤不到你；若还没有，你可能会基于从未存在过的保证去做设计。

## 4.1 交换消息

组件本地状态的变化称为**副作用（side effect）**。本章采用第 1、2 章确立的部分同步模型：不可靠组件 + 不可靠网络；多数时候同步、偶尔异步；组件可能崩溃并恢复，易失状态丢失、持久状态保留；网络可能重排、丢弃、重复消息；排除拜占庭失败。

![图 4.1：两个并发组件之间的请求-响应对话](/media/posts/think-distributed-systems/fig-p077-4-1.png)
*图 4.1：请求-响应对话（Request-response dialogue between two components）*

如图 4.1 所示，发送方（sender）发出请求，接收方（receiver）处理消息并更新本地状态（可能产生副作用），随后返回响应。

![图 4.2：请求-响应对话的离散步骤推进全过程](/media/posts/think-distributed-systems/fig-p077-4-2.png)
*图 4.2：对话的步骤推进（Step-by-step progression of the request-response dialogue）*

图 4.2 将一次完整的请求-响应对话细致分解为五个离散步骤：

1. **步骤 1**：发送方把请求提交给网络（进入网络缓冲区）；
2. **步骤 2**：网络把请求投递给接收方（接收端触发消息事件）；
3. **步骤 3**：接收方处理请求，执行内部业务计算并修改本地持久状态；
4. **步骤 4**：接收方把执行结果响应提交给网络；
5. **步骤 5**：网络把响应投递给发送方（发送端完成交互）。

基于此，消息交换包含两个必须严格区分的维度：

- **消息交付（Delivery）**：网络把报文从信道送达组件缓冲区；
- **消息处理（Processing）**：接收端消费报文并执行副作用。

| 交付语义 | 接收方视角（网络投递行为） |
| :--- | :--- |
| **At most once（至多一次）** | 网络投递 0 次或 1 次（消息可能丢失，绝不重复） |
| **At least once（至少一次）** | 网络投递 1 次或多次（消息绝不丢失，可能重复） |
| **Exactly once（恰好一次）** | 网络投递恰好 1 次（理想物理模型，现实不可达） |

| 处理语义 | 业务状态视角（副作用产生次数） |
| :--- | :--- |
| **At most once（至多一次）** | 业务逻辑执行 0 次或 1 次（绝不重复扣款，可能漏单） |
| **At least once（至少一次）** | 业务逻辑执行 1 次或多次（绝不漏单，可能重复扣款） |
| **Exactly once（恰好一次）** | 业务逻辑表现得如同执行了恰好 1 次（通过去重与幂等保证） |

## 4.2 消息交付与处理的不确定性原理

在局部视角下，发送方 C1 无法观测网络信道与对端 C2 的真实物理状态。这引发了分布式计算的“不确定性原理”：

![图 4.3：局部视角下的三个不确定性窗口](/media/posts/think-distributed-systems/fig-p078-4-3.png)
*图 4.3：局部视角与三大时序窗口（C1’s point of view: three windows of uncertainty）*

如图 4.3 所示，发送方 C1 的执行经历三个严格的时间窗口：

### 4.2.1 发送请求之前（窗口 1）

在尚未发送请求前，C1 确定没有任何消息飞在网络中，对端也未发生任何副作用。状态是确定无误的。

### 4.2.2 发送请求之后、收到响应之前（窗口 2：悬决窗口）

**这是分布式系统一切复杂性的根源。** 当 C1 发出请求并进入等待时，若遇到超时（Timeout），C1 **在理论上根本无法区分以下三种情况**：

1. 请求在网络中丢失了（C2 从未收到，副作用**未发生**）；
2. C2 收到了请求，在处理时崩溃了，或者处理极慢尚未完成（副作用**进行中或已发生**）；
3. C2 已成功处理并发出响应，但响应报文在回程网络中丢失了（副作用**已发生**）。

**结论：发送方无法仅从“超时未响应”推断副作用是否已经发生。**

### 4.2.3 收到响应之后（窗口 3）

一旦 C1 收到明确的 ACK 或业务成功响应，C1 可以确定副作用已经发生。如果收到显式拒单响应，则确定未发生。

:::en
> **Original**: Between sending a request and receiving a response, the sender exists in a window of profound uncertainty. If a timeout occurs, the sender cannot distinguish whether the request was lost, the receiver crashed while processing, or the response was lost on the return path. This fundamental uncertainty makes exactly-once execution impossible through simple network communication alone.

**📌 核心术语与语境解析**：
- **Window of uncertainty**：*不确定性窗口*。发送后到收到响应前，因信息延迟导致的不可区分状态区间。
- **In-doubt**：*悬决*。无法判定对端是否已持久化副作用的认知停滞状态。
:::

## 4.3 真实业务案例：支付与购票

为了深刻体会不确定性窗口带来的工程危机，考虑机票预订与信用卡支付：

![图 4.4：航司客票预订业务流](/media/posts/think-distributed-systems/fig-p084-4-4.png)
*图 4.4：机票预订（Booking an airline ticket）*

![图 4.5：信用卡支付扣款对话与超时竞态](/media/posts/think-distributed-systems/fig-p084-4-5.png)
*图 4.5：信用卡扣款超时交互（Request-response dialogue charging a credit card）*

如图 4.4 与图 4.5 所示，客户端调用支付网关扣除 500 美元：
- 客户端发出扣款指令；
- 银行服务端顺利扣款，但在发送确认回执时网络光缆突发抖动，数据包丢弃；
- 客户端等待 5 秒超时报错；
- 如果客户端盲目采用 At-least-once 策略重试，银行网关会再次执行扣款，用户被扣两次 500 美元！

## 4.4 幂等性：攻克不确定性的唯一正道

如何在不可靠网络上实现 **Exactly-once 处理语义**？唯一的工程解法是：**At-least-once 重试 + 幂等性（Idempotence）**。

一个操作 $f$ 是**幂等的**，当且仅当多次执行该操作产生的影响与执行一次完全相同：
$$f(f(x)) = f(x)$$

### 幂等性的三级实现范式

1. **天然幂等操作**：
   - 读操作（如 `GET /orders/123`）；
   - 绝对状态覆写（如 `SET balance = 100` 而非 `UPDATE balance = balance - 50`）；
   - 幂等删除（如 `DELETE FROM users WHERE id = 10`）。
2. **幂等键（Idempotency Key）去重表**：
   - 客户端为每个业务意图生成全局唯一的 UUID 作为 `Idempotency-Key`；
   - 服务端在同一个本地数据库事务中：
     - 查询去重表：若该 Key 已存在，直接返回先前缓存的响应报文，不重走业务逻辑；
     - 若不存在，插入该 Key，执行扣款更新，并记录处理结果。
3. **分布式事务 / 事务消息**：
   - 将消息消费的 Offset 推进与本地业务状态更新放入同一个原子事务中提交。

:::en
> **Original**: To achieve exactly-once processing semantics in the presence of inevitable network failures and retries, operations must be designed to be idempotent. An idempotent operation can be applied multiple times without changing the result beyond the initial application. Combined with unique request identifiers (idempotency keys), receivers can filter out duplicate deliveries and guarantee safe retries.

**📌 核心术语与语境解析**：
- **Idempotency**：*幂等性*。任意次重复执行等价于单次执行的数学与架构性质。
- **Idempotency key**：*幂等键*。由发起方生成的全局唯一凭证，用于服务端识别并拦截重复请求。
:::

## 本章小结

1. **严格区分交付与处理**：网络只能提供 At-most-once 或 At-least-once 交付；Exactly-once 处理语义必须由接收端应用层参与保障。
2. **悬决窗口不可消除**：发送请求后、收到确认前，超时无法判定对端副作用是否发生。
3. **黄金设计法则**：不可靠网络下的健壮系统，必须且只能依靠 **At-least-once 传输 + 幂等键去重** 构造出可靠的 Exactly-once 业务语义。
