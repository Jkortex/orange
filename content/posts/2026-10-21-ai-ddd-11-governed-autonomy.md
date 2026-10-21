---
title: "AI 增强的领域驱动设计（十一）：受治理的自主性：在智能体之间平衡自主与对齐"
date: 2026-10-21T11:00:00Z
description: "区分确定性边界冲突与语义偏离，在不扩大自主性的前提下纠正漂移，并让证据、不确定性与人工验收在多智能体工作流中始终保持透明可见。"
category: domain-driven-design
tags:
  - "受治理的自主性"
  - "智能体"
  - "概念漂移"
  - "可观测性"
  - "架构设计"
---

> 💡 **专栏导读**：本文收录于专栏 [《AI 增强的领域驱动设计》](/columns/ai-ddd)。全专栏共 12 篇，覆盖大语言模型心智模型、事件风暴与 AI 协作、提示词规则手册、限界上下文精炼，以及专家智能体与编排器的完整工程实践。

*第 10 章*确立了谁可以采取行动、每个专家智能体可以消费哪些已验收的材料，以及何时必须由人工关卡介入。但这留下了一个悬而未决的问题：专家智能体在改变领域之前，究竟可以在多大程度上对已验收的证据链进行解释？

本章将这种解释自由显式化。现在，问题转移到了转换过程的内部：在有价值的提议演变为缺乏依据的领域决策之前，专家智能体究竟可以在多大程度上进行解释、重命名、结构化或泛化？我们将这种自由编码为策略，将机械性违规与语义偏离区分开来，并通过 BrewUp 循环运行一个受控的漂移与纠偏场景，同时保持证据链、不确定性、决策权和人工验收全程可追溯。

在本章中，你将学到：

- 为专家智能体定义可强制执行的自主性策略，且无需预设其领域结论。
- 基于已验收的证据链、经批准的语言、未决问题和显式决策权，组装共享的对齐上下文。
- 区分确定性边界冲突与需要授权审查的语义偏离。
- 约束纠偏尝试次数、时间和工具访问权限，同时保持纠偏过程的局部性、可追溯性并服从人工验收。

## 技术要求

本章中的实现扩展了*第 10 章*中介绍的编排工作区。保存的版本可在配套代码仓库分支 <https://github.com/PacktPublishing/AI-Augmented-Domain-Driven-Design/tree/ch11/governance> 上获取。该实现面向 .NET 10。治理类型位于 `src/Orchestration/BrewUp.Orchestration.Application` 中。`Governance.cs` 包含 `AutonomyPolicy` 和 `AlignmentContext`，`AlignmentGuard.cs` 包含确定性对齐检查，而 `SemanticAlignment.cs` 定义了 `ISemanticAlignmentReviewer`。受控语义审查的实现是 `BrewUp.Orchestration.Infrastructure` 中的 `MarkdownSemanticAlignmentReviewer.cs`。相应的可执行示例与测试位于 `src/Orchestration/BrewUp.Orchestration.Tests`，主要包括 `AlignmentGuardTests.cs`、`SemanticAlignmentTests.cs` 以及 `GovernedOrchestrationLoopTests.cs`。你可以通过本章的代码清单跟随论述思路；仅当需要检查或运行完整的保留实现及其完整测试套件时，才需要克隆该代码仓库。

## 从协调走向决策权

*第 10 章*中的编排循环让协调变得显式化：它决定了哪个专家智能体可以运行、该专家智能体可以消费哪些已验收的材料、何时需要**人工关卡**（Human Gate），以及哪些状态转换是合法的。但它依然没有定义专家智能体在其转换内部拥有多大的自由度。

Storyteller（故事讲述者）必须拥有将已验收事实转化为具体业务场景的自由。Command & Event Writer（命令与事件编写者）必须能够为证据链所支持的意图或结果选取精确的表述形式。Context Mapper（上下文映射者）必须能够提出输入中尚未明确划分的边界。如果缺乏这种自由，生成式专家智能体所能带来的价值将微乎其微。

但这种自由同时也带来了风险。专家智能体可能会引入一个看似更干净的术语、自行推断归属者（Owner）、擅自结束一个未决场景，或者使证据链看起来比实际情况更加一致。产出的工件可能完全符合其 Schema 规范，对话也可能遵循了每一次合法的状态流转，但其实际业务含义却早已发生了漂移（Drift）。

因此，具有实际指导意义的问题在于：哪些选择权属于专家智能体，而哪些选择会篡改已验收的领域知识？

编排器不可能通过自行解释领域来回答这个问题，否则它自己就会沦为另一个建模专家智能体。编排器能够做的是：对允许的自由度进行编码、拒绝机械层面的违规行为，并将语义分歧退回给有权解决这些问题的人工角色。

### 将自主性转化为策略

当把**自主性**（Autonomy）视为契约而非模型本身的固有属性时，治理就会变得更加容易。每个专家智能体都已经拥有了一个有界的转换范围。策略所描述的，正是该边界内部的操作自由度。它明确指定了专家智能体可以产出哪类工件、可以审查哪些已验收的材料、是否允许引入新术语、可以使用哪些工具，以及工作流允许进行多少次纠偏尝试。

```csharp
public sealed record AutonomyPolicy(
    string Specialist,
    string OutputKind,
    string[] AllowedEvidenceKinds,
    bool MayIntroduceNewTerms,
    int MaxCorrectionAttempts,
    TimeSpan Timeout,
    string[] AllowedTools);
```

针对 Storyteller 的策略将这些限制具体化为单个专家智能体的规范：

```csharp
var storytellerPolicy=new AutonomyPolicy(
    Specialist: "storyteller",
    OutputKind: "candidate-scenarios",
    AllowedEvidenceKinds: ["accepted-facts", "walkthrough"],
    MayIntroduceNewTerms: true,
    MaxCorrectionAttempts: 2,
    Timeout: TimeSpan.FromMinutes(2),
    AllowedTools: ["read-accepted-artifact"]);
```

Context Mapper 可以审查完整的已验收证据链，因为它的转换依赖于分散在多个工件中的决策。

该策略约束了探索的边界，却不强加结论。`MayIntroduceNewTerms` 控制着提出陌生术语是否属于该专家智能体被许可的转换操作。当其为 `false` 时，引入 `ApprovedTerms` 之外的术语就构成了机械层面的策略违规，防护守卫（Guard）无需解释其含义便可直接拒绝。当其为 `true` 时，专家智能体可以提议该术语，但该提议并不会自动成为已验收通用语言的一部分。它与现有语言的关系仍需经过语义审查，并最终由获得授权的人工验收决定。

同理，访问已验收工件的权限仅代表授予专家智能体转换该工件的权利，绝不意味着允许它推翻促成该工件通过验收的原始决策。

### 定义共享对齐输入

局部自主性依然依赖于一个共享的已验收知识框架。如果每个阶段对该框架的重构各不相同，那么编排器即便强制推行了一个流程上合法的流程，各个智能体在语义上也会逐渐分道扬镳。

共享对齐输入定义了每一次转换所继承的约束条件：已验收的工件、当前目标、经批准的语言、必须保持可见的未决问题，以及当前专家智能体无权做出的决策。

以下 record 结构表示了这一共享框架：

```csharp
public sealed record AlignmentContext(
    ArtifactEnvelope[] AcceptedArtifacts,
    string WorkflowGoal,
    string[] ApprovedTerms,
    string[] Unresolved,
    string[] ProhibitedDecisionTypes);
```

`AutonomyPolicy` 定义了专家智能体在生成候选方案时可以做什么；`AlignmentContext` 则定义了该转换必须与什么保持一致。例如，对于 Storyteller，该上下文可能包含已验收的事实（accepted-facts）、库存（Stock）演练目标、当前经批准的领域术语、关于少货量（short-quantity）的未决问题，以及严禁引入补货或分配策略的禁止项。

```yaml
var storytellerAlignment=new AlignmentContext(
    AcceptedArtifacts: state.AcceptedArtifacts,
    WorkflowGoal:
        "Turn accepted Stock facts into concrete scenarios " +
        "without resolving unsupported policy.",
    ApprovedTerms:
    [
        "Stock",
        "Sales",
        "set aside",
        "hold",
        "earmark"
    ],
    Unresolved:
    [
        "ES-17"
    ],
    ProhibitedDecisionTypes:
    [
        "short-quantity-policy",
        "retry-owner",
        "hold-duration-policy"
    ]);
```

这些字段并不会指挥 Storyteller 应当如何编写场景。Storyteller 可以自主选择参与者（Actors）、编排有依据支撑的动作序列、斟酌措辞并展示业务变体，但它绝不能把 ES-17 擅自变成一条既定规则、用所谓的规范术语替换尚未统一的语言，或者指定缺乏证据支持的归属权。

随着工作流的推进，这一上下文也会相应发生演变。Command & Event Writer 除了接收早期素材外，还会接收已验收的场景。Context Mapper 则接收完整的已验收证据链。目标随着每次转换变得更加具体，而已验收知识和未决决策则是持续累积，而非凭记忆随意重新构建。

`GovernanceCatalog` 会将 `AcceptedArtifacts` 替换为协议状态中的已验收记录。`WorkflowGoal`、`ApprovedTerms`、`Unresolved` 以及 `ProhibitedDecisionTypes` 仍然属于专家智能体治理配置的一部分；在生产集成中，它们可能会从已验收的语言和交接记录中动态填充，但编排器绝不会从自然语言文本中妄加推测。

随着这些输入的显式化，下一道边界就具备了可强制执行性。程序代码可以直接拒绝超出声明权限的专家智能体，但绝不能越界去判定某个合规的解释在语义层面是否合理。这种界限将机械对齐与**语义偏离**（Semantic Divergence）清晰地划分开来。

## 区分机械性违规与语义偏离

由于对齐输入现已完全显式化，因此该框架的一部分可以通过代码进行检查。工件类型（Artifact Kind）、出处追溯（Provenance）、未决标识符（Unresolved Identifiers）以及声明的决策类型都是程序可以直接比对的事实。然而，一个新术语是否抹平了领域尚未解决的微妙差异，则不属于此类事实。因此，这两种失败需要不同的处理机制：前者可以通过预先声明的规则直接拒绝，而后者只能如实上报给授权人员。

### 强制执行机械对齐规则

某些对齐失败根本不需要任何语义解释。如果 Storyteller 返回了错误的工件类型、引用了从未提供过的证据、遗漏了未决标识符，或者声称做出了其契约明确禁止的决策类型，此类违规并不需要模型去推理解释。这些行为公然违背了已声明的边界，确定性代码理应能够直接检测出来。

对齐检查与对话协议保持分离。`ConversationProtocol` 决定一条消息是否合法；而**对齐守卫**（Alignment Guard）则决定该消息所携带的候选方案是否遵循当前转换的机械性约束。这两者有意存在一次重叠：*第 10 章*中已经拒绝接收遗漏了未决标识符的候选工件，但那是在人工关卡处、由审查员阅读完候选工件后才予以拒绝的。在生产环境中提前进行机械检查，意味着专家智能体绝不会将一份悄悄关闭了开放性问题的候选方案呈现在审查员面前。

因此，候选方案在其常规工件旁边，额外暴露了少量的机器可读对齐元数据：

```csharp
public sealed record CandidateAlignmentMetadata(
    string[] Terms,
    string[] DecisionTypes);

public sealed record AlignmentIssue(
    string Code,
    string Detail);
```

`AlignmentGuard` 使用显式的序数比较（Ordinal Comparisons）来比对声明的事实。以下代码摘录展示了五项检查中的三项；完整的守卫还会检查工件类型和未知术语：

```csharp
var knownEvidence= context.AcceptedArtifacts
    .SelectMany(artifact => artifact.EvidenceRefs)
    .ToHashSet(StringComparer.Ordinal);

var unknownEvidence= candidate.EvidenceRefs
    .Where(id => !knownEvidence.Contains(id))
    .ToArray();
```

```csharp
var lostUnresolved= context.Unresolved
    .Except(
        candidate.Unresolved,
        StringComparer.Ordinal)
    .ToArray();

var forbiddenDecisions= metadata.DecisionTypes
    .Intersect(
        context.ProhibitedDecisionTypes,
        StringComparer.Ordinal)
    .ToArray();
```

*表 11.1* 列出了各项检查及其守护的边界。每一行都是对比声明的事实，因此没有任何一项需要守卫去解释自然语言形式的领域文本。

| 问题代码 (Issue code) | 比对项 | 确定性依据 |
|---|---|---|
| wrong-artifact-kind | candidate.Kind 对比 stage.CandidateKind | 当前阶段明确声明了一个预期的工件类型。 |
| unknown-evidence | candidate.EvidenceRefs 对比已验收证据链 | 证据标识符要么存在于所提供的集合中，要么不存在。 |
| dropped-unresolved | context.Unresolved 对比 candidate.Unresolved | 守卫仅计算两个集合的差集。 |
| unapproved-term | metadata.Terms 对比 context.ApprovedTerms，且 policy.MayIntroduceNewTerms 为 false | 策略显式决定了是否允许提议新术语。 |
| prohibited-decision | metadata.DecisionTypes 对比 context.ProhibitedDecisionTypes | 契约明确列出了当前专家智能体被剥夺的决策类型。 |

*表 11.1 – 五项机械对齐检查及其各自守护的边界*

最后一项检查需要作一点说明。守卫并不会去检查来自*第 9 章*工件中的历史 `decision_owner` 字段，并试图去推测该字段的含义。

*第 9 章*记录了其原因：该字段原本被定义为决策权，但 9.4 节的契约却用它来标识领域事件的原因参与者（Causal Actor），并且该输出仅作为运行证据予以保留，而未被重复使用。因此，机械对齐依赖的是针对当前转换所声明的显式决策权，而不是对历史证据进行静默的标准化归一。

守卫可以证实候选方案是否篡改了工件类型、引用了未知证据、遗漏了 ES-17，或者声明了被禁止的决策。而关于语义层面的问题——两个短语是否等价，或者某种观察现象是否已被升格为既定策略——则始终属于授权审查员的审查范畴。

### 暴露语义偏离而不擅自解决

假设 Storyteller 接收到了已验收的材料，其中 set aside（留出）、hold（保留）和 earmark（专款/专物专用）同时并存，但尚未被确立为同义词；随后它产出了一个自洽的场景，并且全程仅使用了 reserve（预留）一词。此时工件类型与证据引用完全有效，没有任何未决标识符凭空消失，但这个新术语很可能抹平了领域内部尚未达成一致的微妙差异。编排器根本无法判定这种抽象究竟是有益的提炼，还是造成了信息的损耗。

如果盲目拒绝每一个陌生的新术语，就会阻止专家智能体为通用语言的演进做出贡献。而如果自动用另一个术语进行替换，则等于擅自认定这些概念完全等价。

更安全的替代方案是将这种差异本身表示为一个可供审查的输出：

```csharp
public sealed record SemanticDivergence(
    string Kind,
    string CandidateValue,
    string[] RelatedAcceptedValues,
    string Reason);
```

因此，具备语言感知能力的检查可以如实报告候选术语，而无需武断判定其是对是错：

```yaml
var divergence=new SemanticDivergence(
    Kind: "candidate-term",
    CandidateValue: "reserve",
    RelatedAcceptedValues:
    [
        "set aside",
        "hold",
        "earmark"
    ],
    Reason:
"The candidate introduces a term that is not " +
"part of the accepted language.");
```

在该术语获得授权审查的验收之前，它始终处于暂定状态。例如，Context Mapper 可能需要在业务部门就最佳名称达成共识之前，先行对某项职责进行命名。

工作流会将检测到的语义偏离附加在候选方案上。人工关卡可以选择采纳该解释、退回纠偏、直接拒绝，或者据此更新已验收的词汇表或决策记录。

在受控运行中，Storyteller 越过了这一边界，编排器如实记录了该偏离而不擅自修复它，随后纠偏动作被退回给 Storyteller。

## 在不扩大自主性的前提下纠正漂移

声明的规则与上报的偏离只有在工作流能够对其采取行动、且工作流本身不越权攫取其所不具备的权限的前提下，才真正具备价值。本节将通过 BrewUp 循环执行一次刻意设计的漂移场景，确保纠偏过程仅局限于产出该方案的专家智能体内部，约束重试可能改变的内容，并测试让结果始终保持可审查性的各项条件。

### 运行受控的漂移与纠偏场景

*第 10 章*中已经根据审查员自身的阅读理解将 Storyteller 候选方案进行了退回；这里的退回机制完全相同。不同之处在于引发退回的成因。已验收的事实中依然包含 ES-17：当全量库存不足时，Andrea 会拒绝该请求，而 Nadia 则会把现有的库存留出（set aside）。目前没有任何已验收的策略在两种做法之间做出抉择。

在本次运行中，我们让 Storyteller 产出一个结构合法但在语义上过于笃定的候选方案：

```text
Sales requests twelve cases but only eight are available.
Stock reserves the eight available cases and informs Sales
that the remaining quantity cannot be supplied.
```

从机械结构上看，该候选方案完全合法。它具备预期的工件类型，仅引用了提供给 Storyteller 的证据，保留了 ES-17，未声明任何被禁止的决策类型，并且是在策略明确允许专家智能体提出新术语的前提下引入了 `reserve`。在这些检查中，没有任何一项要求守卫去推测 `reserve` 的具体含义。*第 9 章*已经指出过这种特定的捏造行为：预留 8 箱正是“擅自补充源数据中未曾提供的策略”的四种表现之一。

尽管通过了所有机械检查，该候选方案却篡改了证据链的本意。一种偶然观察到的行为被升格成了库存部门（Stock）的通用行为，而从*第 8 章*实现中借用来的新术语 reserve，使得 reserve 听起来比实际情况更加成熟确定。

这种语义上的含义变更对于 Schema 校验而言是完全不可见的。在本次运行中，一个有界的语义审查器上报了潜在的偏离：

```csharp
public interface ISemanticAlignmentReviewer
{
    Task<SemanticDivergence[]> ReviewAsync(
        ArtifactEnvelope candidate,
        AlignmentContext context,
        CancellationToken cancellationToken = default);
}
```

该接口纯粹是观察性的：它既不能篡改候选方案，也不能更新已验收语言，更无法推动工作流流转。

针对 Storyteller 刻意偏离的尝试，审查器返回了两项发现：

```yaml
DIVERGENCE candidate-term
value: reserve
related accepted terms: set aside, hold, earmark
reason: the candidate introduces a more precise term
        that has not been accepted

DIVERGENCE possible-policy-inference
unresolved: ES-17
reason: one observed short-quantity practice is expressed
        as the general Stock behavior
```

人工关卡将这些发现作为审查证据链接收，而不是作为新的领域事实。生产环境中的语义审查器本身可能是生成式模型；而本次受控运行使用的是确定性的 Markdown 适配器。无论是哪种情况，审查器都只负责报告偏离，绝不能代替其他专家智能体去修复候选方案。

因此，编排循环在候选方案旁如实记录下这些偏离，并依然流转至 `AwaitingReview`（等待审查）状态。

```csharp
var assessment= await semanticReviewer.ReviewAsync(
    loop.State.Candidate!,
    storytellerAlignment);
```

```text
loop.RecordAlignmentAssessment(
    "alignment-storyteller-1",
    assessment);
```

现在，人工审查员可以同时检查候选方案、已验收的证据链以及上报的语义偏离。在这种情况下，审查员将该候选方案退回：

```text
loop.ReferCurrent(
    "refer-storyteller-alignment",
    "Do not turn Nadia's observed short-quantity practice " +
    "into the general Stock policy. Preserve both practices " +
    "and keep ES-17 unresolved.");
```

执行跟踪链路（Trace）中完整保留了引入 reserve 的候选方案、其对齐检查发现，以及阻止其向下流转的退回记录。

随后，Storyteller 基于相同的已验收输入再次运行：

```text
await loop.RunCurrentAsync(
    "run-storyteller-alignment-2");
```

经过纠偏的场景现在清晰地陈述了业务分歧，而不是擅自将其抹平：

```text
Sales requests twelve cases but only eight are available.

In one observed case, Andrea refuses the request because the
full quantity cannot be supplied.

In another, Nadia sets aside the eight available cases and
has someone call Sales.

The evidence does not establish which practice should govern
future short-quantity requests.

ES-17 is still unresolved. No new owner has been introduced. The candidate does
not claim that set aside, hold, earmark, and reserve are interchangeable terms.
```

因此，纠偏动作严格保持在产出候选方案的转换过程局部。Storyteller 修改了自己的场景；编排器、语义审查器和人工审查员各自恪守了自身的职责边界。

一项针对性的测试证实了这一边界：

```text
Assert.Equal(
    ["eventstormer", "storyteller", "storyteller"],
    runner.Invocations);

Assert.Equal(2, loop.State.Candidate!.Attempt);

Assert.Contains(
    "ES-17",
    loop.State.Candidate.Unresolved);

Assert.Contains(
    loop.AlignmentTrace,
    entry => entry.MessageId ==
        "alignment-storyteller-1");

Assert.Contains(
    "Do not turn Nadia's observed short-quantity practice",
    loop.Trace.Single(
        entry => entry.MessageId ==
            "refer-storyteller-alignment").Reason);
```

调用序列与尝试次数维护了*第 10 章*中的保证：语义发现绝不会扩大专家智能体的权限。最后三个断言是新增的——ES-17 在纠偏后完好保留、审查发现始终与引发该问题的尝试绑定在一起，且审查员的退回理由完整留存在跟踪链路中。

只有在纠偏后的候选方案通过人工关卡后，工作流才能向下推进。

这次重试仅仅改变了 Storyteller 的候选方案；它既没有篡改证据链，也没有修改治理契约、工具集或审查职责。这种清晰的分离使得下一项要求成为可能：可以在运维层面对重试加以约束，而无需扩大专家智能体的权限。

### 约束纠偏尝试次数、时间与工具访问权限

解释自由同样需要操作维度的限制。专家智能体固然可以探索多种不同的表述形式，但绝不能无休止地重试、在失败后擅自扩大工具访问权限，或者因无限制的模型调用而让工作流陷入死锁挂起。

这些限制在不干预领域含义判定的前提下对执行过程施加了约束。自主性策略中已经包含了这些限制：纠偏预算、超时与取消、工具访问权限，以及纠偏预算耗尽时的终态。

循环在再次调用专家智能体之前，会严格检查这些边界：

```csharp
if (attempt > policy.MaxCorrectionAttempts)
{
    return SpecialistExecutionResult.Stop(
        "correction-budget-exhausted",
        $"Correction budget exhausted for {policy.Specialist}.");
}

using var timeout=
    CancellationTokenSource.CreateLinkedTokenSource(
        cancellationToken);

timeout.CancelAfter(policy.Timeout);

var candidate= await runner.RunAsync(
    stage,
    input,
    attempt,
    timeout.Token)
    .ConfigureAwait(false);
```

失败的尝试绝不能拓宽边界；纠偏预算、提示词约束、工具集和专家智能体契约均保持不变。

`SpecialistToolRegistry` 在调用前同样会应用这一规则：

```csharp
public string[] Resolve(AutonomyPolicy policy)
{
    if (_availableTools is null)
        return [.. policy.AllowedTools];

    var available= _availableTools
        .ToHashSet(StringComparer.Ordinal);

    return policy.AllowedTools
        .Where(available.Contains)
        .ToArray();
}
```

如果 Storyteller 被允许审查已验收的证据链、但不允许访问生产运行系统，那么它的每一次尝试都将遵循完全相同的工具边界。退回只会改变重新运行的原因，绝不会改变专家智能体的权限。

超时只记录执行窗口的结束，并不代表对领域含义的评判。随后，工作流将根据既定策略决定终止还是重试。

耗尽的纠偏预算会产生一个显式的终止状态：

```yaml
STOPPED
specialist: storyteller
reason: correction-budget-exhausted
attempts: 2 of 2, third refused
last-candidate: preserved
last-review-reason: preserved
```

跟踪链路完好保留了失败的尝试、审查发现以及退回原因。预算耗尽会停止工作流，但绝不会篡改其决策权。

### 在不放弃对齐的前提下测试自主性

自主性测试并不会评判 Storyteller 是否产出了最优的场景，也不会判定 Context Mapper 是否找到了最佳的边界；那些属于建模评判。相反，测试旨在验证系统是否始终维护了让这些评判保持可审查性的基础条件。

一项针对性的守卫测试验证了**未决知识**（Unresolved Knowledge）绝不能凭空消失：

```csharp
[Fact]
public void UnresolvedQuestionCannotDisappear()
{
    var candidate= Candidate(
        unresolved: []);

    var issues= AlignmentGuard.Check(
        candidate,
        candidate.AlignmentMetadata!,
        StorytellerStage,
        Governance.Policy,
        Alignment);

    Assert.Contains(
        issues,
        issue =>
            issue.Code ==
            "dropped-unresolved");
}
```

该测试套件还覆盖了已验收术语、错误的工件类型、未知证据以及被禁止的决策。

语义偏离需要使用不同的断言。在已经加载了候选方案测试固件（Fixture）的情况下，针对性断言证明了审查器如实报告了 `reserve`，而没有对候选方案进行归一化或重写：

```csharp
var divergences= await reviewer.ReviewAsync(
    candidate.Artifact,
    Alignment());

var divergence= Assert.Single(
    divergences,
    item => item.Kind == "candidate-term");

Assert.Equal("reserve", divergence.CandidateValue);
Assert.Contains(
    "hold",
    divergence.RelatedAcceptedValues);
Assert.Equal(before, after);
Assert.Contains("Stock reserves", candidate.Text);
```

最后的断言对比了审查前后的文件内容，确认原始候选方案的措辞被完整保留。

策略推断测试将相同的边界应用于 Nadia 偶然被观察到的行为。语义审查器可能会报告某种被观察到的做法已被泛化为库存部门的通用策略，但它绝不能重写候选方案，也不能武断判定哪种做法才是正确的。只有在人工退回之后，Storyteller 才会生成不同的解释。综合起来，这些测试确立了贯穿本章的三重权威边界：确定性代码强制执行声明的约束，专家智能体产出解释方案，而人工审查员决定哪些内容可以成为已验收的知识。

## 将多智能体系统作为受治理的工作流运转

各项机制现已齐备。*图 11.1* 和*图 11.2* 将它们整合在一起，综合展现了贯穿*第 9 章*、*第 10 章*和*第 11 章*构建起来的完整工作流。专家智能体负责具体的转换，确定性代码负责可强制执行的工作流与对齐规则，而人工审查员负责验收与领域决策。第二幅图补充了纠偏路径，展示了被拒绝的解释如何退回到产出它的专家智能体，而不是去擅自扩大编排器或审查员的权限。

*图 11.1 – 三重权威及其各自的权限边界*

在此，编排的价值在于保持职责边界的清晰显式。*图 11.2* 展示了跟踪链路中所记录的职责分离。

*图 11.2 – 候选方案的流向与纠偏退回的路径*

`Completed`（已完成）状态描述的是团队商定的建模流程顺利结束，而非意味着领域内的所有问题都已迎刃而解。专家智能体完成了对已验收材料的转换，必要的审查已然就绪，已验收的工件全程可追溯，且剩余的不确定性依然清晰可见。

这一关键区分也为本专栏的技术探索之旅画上了圆满的句号。我们最初使用 AI 来探索领域素材并生成候选解释方案。随后，我们让这些解释方案变得越来越具备问责性（Accountable）：首先是对齐证据链与共享语言，接着是对齐有界的专家智能体职责、显式的阶段交接、编排规则，最后是对解释自由施加受治理的约束。我们的目标从来不是赋予模型无上的权威，而是让模型的贡献发挥最大价值，同时绝不丢失对知识来源的追溯、清晰保留未决问题、明确每一次决策的制定者，并清楚阐明为什么某个工件被允许成为已验收的领域知识。

## 小结

本章通过将专家智能体的自由度转化为可审查的契约，完善了整体编排模型。`AutonomyPolicy` 约束了证据链访问、输出工件、术语体系、纠偏尝试次数、时间限制与工具调用；`AlignmentContext` 则承载了已验收工件与配置好的治理约束。在 Storyteller 的运行场景中，确定性守卫守护了预先声明的不变量，语义审查揭示了看似合理但缺乏依据的策略推断，工作流在人工验收之前于局部完成了候选方案的纠偏。

在本章中，你学到了如何：

- 在不赋予领域权威的前提下，向专家智能体授予有界的自由度。
- 利用确定性守卫防范破坏声明的不变量，并利用语义审查捕捉含义层面的变更。
- 将纠偏尝试次数、时间和工具调用严格限定在显式的运维策略之内。
- 在整个工作流中贯穿守护证据链、不确定性、决策归属与人工验收。

纵观本专栏，核心焦点已从单纯产出 AI 生成的内容，转变为守护让这些输出变得值得信赖的完整证据链条。原始观察转化为了候选事实。候选方案在跨越人工关卡后才成为被认可的已验收输入；诸如 ES-17 这样的未决问题历经多次转换依然得以保留；纠偏操作被退回给引入漂移的专家智能体；而每一项被验收的决策都能明确溯源至扎实的证据链和获得授权的人工裁决。智能体极大地加速了领域探索、转换与协作协调，但它们从未擅自获得将看似合理的推论独自升格为领域知识的特权。
