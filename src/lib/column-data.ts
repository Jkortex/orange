import { getCollection } from './content.ts'

export type ChapterItem = {
  order: number
  chapterNumber: string
  slug: string
  title: string
  description: string
  phase: string
  tags: string[]
}

export type ColumnStatus = 'completed' | 'updating' | 'planned'

export type ColumnInfo = {
  id: string
  title: string
  subtitle: string
  badge: string
  status: ColumnStatus
  statusText: string
  totalArticles: number
  category: string
  tags: string[]
  updatedAt: string
  description: string
  /** 专栏定位标签（列表页与详情页的 chip），缺省为「全栈实践」 */
  focus?: string
  highlights: { title: string; desc: string }[]
  phases: {
    name: string
    description: string
    chapters: ChapterItem[]
  }[]
}

export type PlannedColumn = {
  id: string
  title: string
  subtitle: string
  badge: string
  statusText: string
  description: string
  estimatedChapters: number
  tags: string[]
}

export const DISTRIBUTED_GO_COLUMN: ColumnInfo = {
  id: 'distributed-go',
  title: '《Go 云原生分布式系统实战》',
  subtitle: '从单机并发到微服务集群，覆盖现代 Go 分布式系统设计与工程落地全链路',
  badge: '精品专栏 · 17 篇全景实战',
  status: 'completed',
  statusText: '17 篇已完结',
  totalArticles: 17,
  category: 'distributed-systems',
  tags: ['Go', '分布式系统', '微服务', 'Kafka', 'gRPC', '云原生'],
  updatedAt: '2026-10-18',
  description:
    '深入剖析现代云原生环境下构建高弹性、高可用分布式系统的工程法则与设计模式。避开脱离实际的抽象理论，从 Go 运行时并发原语与背压开始，层层递进覆盖 HTTP 中间件链、跨服务 ES256+JWKS 鉴权、数据库零停机迁移、Context 超时预算收窄、Kafka 账本模型、gRPC 契约与三态断路器、分布式事务与 Saga 逆序补偿、OpenTelemetry 全链路追踪，直至端到端完整落地包含 7 大微服务的电商订单系统。',
  highlights: [
    {
      title: '并发模型与基石',
      desc: 'Goroutine 生命周期、有界背压控制、WorkerPool 线程池、select 多路复用与优雅关机。',
    },
    {
      title: '网络通信与契约',
      desc: 'Go 1.22 原生增强路由、洋葱模型中间件、ES256+JWKS 鉴权与 NATS/Kafka 账本模型。',
    },
    {
      title: '容错编排与一致性',
      desc: 'gRPC 三态熔断、errgroup 并发扇出与优雅降级、幂等键校验及 Saga 逆序自动补偿。',
    },
    {
      title: '生产级工程闭环',
      desc: 'Expand-Contract 零停机平滑迁移、OTel 全链路追踪、Testcontainers 混沌注入与电商微服务实战。',
    },
  ],
  phases: [
    {
      name: '阶段一：分布式思维与并发基石',
      description: '理解单机极限与分布式协同成本，掌握 Go 并发原语与生命周期治理。',
      chapters: [
        {
          order: 0,
          chapterNumber: '导读',
          slug: '2026-10-18-distributed-go-00-preface',
          title: 'Go 分布式系统实战（导读）：云原生架构演进与全景概览',
          description:
            '探讨云原生分布式架构的设计哲学、从单机到微服务的工程鸿沟，以及专栏技术选型与权衡（slog、pgx、原生路由与 franz-go）。',
          phase: '阶段一：分布式思维与并发基石',
          tags: ['Go', '分布式系统', '云原生', '架构设计'],
        },
        {
          order: 1,
          chapterNumber: '第 01 篇',
          slug: '2026-10-18-distributed-go-01-why-distributed',
          title: 'Go 分布式系统实战（一）：为什么需要分布式？协同的成本与单机极限',
          description:
            '深入分析单机并发物理极限与单点故障，解析分布式系统的网络延迟、部分失败以及 CAP 定理在实际工程中的权衡与代价。',
          phase: '阶段一：分布式思维与并发基石',
          tags: ['Go', '分布式系统', '高可用', '架构设计'],
        },
        {
          order: 2,
          chapterNumber: '第 02 篇',
          slug: '2026-10-18-distributed-go-02-concurrency',
          title: 'Go 分布式系统实战（二）：并发即微缩分布式系统：Goroutine、Channel 与工作池',
          description:
            '揭示 Go 运行时并发原语与分布式概念的镜像关系，详解 Goroutine 生命周期、有界通道背压、select 超时及生产级 WorkerPool 与优雅关机。',
          phase: '阶段一：分布式思维与并发基石',
          tags: ['Go', '并发编程', 'Goroutine', 'Channel', 'WorkerPool'],
        },
      ],
    },
    {
      name: '阶段二：通信契约与服务网关',
      description: '异步消息队列与 HTTP 中间件体系构建，打通服务间通信与无状态鉴权。',
      chapters: [
        {
          order: 3,
          chapterNumber: '第 03 篇',
          slug: '2026-10-18-distributed-go-03-two-services-one-queue',
          title: 'Go 分布式系统实战（三）：两个服务一条队列：HTTP 同步 vs 异步选型与 NATS 实战',
          description:
            '对比 HTTP 同步阻塞与消息队列异步解耦的延迟与容灾，基于 NATS Core 落地发布/订阅与队列工作组，实现故障隔离与水平扩容。',
          phase: '阶段二：通信契约与服务网关',
          tags: ['Go', '消息队列', 'NATS', '微服务', '异步架构'],
        },
        {
          order: 4,
          chapterNumber: '第 04 篇',
          slug: '2026-10-18-distributed-go-04-http-middleware',
          title: 'Go 分布式系统实战（四）：HTTP 服务与中间件链路：Go 1.22 原生路由与核心中间件',
          description:
            '基于 Go 1.22 net/http 增强路由构建洋葱模型中间件链，实现 Panic 恢复、Request ID 透传、slog 日志、连接排空与探针契约。',
          phase: '阶段二：通信契约与服务网关',
          tags: ['Go', 'HTTP', '中间件', 'Web服务', 'Go1.22'],
        },
        {
          order: 5,
          chapterNumber: '第 05 篇',
          slug: '2026-10-18-distributed-go-05-auth-jwt',
          title: 'Go 分布式系统实战（五）：跨服务认证与 JWT 鉴权：无状态验证与 JWKS 动态轮换',
          description:
            '剖析分布式鉴权架构演进，采用 ES256 非对称算法、JWKS 公钥分发实现零停机密钥轮换，结合 Hub-and-Spoke 代理与 Scope 鉴权。',
          phase: '阶段二：通信契约与服务网关',
          tags: ['Go', '认证鉴权', 'JWT', 'JWKS', '安全架构'],
        },
      ],
    },
    {
      name: '阶段三：数据隔离与全链路治理',
      description: '从数据库隔离与零停机迁移，到 Kafka 持久化账本与 gRPC 容错断路器。',
      chapters: [
        {
          order: 6,
          chapterNumber: '第 06 篇',
          slug: '2026-10-18-distributed-go-06-database-migrations',
          title: 'Go 分布式系统实战（六）：数据库访问与平滑迁移：连接池调优与 Expand-Contract 模式',
          description:
            '坚守一服务一库隔离原则，调优 pgx 连接池与 PgBouncer 架构，通过仓储模式、sqlc 类型安全生成与 Expand-Contract 模式实现零停机数据库迁移。',
          phase: '阶段三：数据隔离与全链路治理',
          tags: ['Go', 'PostgreSQL', '数据库', '数据迁移', 'pgx'],
        },
        {
          order: 7,
          chapterNumber: '第 07 篇',
          slug: '2026-10-18-distributed-go-07-context-propagation',
          title: 'Go 分布式系统实战（七）：Context 贯穿全链路：超时预算收窄与生命周期避坑',
          description:
            '深入探讨 Context 树传播机制，解决客户端断开导致的后台空转，剖析超时预算递减收窄策略与 6 大反模式规避法则。',
          phase: '阶段三：数据隔离与全链路治理',
          tags: ['Go', 'Context', '超时控制', '全链路追踪', '并发控制'],
        },
        {
          order: 8,
          chapterNumber: '第 08 篇',
          slug: '2026-10-18-distributed-go-08-kafka-queues',
          title: 'Go 分布式系统实战（八）：深入消息队列：Kafka 账本模型、背压控制与消费者组',
          description:
            '对比 NATS 内存邮箱与 Kafka 分布式持久化账本，基于 franz-go 纯 Go 客户端实现显式背压、增量协同重平衡与死信队列（DLQ）。',
          phase: '阶段三：数据隔离与全链路治理',
          tags: ['Go', 'Kafka', '消息队列', '消费者组', '背压机制'],
        },
        {
          order: 9,
          chapterNumber: '第 09 篇',
          slug: '2026-10-18-distributed-go-09-grpc-circuit-breaker',
          title: 'Go 分布式系统实战（九）：服务间 RPC：gRPC、Protobuf 契约与断路器容错',
          description:
            '解析 gRPC 高性能二进制契约，结合 buf 工具链、双重 API 模式（管理面 vs 消费面），实现指数退避重试与三态断路器状态机。',
          phase: '阶段三：数据隔离与全链路治理',
          tags: ['Go', 'gRPC', 'Protobuf', '断路器', '微服务'],
        },
        {
          order: 10,
          chapterNumber: '第 10 篇',
          slug: '2026-10-18-distributed-go-10-orchestration-fan-out',
          title: 'Go 分布式系统实战（十）：并行编排与扇出调用：errgroup 并发控制与优雅降级',
          description:
            '打破串行调用延迟瓶颈，使用 errgroup 实施扇出并发请求与 SetLimit 背压控制，实现快速失败与非核心依赖显式降级（BestEffort）。',
          phase: '阶段三：数据隔离与全链路治理',
          tags: ['Go', '并发编排', 'errgroup', '服务降级', '微服务'],
        },
      ],
    },
    {
      name: '阶段四：一致性保障与工程闭环',
      description: '攻克分布式事务与幂等挑战，构建现代可观测性三支柱与混沌测试防护网。',
      chapters: [
        {
          order: 11,
          chapterNumber: '第 11 篇',
          slug: '2026-10-18-distributed-go-11-consistency-in-practice',
          title: 'Go 分布式系统实战（十一）：分布式一致性实战：幂等键、乐观锁与 Saga 逆序补偿',
          description:
            '应对跨网络双写困境与最终一致性需求，构建幂等键校验中间件、乐观锁版本号并发控制、Saga 编排器逆序补偿与事务发件箱模式。',
          phase: '阶段四：一致性保障与工程闭环',
          tags: ['Go', '分布式事务', 'Saga', '一致性', '幂等设计'],
        },
        {
          order: 12,
          chapterNumber: '第 12 篇',
          slug: '2026-10-18-distributed-go-12-observability',
          title: 'Go 分布式系统实战（十二）：可观测性：结构化日志、Prometheus 指标与 OTel 追踪',
          description:
            '构建现代可观测性三大支柱：log/slog 结构化日志、Prometheus 避免高基数指标埋点，以及基于 OpenTelemetry 的跨进程全链路追踪闭环。',
          phase: '阶段四：一致性保障与工程闭环',
          tags: ['Go', '可观测性', 'OpenTelemetry', 'Prometheus', 'slog'],
        },
        {
          order: 13,
          chapterNumber: '第 13 篇',
          slug: '2026-10-18-distributed-go-13-testing-distributed-systems',
          title: 'Go 分布式系统实战（十三）：分布式系统测试：测试金字塔、Testcontainers 与混沌注入',
          description:
            '搭建生产级测试金字塔，利用 Testcontainers 启动真实基础设施、结合 -race 检测、手写 Fake 故障注入、混沌测试与协程泄露排查。',
          phase: '阶段四：一致性保障与工程闭环',
          tags: ['Go', '自动化测试', 'Testcontainers', '混沌工程', '集成测试'],
        },
        {
          order: 14,
          chapterNumber: '第 14 篇',
          slug: '2026-10-18-distributed-go-14-config-and-secrets',
          title: 'Go 分布式系统实战（十四）：配置与密钥管理：12-Factor 原则与原子指针动态热重载',
          description:
            '践行云原生 12-Factor 配置原则，区分 ConfigMap 与 Secret，实现敏感信息脱敏日志，并通过 atomic.Pointer 与 SIGHUP 信号完成动态热重载。',
          phase: '阶段四：一致性保障与工程闭环',
          tags: ['Go', '配置管理', '云原生', '安全', '12-Factor'],
        },
      ],
    },
    {
      name: '阶段五：综合实战与速查附录',
      description: '贯通全部核心模式落地电商微服务系统，沉淀并发速查与生产 CLI 运维工具。',
      chapters: [
        {
          order: 15,
          chapterNumber: '第 15 篇',
          slug: '2026-10-18-distributed-go-15-capstone-complete-system',
          title: 'Go 分布式系统实战（十五）：终极实战：OrderFlow 电商订单微服务系统端到端落地',
          description:
            '将全专栏核心模式融会贯通，落地包含 7 个微服务组件的 OrderFlow 电商全系统，涵盖 Mini-Saga 补偿、自适应服务发现与生产环境加固。',
          phase: '阶段五：综合实战与速查附录',
          tags: ['Go', '微服务', '电商系统', '架构实战', 'Docker'],
        },
        {
          order: 16,
          chapterNumber: '第 16 篇',
          slug: '2026-10-18-distributed-go-16-appendices',
          title: 'Go 分布式系统实战（十六）：附录全景：并发速查、存储抽象与运维 CLI 工具链',
          description:
            '汇总 Go 并发核心原语速查手册、文件与对象存储抽象（S3 与本地目录穿越防护）、基于 Cobra 与 Bubbletea 的运维 CLI 工具链及核心术语表。',
          phase: '阶段五：综合实战与速查附录',
          tags: ['Go', '并发速查', 'CLI', '存储抽象', '术语表'],
        },
      ],
    },
  ],
}

export const AI_DDD_COLUMN: ColumnInfo = {
  id: 'ai-ddd',
  title: '《AI 增强的领域驱动设计》',
  subtitle: '用大语言模型、结构化提示词与多智能体工作流，把领域建模升级为可执行的控制平面',
  badge: '精品专栏 · 12 篇全景实战',
  status: 'completed',
  statusText: '12 篇已完结',
  totalArticles: 12,
  category: 'domain-driven-design',
  tags: ['DDD', '领域驱动设计', '大语言模型', '多智能体', '提示词工程', '架构设计'],
  updatedAt: '2026-10-21',
  focus: '领域建模',
  description:
    '一套把 AI 纳入领域设计推理闭环的完整方法论。先建立大语言模型的心智模型：分词、统计预测与上下文窗口的运作机制，解释精准语言为何能解锁理解力；再以事件风暴衔接人类业务洞察，沉淀提示词规则手册，用反馈闭环精炼事件、命令与聚合，最终收敛出高内聚的限界上下文；最后把提示词升级为专家智能体，用编排器、类型化消息、合法状态转换与人工关卡搭建可执行控制平面，并让知识出处、不确定性与概念漂移在受治理的自主性中始终可见。',
  highlights: [
    {
      title: '心智模型与认知负荷',
      desc: '分词、统计预测、上下文窗口与涌现推理的运作机制，及其对领域建模精确性的决定性影响。',
    },
    {
      title: '领域探索与规则手册',
      desc: '以事件风暴与故事叙述衔接人类洞察，用可复用的提示词规则手册教会模型按 DDD 的方式思考。',
    },
    {
      title: '限界上下文与领域载体',
      desc: '以反馈闭环精炼事件、命令与聚合，把领域知识固化进提示词这一持久载体，形成活文档。',
    },
    {
      title: '智能体编排与治理',
      desc: '专家智能体契约、编排器控制平面与漂移纠正，让 AI 的自主性、证据链与人工验收始终可审查。',
    },
  ],
  phases: [
    {
      name: '阶段一：AI 简要回顾与大语言模型的工作原理',
      description:
        '建立对现代 AI 与大语言模型能力与局限的准确心智模型，并自信地运用它们辅助架构设计工作。',
      chapters: [
        {
          order: 0,
          chapterNumber: '导读',
          slug: '2026-10-21-ai-ddd-00-guide',
          title: 'AI 增强的领域驱动设计（导读）：为什么需要 AI 辅助的领域建模，以及如何使用本专栏',
          description:
            '说明 AI 进入领域建模的三个动因，给出三大阶段的学习路线、贯穿全专栏的 BrewUp 示例系统、动手实验约定与统一术语说明。',
          phase: '阶段一：AI 简要回顾与大语言模型的工作原理',
          tags: ['DDD', '领域驱动设计', '大语言模型', '学习指南'],
        },
        {
          order: 1,
          chapterNumber: '第 01 篇',
          slug: '2026-10-21-ai-ddd-01-why-ai-matters',
          title: 'AI 增强的领域驱动设计（一）：为何 AI 对当今的领域驱动设计至关重要',
          description:
            '剖析领域复杂度攀升、认知过载与传统建模实践的瓶颈，明确 AI 是认知放大器而非全自动替代品，并给出架构师日常工作流的改造路径。',
          phase: '阶段一：AI 简要回顾与大语言模型的工作原理',
          tags: ['DDD', '领域驱动设计', '认知负荷', '架构设计'],
        },
        {
          order: 2,
          chapterNumber: '第 02 篇',
          slug: '2026-10-21-ai-ddd-02-how-llms-think',
          title: 'AI 增强的领域驱动设计（二）：大语言模型到底如何“思考”，以及为何精准性能够解锁理解力',
          description:
            '深入剖析分词机制、统计预测、上下文窗口与涌现推理及其认知盲区，揭示精准的语言与结构化指令如何弥补模型内在局限。',
          phase: '阶段一：AI 简要回顾与大语言模型的工作原理',
          tags: ['大语言模型', '分词', '上下文窗口', '提示词工程'],
        },
        {
          order: 3,
          chapterNumber: '第 03 篇',
          slug: '2026-10-21-ai-ddd-03-architects-view',
          title: 'AI 增强的领域驱动设计（三）：架构师视角：与 AI 系统协同推理',
          description:
            '把 AI 重新定义为在显式概念边界内协作的推理伙伴，将架构思维应用于对话、信息流、共享词汇、约束与职责划分之中。',
          phase: '阶段一：AI 简要回顾与大语言模型的工作原理',
          tags: ['架构设计', '提示词工程', '上下文工程', 'DDD'],
        },
      ],
    },
    {
      name: '阶段二：通过简单规则与提示词将 AI 应用于 DDD',
      description:
        '借助规则、提示词与迭代精炼开展领域建模，产出自洽连贯的事件、命令、聚合与限界上下文。',
      chapters: [
        {
          order: 4,
          chapterNumber: '第 04 篇',
          slug: '2026-10-21-ai-ddd-04-domain-exploration',
          title: 'AI 增强的领域驱动设计（四）：从领域探索到 AI 协作',
          description:
            '以事件风暴与领域故事叙述为桥梁，将发散式的业务探索转化为结构化上下文，识别并精炼核心领域事件，建立一致的语言基准。',
          phase: '阶段二：通过简单规则与提示词将 AI 应用于 DDD',
          tags: ['事件风暴', '领域探索', '通用语言', 'DDD'],
        },
        {
          order: 5,
          chapterNumber: '第 05 篇',
          slug: '2026-10-21-ai-ddd-05-defining-rules',
          title: 'AI 增强的领域驱动设计（五）：定义规则：教会模型运用 DDD 进行思考',
          description:
            '构建提示词规则手册，以三层架构明确词汇定义、结构规范、预期输出与评估准则，并借智能体、技能与 MCP 服务器为 DDD 推理装上护栏。',
          phase: '阶段二：通过简单规则与提示词将 AI 应用于 DDD',
          tags: ['提示词工程', 'DDD', '规则手册', '护栏'],
        },
        {
          order: 6,
          chapterNumber: '第 06 篇',
          slug: '2026-10-21-ai-ddd-06-iterative-refinement',
          title: 'AI 增强的领域驱动设计（六）：迭代精化：构建限界上下文',
          description:
            '把反馈闭环应用于事件、命令、聚合与策略的设计，引入 CQRS 明确职责分离，逐步为 BrewUp 案例构建高内聚、自洽的限界上下文。',
          phase: '阶段二：通过简单规则与提示词将 AI 应用于 DDD',
          tags: ['限界上下文', '迭代精炼', 'CQRS', '聚合设计'],
        },
        {
          order: 7,
          chapterNumber: '第 07 篇',
          slug: '2026-10-21-ai-ddd-07-prompt-as-domain-carrier',
          title: 'AI 增强的领域驱动设计（七）：作为领域载体的提示词',
          description:
            '让提示词承载并沉淀领域知识，使其从随用随弃的查询升级为活文档，跨工作流复用规则与示例，并把 AI 输出当作团队理解的一面镜子。',
          phase: '阶段二：通过简单规则与提示词将 AI 应用于 DDD',
          tags: ['提示词工程', '领域知识', '活文档', 'DDD'],
        },
      ],
    },
    {
      name: '阶段三：构建智能体以简化交互',
      description:
        '从单一提示词进阶到专业智能体与编排器，构建可扩展且稳定一致的 AI 辅助领域建模工作流。',
      chapters: [
        {
          order: 8,
          chapterNumber: '第 08 篇',
          slug: '2026-10-21-ai-ddd-08-from-prompts-to-agents',
          title: 'AI 增强的领域驱动设计（八）：从提示词到智能体：构建 AI 协作结构',
          description:
            '将工作流从单一提示词升级为具备清晰认知边界的专家智能体团队，用规范沉淀领域知识，并借助守卫智能体设立不可逾越的认知边界。',
          phase: '阶段三：构建智能体以简化交互',
          tags: ['智能体', '多智能体', '规范驱动', '认知边界'],
        },
        {
          order: 9,
          chapterNumber: '第 09 篇',
          slug: '2026-10-21-ai-ddd-09-guardrails-to-specialists',
          title: 'AI 增强的领域驱动设计（九）：从护栏到专家：为 DDD 设计智能体',
          description:
            '亲手打造专精于事件风暴、故事叙述、命令与事件编写及上下文映射的专业智能体，用契约与交接划定认知边界，让通用语言保证专家之间的一致性。',
          phase: '阶段三：构建智能体以简化交互',
          tags: ['智能体', '事件风暴', '契约与交接', '领域建模'],
        },
        {
          order: 10,
          chapterNumber: '第 10 篇',
          slug: '2026-10-21-ai-ddd-10-the-orchestrator',
          title: 'AI 增强的领域驱动设计（十）：编排器：构建协调智能体',
          description:
            '把专家智能体之间的任务交接转化为可执行控制平面，涵盖资格检查、类型化消息、合法状态转换、人工审批关卡、持久化与重放。',
          phase: '阶段三：构建智能体以简化交互',
          tags: ['编排器', '智能体', '状态机', '人工关卡'],
        },
        {
          order: 11,
          chapterNumber: '第 11 篇',
          slug: '2026-10-21-ai-ddd-11-governed-autonomy',
          title: 'AI 增强的领域驱动设计（十一）：受治理的自主性：在智能体之间平衡自主与对齐',
          description:
            '区分确定性边界冲突与语义偏离，在不扩大自主性的前提下纠正漂移，并让证据、不确定性与人工验收始终保持透明可见。',
          phase: '阶段三：构建智能体以简化交互',
          tags: ['受治理的自主性', '智能体', '概念漂移', '可观测性'],
        },
      ],
    },
  ],
}

export const SPRING_BOOT_ANGULAR_COLUMN: ColumnInfo = {
  id: 'spring-boot-angular',
  title: '《Spring Boot 4 & Angular 22 全栈微服务实战》',
  subtitle: '从 Java 26 微服务架构、响应式状态治理到容器化生产部署的全链路工程实践',
  badge: '精品专栏 · 22 篇全栈实战',
  status: 'completed',
  statusText: '22 篇已完结',
  totalArticles: 22,
  category: 'fullstack',
  tags: ['Spring Boot', 'Angular', 'Java', 'TypeScript', '微服务', '全栈开发'],
  updatedAt: '2026-10-23',
  focus: '微服务全栈',
  description:
    '系统化剖析现代企业级全栈微服务架构设计与落地法则。贯穿在线书店业务案例，深度覆盖 Java 26 模式匹配与结构化并发、Spring Boot 4.1.0 多范式持久化（PostgreSQL & MongoDB）、Eureka 服务发现与 Spring Cloud Gateway 动态网关、OpenAPI 契约驱动与分布式可观测性、Keycloak + JWT 集中鉴权、Spring WebFlux 响应式流与 SSE 实时通知；前端全面拥抱 Angular 22 纯 Standalone 架构、Signals 响应式系统、NgRx SignalStore 状态治理、复杂响应式表单、Angular 现代 SSR 水合优化与多阶段容器化一键部署。',
  highlights: [
    {
      title: '现代化全栈架构基石',
      desc: 'Java 26 语言特性与 Spring Boot 4.1.0 最佳实践，Angular 22 独立组件与无 Zone.js（Zoneless）变更检测。',
    },
    {
      title: '多范式持久化与微服务治理',
      desc: 'PostgreSQL 强事务关系模型与 MongoDB 灵活文档模型并行，Eureka 动态发现与 Spring Cloud Gateway 响应式网关。',
    },
    {
      title: '安全鉴权与实时响应式流',
      desc: 'Keycloak 集中式身份认证与无状态 JWT 验签传播，Project Reactor 非阻塞流与 SSE 服务端实时推送。',
    },
    {
      title: '前端状态治理与生产级交付',
      desc: 'NgRx SignalStore 事件驱动状态管理，按路由差异化 SSR 与增量水合，Docker Compose 全栈一键编排。',
    },
  ],
  phases: [
    {
      name: '阶段一：全栈架构基石与 AI 提效',
      description: '掌握全栈技术选型与架构全景，规范微服务工程骨架与 AI 研发工作流。',
      chapters: [
        {
          order: 0,
          chapterNumber: '导读',
          slug: '2026-10-23-spring-boot-angular-00-guide',
          title: 'Spring Boot & Angular 全栈实战（导读）：现代微服务与响应式前端全景路线图',
          description:
            '全景解析现代企业级全栈应用架构体系，剖析 Java 26、Spring Boot 4 与 Angular 22 的技术演进、实战案例拆解与学习路线图。',
          phase: '阶段一：全栈架构基石与 AI 提效',
          tags: ['Spring Boot', 'Angular', 'Java', 'TypeScript', '微服务', '架构设计'],
        },
        {
          order: 1,
          chapterNumber: '第 01 篇',
          slug: '2026-10-23-spring-boot-angular-01-the-big-picture',
          title: 'Spring Boot & Angular 全栈实战（一）：技术全景、演进脉络与架构蓝图',
          description:
            '全面梳理 Spring Boot 4.1.0 与 Angular 22 的核心技术演进，剖析 Java 26 新特性、Signals 细粒度响应式系统与微服务书店案例系统架构。',
          phase: '阶段一：全栈架构基石与 AI 提效',
          tags: ['Spring Boot', 'Angular', 'Java', 'TypeScript', '微服务', '架构设计'],
        },
        {
          order: 2,
          chapterNumber: '第 02 篇',
          slug: '2026-10-23-spring-boot-angular-02-microservices-getting-started',
          title: 'Spring Boot & Angular 全栈实战（二）：微服务核心架构与业务领域拆解',
          description:
            '深入微服务架构设计原则，剖析按业务能力拆分服务、分层架构设计与领域对象规范，从零搭建 Spring Boot 4 微服务基础工程骨架。',
          phase: '阶段一：全栈架构基石与 AI 提效',
          tags: ['Spring Boot', '微服务', '架构设计', 'Java'],
        },
        {
          order: 3,
          chapterNumber: '第 03 篇',
          slug: '2026-10-23-spring-boot-angular-03-ai-development-assistant',
          title: 'Spring Boot & Angular 全栈实战（三）：工程级 AI 辅助研发工作流与规则指令集',
          description:
            '探索大模型在全栈微服务研发中的工程化落地，配置专属 copilot-instructions 规范指令集，建立可信可验的代码生成与重构工作流。',
          phase: '阶段一：全栈架构基石与 AI 提效',
          tags: ['AI辅助开发', 'Spring Boot', 'GitHub Copilot', '工程提效'],
        },
      ],
    },
    {
      name: '阶段二：Spring Boot 微服务后端架构',
      description: '落地多范式持久化、企业级 RESTful API、统一网关、可观测性、安全鉴权与响应式编程。',
      chapters: [
        {
          order: 4,
          chapterNumber: '第 04 篇',
          slug: '2026-10-23-spring-boot-angular-04-databases-repositories-spring-data',
          title: 'Spring Boot & Angular 全栈实战（四）：Spring Data 多范式持久化（PostgreSQL 与 MongoDB）',
          description:
            '结合关系型数据库 PostgreSQL 与 NoSQL 文档数据库 MongoDB，实战 Spring Data JPA 与 Spring Data MongoDB 的实体建模、Repository 设计与多范式持久化架构。',
          phase: '阶段二：Spring Boot 微服务后端架构',
          tags: ['Spring Boot', 'Spring Data', 'PostgreSQL', 'MongoDB', '持久化'],
        },
        {
          order: 5,
          chapterNumber: '第 05 篇',
          slug: '2026-10-23-spring-boot-angular-05-application-services-apis',
          title: 'Spring Boot & Angular 全栈实战（五）：应用服务层与企业级 RESTful API 实战',
          description:
            '深入 Spring Boot 服务分层设计，构建具备 DTO 转换、参数校验、全局异常治理与分页能力的生产级 REST API。',
          phase: '阶段二：Spring Boot 微服务后端架构',
          tags: ['Spring Boot', 'REST API', 'DTO', '数据校验', '异常处理'],
        },
        {
          order: 6,
          chapterNumber: '第 06 篇',
          slug: '2026-10-23-spring-boot-angular-06-service-discovery-api-gateway',
          title: 'Spring Boot & Angular 全栈实战（六）：Spring Cloud 服务发现与统一 API 网关',
          description:
            '基于 Eureka 构建微服务动态注册与健康感知，实战 Spring Cloud Gateway 的动态路由编排、过滤器链路与跨域治理。',
          phase: '阶段二：Spring Boot 微服务后端架构',
          tags: ['Spring Cloud', '微服务网关', '服务发现', 'Eureka', 'API Gateway'],
        },
        {
          order: 7,
          chapterNumber: '第 07 篇',
          slug: '2026-10-23-spring-boot-angular-07-openapi-observability',
          title: 'Spring Boot & Angular 全栈实战（七）：OpenAPI 规范驱动与全链路可观测性落地',
          description:
            '结合 SpringDoc 自动化生成 OpenAPI 规范与 Swagger 交互界面，落地基于 Actuator、Prometheus 与分布式链路追踪的可观测体系。',
          phase: '阶段二：Spring Boot 微服务后端架构',
          tags: ['OpenAPI', '可观测性', 'Spring Boot', 'Actuator', '链路追踪'],
        },
        {
          order: 8,
          chapterNumber: '第 08 篇',
          slug: '2026-10-23-spring-boot-angular-08-spring-security-jwt',
          title: 'Spring Boot & Angular 全栈实战（八）：基于 Spring Security 与 JWT 的微服务安全鉴权',
          description:
            '深入微服务安全边界，落地 OAuth2 与 Keycloak 集成、无状态 JWT 签发与跨微服务 Token 传播验证体系。',
          phase: '阶段二：Spring Boot 微服务后端架构',
          tags: ['Spring Security', 'JWT', 'Keycloak', '微服务安全', 'OAuth2'],
        },
        {
          order: 9,
          chapterNumber: '第 09 篇',
          slug: '2026-10-23-spring-boot-angular-09-reactive-webflux',
          title: 'Spring Boot & Angular 全栈实战（九）：Spring WebFlux 响应式流与 SSE 实时消息推送',
          description:
            '探索 Reactor 非阻塞反应式编程模型，构建 Server-Sent Events (SSE) 实时通道，实现图书上新与库存变动的流式推送。',
          phase: '阶段二：Spring Boot 微服务后端架构',
          tags: ['WebFlux', '响应式编程', 'SSE', 'Reactor', '实时通信'],
        },
        {
          order: 10,
          chapterNumber: '第 10 篇',
          slug: '2026-10-23-spring-boot-angular-10-building-packaging-backend',
          title: 'Spring Boot & Angular 全栈实战（十）：后端多微服务容器化构建与 Docker Compose 统一编排',
          description:
            '基于分层 JAR 与多阶段 Dockerfile 构建轻量化后端微服务容器镜像，利用 Docker Compose 编排数据库、网关与微服务全栈集群。',
          phase: '阶段二：Spring Boot 微服务后端架构',
          tags: ['Docker', 'Docker Compose', '容器化', 'Spring Boot', '生产部署'],
        },
      ],
    },
    {
      name: '阶段三：Angular 现代前端与响应式治理',
      description: '掌握 Standalone 组件、响应式表单、Signals 与 SignalStore 状态流、客户端鉴权、SSR 与 SSE 集成。',
      chapters: [
        {
          order: 11,
          chapterNumber: '第 11 篇',
          slug: '2026-10-23-spring-boot-angular-11-angular-project-architecture',
          title: 'Spring Boot & Angular 全栈实战（十一）：Angular 22 现代脚手架与独立组件架构',
          description:
            '深入 Angular 22 现代工程体系，落地纯 Standalone 架构、基于 Signals 的输入输出、Smart/Dumb 组件分层与 Vitest 现代测试框架。',
          phase: '阶段三：Angular 现代前端与响应式治理',
          tags: ['Angular', 'Standalone', 'TypeScript', '前端架构', 'Vitest'],
        },
        {
          order: 12,
          chapterNumber: '第 12 篇',
          slug: '2026-10-23-spring-boot-angular-12-ai-assisted-frontend',
          title: 'Spring Boot & Angular 全栈实战（十二）：前端 AI 辅助开发规范与指令调优',
          description:
            '建立前端 AI 研发规范库，配置针对 Angular Material、Reactive Forms 与 Vitest 测试的专属 instruction 文件，实现可控可复用的代码生成。',
          phase: '阶段三：Angular 现代前端与响应式治理',
          tags: ['AI辅助开发', 'Angular', 'GitHub Copilot', '前端工程化'],
        },
        {
          order: 13,
          chapterNumber: '第 13 篇',
          slug: '2026-10-23-spring-boot-angular-13-understanding-angular-forms',
          title: 'Spring Boot & Angular 全栈实战（十三）：深入理解 Angular 响应式表单设计哲学',
          description:
            '对比模板驱动表单与响应式表单，剖析 FormGroup、FormControl 与 FormArray 的模型不可变性，解析同步与异步校验器的运行机制。',
          phase: '阶段三：Angular 现代前端与响应式治理',
          tags: ['Angular', 'Reactive Forms', '响应式表单', '前端表单'],
        },
        {
          order: 14,
          chapterNumber: '第 14 篇',
          slug: '2026-10-23-spring-boot-angular-14-implementing-reactive-forms',
          title: 'Spring Boot & Angular 全栈实战（十四）：实战复杂响应式表单与跨字段校验',
          description:
            '结合 Angular Material 实战注册、登录、作者与图书四大表单，落地密码一致性跨字段校验、动态错误提示与 AI 辅助生成表单流。',
          phase: '阶段三：Angular 现代前端与响应式治理',
          tags: ['Angular Material', '响应式表单', '跨字段校验', '实战开发'],
        },
        {
          order: 15,
          chapterNumber: '第 15 篇',
          slug: '2026-10-23-spring-boot-angular-15-signals-and-stores',
          title: 'Spring Boot & Angular 全栈实战（十五）：利用 Signals 与 NgRx SignalStore 治理应用状态',
          description:
            '告别复杂样板代码，使用轻量级 NgRx SignalStore 搭配 Events 插件，以 AuthStore 为例落地清晰、类型安全且事件驱动的状态流。',
          phase: '阶段三：Angular 现代前端与响应式治理',
          tags: ['Angular', 'Signals', 'NgRx', 'SignalStore', '状态管理'],
        },
        {
          order: 16,
          chapterNumber: '第 16 篇',
          slug: '2026-10-23-spring-boot-angular-16-authentication-in-angular',
          title: 'Spring Boot & Angular 全栈实战（十六）：Angular 客户端鉴权、拦截器与路由守卫',
          description:
            '前端完整对接后端认证微服务，实现基于 HTTP Interceptor 的 JWT 自动装配、无感 Token 刷新、路由守卫与受保护的个人中心页面。',
          phase: '阶段三：Angular 现代前端与响应式治理',
          tags: ['Angular', 'JWT', '拦截器', '路由守卫', '前端安全'],
        },
        {
          order: 17,
          chapterNumber: '第 17 篇',
          slug: '2026-10-23-spring-boot-angular-17-crud-state-management',
          title: 'Spring Boot & Angular 全栈实战（十七）：状态管理驱动的完整 CRUD 交互闭环',
          description:
            '结合 AuthorStore 与 BookStore，实战分页列表、动态防抖检索、模态框创建/编辑与级联下拉关联的生产级 CRUD 完整流程。',
          phase: '阶段三：Angular 现代前端与响应式治理',
          tags: ['Angular', 'CRUD', 'SignalStore', '分页检索', '业务实战'],
        },
        {
          order: 18,
          chapterNumber: '第 18 篇',
          slug: '2026-10-23-spring-boot-angular-18-server-side-rendering',
          title: 'Spring Boot & Angular 全栈实战（十八）：Angular 现代服务端渲染（SSR）与水合优化',
          description:
            '配置 RenderMode 细粒度路由渲染策略，结合 AngularNodeAppEngine、isPlatformBrowser 平台守卫与增量水合技术，实现高 SEO 与极速首屏加载。',
          phase: '阶段三：Angular 现代前端与响应式治理',
          tags: ['Angular', 'SSR', '水合', 'SEO', '服务端渲染'],
        },
        {
          order: 19,
          chapterNumber: '第 19 篇',
          slug: '2026-10-23-spring-boot-angular-19-real-time-data-angular',
          title: 'Spring Boot & Angular 全栈实战（十九）：SSE 实时数据流与 RxJS 响应式集成',
          description:
            '在 Angular 客户端基于 RxJS 封装 EventSource 连接，消费后端 Server-Sent Events 流，实现新书实时推送、自创建事件去重与列表自动刷新。',
          phase: '阶段三：Angular 现代前端与响应式治理',
          tags: ['Angular', 'SSE', 'RxJS', '实时通信', 'EventSource'],
        },
        {
          order: 20,
          chapterNumber: '第 20 篇',
          slug: '2026-10-23-spring-boot-angular-20-building-deploying-frontend',
          title: 'Spring Boot & Angular 全栈实战（二十）：前端生产级构建与 Node SSR 容器化打包',
          description:
            '实战 Angular 生产级构建优化，编写多阶段 Node.js Dockerfile 容器化 SSR 服务，配置反向代理打通前后端通信契约。',
          phase: '阶段三：Angular 现代前端与响应式治理',
          tags: ['Angular', 'Docker', '容器化', 'SSR', '生产构建'],
        },
      ],
    },
    {
      name: '阶段四：端到端联调与生产交付',
      description: '全链路打通前端 SSR 代理与微服务集群，编排容器化一键部署并验证生产环境高可用。',
      chapters: [
        {
          order: 21,
          chapterNumber: '第 21 篇',
          slug: '2026-10-23-spring-boot-angular-21-connecting-frontend-backend-production',
          title: 'Spring Boot & Angular 全栈实战（二十一）：端到端联调、网络代理与生产级编排',
          description:
            '汇聚全栈成果，利用 Docker Compose 统筹编排 PostgreSQL、MongoDB、Keycloak、Eureka、网关、业务微服务与 Angular 前端，实现生产级一键交付。',
          phase: '阶段四：端到端联调与生产交付',
          tags: ['全栈实战', 'Docker Compose', '生产交付', '端到端联调', '微服务架构'],
        },
      ],
    },
  ],
}

export const ALL_COLUMNS: ColumnInfo[] = [
  DISTRIBUTED_GO_COLUMN,
  AI_DDD_COLUMN,
  SPRING_BOOT_ANGULAR_COLUMN,
]

export const PLANNED_COLUMNS: PlannedColumn[] = [
  {
    id: 'k8s-cloud-native',
    title: '《Kubernetes 生产级微服务治理实战》',
    subtitle: '构建高可靠、自愈编排与服务网格网格化生产集群',
    badge: '筹备规划中',
    statusText: '预计 12 篇',
    description:
      '系统化剖析生产集群搭建、Pod 资源 QoS 隔离、HPA/VPA 弹性伸缩、网络策略与 Istio 服务网格微服务治理全流程。',
    estimatedChapters: 12,
    tags: ['Kubernetes', '云原生', '微服务', '服务网格', 'DevOps'],
  },
]

export function getAllColumns(): ColumnInfo[] {
  return ALL_COLUMNS
}

export function getColumn(id: string): ColumnInfo | undefined {
  return ALL_COLUMNS.find((col) => col.id === id)
}

/**
 * 构建期守卫：专栏目录与专栏文章必须一一对应。
 * 专栏文章不进文章列表，只靠专栏页暴露入口，一旦失配就会变成死链或孤儿文章，
 * 因此在构建时直接失败，而不是等到读者点击才发现。
 */
export function assertColumnsConsistent(): void {
  // skipManifest：构建期清单尚未生成（或版本不兼容），这里必须直读 content/
  const posts = getCollection('posts', { skipManifest: true })
  const postSlugs = new Set(posts.map((post) => post.slug))
  const columnIds = new Set(ALL_COLUMNS.map((col) => col.id))

  for (const col of ALL_COLUMNS) {
    for (const phase of col.phases) {
      for (const chapter of phase.chapters) {
        if (!postSlugs.has(chapter.slug)) {
          throw new Error(
            `专栏「${col.title}」的章节 ${chapter.slug} 缺少对应文章文件（content/posts/${chapter.slug}.md）`,
          )
        }
      }
    }
  }

  for (const post of posts) {
    const columnId = post.data.column
    if (!columnId) continue
    if (!columnIds.has(columnId)) {
      throw new Error(`文章 ${post.slug} 声明的专栏「${columnId}」不存在`)
    }
    const col = ALL_COLUMNS.find((c) => c.id === columnId)!
    const listed = col.phases.some((phase) =>
      phase.chapters.some((chapter) => chapter.slug === post.slug),
    )
    if (!listed) {
      throw new Error(`文章 ${post.slug} 声明的专栏「${columnId}」目录中缺少该篇`)
    }
  }
}
