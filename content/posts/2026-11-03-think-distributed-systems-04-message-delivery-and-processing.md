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

考虑两个组件进行**请求-响应式对话**：发送方（sender）发出请求，接收方（receiver）处理消息（可能产生副作用），再返回响应。

一次对话可分解为五个步骤：

1. 发送方把请求提交给网络；
2. 网络把请求投递给接收方；
3. 接收方处理请求，可能产生副作用；
4. 接收方把响应提交给网络；
5. 网络把响应投递给发送方。

并且消息交换包含两个可分离的方面：

- **消息交付**：消息在网络内的传输，以及网络把消息呈现给组件；
- **消息处理**：生成响应，以及产生副作用。

| 交付语义 | 接收方视角 |
| :--- | :--- |
| At most once | 网络投递零次或一次 |
| At least once | 网络投递一次或多次 |
| Exactly once | 网络投递恰好一次 |

| 处理语义 | 接收方视角 |
| :--- | :--- |
| At most once | 接收方处理零次或一次 |
| At least once | 接收方处理一次或多次 |
| Exactly once | 接收方处理恰好一次 |

通常我们更关心**处理**而非交付：处理承载应用逻辑，副作用就发生在处理阶段。

:::en
> **Original**: We can think of message exchange as being two separate aspects: Message delivery refers to the transfer of a message within a network, as well as the presentation of the message from the network to the component. Message processing refers to both the generation of a response and the creation of a side effect. ... Generally, in terms of at-most-once, at-least-once, and exactly-once semantics, our focus is on message processing rather than message delivery.

**📌 核心术语与语境解析**：
- **Message delivery**：*消息交付*。消息在网络中的传输与呈现，只涉及“到没到”。
- **Message processing**：*消息处理*。生成响应并产生副作用，涉及“做没做”。
:::

## 4.2 消息交付与处理的不确定性原理

组件只能观察自己的状态与自己通往网络的信道——有限的**局部视角**。这使发送方从“确定”进入“不确定”，再力争回到“确定”。

### 4.2.1 发送请求之前

发送方可以确定：还没有任何工作完成，也没有任何副作用发生。

### 4.2.2 发送请求之后、收到响应之前

发送方**无法确定**工作是否完成、即将完成，还是永远不会完成。它无法区分以下情况：

- 请求在网络中丢失；
- 接收方在处理前崩溃；
- 接收方在处理后崩溃；
- 响应在网络中丢失；
- 网络或接收方只是变慢。

### 4.2.3 收到响应之后

发送方重新回到确定状态：响应表示成功（工作已完成）或失败（工作未完成）。注意：不存在拜占庭失败，组件不允许欺骗。

:::en
> **Original**: This limited view causes the sender to transition from a state of certainty to a state of uncertainty, with the ideal goal of returning to a state of certainty. ... At this point, the sender cannot be certain whether the work has been done, is about to be done, or will never be done. The sender cannot distinguish among these cases: The request was lost in the network. The receiver crashed before processing the message. The receiver crashed after processing the message. The response was lost in the network. The network or the receiver is slow.

**📌 核心术语与语境解析**：
- **Uncertainty principle**：*不确定性原理*。请求发出后、响应到达前，发送方对副作用状态的根本无知。
- **Side effect**：*副作用*。本地状态的变化，是“是否重复扣款”这类问题的实质。
:::

> **顿悟时刻：分布式系统与 TCP**
>
> **问**：TCP 不是能防止网络丢包吗？
>
> **答**：TCP 是“可靠”协议，但它救不了你。
>
> TCP 通过确认与重传保证数据准确完整地传输，实现在内核中，通过 socket 暴露给应用。发送方与接收方都先把数据写入本地缓冲区，然后确认接收。出问题时，TCP 重传已发数据、对已收数据去重。
>
> 但内核是**先确认、后投递**给应用——这把语义从 at-least-once 交付降级成了 at-most-once 交付。**低层的 at-least-once 并不蕴含高层的 at-least-once**：如果在“确认之后、投递并处理之前”出错，消息就丢了。换言之，TCP 无法保证不丢消息。

## 4.3 沉默与喧嚣

发送请求后、收到响应前，我们处于必须解决的不确定状态。**超时（timeout）**是常用手段：

- 超时之前——**沉默（silence）**：什么也没发生，我们只能等；
- 超时之后——**喧嚣（chatter）**：我们开始猜测、重试、报警。

超时的本质是一次**押注**：赌“这么久还没响应，就是出事了”。它无法区分“慢”与“失败”，因此必然带来误判——这正是第 3 章“完备且准确的检测器不可能存在”的具体体现。

一次发送的意图是 **at-most-once** 交付：零次或一次。但消息可能被网络重复；而发送方一旦重试，意图就变成 **at-least-once**：一次或多次。既然 exactly-once 处理不可能，我们能否退而求其次，保证 **exactly-once 处理语义**？

> **顿悟时刻：两种失败的尝试**
>
> **方案一：先记录、后处理。** 收到请求先标记为已接收，再处理。若在处理前崩溃，消息已被标记，重试会被 if 语句短路——消息**永远不会被处理**，退化为 at-most-once。
>
> **方案二：先处理、后记录。** 若在处理后、记录前崩溃，重试不会被短路——消息**被处理两次**，退化为 at-least-once。
>
> 两种顺序都无法单独保证 exactly-once，因为“处理”与“记录”不是原子的。

:::en
> **Original**: After sending a request but before receiving a response, we are in a state of uncertainty that we ultimately need to resolve. Timeouts are a common mechanism ... The sender intends to deliver and process a message at most once, that is, zero times or one time. Messages may get duplicated in the network, however. If the sender tries again, the sender intends to deliver and process a message at least once: one or more times.

**📌 核心术语与语境解析**：
- **Timeout**：*超时*。把“沉默”转成“判断”的机制，必然伴随误判。
- **Short-circuit**：*短路*。去重逻辑直接返回，导致消息被跳过。
:::

## 4.4 Exactly-once 处理语义

Exactly-once 处理语义关注**处理结果**而非处理过程本身：它保证“处理一次”的系统状态与“处理两次或更多次”的系统状态**等价**。

$$P(m) \equiv P(m) \cdot \ldots \cdot P(m)$$

注意这里说的是**等价（equivalence）**，不是**相等（equality）**。我们无法保证状态完全相同。最简单的例子是日志：处理两次就会写两条日志，但我们通常认为日志重复无关紧要——系统不“相等”，但“等价”。

> **顿悟时刻：等价性取决于观察者**
>
> 与正确性保证一样，等价性是应用相关的。作为工程师，**你来定义什么叫等价**。你认为等价的，我可能认为不同。

Exactly-once 处理语义是**端到端保证**，发送方与接收方都有责任：

- 发送方必须**收到响应前不停重试**（保证 at-least-once 交付）；
- 接收方必须**不跳过处理**（保证 at-least-once 处理）。

:::en
> **Original**: Exactly-once processing semantics focus on the processing outcome rather than the processing itself. These semantics guarantee that the state of the system processing a message once is equivalent to the state of the system processing the message two or more times. ... Note that we are not talking in terms of equality but in terms of equivalence. ... Exactly-once processing semantics are an end-to-end guarantee.

**📌 核心术语与语境解析**：
- **Equivalence vs. equality**：*等价 vs. 相等*。允许无关紧要的差异（如日志条数），但要求业务状态一致。
- **End-to-end guarantee**：*端到端保证*。任何单侧组件都无法独自兑现的保证。
:::

## 4.5 幂等性

既然处理可能发生多次，如何保证系统状态与“只处理一次”等价？答案是**幂等性**：

$$f(f(x)) = f(x)$$

在分布式系统中，幂等性指**多次执行某操作与执行一次的效果等价**。若消息处理是幂等操作，则 at-least-once 处理即可获得 exactly-once 处理语义。

坏消息是：保证幂等性极其困难，而且它同样是**应用相关**、**端到端**的。

- **天生幂等**：如 write-once 寄存器，初始为 NULL，第一次写入后值永久锁定，后续请求不改变状态。重复请求到达时，寄存器状态完全相同。
- **天生不幂等**：如信用卡扣款。请求重复且已处理过，卡就被扣两次。

实现幂等的常见模式是**幂等键（idempotence key）**：发送方生成 UUID，附加到请求及其每次重试上；接收方承诺基于 UUID 去重。

接收方去重的常见模式是**事务性记录与处理**：把“处理副作用”与“记录幂等键”放在同一个事务里——要么都发生，要么都不发生。应用可以用独立表记录幂等键，仅当新键能在不违反唯一约束的前提下插入时，才提交副作用。

:::en
> **Original**: Idempotence refers to the property of an operation where applying the operation multiple times yields the same value as applying the operation once: f(f(x)) = f(x). Similarly, in the context of distributed systems, idempotence refers to the property of an operation where executing the operation multiple times has an equivalent effect to executing the operation once. If message processing consists of an idempotent operation, at-least-once message processing guarantees have exactly-once processing semantics guarantees. ... A common pattern in implementing idempotence uses an idempotence key: The sender generates a universally unique identifier (UUID) and attaches the UUID to the request and every retry of the request.

**📌 核心术语与语境解析**：
- **Idempotence**：*幂等性*。重复执行不改变结果，是把 at-least-once 升级为 exactly-once 语义的杠杆。
- **Idempotence key**：*幂等键*。请求的全局唯一标识，接收方据此去重。
:::

## 4.6 案例：信用卡扣款

以订机票为例，其中一步是扣款。目标是：**每次购买恰好扣一次**——不能零次，也不能两次或更多。

无失败无延迟时，发送请求、收到响应，一切确定。有失败或延迟时，请求发出但响应没回来——此时发送方无从判断。

没有响应时，App 可能有限次重试，最终告知用户重试失败。此时用户可能得联系客服确认是否出票；不过多数情况下，一封确认邮件或刷新“我的行程”就能给出答案。

如何保证 exactly-once 处理语义与幂等性？因为二者都取决于观察者，方案与用户体验有很多种：

- **支付服务商支持幂等键**：例如 Stripe 会保存某个幂等键首次请求的状态码与响应体（无论成功失败），后续同键请求返回相同结果，包括 500 错误。但这依赖发送方能生成幂等键——如果预订号本身就是 UUID，直接拿它当幂等键即可。
- **反面案例**：作者曾在某航司 App 上反复结账失败，重启四五次后放弃；查账单时发现四五笔待入账扣款。客服承诺 24 小时内只会有一笔真正入账——但这段体验本身说明：**没有幂等键的重试，就是把不确定性转嫁给了用户。**

:::en
> **Original**: We want to guarantee that the credit card is charged exactly once per purchase—not zero times or two or more times. ... Stripe's idempotency works by saving the resulting status code and body of the first request made for any given idempotency key, regardless of whether it succeeded or failed. Subsequent requests with the same key return the same result, including 500 errors. Stripe's idempotency, however, relies on the sender's ability to generate idempotency keys.

**📌 核心术语与语境解析**：
- **Idempotency key**：*幂等键*。服务端据此返回首次结果，避免重复扣款。
- **Pending charge**：*待入账扣款*。银行侧的预授权记录，与“实际扣款”并非一回事。
:::

## 本章小结

1. **交付 ≠ 处理**：交付只问“到没到”，处理才产生副作用。
2. **不确定性原理**：请求发出后、响应到达前，发送方无法区分丢失、崩溃与变慢。
3. **三种语义**：at-most-once（可能丢）、at-least-once（可能重）、exactly-once（不可能直接实现）。
4. **TCP 救不了你**：内核先确认后投递，低层 at-least-once 不蕴含高层 at-least-once。
5. **Exactly-once 是语义而非事实**：以“等价”而非“相等”定义，且由应用裁定。
6. **幂等性是把 at-least-once 变成 exactly-once 语义的杠杆**：天生幂等最好，否则用幂等键 + 事务性去重。
7. **端到端责任**：发送方不停重试，接收方不跳处理、按幂等键去重。

