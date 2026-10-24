# 第 5 章：定义规则：教会模型运用 DDD 进行思考

在上一章中，我们借助事件风暴（EventStorming）和领域叙事（Domain Storytelling）将领域知识显式外化，并沉淀了团队在全书后续内容中将持续沿用的词汇表。我们以一条实践原则收尾：“发现（Discover）、精炼（Refine）、命名（Name）、强化（Reinforce）”这一演进序列所构建的语言，其稳定性足以在与 AI 助手的多次对话中建立信任。然而，稳定的词汇并不等同于严谨自律的推理（Disciplined Reasoning）。本章将通过引入**规则手册（Rulebook）**来弥合这一差距。

规则手册是一组简短且显式的约束条件，用于管控模型在特定限界上下文（Bounded Context）内部的推理方式。团队只需编写一次，将其与代码一同进行版本控制，并在后续的每次会话中重复使用。在实践中，它是代码仓库中与代码并存的一个文件：一份 Markdown 格式的指令文件或一小段 YAML 片段，像任何其他源文件一样被编辑和评审。它的有效性取决于具体精确度（Specificity），而非篇幅的长短或构思的巧妙。规则手册在与 AI 交互中所扮演的角色，恰如限界上下文在领域驱动设计中所起的作用：它守护语义、保全设计意图，并使输出在时间的推移中始终保持可靠。

这些约束之所以不可或缺，是因为即便大语言模型（LLM）手握清晰的词汇表，依然可能会擅自扩大业务范围、凭空捏造聚合，并模糊上下文边界。这样的大模型同样可能生成看似行云流水、实则偏离实际设计的输出。这种漂移（Drift）根源于大语言模型的工作机制：它沿着提示词所暗示的方向去填补概率上的空白。而规则手册则提前规定了模型应当如何处理这些空白。

故事始于 BrewUp 案例中一个切实的真实时刻：团队猛然发觉，AI 助手完全可以生成表面上极具 DDD 规范的输出，背地里却存在隐秘的错误（Silently Wrong）。顺着这一线索，本章将展示少量恰到好处的规则如何有效规避此类失误，以及如何将这些规则打包到可复用的容器中——即智能体（Agents）、技能（Skills）与 MCP 服务器（MCP Servers）——从而使其在一次又一次的会话中持续发挥效力。

在本章中，你将学到：

- 为什么形如“*始终如一地应用 DDD*”这种泛化的 DDD 指令无法真正约束模型，以及一个包含专用词汇、不变量（Invariants）和禁用同义词（Forbidden Synonyms）的支付（Payment）专属规则手册究竟长什么样。
- 智能体、技能和 MCP 服务器如何作为规则的三种不同容器协同运作。每个容器分别塑造不同的关注点：模型应当扮演的身份（Who）、它执行特定任务的方式（How），以及它能够查阅的受信任项目数据源（What）。
- 结构化输出预期（例如包含命名命令与事件字段的 YAML）如何将模型的推理过程转化为可供你评审、对比差异（Diff）以及复用的制品（Artifacts）。
- 团队如何通过批判与审视（Critique）不断迭代精炼规则手册，将模型的每一次隐性失误转化为一条崭新的规则，从而确保下一次能够精准拦截同类错误。

让我们从团队最初经历的那个场景起步：一个在纸面上看似完全正确的支付上下文（Payment Context）。

## 技术要求

本章所阐述的核心思想并不依赖于某一家特定的大模型或厂商。文中的示例假定你所使用的助手能够读取项目级配置文件，而不仅限于当前对话上下文。为了动手实践本章内容，你需要：

- 一款能够读取项目级指令文件的 AI 编程助手：取决于具体的工具，可以是 `CLAUDE.md`、`AGENTS.md` 或 `.github/copilot-instructions.md`。
- 支持具备明确命名且面向特定任务的过程机制——如技能（Skills）、自定义命令或助手中的等价物——如果你希望亲自运行本章后半部分的示例而非仅浏览阅读，还需要具备至少一个 MCP 服务器的访问权限。
- 一款能够编辑 Markdown 与 YAML 文件的文本编辑器。

本章中的规则手册、智能体代码片段和技能定义都刻意保持得非常精炼。它们旨在展示 DDD 约束在各个容器中呈现的具体形态，而非演示某款特定商业产品的配置细节，因此这些模式可以无缝迁移到团队所选定的任何 AI 助手之中。

## 为何规则远比提示词更重要

当 BrewUp 团队首次要求 AI 助手为支付上下文（Payment Context）建模时，其生成的输出乍看之下合情合理。返回的 YAML 包含一个 `Payment` 聚合，诸如 `Authorize`（授权）、`Capture`（扣款/捕获）和 `Refund`（退款）等符合直觉的命令，以及采用过去时态命名的事件。然而，一位资深工程师随即指出，模型悄悄捏造了一个 `Charge` 聚合，仅仅因为提示词中偶然提及了“*向客户收费（charge the customer）*”。此外，模型还生成了一条直接对“已授权（Authorized）”而非“已捕获（Captured）”的支付款项发起退款的流程。该结果语言流畅且语法严密，却在团队从未成文写下的一条领域规则上犯下了致命的隐性错误。

正是在那个瞬间，团队决定不再单纯编写提示词，而是开始编写规则。两者在文本表现上可能颇为相似，但回答的却是截然不同的问题：提示词要求模型“做什么”，而规则则约束模型“如何推演”。当模型给出的错误答案看起来“无比正确”时，这种区别就显得尤为关键。无论怎样重新措辞提示词，都无法阻拦凭空捏造出的 `Charge` 聚合，因为此前从未有人明确告知助手：`Charge` 是被严令禁用的。

这些规则无需复杂冗长即可发挥实效。一组简短且界定清晰的约束，通常就足以引导模型展开符合领域一致性的推理。真正的挑战在于“甄选”：找出能够迫使模型以领域驱动设计方式思考的最小规则集。

人们在构建这种规则手册时，很自然的一个初次尝试往往是把教科书里的 DDD 概念直接翻译成一份 Copilot 指令文件便草草了事。下面的代码片段就是此类早期尝试的一个典型缩影：

```text
Domain-Driven Design (DDD) Instructions

General Principles
- Apply Domain-Driven Design patterns consistently in all generated code
- Use the Ubiquitous Language of the domain
- Maintain a strict separation between architectural layers

Tactical Design Patterns
- Entities: Must have a unique and persistent identity
- Value Objects: Must be immutable
- Aggregates: Define the Aggregate Root and enforce invariants
- Repositories: Define interfaces in the Domain layer
```

这种检查清单看起来或许令人安心，但实际上几乎无法提供任何有效的约束。其中的每一行内容，不过是在重述助手早已在预训练数据中吸收过的通用常识。“*Apply DDD consistently*（始终如一地应用 DDD）”根本不是一条约束，而是一句美好的祈福祈愿。“*Entities have a unique identity*（实体具有唯一标识）”也是模型无需任何帮助就能倒背如流的公理定义。这份文件并没有收窄助手在你项目中可能生成的内容空间，因为它根本没有提及任何关于你项目的具体信息。无论是否加载该文件，模型的行为都毫无二致。篇幅长短并不是问题的症结所在——即使列出一份三倍长的检查清单，对模型的约束力依然微乎其微。因为它所缺失的是至关重要的具体精确度（Specificity）：即特定限界上下文独有的词汇表、不变量以及模型边界。

一份真正有价值的规则手册，必须植根于单一限界上下文的具体特征。下面展示了将这一理念应用于 BrewUp 支付上下文的实例，团队将通过代价高昂的线上生产 Bug 所换来的惨痛教训，全部凝练编码进了规则之中：

```yaml
context: Payment
vocabulary: Payment, Authorization, Capture, Refund, Settlement
forbidden_synonyms: Charge, Transaction, OrderPayment

invariants:
- Currency at authorization must equal the order currency. No conversion at
payment time.
- An authorization expires 30 minutes after issuance; capture must occur within
that window.
- Refunds are issued only against captured payments, never against authorizations.
- Partial refunds are allowed; partial captures are not.

events:
- Use past-tense names rooted in the Payment vocabulary, e.g. PaymentAuthorized,
PaymentCaptured, PaymentRefunded.
```

该片段中的每一行内容，都在实实在在地收拢助手可能生成的空间。模型绝不可能凭空捏造出 `Charge` 聚合，因为早在模型首次犯错的那一天，`Charge` 就已被列入禁用名单；模型绝不可能提议在支付环节进行货币转换，因为业务不变量明令禁止；模型也绝不可能针对仍处于授权状态的支付发起退款，因为本章开篇提及的那套错误的退款逻辑，如今已被正式沉淀为一条刚性规则。这份文件虽然更加短小精悍，其约束却无比具体精准。这正是泛化检查清单与领域规则手册之间的本质区别。

### 规则从何而来

如此具体的规则手册，乍看之下似乎必须大费周章地组织专门的工作坊才能产出。然而在 BrewUp 中，团队绝大部分的规则手册都是通过忠实记录此前遭遇过的现实问题构建起来的。这些规则绝大部分源于三大渠道：

第一个来源是**团队已经遭遇过的实际问题**。`forbidden_synonyms: Charge, Transaction, OrderPayment` 这份禁用名词列表，记录的全都是曾经在不恰当场合出现过的词汇，而非凭空猜测模型可能会捏造什么。`Charge` 之所以赫然在列，正是因为本章开篇的那次建模会话。规则中的各项不变量同样具有完全相同的出处溯源（Provenance）：每一条都是某人通过代价惨痛的踩坑教训总结得出、并记录在案以确保无人重蹈覆辙的真知。这份列表同时也是对一种合理质疑的绝佳回应——有人认为禁用同义词是在“自证其无”，穷举永远没有尽头。事实上，根本没有人需要提前枚举世间所有的错误名词；列表只需记录那些已经让团队付出过真金白银代价的词汇即可，这使其天然保持有限，且新增速度会逐渐衰减。

第二个来源是**团队业已维护的词汇表**。上一章的结尾包含一个专门的“词汇排他块（Vocabulary Exclusions Block）”——例如“*切勿使用 Order received 作为 Order submitted 的同义词*”；“*当领域事实仅仅是授权时，切勿使用 Payment completed*”——这些是在工作坊中正式研讨确立的，而非源于后期的试错摸索。这个排他块本身就是一份现成的禁用同义词清单；团队只需将其搬入规则手册中即可，完全无需另行构思。在词汇表中，只要有人费心去区分两个在常规流畅文笔下容易混用的词汇，就意味着一条规则正呼之欲出。

第三个来源是**工作坊未能解决的悬而未决问题（Open Questions）**。*第 4 章*遗留了若干未决事项——例如库存预留（Stock reservation）到底由谁掌管、在订单被确认之前必须满足哪些前置条件——每一个悬置的问题，都是模型在缺乏约束时极易凭借直觉去“脑补”合理答案的潜在漏洞。针对悬而未决的问题所制定的规则，往往不是陈述一个确凿事实，而是一条“紧急刹车”的指令：**如果概念的归属权尚不清晰，请将其列为待决问题，而不是擅自捏造规则**。

在此之后，规则将通过循环演进不断沉淀积累：将现有的规则手册提供给模型，以人类专家的领域判断力审视其返回的结果，并将每一次修正提炼为一条崭新的规则，以确保下一次能够直接拦截同类错误。本章最后一节将带领大家在订单管理（Order Management）的两次迭代中完整体验这一闭环。这正是成熟规则手册的主要成因：当一个团队经历过几次这样的循环后，他们便不再纠结于“到底该写哪些规则”，而是能够敏锐地识别并提炼出规则。

洞悉规则从何而来只是完成了一半的工作，另一半则是清晰地界定你所编写的规则属于何种类别。前面展示的支付代码片段实际上承担了三项截然不同的职责：它规定了模型可以如何命名事物、这些事物被允许如何运转，以及最终给出的答案必须呈现怎样的格式形态。

## DDD 规则手册的三层架构

一份规则手册由三个层级自底向上堆叠构建而成：**语言（Language）**、**语义（Semantics）**以及**输出结构（Output Structure）**。每一层的稳固性完全依赖于其下层的支撑。

第一层是**语言层**。模型必须始终如一地使用该限界上下文的通用语言（Ubiquitous Language），避免滑向通用的技术黑话或擅自创造的同义词。语言层在形式上类似风格约定，在实效上则扮演着坚固的护栏（Guardrail）。*第 2 章与第 3 章*揭示了其背后的作用机理：重复出现的术语会通过注意力机制自我强化，每一次强化都会收窄模型从中采样的概率分布。因此，稳定的词汇表能产生实质效用——它极大地缩减了模型可能肆意游荡的潜在语义空间。在支付规则手册中，这一层精炼为单一的一行：`forbidden_synonyms: Charge, Transaction, OrderPayment`。

第二层是**语义规则层**。这些规则向模型传达领域概念被允许如何表现与运转。例如：事件代表已经发生的事实；聚合通过其聚合根保护内部不变量；仓储（Repository）属于领域契约的一部分，即便其技术实现位于别处。缺乏了语义层，模型依然能输出行云流水般的文本，但往往会抹平或曲解真实的领域本质。支付规则中就包含这样一条规则：“*退款仅能针对已扣款的支付发起，绝不能针对已授权的支付发起*”。这条规则丝毫不涉及命名规范，它直接对系统“被允许执行什么操作”施加了硬性约束。

第三层是**输出结构层**。要求模型以 YAML 或 JSON 表达其结果，能够强迫它围绕具有明确业务内涵的分类组织答案，而非任由其自由发散抒写散文。命令、事件、聚合、策略（Policies）以及上下文边界得以变得清晰可见、便于评审且可重复利用。支付规则手册中的 `events` 块便是这一层极具代表性的微缩体现：它并没有逐一罗列事件，而是严格规定了事件必须呈现的格式形态。

本章在开篇完整展示了支付规则手册作为引子。而面对第二个案例，我们值得手握这三层认知框架，逐行深入剖析各条规则分别承担了何种职能。以下是 BrewUp 订单管理（Order Management）的极简规则手册，这也是你在本章后续内容中将持续深化的上下文：

```yaml
context: BrewUp Order Management
rules:
  - Use only the defined domain vocabulary: Order, Payment, Stock
  - An event must represent something that has already happened
  - Each successful state-changing command should produce at least one domain
event
  - Do not introduce new aggregates
output:
  format: yaml
  fields:
    - command
    - event
    - aggregate
```

对照三层架构来审视，这份文件的职责划分清晰明了。词汇约束行对应**语言层**：严格限定为这三个词汇，其余任何术语均不被接纳。关于事件、命令与聚合的规则构成了**语义层**，因为它们管束的是领域概念必须如何运转，而非其名称叫什么。输出块则属于**结构层**，它的存在使得针对同一提示词的两次运行结果能够逐行进行精准比对。

即便只是这样一组简短的约束，也足以从根本上重塑人机交互。模型不再拥有随意发挥通用解决方案的自由，它必须在划定的语言与结构边界内运作。规则手册约束的是模型“在何处展开推理”，而非泛泛地恳求它“推理得更好”。与此同时，这份文件**刻意省略的内容**同样耐人寻味：它将 `Order`、`Payment` 和 `Stock` 列为此上下文的词汇，却从未指明订单管理上下文到底真正拥有（Own）这三者中的哪一个。这种留白是深思熟虑的设计，我们在本章末尾将重新审视它——届时我们将拥有一个持久的容器来存储从批判与审视中浮现出的新规则。

这三层架构向我们揭示了**你所定义的约束属于何种类属**：语言、语义抑或输出结构。然而，它们尚未阐明这些约束究竟应当栖身于何处，以及应当如何被有效复用。这引出了下一个核心命题：智能体（Agents）、技能（Skills）与 MCP 服务器（MCP Servers）并非另一套规则手册模型，而是将这些约束落地执行的三种差异化机制。某些规则应当融入模型的常态化人设姿态，某些规则仅适用于特定的独立任务，而另一些规则则依赖于必须主动检索而非凭空推测的受信任知识。

## 智能体、技能与 MCP 服务器：DDD 护栏的三大容器

行文至此，我们此前一直将规则视为直接内嵌于提示词之中的指令。然而，随着工作流规模的扩张，这种做法将变得极难维护。下面这段提示词，是 BrewUp 团队在彻底摒弃该做法前所写的最后一个庞杂提示词：

```csharp
You are a DDD expert. Use only our ubiquitous language (Order, Payment, Stock;
never Charge or Transaction), read the workshop transcript below, extract the
domain events, keep only real business facts, drop UI actions and technical side
effects, do not invent aggregates, check docs/glossary.md before naming anything,
return YAML with command, event and aggregate fields, and mark anything you cannot
confirm as an open question.
```

从技术角度来看，这条提示词并没有语法或逻辑错误。其根本症结在于：它将角色身份、专用词汇、执行过程、输出形态以及项目知识这五种异构关注点揉碎杂糅在了一条单一指令之中。当模型给出的回答出现不易察觉的细微偏差时，你根本无从推断究竟是这五个关注点中的哪一个出了纰漏。不仅如此，它完全无法复用。当下一次建模任务需要完全相同的词汇规则但不同的执行过程时，团队往往只能复制并修改这条提示词；仅仅两周之后，团队就不得不疲于维护六七个表面相似却在暗中相互冲突的提示词。

一种更为清晰优雅的架构方案，是将这些关注点解耦拆分到具有不同生命周期的**三大容器**之中：
- **智能体（Agent）**承载模型在整个会话期间始终保持的常态化姿态（Posture）；
- **技能（Skill）**的范围更为收敛聚焦：它是一个独立的过程规程，仅在被显式调用时激活，其余时间保持休眠；
- 基于模型上下文协议（Model Context Protocol）构建的 **MCP 服务器（MCP Server）**则承担了截然不同的职能：它向模型开放可供查阅的权威项目数据源，从根本上杜绝毫无根据的凭空臆测。

作为一条极为实用的工程法则：**如果某项约束无论面对何种任务都必须始终成立，它就归属于智能体；如果某项约束仅在特定任务执行期间生效，它就归属于技能；如果某项约束依赖于当前对话上下文之外的既成事实，它就应当被置于 MCP 之后。**

尽管不同的 AI 助手产品（如 Claude、Codex 或 Copilot）在具体界面形式上各不相同，但背后的架构设计意图却高度一致：**约束概率化生成机制，使其表现更接近严谨自律的领域建模，而非漫无边际的通用文本补全**。以下内容并非这三类容器的完整配置参考手册，而是具代表性的精选切片，旨在向你展示具备 DDD 感知力的约束在各个容器中应当呈现怎样的具体形态。

### 智能体

**智能体（Agents）**运作在最高控制层级。它们界定了模型在特定交互场景下的身份、角色以及思考视角。智能体的生命周期超越了单次提示词的范畴：它规范的是整个会话周期的模型行为，而非单次一问一答的交互。在 DDD 语境下，智能体可以通过强制推行通用语言、严守限界上下文边界以及维持架构规范，来具象化扮演领域架构师的角色。智能体回答了一个最根本的问题：**在展开推理时，模型到底应该扮演何种角色？**

*图 5.1* 直观展示了这一理念：将模型塑造为一位 DDD 架构师，而非普通的通用助手。这种角色塑造至关重要，因为它在稳定具体输出之前，首先锁定了思考视角。

![图 5.1 – 智能体代表领域驱动设计（DDD）架构师](images/fig-5-1.png)

*图 5.1 – 智能体代表领域驱动设计（DDD）架构师*

具体而言，这种全局定调通常栖身于项目级指令文件中：取决于你使用的助手，可以是 `CLAUDE.md`、`AGENTS.md` 或 `.github/copilot-instructions.md`。载体容器虽有变化，设计意图却始终如一。往往只需一小段精炼的配置，便足以牢牢锚定助手在整个会话期间的行为姿态：

```markdown
## DDD Guardrails

- Act as a domain-focused software architect, not as a generic code generator.
- Use the project's ubiquitous language exactly as defined. Do not introduce
synonyms unless explicitly requested.
- Treat bounded contexts as strict semantic boundaries. Do not merge concepts
across contexts.
- Never invent aggregates, invariants, or business rules that are not supported by
the provided context.
- If domain constraints are missing, ask for clarification instead of filling gaps
with plausible assumptions.
- Prefer domain behaviors, business rules, and events over CRUD-oriented
explanations.
```

短短六行指令之所以能发挥巨大威力，是因为其中的每一行都精准预判并封堵了模型在自然状态下极易做出的潜在越界举动。模型不再仅仅被口头鼓励“听起来像个领域架构师”，而是被施加了刚性约束，防止其擅自捏造聚合、跨越限界上下文随意引入同义词，或用看似合理的业务规则来掩盖缺失的信息。

对照三层架构来审视，这个片段是对规则手册的合理重构与迁移，而非将其彻底取代。关于通用语言与限界上下文的条款构成了**语言层**；关于严禁捏造聚合以及“遇缺则问而非妄加揣测”的条款构成了**语义层**。至于**结构层**在这里则完全缺席，而这种缺席恰恰是深思熟虑的结果：智能体无法预设答案的具体形态，因为它根本无法提前获知后续究竟会迎来何种任务提问。结构层归属于另一个容器，且对应于一个更靠后的步骤：**姿态先行确立，输出规范随后跟进**。

### 技能

如果说智能体负责确立行为姿态，那么**技能（Skills）**则专注于执行单一的具体任务。它是一个具备明确命名的规程过程，在触发条件满足时由模型执行，而在不需要时保持休眠。在 DDD 工作流中，诸如从业务场景中提取领域事件、校验聚合边界、审查专业术语，或是将核心业务事实与技术副作用彻底剥离等具体操作规程，都沉淀于此。即使一个 AI 助手已被赋予了像领域架构师一样思考的人设姿态，它依然需要被告知：这个团队具体是如何提取领域事件的。技能正是为了填补这一执行断层而生的。

*图 5.2* 刻画了这一角色定位。技能充当了规则、指令以及预期输出模式的可复用容器。技能不仅指明了“做什么”，更具实用价值的是，它详尽规定了“如何做”。

![图 5.2 – 作为特定、可复用能力容器的技能](images/fig-5-2.png)

*图 5.2 – 作为特定、可复用能力容器的技能*

一个典型的技能通常短小精悍、命名清晰，并严格聚焦于某项具体的建模任务。下述示例展示了团队如何从工作坊纪要中提取领域事件，其中包含了显式的准许/禁止执行步骤以及固定的输出格式：

```yaml
---
name: extract-domain-events
description: Extract core domain events from a business scenario using DDD rules
---

## Instructions

1. Read the scenario and identify candidate events.
2. Keep only events that represent meaningful business facts.
3. Remove UI actions, technical side effects, and infrastructure reactions.
4. Use past-tense event names only.
5. Do not introduce new aggregates that are not present in the provided context.
```

```markdown
6. If two events appear to be synonyms, normalize them using the canonical
vocabulary.

## Output format

Return YAML with these fields only:
- event
- aggregate
- reason
- open_questions
```

技能的核心价值在于**可重复性（Repeatability）**。像“以 DDD 方式思考”这样泛化的指令，每次调用可能会产生千差万别的发散结果。而技能则确保每次产出的答案都恪守完全相同的输出模式（Schema），从而使团队能够将当前的运行结果与上一次进行精确的比对。正是这种可重复性，把稍纵即逝的一次性提示词，升华为一种团队可以在数月乃至数年间持续评审、版本化演进和精细打磨的坚实工程实践。

与智能体相比，二者的职责边界泾渭分明：无论面对何种任务，智能体始终守护着模型在领域层面的严谨诚实；而技能则确保每次都严格执行完全相同的操作流程并输出相同的结构。如果丢弃智能体，技能在专业词汇上便会发生漂移；如果丢弃技能，智能体在每次运行时虽然依然具备出色的领域判断力，但给出的结果格式却每次各不相同。

### MCP 服务器

智能体与技能塑造的是模型的推理方式，而 **MCP 服务器（MCP Servers）**改变的则是模型用以推理的素材基底。该协议由 Anthropic 于 2024 年底推出，是一项通过单一且统一的接口将 AI 助手与自身对话之外的外部数据源连接起来的开放标准。MCP 服务器就是这样一个数据源，它在团队制定的规则管控下暴露给模型：包括助手可以调用的工具、可以查阅的文档，以及可以依凭的项目制品。在 DDD 工作中，一旦人机交互开始依赖于那些绝不应由通用预训练数据凭空推测的领域知识（如权威词汇表、事件风暴导出成果、上下文映射图、架构决策记录 ADR 等），MCP 的价值就会立刻凸显。通过将对话牢牢锚定在真实的项目资料上，MCP 服务器使“*词汇表里究竟是怎么定义的？*”这一问题，从模型“凭概率推测回答”转变成了“通过确定性查表检索（Lookup）回答”。

*图 5.3* 展现了这种能力的延展。MCP 允许模型突破眼前提示词的局限，与外部系统以及经验证的权威知识源展开交互。MCP 并未消除对规则的需求，但它将这些规则深深扎根于实际的项目素材之中。

![图 5.3 – MCP 允许与外部系统进行通信](images/fig-5-3.png)

*图 5.3 – MCP 允许与外部系统进行通信*

一份 MCP 配置通常会声明少量的工具，以及助手应当在何种条件下查阅这些工具。由于 MCP 依然是一项处于动态演进中的规范，因此阅读以下片段时请重在把握其架构设计意图，而非纠结于当前具体的 Schema 语法细节；最权威的版本始终以官方规范为准。该示例向模型开放了三个受信任的数据源——即词汇表、上下文映射图以及经验证的工作坊纪要——并对其使用方式施加了明确约束：

```yaml
tools:
  - name: glossary.lookup
    description: Returns canonical domain terms and forbidden synonyms
  - name: contextmap.get
    description: Returns bounded contexts and allowed relationships
  - name: eventstorming.search
    description: Searches validated workshop events and notes

usage_rules:
  - Always check glossary.lookup before normalizing domain terminology.
  - Use contextmap.get before suggesting interactions across bounded contexts.
```

```text
  - If an event is not found in the validated workshop material, mark it as
proposed, not confirmed.
```

此处的根本转变在于**模型应对不确定性（Uncertainty）的方式**。在缺乏 MCP 支持的情况下，助手往往要么言之凿凿地给出看似合理的臆想答案，要么索性直接拒绝作答。而借助 MCP，助手不仅能对照词汇表精准核对术语，还能检索候选事件是否确实出现在经验证的工作坊记录中；对于任何未经证实的内容，它能主动将其标记为“建议提议（Proposed）”而非“已确认（Confirmed）”。这种事实扎根（Grounding）机制，能够将缺乏依据的主观臆测，从一种隐蔽的潜在失误，转化为建模团队清晰可查、便于评审的显式信号。

当然，MCP 自身并不会替人类做决策。词汇表查询能返回规范的标准术语，但它无法替你决定该术语究竟是否应当归属于当前的限界上下文。扎根机制减少了模型靠“瞎猜”填补空白的必要性，而最终的裁量权，依然交由智能体所维系的思考姿态以及团队人类专家的严格评审来把关。

三大容器各司其职：**智能体锁定了模型“是谁”（Who），技能规范了模型“如何工作”（How），而 MCP 则锚定了模型“知道什么”（What）**。它们各自孤立存在时均显不足，但一旦协同运作，便能彻底取代脆弱单薄的单一提示词，构建出一个高度结构化的受控环境，让模型能够在团队划定的严密边界内进行理性推理。

在实际工程落地中，三者的边界有时并非泾渭分明，一条规则往往合理地同时横跨两处。例如，“*严禁擅自捏造聚合*”本质上是一种思考姿态，因此天然归属于智能体；然而，事件提取技能同样迫切需要重申这一约束，因为在该任务场景下，模型捏造聚合的冲动最为强烈。BrewUp 团队总结出了一条经验法则：**一条规则应当只编写一次，并优先置于足以容纳它的最宽泛容器之中；仅当更窄的容器确实需要在此处施加更严格的限制时，才允许进行针对性的收紧重申**。如果在技能中一字不差地机械照搬智能体的规则，只会埋下日后产生概念漂移的冗余隐患；但如果技能是为了特定任务对智能体的全局姿态进行进一步的加固收紧，那这恰恰完美契合了技能的核心价值。三层架构始终是规则手册的概念基石，而智能体、技能与 MCP 服务器，则不过是为其语言、语义和输出结构约束提供了三种各具侧重的工程落地途径。

## 迭代迈向自洽统一的领域词汇

至此，规则手册已不再是一组抽象的静态说明，它已蜕变为团队可以针对实际建模输出进行真实检验的有效利器。实际的工作流十分简洁明快：**使用当前的规则集运行模型，审视其对与错，随后将修正意见沉淀为一条崭新的规则**。

让我们来看 BrewUp 订单管理（Order Management）上下文的第二次迭代。在仅提供前述规则手册而未附带任何其他额外信息的情况下，GPT-5.6 Sol 于 2026 年 9 月 10 日在一个未配置系统提示词且推理级别设为高（High）的崭新对话中，返回了如下内容：

```yaml
- command: PlaceOrder
  event: OrderPlaced
  aggregate: Order
- command: CompletePayment
  event: PaymentCompleted
  aggregate: Payment
- command: ReserveStock
  event: StockReserved
  aggregate: Stock
- command: ConfirmOrder
  event: OrderConfirmed
  aggregate: Order
```

这一输出已经显著优于泛化的平庸回答：它熟练地运用了领域语言，生成了过去时态的事件，并将结果严格组织在便于评审的清晰结构之中。然而，它远未达到最终标准。仅仅做到“看似合理”对于严肃的架构设计而言还远远不够。团队在此处获得的真正收获，是一个足够具体、便于深度剖析的初稿，以及在剖析过程中自然浮现出的更为犀利的领域本质问题。

如果对照限界上下文边界来审视，这份初稿恰恰暴露出规则手册本意要严防死守的根本问题：在一份本该专属于订单管理的建模文件中，`PaymentCompleted` 却被归因于一个 `Payment` 聚合，而 `StockReserved` 则被归因于一个 `Stock` 聚合。规则手册明明要求“不得引入新聚合”，可这里却硬生生地冒出了两个额外的聚合。模型并没有凭空编造名称：`Payment` 和 `Stock` 确实都赫然列在词汇行中。然而，模型却错误地将该上下文仅仅“引用”到的外部概念，直接跃升为了本上下文所“拥有”的核心聚合。事实上，`Payment` 归属于支付上下文，而 `Stock` 则属于*第 4 章*中界定的仓储职责；订单管理上下文仅仅是接收关于它们的事件通知而已。一旦订单管理把它们纳为己有，就意味着模型在暗地里悄无声息地击穿并瓦解了限界上下文的边界。这里的语言表述看似无懈可击，但**所有权归属（Ownership）**却彻底颠倒混乱。这种隐蔽的致命错误，正是流畅表达的大语言模型极易掩盖的盲区，除非有严谨的规则手册强行迫使这种边界区隔显性化。

在这份输出中还隐藏着一个稍小却同样关键的疏漏：*第 4 章*的工作坊最终敲定采用的术语是 `Order submitted`（订单已提交），而模型却输出了 `OrderPlaced`（订单已下单）。词汇行明确定义了 `Order`、`Payment` 和 `Stock`，却未对事件的具体命名做出硬性规范，于是模型便顺理成章地自作主张。在一个专门探讨“禁用同义词”的章节中，这一疏忽本身就是最生动的一堂课。

因此，下一阶段的规则绝非空中楼阁，它们全部精准脱胎于上述的批判性审视：

```text
- Order Management owns the Order aggregate only.
- Payment and Stock are external concepts for this context.
- Events produced by other bounded contexts must be marked as external inputs.
- Do not treat external events as internal state changes.
- Use the canonical event names from the glossary: OrderSubmitted,
OrderConfirmed, OrderCancelled.
- If ownership is unclear, add an open question instead of inventing a rule.
```

将这批崭新的规则注入之后，我们在全新的会话中发起完全相同的请求，模型给出了如下答卷：

```yaml
owned_aggregate: Order
command:
  - Submit Order
  - Confirm Order
  - Cancel Order
internal_event:
  - OrderSubmitted
  - OrderConfirmed
  - OrderCancelled
external_input:
  - Payment
  - Stock
policy:
  - After OrderSubmitted, Payment and Stock are external inputs.
  - Confirm Order only after Payment and Stock indicate success.
  - Confirm Order produces OrderConfirmed.
  - Cancel Order produces OrderCancelled.
open_question:
  - What are the canonical external event names from Payment and Stock?
  - Should an unsuccessful Payment or Stock cause Cancel Order?
```

对照最初的草案，这里发生了三大实质性的蜕变：
1. `Order` 成为该文件所声称拥有的唯一聚合；
2. `Payment` 和 `Stock` 被整齐归入 `external_input`（外部输入）分类之下；
3. 事件名称精准契合词汇表的权威规范，而非听任模型的主观偏好。

其中的 `open_question`（待决问题）部分尤为亮眼：模型不再擅自为那些不属于自己管辖的事件妄加命名，而是主动反问支付与库存上下文到底是如何称呼这些外部事件的。关于“权属不明即提出疑问”的规则正在切实生效。

与此同时，有两个细节尚待完善：由于规则手册只锁定了权威事件命名，未对命令（Commands）做出硬性命名格式约束，因此命令以包含空格的 `Submit Order` 形式呈现，而非驼峰式的 `SubmitOrder`；此外，正如模型自身提出的疑问，`external_input` 目前仅列出了两个上下文名称，而非具体的两个事件。这两项细节自然成为了下一次迭代的输入素材，生动诠释了一份“活的规则手册（Living Rulebook）”是如何在实战中持续演化生长的。

这正是本章通篇致力于构建的实战闭环：**你绝不要向模型索要最终答案，而是要求其提供一份结构化的初稿，运用 DDD 专业判断力对其进行严厉批判，随后将这些审视批评提炼为一条崭新的规则**。随着时间的推移，规则手册将逐渐蜕变为领域知识的生动活态记录：一套短小精悍的刚性约束，忠实地捍卫着通用词汇、所有权边界、上下文隔离以及核心业务不变量。

当规则足够精准、短小精炼并经历持续的打磨迭代时，AI 助手便能始终如一地在团队设定的领域边界内高效协同。

## 小结

在本章中，我们完成了从稳定的领域词汇向严谨自律的理性推理的跨越。我们见证了这样一个事实：即便拥有清晰的通用语言，大语言模型依然能够生成行云流水、却在深层上公然违背既有架构设计的产物。最有效的抵御之道绝非单纯雕琢更好的提示词，而是构建一组短小精悍的规则，刚性约束模型在单一限界上下文内部的推演方式。

BrewUp 支付案例中模型悄然捏造 `Charge` 聚合的那一幕，让泛化指令的惨痛代价变得具象可见。一份照本宣科的教科书式 DDD 检查清单对于防范此类失误毫无助益，因为它对具体项目的情况只字未提。相反，一份针对支付上下文量身定制的精炼规则手册，则通过禁用同义词、货币一致性不变量以及退款前置条件，极大地收紧了模型可能探索的潜在空间。**规则唯有使用特定上下文的语言发声，才能真正彰显其不可替代的工程价值。**

在本章中，你学到了：

- 一份实用的规则手册始于某个特定限界上下文的专用词汇、业务不变量以及上下文边界。教科书式的通用定义听起来严密，实际上却收效甚微，因为模型早已在预训练中习得了这些概念。
- 任何规则手册都可以从三层架构进行审视：**语言层**规范模型如何命名事物，**语义层**规定这些事物被允许如何运转，而**结构层**则硬性约束答案必须呈现的形态。支付规则文件仅用区区十几行代码便同时兼顾了这三层。
- 智能体、技能与 MCP 服务器是承载规则的三大差异化容器。智能体锁定了模型在推理时应当扮演的身份（Who）；技能规范了特定建模任务的具体执行方式（How）；而 MCP 服务器则在明确的规则约束下，向助手暴露其可以查阅的权威受信任项目数据源（What）。
- 结构化输出能够充当有效的护栏，使模型的推理更易于评审与对比。要求模型以包含命名命令、事件和聚合字段的 YAML 格式输出，能够让其推理过程变得透明可审、跨迭代可比，并便于在后续的建模工作中直接复用。
- 规则手册是在持续的批判与审视中迭代沉淀的。第一批规则往往脱胎于团队曾付出过惨痛代价的真实 Bug、既有的词汇表，以及工作坊中遗留的待决问题。其余的规则，则是在持续运行模型、敏锐捕捉其在何处暗中击穿了限界上下文，并将每一次修正意见提炼为新规则的循环中逐步丰满起来的。

在下一章中，你将从“定义规则”迈向“在限界上下文的迭代精炼中应用规则”。你将看到团队与助手之间的反馈循环如何逐步将事件、命令、聚合与策略打磨成自洽连贯的架构设计，并以**命令查询职责分离（CQRS）**为透镜，围绕清晰的命令与查询职责来高效组织模型的深度推理。

## 参考文献

- Anthropic (2024). Model Context Protocol specification. <https://modelcontextprotocol.io/> (accessed September 2026).
