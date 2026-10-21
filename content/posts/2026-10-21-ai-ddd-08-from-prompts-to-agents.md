---
title: "AI 增强的领域驱动设计（八）：从提示词到智能体：构建 AI 协作结构"
date: 2026-10-21T08:00:00Z
description: "将工作流从单一提示词升级为具备清晰认知边界的专家智能体团队，用规范沉淀领域知识，并借助守卫智能体设立不可逾越的认知边界。"
category: domain-driven-design
column: ai-ddd
tags:
  - "智能体"
  - "多智能体"
  - "规范驱动"
  - "认知边界"
  - "DDD"
---

> 💡 **专栏导读**：本文收录于专栏 [《AI 增强的领域驱动设计》](/columns/ai-ddd)。全专栏共 12 篇，覆盖大语言模型心智模型、事件风暴与 AI 协作、提示词规则手册、限界上下文精炼，以及专家智能体与编排器的完整工程实践。

*第 7 章*以“库存管理（Stock Management）”领域载体收尾：该工件完整保留了限界上下文的目标、其所拥有的概念、已确认的策略、仍处于提议阶段的策略、遗留的开放性问题，以及必须明令禁止的假设。在本章中，你将不再把该载体视为一个孤立的提示词，而是开始将其作为结构化 AI 协作的输入。

该载体此前仅应用于单个上下文。然而订单确认横跨了三个限界上下文：销售（Sales）做出商业承诺，支付（Payment）对交易进行授权，而仓库（Warehouse）保管啤酒库存。因此，本章基于为“销售订单确认（Sales Order Confirmation）”功能所编写的相同结构的载体展开工作。此处所遵循的工程纪律与*第 7 章*所提炼的完全一致，所不同的只是它必须描述的边界更为宽广。

为了使这一转变清晰可见，我们让同一个刻意保持模糊的销售订单确认**功能请求（feature request）**依次经历四种治理力度逐步递增的环境：纯提示词实现（prompt-only implementation）、**规范驱动开发（specification-driven development）**、辅以**守卫智能体（guard agents）**的相同工件工作流，以及围绕显式职责与交接构建的基于角色的工作流。这种对比提出了一个切中要害的实际问题：当功能请求流转于规范、计划、任务、角色、测试和代码之间时，究竟还能留存多少领域权威？

在本章后文中，你将把强制做出这种区分的审查点称为**认知边界（cognitive boundaries）**：在这些节点上，模型推理必须服从显式的领域权威。

> **说明：将框架视为实验透镜**
>
> 本章采用 GitHub Spec Kit 与**敏捷 AI 辅助开发突破法（BMAD，Breakthrough method for Agile AI-Assisted Development）**作为组织 AI 辅助开发的两种具体方式。Spec Kit 将工作组织为一系列持久化工件序列——规范、计划、任务以及实现——以便在每一步转换触及代码之前均可接受审查。BMAD 则将规划与交付分散到各个专业角色中（如分析师、产品经理、架构师、开发者和审查者），使职责划分与交接过程显式化。前三次运行保留了以工件为中心的工作流，同时逐步增加治理手段；第四次运行则改变了协作模型本身。要理解本章内容，你无需安装任何一种工具；正如“技术要求”一节所述，它们生成的工件均已提交至配套代码仓库中。
>
> 本专栏并未将这两种框架作为所讨论的 DDD 原则的来源，本章也绝非将它们作为竞品进行对比评测。我们保持功能请求和领域规则恒定不变，进而观察领域知识在何处流动、谁能够质疑缺乏依据的决策，以及每次转换后能够留存哪些证据。本章所考察的原则独立于具体框架：限界上下文对其决策保留最终权威，外部结果需要显式的出处追溯，完成声明需要行为证据的支撑，而人类的最终审批权绝不能委托给任何自动化工作流。

在本章中，你将学到：

- 为什么即使代码具备 DDD 的外在形态，在决策出处不明确时依然可能伪造证据。
- 领域载体如何转变为特性规范中一组可审查的约束条件。
- 如何**追溯（trace）**规范中的某项领域承诺，直至计划、任务、测试和代码实现。
- 守卫智能体如何在不替代领域专家或行为证明的前提下，构建起认知边界。
- 为什么更换框架虽然会重新分配角色与交接方式，但始终无法免除对显式权威、证据链及人类审批的刚性需求。

## 技术要求

本章是一次对代码仓库的导读之旅。此处讨论的每一个工件和每一段代码摘录，均完整保留在 <https://github.com/PacktPublishing/AI-Augmented-Domain-Driven-Design> 中，且四次运行各自拥有独立的分支。*表 8.1* 将分支与各次运行进行了映射，并列出了每个分支上推荐阅读的核心文件。

| 分支 | 运行轮次 | 阅读内容 |
|---|---|---|
| `no_sdd` | 运行 1 – 纯提示词 | `src/` 下的 `SalesOrder.cs`、`SalesOrderSaga.cs`、`RequestBeerAvailablityRaisedEventHandler.cs` |
| `sdd_without_custom_agents` | 运行 2 – 无守卫的 Spec Kit | `specs/001‑order‑confirmation/` 下的 `spec.md`、`plan.md`、`research.md`、`tasks.md` |
| `sdd‑with‑harness` | 运行 3 – 带守卫智能体的 Spec Kit | `.github/agents/speckit.brewup.*.agent.md` 中的守卫定义，以及 `.specify/memory/` 中的权威数据源 |
| `bmad‑solution‑with‑harness` | 运行 4 – 受治理的 BMAD | `_bmad‑output/` 下的 `project‑context.md`、`planning‑artifacts/`、`implementation‑artifacts/` |
| `bmad‑solution‑without‑harness` | 运行 4 – 移除治理叠加层的 BMAD | 仅包含 BMAD 安装文件。该分支未保留任何规划工件与代码实现，因此无法支持工作流对比 |

*表 8.1 – 配套代码仓库中各次运行的保留位置*

通过在 GitHub 上阅读这些文件，你即可顺畅跟进本专栏内容，无需在本地安装任何软件。

如果你希望在眼前直接查阅代码，可克隆该仓库并为每次运行签出对应的分支：

```text
git clone https://github.com/PacktPublishing/AI-Augmented-Domain-Driven-Design.git
cd AI-Augmented-Domain-Driven-Design
git checkout no_sdd
```

在 `src/BrewUp.slnx` 中构建该解决方案需要 .NET 10 SDK，但这完全是可选的：本章绝不要求你实际编译执行代码，只需仔细审视代码的具体实现以及其测试到底证明了什么。

GitHub Spec Kit 与 BMAD 方法是本章进行对比的两种工作流，你同样无需安装它们中的任何一个。它们的输出产物——规范、计划、任务列表、产品简报以及审查报告——均已作为普通的 Markdown 文件提交至上文所列的分支中。只有在你希望自行复现运行过程时，才需要安装它们。

## 从看似合理的提示词到脆弱的实现

我们首先从一个刻意保持极简的基线运行开始。我们向 AI 助手提供了一段简短的功能请求，并要求其直接实现代码变更，而无需预先创建规范、厘清决策归属或引入审查关卡：

```text
Implement order confirmation for BrewUp.

An order can be confirmed when:
- the customer payment has been authorized;
- all requested beers are available in the warehouse.

When the order is confirmed, reserve the stock.
```

这短短几行文本就是**功能请求（feature request）**。在本章中，无论何时提到“*该请求*”，均指代这段文本，绝非指 HTTP 请求或服务总线上的消息。该请求表面看起来十分精确，因为它明确指出了两个条件和一个动作。然而，它却将至关重要的领域决策完全隐去：哪个限界上下文拥有支付授权的归属权、现货可用性是否为持久事实、库存何时必须被预留，乃至被确认的究竟是哪类订单（Order）。这里的信息足以让 AI 生成代码，但远远不足以维护领域模型的完整性与自洽性。

该基线运行是*表 8.1* 中所列四次运行中的第一次。我们放任这些模糊之处未予解决，直接要求助手从该功能请求跳跃到仓库中可运行的代码。尽管当时领域载体已经存在，但助手没有收到查阅该载体的指令，没有经历规范制定步骤，也没有设立任何审查关卡。由此生成的实现保留在配套代码仓库的 `no_sdd` 分支上。我们将每个保留下来的分支称为一条**追溯痕迹（trace）**：即单次运行所留存的工件与代码，即便产生它们的对话过程无法重现，事后依然清晰可读。这第一条追溯痕迹记录了一种领域知识明明存在、却从未被引入决策路径的工作流。

生成的代码初看似乎颇具规范纪律。它引入了 `PaymentAuthorizationId` 和 `StockReservationId`，增加了 `ConfirmSalesOrder` 命令，发布了 `SalesOrderConfirmed` 领域事件，并在任一引用为空时阻止销售订单进入 Confirmed 状态：

```csharp
if (string.IsNullOrWhiteSpace(paymentAuthorizationId.Value))
    throw new ArgumentException(
        "Payment authorization id is required.",
        nameof(paymentAuthorizationId));

if (string.IsNullOrWhiteSpace(stockReservationId.Value))
    throw new ArgumentException(
        "Stock reservation id is required.",
        nameof(stockReservationId));

RaiseEvent(new SalesOrderConfirmed(
    new SalesOrderId(Id.Value),
    paymentAuthorizationId,
    stockReservationId,
    correlationId));
```

如果孤立地审视，该方法似乎完全符合 DDD 原则：销售（Sales）上下文掌控着向 Confirmed 状态的流转，不变量清晰显式，且状态变更由领域事件明确表达。该方法证明了两个引用的存在；但它无法证明这两个引用确实是由拥有这些决策权的限界上下文所生成的。

### 毫无权威依据凭空捏造的证据

致命问题出现在销售订单 Saga（Sales Order saga）中。当既有工作流报告客户预算已通过验证时，生成的代码竟然直接从消息关联标识符（correlation identifier）凭空构建了一个支付授权引用：

```csharp
internal void MarkCustomerBudgetAsVerified(
    CustomerJson customer,
    Guid correlationId)
{
    var paymentAuthorizationId =
        new PaymentAuthorizationId(correlationId.ToString());
```

```csharp
    RaiseEvent(new SagaCustomerBudgetVerified(
        new CustomerId(_customerId),
        correlationId,
        paymentAuthorizationId,
        customer,
        ...));
}
```

该值虽然满足了聚合的防护断言（guard），但它根本不是由支付（Payment）上下文生成的。关联标识符的作用是在技术层面上关联一次对话中的多条消息；它根本不代表对某一金额的业务授权。通过赋予其 `PaymentAuthorizationId` 类型，该实现将“客户预算验证”公然偷换成了伪造的支付凭证。

在同一套生成的代码中，仓库（Warehouse）部分则以另一种形式宣告失败。`RequestBeerAvailablityRaisedEventHandler` 检查了库存可用性的快照，为每个请求的明细行将一条预留命令加入队列，随后直接发布了结果：

```csharp
StockReservationId stockReservationId =
    new(Guid.CreateVersion7().ToString());
// [...] 为每个请求的明细行生成一个 ReserveItemStock 命令
if (canReserveAllRows)
{
    foreach (var command in reserveCommands)
        await serviceBus.SendAsync(command, cancellationToken);
}
RequestBeersAvailabilityChecked integrationEvent = new(
    new IntegrationId(@event.AggregateId.Value),
    correlationId,
    canReserveAllRows ? stockReservationId : null,
    beerAvailability);
await eventBus.PublishAsync(integrationEvent, cancellationToken);
```

该标识符是在处理程序内部凭空“铸造”出来的，此时实际的预留根本尚未发生，而 `SendAsync` 仅仅是将命令送入队列而已：携带 `StockReservationId` 的集成事件在没有等待哪怕任何一个 `ReserveItemStock` 成功执行的情况下就被发布了出去。因此，在仓库真正产生订单确认所依赖的预留结果之前，销售上下文就已经收到了该标识符。现货可用性随时可能变化；唯有已经完成的库存预留才是持久可靠的业务证据。

正是这种失败让基线运行具有了极高的分析价值。生成的代码包含了显式强类型、合理的防护断言、领域事件、测试用例以及归属于仓库的状态变更路径。这些表面看似正确的要素掩盖了真正的内在缺陷：该工作流仅仅保留了证据的外在形态，却彻底丢失了必须生成该证据的权威归属。

### 从审查发现到持久化规则

对该分支进行的 DDD 审查应当沉淀出持久的领域知识，而非审查结束后就烟消云散的临时代码评审批注。如果下一次交互仍然只接收原始的功能请求，模型完全可以随意重蹈覆辙，做出同样的虚假假设。因此，本次审查为领域载体提炼出了一组候选规则：

```text
- Payment owns payment authorization outcomes.
- Sales may store PaymentAuthorizationId only as evidence of an outcome produced
by Payment.
- A correlation identifier is not a payment authorization reference.
- Customer budget verification must not be interpreted as payment authorization.
- Warehouse owns stock availability and stock reservation.
- Availability is not durable evidence; confirmation requires StockReservationId.
- The coordinator coordinates external decisions but does not own or reproduce
them.
```

（规则含义：
- 支付（Payment）上下文拥有支付授权结果的所有权。
- 销售（Sales）上下文仅可将 `PaymentAuthorizationId` 作为支付上下文所产出结果的凭证进行存储。
- 关联标识符绝非支付授权引用。
- 客户预算验证决不能被解释为支付授权。
- 仓库（Warehouse）上下文拥有库存可用性与库存预留的所有权。
- 可用性并非持久证据；订单确认必须以 `StockReservationId` 为前提。
- 协调器负责协调外部决策，但绝不拥有也绝不能重新伪造这些决策。）

这些规则构成了后续每一次运行的累加基线。规范驱动工作流必须将它们从特性规范一路贯彻至计划与任务中；守卫智能体环境必须利用它们去质疑工件之间缺乏依据的转换；而基于角色的工作流则必须在工作流经分析师、产品经理、架构师、开发者及审查者角色时，完整守护这些规则。

更冗长的提示词或许能在单次交互中阻止助手用关联标识符拼凑 `PaymentAuthorizationId`。但持久规则承载着截然不同的使命：它们确保该决策在后续的每一个阶段中都始终处于可供审查的状态。因此，下一次运行将原始请求与这些规则转化为一份规范，使得其需求、待决的开放性问题以及后续规划在真正开始实现之前就能够被全面审视。

若想亲自验证这一过程，可签出配套代码仓库中的 `no_sdd` 分支，并将以下三个文件作为一条连贯的证据链路（而非各自独立的实现）来通盘阅读。在 `SalesOrder.cs` 中，观察聚合在确认前需要哪些证据。在 `SalesOrderSaga.cs` 中，将 `PaymentAuthorizationId` 反向追溯至构建它所依据的事件与原始值。在 `RequestBeerAvailablityRaisedEventHandler.cs` 中，对比 `StockReservationId` 被发布的时刻与预留命令真正能够产生实际结果的时刻：

```text
src/Sales/BrewUp.Sales.Domain/Entities/SalesOrder.cs
src/Sagas/BrewUp.Sagas.Domain/Entities/SalesOrderSaga.cs
src/Warehouse/BrewUp.Warehouse.Facade/Acl/
RequestBeerAvailablityRaisedEventHandler.cs
```

将这些文件串联起来阅读，便能揭示出局部代码审查极易忽略的深层问题。销售聚合所消费的引用看似合情合理，但其决策出处早在工作流的上游便已被歪曲。一个引用是在支付上下文之外凭空伪造的，而另一个引用则在仓库尚未完成预留之前就被仓促发布。因此，下一次运行必须在这些假设渗透至具体代码实现之前，使归属权、决策出处以及执行次序变得完全可供审查。

## 将领域知识转化为规范

纯提示词运行放任功能请求自行填补其中的逻辑空白。在第二次运行中，我们保持该功能请求一字不变，仅仅改变了助手理解该请求的环境。在 `sdd_without_custom_agents` 分支上，工作流在产出规范之前，能够查阅 BrewUp 宪章（constitution）以及销售订单确认领域载体：

```text
/speckit.specify <the feature request above, unchanged>
```

该命令是 Spec Kit 的标准入口：它将给定的请求转换为一份可以在任何代码诞生之前接受审查的 `spec.md`。如果你把该请求直接重写为一份详尽的解决方案，你就无法分辨随后的改进究竟归功于工作流本身，还是源于人类在事前所完成的领域建模。原始请求的模糊性依旧存在；发生根本改变的是，它现在必须首先穿透持久的领域知识，而后才能沉淀为代码。

随着工作流的推进，必须始终牢记每个工件的明确职责。宪章定义了代码仓库级别的通用工程约束。领域载体记录了该功能的决策权威归属、已被认可的领域含义以及尚未定论的策略。规范将功能请求与上述数据源转化为可审查的需求和开放性问题。澄清（clarification）步骤将人类专家的决策回填至规范中；随后的计划（plan）将已认可的决策映射到具体方案上；而任务列表（task list）则将这种映射转化为具体实现与测试必须予以证实的断言。每一个工件都在回答不同的问题，并为团队在关键决策节点上提供了又一个审查把关的切入点。

在本次运行中，宪章贡献了诸如模块化限界上下文、领域纯洁性（domain purity）、测试先行开发（test-first development）以及架构适应度函数（architecture fitness functions）等工程约束。载体则贡献了针对该功能的特定业务规则：销售、支付和仓库保持各自独立的决策权威；支付授权与库存预留属于外部产出的结果；销售上下文决不可伪造其中任何一项；且现货可用性绝非订单确认的持久证据。宪章约束着工程系统的实现规范，而载体则严格规范着该功能的业务语义。

### 规范对功能请求带来的重塑

Spec Kit 并没有替代上述任何一个工件。它将其中相关的内容提炼并转化为一份特性规范，供团队在进入规划阶段前进行审查。生成的 `spec.md` 开篇即设立了一个名为“领域约束（权威）”（Domain Constraints (Authoritative)）的小节。其核心规则包括如下内容：

```text
Three separate domain authorities:
Sales - commercial commitment
Payment - payment authorization
Warehouse - physical stock

Availability is not a durable fact.
Only a Stock Reservation is durable enough to support
Sales Order confirmation.

Confirmed requires evidence:
PaymentAuthorizationId and StockReservationId.
```

请将上述摘录视为一张出处追溯图（provenance map）。第一组规则将每项决策精准分配给拥有该决策权的限界上下文；第二组规则严格区分了瞬态可用性与持久预留结果；最后的几行则明确了销售上下文可以保留哪些外部引用，同时严禁掠夺这些引用所代表的决策权。

规范借助这些陈述对原始措辞进行了深度重塑。*表 8.2* 展示了从原始提示词到 `spec.md` 之间所发生的真实语义转换：

| 原始措辞 | 规范转换 | DDD 效果 |
|---|---|---|
| Order（订单） | Sales Order（销售订单），归属于 Sales 上下文 | 消除了泛化模糊的聚合，明确了生命周期的主权归属。 |
| Payment has been authorized（支付已获得授权） | `PaymentAuthorizationId` 由 Payment 上下文生成 | 将模糊的前提条件转化为具备显式决策出处的证据。 |
| Beers are available（啤酒有现货） | `StockReservationId` 由 Warehouse 上下文生成 | 用持久确凿的业务结果替代了瞬态的观察结果。 |
| Reserve the stock when confirmed（订单确认时预留库存） | 在确认流程完成之前必须先获得预留结果 | 阻止销售上下文依据可能已失效的库存可用性盲目承诺。 |
| 未指定的失败行为 | 开放性问题与范围外策略 | 防止凭空捏造重试、退款、作废以及通知逻辑。 |

*表 8.2 – 规范如何将原始请求转化为显式的 DDD 约束*

最深远的变化关乎时间维度。原始语句让“可用性”听起来像是一个前置条件，而将“预留”描述为一个紧随确认之后的动作。领域载体坚决否定了这种时间次序。可用性极易过期失效；而预留才是经久有效的确凿凭据。因此，规范要求在销售订单完成向 Confirmed 状态的跃迁之前，必须先获得仓库上下文的产出结果。规范的作用远不止于润色措辞：它在纠正成本尚处极低阶段时，及时修正了领域模型。

随后，规范将该不变量转换为用户场景、验收场景、功能需求以及可衡量的业务结果。例如，其核心场景明确要求在确认之前必须同时具备两项外部引用：

```text
Given a Sales Order awaiting confirmation that holds
a valid PaymentAuthorizationId and StockReservationId,
When confirmation is attempted,
Then the Sales Order status becomes Confirmed
and both references remain recorded as evidence.
```

该场景极具价值，因为人们无需打开代码即可对其提出质疑。无论你身处何种角色，都能与该场景展开互动：领域专家可以追问这些引用究竟从何而来，架构师可以检查它们是否跨越了显式的集成边界，开发者可以依据该不变量派生出聚合测试，而审查人员则可以直接驳回任何后续要求销售上下文去授权支付或扣减库存的任务。规范由此将领域载体转化成了一个人人可见的审查界面。

### 澄清机制及其沉淀的持久决策

第一轮规范生成还暴露出了先前提示词所隐瞒的关键问题。随后我们执行了澄清步骤，并提供了三项领域决策：

- 如果支付已获授权但库存无法预留，销售订单将维持其确认前的初始状态。
- 现有的销售订单 Saga 或流程管理器（process manager）负责协调整个确认流程。
- 对支付授权的任何解除（release）或作废（void）完全属于支付上下文的职责；销售上下文不执行任何补偿动作。

澄清机制的宝贵之处在于，这些答复直接固化为持久工件的一部分，而不再仅漂浮在某次对话的临时记忆中。Saga 不再只是编写代码时随意选用的顺手工具，而是经过显式抉择的协调者。销售上下文中缺失补偿逻辑不再是一种疏漏，而是一项深思熟虑的边界决策：支付上下文对其生成的授权保留绝对权威。

其他决策则被正当地保留为待决的开放性问题。规范依然在追问：是否允许部分预留、预留的有效期是多久、支付提供商超时意味着什么、销售等待仓库的超时阈值是多少、谁负责向客户发送通知、两个外部结果的到达先后次序是否有影响，以及预先批准的账期条款是否可以作为替代证据。这些开放性问题严格约束着后续计划所允许做出的断言范围；若为了推进规划而强行抹去这些问题，只会将真正的业务约束掩盖起来。

行文至此，Spec Kit 产出的成果在安全性上已经显著超越了纯提示词实现。规范准确采用了通用语言，厘清了决策归属权，记录真实的凭据而非凭空捏造，并忠实保留了未决的业务策略。然而，结构化工作流提升的是“可检查性”（inspectability）而非“权威性”（authority）：生成的文本只是变得更容易受到质疑，但工作流本身并不能自动保证其业务正确性。规范依然必须经过一轮严谨的 DDD 审查。

*图 8.1 概括了规范驱动分支中所采用的工作流。同一个功能请求进入受治理的上下文，经由人类进行澄清，并在规范需要修正时于 DDD 审查后重新回填至 `spec.md`。*

*图 8.1 – 从同一个功能请求演进至可审查且可修正的规范*

### 审查规范

规范使原始请求具备了可审查性；而接下来的 DDD 审查则着重评估这次转换本身。它相互比对各项需求，将强制性陈述反向追溯至具名来源，并在计划将其转化为可执行形态之前，将已确认的领域决策与看似合理的提议策略区分开来。因此，这一阶段的贡献远不止于又一次归属权检查：它能够揭示工件内部那些孤立来看各自合理、合在一起却自相矛盾的隐患。第一项审查发现正是这样一种矛盾。FR-004 将预留请求分配给了销售上下文，而 FR-012 则将跨上下文协调交给了 Saga：

```yaml
FR-004: When a Sales Order satisfies the preconditions for
confirmation, the Sales context MUST request a stock
reservation from the Warehouse context through an integration
boundary, rather than reserving, decrementing, or otherwise
mutating warehouse stock itself.

FR-012: The existing Sales Order saga/process manager (Sagas
context) MUST coordinate the confirmation flow across Payment
and Warehouse [...] and MUST NOT own the cross-context
orchestration itself.
```

每一条陈述孤立来看都完全合理。但放在一起研读时，它们不仅让发送方身份变得模棱两可，更产生了直接的冲突。FR-004 指示销售上下文去请求预留，而 FR-012 则禁止销售上下文染指承载该请求的跨上下文编排。究竟是由销售发送 `ReserveStock`，而 Saga 仅作为观察者监听结果？还是由 Saga 将其作为自身协调职责的一部分进行发送，而销售上下文仅被动接收最终的确认指令？领域载体允许引入协调机制，但要求各方权威必须保持显式清晰。在此阶段，现有证据根本无法确认究竟哪个参与者应当发送 `ReserveStock`。因此，规范应当在进入规划前如实保留该归属权问题以待裁决，绝不能悄无声息地擅自偏向某种解释。

第二项发现关乎幂等性。生成的规范引入了如下需求：

```yaml
FR-009: Confirmation MUST be idempotent: re-processing the
confirmation trigger for an already-Confirmed Sales Order
MUST NOT produce a second confirmation outcome nor a
duplicate stock-reservation request.
```

在消息驱动的工作流中，幂等性无疑是一项非常合理的工程属性，该提议极有可能被业务采纳。然而，它既未出现在最初的功能请求中，也未记载于领域载体之内。AI 助手擅自将一项看似合理的工程期望拔高成了强制性的功能需求。DDD 审查不应仅仅因为它是模型自行添加的就直接删除，也不能仅仅因为它是一个好主意就盲目全盘接纳。DDD 审查应当将其归类为“提议中的策略”（proposed policy），并追问哪个组件拥有重复检测的所有权，并在下游任务将其视为定论之前，明确界定什么才算作“同一次确认尝试”。

需求核对清单（checklist）未能捕获上述任何一个问题。核对清单报告称所有检查项均通过、所有需求均无歧义，且规范已完全准备好进入规划。然而与此同时，`spec.md` 依然被标记为“草稿（Draft）”，并保留着可能彻底改变交互设计的未决问题。核对清单依然值得运行，前提是你必须清醒认识到它到底能证明什么：它证明了必需的章节存在、验收场景齐备，以及载体中具名的约束在文档中有所提及——但绝不能证明每项需求都拥有合法的决策出处，更不能证明两条孤立来看合情合理的需求在决策归属上能够达成自洽。

因此，DDD 审查产出的是行动方案，而非代码：

- 明确厘清究竟是由销售上下文还是由 Saga 发送库存预留请求，并使每一个场景和需求与该裁决保持对齐。
- 将幂等性移入提议策略中，直至其所有者、唯一标识规则及预期行为获得显式认可。
- 保持未决业务策略的显式可见，防止计划盲目着手实现依赖于它们的工作。
- 将生成的核对清单视为“结构完整性”的证明，而非“领域认可”的通行证。

本次审查让规范回归到更加诚实严谨的状态。得到载体支撑的需求得以继续推进，像幂等性这样看似合理的补充作为提议保持清晰可见，而相互矛盾的职责划分则精准标识出仍需人类定夺的决策空白。纯提示词运行将其对边界的践踏隐匿于看似可信的代码之下；而规范驱动运行则在架构和任务扩散分歧之前，将矛盾彻底曝光于台前。规划阶段如今能够基于明确的决策与显式的空白展开，而非寄托于核对清单所营造的虚假完整表象。

## 从规范到计划与任务

在规范完成审查且未决决策清晰显式化之后，工作流现在从“已验证的理解”向“可执行的工作”演进。这种过渡成倍推高了任何残存歧义的修正成本。`spec.md` 中的一项需求在仅仅是一句话时，极易受到挑战；而计划则会将其分配至具体模块、聚合、消息与测试中，任务列表更进一步将这些分配细化为开发者或编码智能体可执行的具体工作。缺乏支撑的假设一旦跨越这条边界，它就不再只是规范中一行令人起疑的文字，而是会被分散渗透至各个文件、依赖关系、测试预期以及完成复选框之中。因此，规划绝非单纯的流程性交接：它是领域语义开始凝结为可执行形态的关键拐点。

我们在 `sdd_without_custom_agents` 分支上继续前行，所依据的正是前一步骤所产出的规范。第一条命令要求 Spec Kit 针对现有的 BrewUp 解决方案制定特性计划：

```text
/speckit.plan
```

该命令产出的成果远不止于 `plan.md`。它深入检查了代码仓库，并在 `specs/001‑order‑confirmation` 目录下创建了一整套完备的设计包：

- `research.md` 记录既有系统调查结果、设计决策、被否决的备选方案以及对载体的合规情况。
- `data‑model.md` 将不变量投影至聚合状态与行为之中。
- `contracts/` 在上下文边界处定义命令、领域事件与集成事件契约。
- `quickstart.md` 将验收场景转换为构建与测试预期。
- `plan.md` 将上述工件与 BrewUp 的实际模块及目录文件结构紧密绑定。

### 计划做出了哪些裁决

规划将经认可的领域语义映射到解决方案的具体部分。计划记录了支付与仓库凭证在何处汇入工作流，以及由哪个组件协调它们的到达。它还明确记录了确认不变量在何处强制执行，以及哪些生产端（producer）行为被排除在当前业务切片之外。其“结构决策”（Structure Decision）显式捕获了这种投影：

```text
Structure Decision: [...] The confirmation invariant lives in
BrewUp.Sales.Domain (SalesOrder); orchestration lives in
BrewUp.Sagas.Domain (SalesOrderSaga + orchestrator); all
cross-context messages live in BrewUp.Shared. Warehouse-side
production of the reservation outcome and any Payment-side
production are out of scope and are reached only through the
shared contracts.
```

这一投影恪守了若干关键的 DDD 决策。销售拥有向 Confirmed 状态流转的主权。支付与仓库依旧是产生这两项外部结果的真正权威。Saga 协调它们的到达，但绝不凭空代劳任何一项决策。销售订单将 `PaymentAuthorizationId` 和 `StockReservationId` 作为证据保存，而非硬塞入外部领域模型。开发者现在可以为不变量的每一个组成部分精准指明其所属的模块、消息以及聚合方法。

该设计包使得整条证据链路支持双向审查。请从左至右阅读*表 8.3* 的各行：源头断言演进为设计决策或具体任务，而 DDD 审查则评估该投影究竟保留了什么、丢失了什么。

| 源头断言 | 投影至计划与任务 | DDD 审查 |
|---|---|---|
| 确认需要 `PaymentAuthorizationId` 与 `StockReservationId` | `SalesOrder.Confirm` 拥有该不变量；T007‑T010 创建聚合测试、行为与处理程序。 | 得到保留。销售上下文记录凭证，且仅拥有状态流转权。 |
| Saga 协调支付与仓库结果。 | D4 选定 `SalesOrderSaga`；T011‑T015 添加状态与响应逻辑。 | 协作方向明确，但实现的实际消息链路仍须与计划保持一致。 |
| 仓库拥有库存预留权。 | T016 创建 `ReserveStock` 契约；仓库处理程序被声明在范围之外。 | 边界归属权得以保留，但所要求的预留行为并未真正交付。 |
| 确认操作应当具备幂等性。 | D5 将其列为设计决策；T008、T009 与 T014 实现重复抑制逻辑。 | 一项提议策略在缺乏被认可的所有者与唯一标识规则的情况下，被拔高为强制要求。 |
| 两种结果汇合应触发且仅触发一次确认。 | T017 承诺提供编排器行为测试，并宣称实现了端到端验证。 | 完成状态必须由行为来证明，不能仅凭打勾的任务复选框推断。 |

*表 8.3 – 规范演进为可执行工作时的可追溯性与 DDD 审查*

现在，请从右至左反向审视同一张表格的各行，追问每一项可执行工作是否都能溯源至已被认可的需求、具名的权威以及坦诚诚实的功能范围。最后两行尤其值得深思：下游工件看起来愈发完备周详，然而底层的业务策略或行为证据却依旧悬而未决。

### 可追溯性及其无法证明之物

其中两行揭示了**可追溯性（traceability）**的核心局限。工作流极其自洽地将幂等性从 FR-009 一路追溯至设计决策 D5 以及生成的测试与防护断言中。然而，业务领域自始至终未曾定义究竟什么才算作“同一次确认尝试”，也没有界定谁拥有该唯一标识判定规则的所有权。因此，工作流在方案尚未获得认可之前，就盲目放大了这一看似合理的提议。此时正确的应对方式是回退至规范阶段，将该策略归类为提议中，获取所缺失的领域裁决，随后再行修订计划。

库存预留则暴露了恰恰相反的问题。在此处，领域载体表达得斩钉截铁：仓库必须产出订单确认前所必需的持久 `StockReservationId`。然而，`research.md` 和 `plan.md` 却直接将仓库侧的生产端排除在外，任务 T016 仅仅止步于一个消息契约：

```text
T016 Create the Warehouse-owned reservation request contract
ReserveStock in [...] carrying WarehouseId, the Sales Order
reference, requested rows, and correlationId (contract only -
Warehouse-side handler is out of scope per research D2).
```

这一接缝虽然允许销售上下文和 Saga 消费一个人造的 `StockReserved` 结果，但它丝毫不能证明仓库真正预留了所请求的明细行，或真正生成了销售所依赖的引用。因此，已实现的切片仅仅演示了销售订单如何依据外部决策凭据完成确认，而根本没有打通从生产者到消费者的完整链路。可追溯性使得仓库侧证据的缺失暴露无遗；但它本身并不能弥补这一断层。接下来的问题是：那些已被勾选为完成的任务，是否真如其宣称的那样证实了相应行为的交付？

### 当勾选的任务并不等于已完成的任务

在完成规划后，我们生成了可执行的任务分解：

```text
/speckit.tasks
```

由此生成的 `tasks.md` 将工作拆解为 25 个精巧有序的任务，明确指定了文件名、依赖关系、并行机会以及测试先行预期。这种精细的颗粒度使得实现更易于协调与审查，但同时也极易诱使人们产生幻觉，误以为每一个被打勾的复选框都代表某项特定行为已被真实交付。

在 `sdd_without_custom_agents` 分支上，工作流将除 T022 之外的每一个任务都标记为完成。例如任务 T017 承诺编写测试，以证实两个外部结果会触发且仅触发一次 `ConfirmSalesOrder`、任一单独结果不会触发确认，且失败结果会阻止确认。对应的测试文件包含了 5 个测试用例（facts），它们的结构无一例外全部如下所示：

```csharp
public class SalesOrderSagaConfirmationTests
{
    [Fact]
    public void PaymentAuthorized_CorrelationId_MustBe_Preserved()
    {
        var correlationId= Guid.CreateVersion7();
        SagaPaymentAuthorized @event = new(
            new IntegrationId(correlationId.ToString()),
            correlationId,
            Guid.CreateVersion7().ToString());

        Assert.Equal(correlationId,
            MessageHelpers.GetCorrelationId(@event));
    }
```

```text
    // [...] 针对 PaymentAuthorizationFailed、StockReserved、
    // StockReservationFailed、SalesOrderReadyToConfirm
    // 的另外 4 个完全相同形态的测试用例
}
```

要直接证实这一断层，只需查阅 `SalesOrderSagaConfirmationTests.cs`，看看其中是否存在哪怕一个能够构建或重构（rehydrate）`SalesOrderSaga`、用两个外部结果驱动它、并验证其确实只发出且仅发出一次 `ConfirmSalesOrder` 的测试用例。一个都没有。同样也不存在任何只输入单一结果或输入失败结果、并断言绝不发出确认的测试用例。因此，该文件仅仅证明了“消息结构的完好保留”，根本没有证明 T017 所承诺的业务行为。然而 T017 却被堂而皇之地打上了勾：测试文件的存在与断言语法的合法性被偷换成了任务的完成，尽管任务所承诺的核心行为依然处于未获证实的悬空状态。

T019 则从另一个维度揭示了相同的分歧。该任务描述了派发 `ReserveStock` 以及发送唯一一次 `ConfirmSalesOrder`，然而具体实现却仅仅将 `ReserveStock` 保留为一个空契约，并通过另一条完全不同的消息路径抵达销售上下文。这段代码或许仍然能够支撑某种可行的架构，但那个被勾选的任务却早已不再代表代码的实际行为。

将每一个复选框视为一项严肃的“行为断言”，便能让上述两处不匹配显露无遗。真正的“完成”必须在任务所指定的边界上产生可观测的确定结果；文件的创建、编译的通过以及狭隘的单元断言仅仅是辅助证据，绝不能替代最终结果本身。

针对本条追溯痕迹，DDD 审查产出了如下具体行动：

- 裁定当前切片是否包含真实的仓库预留生产端；使功能声明与该裁决严格对齐。
- 促使 `plan.md`、`T019` 以及已实现的 Saga 到销售的消息路径精确描述同一种协调机制。
- 将仅验证关联关系的 Saga 测试，替换为覆盖两种到达顺序、恰好一次确认以及失败结果的真实行为测试。

这些审查发现并不会自动回填更新领域载体。预留断层以及任务与测试之间的脱节属于工作流与验证层面的缺陷，并非全新的业务规则。它们首先应当归入规范审查与工程核对清单中。唯有关于幂等性、预留原子性或失败语义的人类决策，才能升格为持久的领域知识。

若要依据留存的工件复现本项审查，可查阅 `sdd_without_custom_agents` 分支上 `specs/001‑order‑confirmation` 目录下的 `plan.md`、`research.md`、`quickstart.md` 和 `tasks.md`。随后，将 T016、T017、T019 与 `ReserveStock.cs`、`SalesOrderSagaConfirmationTests.cs`、`SalesOrderSaga.cs` 以及 `SagaSalesOrderReadyToConfirmIntegrationEventHandler.cs` 进行比对。这里极具启发意义的实践是：持续追踪一项领域承诺，直至有真实的测试与生产路径切实证明它为止。在当前阶段进行这一审视，揭示了工件链路的局限性：它忠实记录了每一项决策，但工件本身永远不会主动反驳或提出抗议。下一次运行则引入了能够进行抗辩与把关的全新机制。

## 借助守卫智能体设立认知边界

规范驱动运行使得领域决策在规范、计划、任务、测试和代码之间具备了可追溯性。但它同时也揭示了结构化工件单凭自身所无法企及的盲区。一项缺乏支撑的策略一旦溜入链路，后续的每一个工件都能将其精准复述，并使其显得愈发确凿无疑。在上一轮运行中，未经确认的幂等性规则演化成了可执行的工作。仓库生产端从范围中悄然消失，而该功能却依然保留着已预留库存的虚夸声明，被打勾的任务更是夸大了测试所实际证明的行为。工作流使这些失败变得可供检查，却未能确保它们在扩散蔓延之前得到有力的质疑与拦截。

在第三次运行中，我们仅仅改变了审查环境：一套由专业守卫智能体构成的治理框架（harness），在每次生成转换之间设立了显式的审查节点。它们严密检查每一个新生成的工件是否依然遵循被认可的领域权威、是否完整保留了未决决策，以及是否恪守了前序工件所确立的架构边界。这种环境的核心价值在于及时的抗辩与拦截：未获支撑的假设在其潜入工作流的最初源头就会被揪出曝光，赶在后续工件将其常规化为既成事实之前予以阻断。

### 认知边界约束了什么

持久化的知识是必不可少的，但仅仅持久化本身并不能确保其得到严格执行。一份生成的规范、计划或任务列表完全可以在表面维持逻辑自洽与形式正确的同时，对宪章、载体及架构记忆进行歪曲解释、削弱甚至暗中无视。治理框架将这些被动的知识源直接拉入审查路径，并将其作为刚性的评估准则。我们将由此构筑的检查关卡称为**认知边界（cognitive boundaries）**。

该术语在字面上刻意与“限界上下文（bounded context）”保持对仗，但二者绝不可混为一谈。限界上下文约束的是领域模型的语义与所有权：一个术语在何处有效、由哪个模型赋予其含义、哪个权威拥有做出相应决策的权力。而**认知边界（cognitive boundary）**约束的则是 AI 参与者在工作流的特定节点上被允许推断、决策或转换的内容边界。守卫智能体本身既不拥有销售订单的生命周期，也不负责授权支付或预留库存。它的职责是核验生成的工件没有将这些决策权拱手移交给错误的参与者，也没有暗中擅自定夺那些领域故意保留的未决策略。守卫有权叫停工作流；但它绝不能代替真正的所有者去补全领域模型。

### 两类规则：所有权与结构

治理框架将权威规则清晰划分为两类。限界上下文规则回答的是“谁拥有某项决策”的问题；而架构规则回答的则是“该所有权在解决方案中必须落在何处”的问题。

领域载体包含带有明确编号的限界上下文规则，例如：

```text
BC-003 - Payment owns authorization outcomes.

BC-006 - Stock Reservation is an external decision.
Sales may store StockReservationId as evidence that Warehouse
produced a reservation outcome. [...] Sales must not produce
the stock reservation outcome.

BC-009 - External decision references, not embedded models.
Sales may store external decision references [...] Sales must
not embed Payment or Warehouse domain models.
```

架构记忆则通过结构性约束对这些规则进行补充：

```text
AR-001 - Bounded contexts must be explicit modules.

AR-002 - Standard module project structure.

AR-016 - Business authority must not be collapsed into
another module.
```

两套规则相互结合，使守卫能够沿着两个紧密相连的维度对同一个工件进行严格审查。限界上下文规则检验某项决策是否依然归属于拥有它的上下文；架构规则检验模块、消息与依赖关系是否在代码实现方案中坚守了这种隔离。一项需求可能在字面上正确地将支付上下文指名为权威，而计划却把支付行为安置在销售模块内部。反之，一个物理上独立的支付模块，也绝不能让一条允许销售上下文伪造授权结果的需求合法化。唯有当领域语义与结构表征达成高度统一时，审查才算真正通过。

因此，守卫能够依据具体具名的准则源报告冲突，而非依据某种空洞模糊的“良好架构”主观臆测。守卫能够精准指出 `spec.md` 中违反 BC-003 的某句话、`plan.md` 中违反 AR-001 或 AR-016 的项目工程布局，或者某种需求概念合理但在拟议实现中使边界发生坍缩的复合问题。所有权规则守护的是决策权；而架构规则守护的则是使该所有权始终清晰可见的系统物理形态。

### 守卫在生命周期中的卡位布局

*图 8.2 展示了围绕工件链路设立的治理框架。同一个功能请求首先与宪章、领域载体及架构记忆汇合。随后，守卫对从规范到计划、从计划到任务、以及从任务迈向实现的各次转换进行层层审查。当守卫发现缺乏依据的决策时，工作流应当回退至人类澄清或工件修正阶段，而非默不作声地继续推进。BLOCK 箭头展示了对已确认问题的预期响应动作。*

*图 8.2 – 守卫智能体在规范驱动工件之间构筑认知边界*

每一次生成式转换都会引入发生漂移（drift）的新风险，因此每一次转换都配得上设立专属的认知边界。在请求转化为规范之前，领域上下文便被预先加载；随后，守卫会严格审查工作流从中派生出的每一个工件。

在 BrewUp 代码仓库中，这些检查被深度挂接到 `sdd-with-harness` 分支上的 Spec Kit 生命周期中。一个智能体负责在规范制定开始前加载权威上下文；其余守卫则对后续转换所产出的工件进行严格把关。请自顶向下阅读*表 8.4*，将其视为一张领域知识可能在何处发生遗失的风险地图：首先是请求转变为规范之时，其次是需求转变为架构之时，最终是计划转变为可执行任务之时。扩展配置会在这些转换节点上自动提供挂钩（hooks），但每个钩子依然保持可选。

| 智能体 | 运行契机 | 检查要点 |
|---|---|---|
| `load‑domain‑context` | 编写规范之前 | 将领域载体、宪章及架构记忆载入请求的上下文中 |
| `domain‑guard` | 编写规范之后 | 销售、支付与仓库之间的所有权归属，以及每条策略的决策出处 |
| `plan‑readiness` | 制定计划之前 | 是否存在被暗中擅自裁决的开放性业务问题 |
| `plan‑guard` | 制定计划之后 | 职责映射到组件过程中的架构漂移 |
| `module‑structure‑guard` | 制定计划之后 | 对照架构记忆中的 AR 规则检查模块组织布局 |
| `task‑guard` | 任务生成之后 | 生成任务内部的所有权归属与未决策略合规性 |

*表 8.4 – 治理框架中的智能体及其审查的转换节点*

这一序列将一个核心审查问题分散布置在整个生命周期之中：最新的转换是否忠实保留了其来源中所具备的权威归属与未决决策？`load-domain-context` 确立了基线；`domain-guard` 审查对请求的初始解读；规划守卫审视其架构投影；而 `task-guard` 则核验向可执行断言的最终翻译。后置的守卫并非重复前序的审查，而是测试一项已认可的决策是否能够在全新的转换形式下幸免于难。幂等性需求提供了一个具体范例，展示了这种分布式审查如何改变工作流所能洞察的视野。

### 守卫实战演练：幂等性需求

上一轮运行中的幂等性需求生动揭示了实践中的转变。标准工作流引入了如下规则：

```text
Confirmation MUST be idempotent: re-processing the confirmation
trigger for an already-Confirmed Sales Order MUST NOT produce
a second confirmation outcome nor a duplicate stock-reservation
request.
```

这项需求在技术层面非常合理，但这并不能赋予其合法的领域权威。无论是原始功能请求还是领域载体，都未曾界定一次确认尝试的唯一标识、未曾分配重复检测的归属权，也未曾确定应当如何处理重复到达的外部结果。领域守卫必须揭示出这种决策出处的缺失，并在工作流继续推进之前指出所必需的业务决策。守卫绝不能自行捏造唯一标识规则，也不能武断地认定幂等性毫无必要。

留存的工件中虽然并未包含阻断报告，且 FR-009 依然作为一项强制需求赫然在列。然而，对比之下依然揭示了意义深远的转变。在治理框架下生成的规范将领域权威置于首要位置，在绝大多数需求旁清晰标注了权威规则的引用，并将未决策略记录在带有明确负责人的具名编号章节中。FR-009 虽仍无合法出处，但与那些明确标明引用的需求并列在一起时，其出处的缺失变得一目了然。认知边界并未彻底杜绝未经支撑的规则潜入；但它使该规则能够从已被认可的领域知识中被清晰甄别出来。

任务列表展现了第二个效应。标准运行排除了仓库生产端，却依然保留了该功能具备库存预留能力的虚妄断言。在治理框架下，当一次人类澄清解决了部分预留问题后，预留行为被转化为了显式的工作。然而，由此产生的规范内部依然包含相互冲突的“部分预留”与“全有或全无”场景。出处追溯记录了究竟是谁提供了决策，但它并不能自动调和由此派生出的每一句冲突表述。负责该领域的权威必须在规划继续推进之前，彻底消解这一矛盾。

新增的任务同样无法证明预留功能在行为层面上已完备实现。留存的实现与测试依然悬而未决：面对多款请求的啤酒、重复尝试、状态恢复以及从仓库到销售的完整链路上，预留逻辑是否依然正确？这些断层属于验证层面的审查发现。守卫能够揭示哪些断言需要获得证明，但它绝不可能仅通过检查静态工件就凭空提供这种证明。

证据边界在此处至关重要，因为没有运行日志记录下守卫曾经驳回早先范围缩减的动作。因此该序列无法严格复现，我们也不能断言是治理框架促成了这一转变。但这种审慎的局面对比依然极具价值：正是那个使开放性问题显式化并将其指派给具体权威的环境，最终促成了部分预留问题获得人类的业务裁决，并作为规划内的工作重新回归。

结构守卫将同样的纪律应用于防范另一种漂移。如果一项计划在逻辑上承认支付上下文是授权的真正权威，却将其命令与处理程序物理放置在销售模块内部，那么 BC-003 便能指明其对所有权的侵犯，而 AR-016 则能指明其造成的结构坍缩。在任务层级上，销售上下文可以被要求存储 `PaymentAuthorizationId` 作为外部证据；但任务绝不可要求销售上下文去执行支付授权。在各次转换节点上严加防守，使得冲突在这些错误假设肆意扩散至契约、测试和生产代码之前就被及时曝光。

### 守卫决不可越界之举

守卫绝不应该悄悄重写工件以使其看起来符合规范；那样做只会让它沦为一个缺乏问责机制的额外决策黑盒。它的本职工作是引用已被认可的准则，展示相互冲突的证据，并指明在工作流获准继续之前必须做出修改的工件或必须由人类给出的业务裁决。一个 BLOCKED（阻断）的结果意味着后续步骤不应盲目推进，但这并不代表守卫所言就一定完全正确。人类完全可以驳回守卫的审查发现，而这种机制的价值正在于：驳回本身成为了一项显式的、可审计的决策，而非悄然湮没在下一轮生成的输出之中。由于每个钩子（hook）都是可选的，因此这属于一种流程纪律，而非技术上的绝对保证。

因此，架构师的核心地位依然坚不可摧：必须有人出面裁决哪些知识源具备权威性，以及哪些审查发现需要求助于领域专家而非单纯的技术修补。此外，守卫只能执行那些已被明确显式化的规则。如果载体对预留的原子性只字未提，没有任何守卫能够凭空知晓哪种部分预留行为才是正确的。在新增守卫之前，务必先追问它到底能够引用哪条公认的规则：一个无规可依的守卫，只不过是挂在钩子上的个人偏见罢了。而团队始终不可或缺的，依然是行为证明：一个被打上勾的复选框，绝非代码实现确实满足了任务所列条件的可靠凭证。

治理框架同样未能补全行为证明的拼图。留存的测试并未涵盖两种到达次序、恰好一次确认、拒绝处理、状态恢复，或者从仓库产出经由 Saga 抵达销售的完整通路。工件的出处追溯能够厘清“必须测试什么”；但它绝不能替代对承诺行为的真实观测。

在缺乏运行日志的情况下，唯一保持可重现的便是工件本身的对比。在 `sdd‑with‑harness` 分支上，查阅 `.github/agents/speckit.brewup.*.agent.md` 中的守卫定义、`.specify/memory/architecture/brewup‑module‑structure.md` 中的结构规则，以及 `brewup‑spec‑kit‑harness.md` 中的卡位串联配置。随后，随手抽取 `specs/001‑order‑confirmation/spec.md` 中的任意一项需求，追问究竟是哪条规则授权了它。文档要么给出了明确答复，要么未能回答——而这，便是切实可重现的检验测试。

### 受控的委托

第三次运行使委托机制变得更加受控且易于审查。AI 依然可以生成每一个工件，而治理框架则插入层层审查，旨在质疑缺乏依据的策略越权提升、曝光越过限界上下文边界的决策侵入，并标识出将外部权威坍缩并入销售上下文的危险任务。这一区分正是认知边界的现实真谛：它明确划定了模型推断应当在何处向显式权威让步，以及在何处必须引入人类的定夺。

守卫智能体是我们所采用的第一种专业化形态，其角色被刻意设计为防御性质。它们审查转换过程、揭露缺乏依据的决策，并为团队在架构漂移蔓延扩散之前提供制止它的宝贵契机。

三者的区别可以用三句话来概括：提示词描述了模型应当尝试做什么；规范记录了后续工作必须坚守什么；而守卫智能体则核验下一步的转换是否依然处于合法授权之中。治理框架并不能将 AI 变成一位更出色的架构师，可选的钩子也无法彻底阻止它暗中充当架构师。治理框架所能做到的，是让那些缺乏依据的决策充分暴露于台前，以便在它们扩散蔓延之前接受及时的质疑与驳回。

简而言之，第三次运行改变了“未获支撑的决策在何时变得可见”，同时依然将“谁有权做出决策”的问题原封不动地保留在原地。而下一次运行则跳出了单纯的工件链条，转而彻底重塑了协作者的组织形态。

## 在基于角色的工作流中运行相同的功能请求

前三次运行均采用相同的以工件为中心的协作模型：请求转化为规范，规范转化为计划，计划转化为任务，而守卫（当存在时）则在它们之间的各次转换中进行严格把关。第四次运行则重构了协作的组织方式，同时也是四次运行中最单薄的一次。在其两个分支中，仅有一个分支保留了可用的工件，因此下文是对这单一追溯痕迹的研读，而非与前三次运行具备相同分量权重的第四种完整结果。

在 BMAD 运行中，领域知识通过专业角色及其交接（handoffs）进行流转，而非单纯依靠一连串生成的静态文档。分析师框定问题边界，产品角色塑造业务成果与范围，架构师将决策映射投影到系统结构中，开发者实现用户故事，而审查者则对完成声明提出质疑与抗辩。因此，本次对比的核心诉问在于：当职责在协作人员之间而非工件之间交接时，相同的领域规则是否依然能够保持可见、可被质疑且出处可溯？

### 仓库中真实留存的追溯痕迹

BMAD 运行拥有两个具名分支，但它们所包含的证据并不均等。在撰写本章所审查的仓库状态下，`bmad‑solution‑without‑harness` 分支仅记录了 BMAD 的安装，并移除了 BrewUp 治理叠加层（governance overlay）；该分支不包含任何 `_bmad‑output` 规划工件、功能实现或命令对话抄录。这一缺失并不表明未经治理的 BMAD 工作流一定会失败；它仅仅意味着该分支无法支撑工作流层面的严谨对比。

真正具备可用价值的追溯痕迹保留在 `bmad‑solution‑with‑harness` 分支上。它同样始于那个完全相同的订单确认请求，将获批的 BrewUp 决策注入 `project‑context.md`，随后顺次流转至产品简报（product brief）、**产品需求文档（PRD）**、架构设计、史诗与用户故事（epics and stories）、实现就绪度评估（implementation-readiness assessment），以及前三个具体实现故事。这些工件所保留的逻辑序列如下：

```text
project context（项目上下文）
  -> product brief（产品简报）
  -> PRD（产品需求文档）
  -> architecture（架构设计）
  -> epics and stories（史诗与用户故事）
  -> implementation readiness（实现就绪度）
  -> Story 1.1: Payment domain and module（故事 1.1：支付领域与模块）
  -> Story 1.2: Payment projection and callback（故事 1.2：支付投影与回调）
  -> Story 1.3: Warehouse stock reservation（故事 1.3：仓库库存预留）
```

该追溯痕迹是一条源于静态工件的工作流痕迹，而非可完整重放的命令日志。没有任何运行记录或标签记载了当时精确的命令输入与对话交接细节。文件与提交历史能够展示哪些转换最终留存了下来；但它们无法证明生成这些转换的每一次具体交互细节。

### 领域知识在何处流转

在 BMAD 分支中，领域知识的第一个持久载体是 `_bmad‑output/project‑context.md`。它总结了模块化单体规则、测试先行纪律以及严禁擅自捏造未决策略的禁令，同时反向引用了带有明确编号的销售订单确认和模块结构治理文档。该总结明确声明，它绝不会覆盖这些上游权威源。这一区分至关重要：角色接收到的是可执行的上下文，但最终的权威依然牢牢掌握在载体与获批的领域决策手中。

产品简报将该上下文转化为一份目标成果陈述。其中一段简短的摘录严密守护了此前纯提示词运行所践踏的边界：

```text
Sales stores only PaymentAuthorizationId and StockReservationId
as external evidence. It does not embed Payment or Warehouse models.
```

PRD 将上述陈述进一步展开为具体需求：支付拥有授权，仓库拥有完整的库存预留，销售必须具备这两项凭证 ID，而 Saga 则按照“支付 -> 仓库 -> 销售”的次序进行协调，且绝不凭空代劳其中任何一项决策。架构决策将这些需求严密绑定到具体模块和依赖方向上。随后，史诗与故事将每项行为附着到具名的测试、路径以及 `BC‑###` 或 `AR‑###` 规则之上。因此，领域知识在由角色所塑造的工件之间穿梭流动，且始终保持高度的可审查性，因为每一次交接都在源头留下了清晰可溯的痕迹。

缺失的证据同样不容忽视。代码仓库中并未包含分析师、产品经理、架构师与开发人员等角色之间的原始对话记录。因此，仓库无法证实各个角色在运行期间究竟阅读了什么、提出了哪些抗辩与反对意见。仓库所能证明的，仅仅是最终生成的工件承载了这些规则，且关卡报告确实对照已提交的权威源对这些工件进行了审查。

## 本章小结

本章跟踪了一个含糊不清的销售订单确认功能请求，见证了它在四种治理力度逐步升级的环境中的演进历程。纯提示词运行生成了看似符合 DDD 规范的代码，却公然捏造了支付与仓库的凭据。Spec Kit 使得载体规则在规范、计划和任务中具备了清晰的可追溯性，但同时也表明单凭可追溯性本身，无法阻止未经支撑的策略越权提升或虚假的完成声明。守卫智能体增设了认知边界，精准揭露了所有权与决策出处的断层，但通过静态检查依然必须辅以领域裁决与真实的行为证明。

BMAD 运行将相同的领域知识分散重组于项目上下文、产品简报、PRD、架构设计、用户故事以及审查关卡之中。留存的 BMAD 追溯痕迹成功将领域规则贯穿至支付与仓库的增量实现中，却止步于演示端到端确认所必需的销售与 Saga 用户故事。框架或许可以重新洗牌角色与交接机制；但权威的界定、确凿的证据以及人类的最终裁决权，始终不可动摇。

*表 8.5 按照本章的阐述顺序，将四次运行进行了横向比对。*

| 运行轮次 | 增添的机制 | 依然无法证明的事项 |
|---|---|---|
| 纯提示词（Prompt only）<br>`no_sdd` | 除了功能请求之外一无所有 | 无法证明任一引用确实是由拥有该决策权的上下文所生成 |
| Spec Kit<br>`sdd_without_custom_agents` | 引用载体并在运行后依然留存的规范、计划与任务列表 | 无法证明每项需求都拥有合法的出处，也无法证明被打勾的任务已被行为所证实 |
| Spec Kit 叠加守卫<br>`sdd‑with‑harness` | 必须指明其所执行规则的审查节点，以及带有负责人的未决策略 | 无法证明预留功能在端到端链路上行之有效：守卫阅读的是工件，而非运行行为 |
| BMAD<br>`bmad‑solution‑with‑harness` | 承载相同规则的角色与交接，每一步均可追溯至源头 | 无法证明端到端订单确认，因为该运行在完成销售与 Saga 故事之前便已终止 |

*表 8.5 – 四次运行：各自增添了什么，以及各自留下了哪些尚未证实之处*

在本章中，你学到了如何：

- 甄别识别那些毫无领域权威依据凭空捏造的虚假证据。
- 将领域规则从需求规范一路贯彻至可执行的工作任务中。
- 跨越需求、测试与生产行为，全程追踪领域承诺的兑现情况。
- 利用守卫在所有权发生漂移蔓延之前将其及时曝光。
- 在工作流或协作框架发生变迁时，始终捍卫人类的最终审批权。

*第 9 章*将从防御性的守卫演进为专门的 DDD 智能体，深入界定它们在不僭越成为领域决策者的前提下，参与领域建模所必需的职责划分、输入、输出以及能力边界。

## 参考文献

- GitHub (2025). Spec Kit: a toolkit for spec-driven development. <https://github.com/github/spec-kit>（访问于 2026 年 9 月）。
- BMAD Code (2025). BMAD-METHOD: Breakthrough Method for Agile AI Driven Development. <https://github.com/bmad-code-org/BMAD-METHOD>（访问于 2026 年 9 月）。
