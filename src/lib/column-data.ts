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

/**
 * 专栏的编辑信息：只保留无法从文章 frontmatter 推导的内容。
 * 章节标题、描述、标签、分类、篇数与更新日期一律在构建期从 frontmatter 合成，
 * 避免专栏页与文章页各存一份、互相漂移。
 */
export type ColumnSource = {
  id: string
  title: string
  subtitle: string
  badge: string
  status: ColumnStatus
  tags: string[]
  description: string
  /** 专栏定位标签（列表页与详情页的 chip），缺省为「全栈实践」 */
  focus?: string
  highlights: { title: string; desc: string }[]
  /** 章节标题中重复的专栏名前缀，展示时剥离（如「Go 分布式系统实战（一）：」） */
  titlePrefix?: string
  phases: {
    name: string
    description: string
    chapters: { order: number; slug: string }[]
  }[]
}

/** hydrateColumn 需要的最小文章字段；CollectionEntry<'posts'> 可直接传入 */
export type ChapterSourcePost = {
  slug: string
  data: {
    title: string
    description?: string
    tags: string[]
    date: Date
    category?: string
  }
}

/** 构建期由 ColumnSource + 文章 frontmatter 合成的完整专栏 */
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

export const DISTRIBUTED_GO_COLUMN: ColumnSource = {
  id: 'distributed-go',
  title: '《Go 云原生分布式系统实战》',
  subtitle: '从单机并发到微服务集群，覆盖现代 Go 分布式系统设计与工程落地全链路',
  badge: '精品专栏 · 全景实战',
  status: 'completed',
  titlePrefix: 'Go 分布式系统实战',
  tags: ['Go', '分布式系统', '微服务', 'Kafka', 'gRPC', '云原生'],
  focus: '分布式系统',
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
          slug: '2026-10-18-distributed-go-00-preface',
        },
        {
          order: 1,
          slug: '2026-10-18-distributed-go-01-why-distributed',
        },
        {
          order: 2,
          slug: '2026-10-18-distributed-go-02-concurrency',
        },
      ],
    },
    {
      name: '阶段二：通信契约与服务网关',
      description: '异步消息队列与 HTTP 中间件体系构建，打通服务间通信与无状态鉴权。',
      chapters: [
        {
          order: 3,
          slug: '2026-10-18-distributed-go-03-two-services-one-queue',
        },
        {
          order: 4,
          slug: '2026-10-18-distributed-go-04-http-middleware',
        },
        {
          order: 5,
          slug: '2026-10-18-distributed-go-05-auth-jwt',
        },
      ],
    },
    {
      name: '阶段三：数据隔离与全链路治理',
      description: '从数据库隔离与零停机迁移，到 Kafka 持久化账本与 gRPC 容错断路器。',
      chapters: [
        {
          order: 6,
          slug: '2026-10-18-distributed-go-06-database-migrations',
        },
        {
          order: 7,
          slug: '2026-10-18-distributed-go-07-context-propagation',
        },
        {
          order: 8,
          slug: '2026-10-18-distributed-go-08-kafka-queues',
        },
        {
          order: 9,
          slug: '2026-10-18-distributed-go-09-grpc-circuit-breaker',
        },
        {
          order: 10,
          slug: '2026-10-18-distributed-go-10-orchestration-fan-out',
        },
      ],
    },
    {
      name: '阶段四：一致性保障与工程闭环',
      description: '攻克分布式事务与幂等挑战，构建现代可观测性三支柱与混沌测试防护网。',
      chapters: [
        {
          order: 11,
          slug: '2026-10-18-distributed-go-11-consistency-in-practice',
        },
        {
          order: 12,
          slug: '2026-10-18-distributed-go-12-observability',
        },
        {
          order: 13,
          slug: '2026-10-18-distributed-go-13-testing-distributed-systems',
        },
        {
          order: 14,
          slug: '2026-10-18-distributed-go-14-config-and-secrets',
        },
      ],
    },
    {
      name: '阶段五：综合实战与速查附录',
      description: '贯通全部核心模式落地电商微服务系统，沉淀并发速查与生产 CLI 运维工具。',
      chapters: [
        {
          order: 15,
          slug: '2026-10-18-distributed-go-15-capstone-complete-system',
        },
        {
          order: 16,
          slug: '2026-10-18-distributed-go-16-appendices',
        },
      ],
    },
  ],
}

export const AI_DDD_COLUMN: ColumnSource = {
  id: 'ai-ddd',
  title: '《AI 增强的领域驱动设计》',
  subtitle: '用大语言模型、结构化提示词与多智能体工作流，把领域建模升级为可执行的控制平面',
  badge: '精品专栏 · 全景实战',
  status: 'completed',
  titlePrefix: 'AI 增强的领域驱动设计',
  tags: ['DDD', '领域驱动设计', '大语言模型', '多智能体', '提示词工程', '架构设计'],
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
          slug: '2026-10-21-ai-ddd-00-guide',
        },
        {
          order: 1,
          slug: '2026-10-21-ai-ddd-01-why-ai-matters',
        },
        {
          order: 2,
          slug: '2026-10-21-ai-ddd-02-how-llms-think',
        },
        {
          order: 3,
          slug: '2026-10-21-ai-ddd-03-architects-view',
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
          slug: '2026-10-21-ai-ddd-04-domain-exploration',
        },
        {
          order: 5,
          slug: '2026-10-21-ai-ddd-05-defining-rules',
        },
        {
          order: 6,
          slug: '2026-10-21-ai-ddd-06-iterative-refinement',
        },
        {
          order: 7,
          slug: '2026-10-21-ai-ddd-07-prompt-as-domain-carrier',
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
          slug: '2026-10-21-ai-ddd-08-from-prompts-to-agents',
        },
        {
          order: 9,
          slug: '2026-10-21-ai-ddd-09-guardrails-to-specialists',
        },
        {
          order: 10,
          slug: '2026-10-21-ai-ddd-10-the-orchestrator',
        },
        {
          order: 11,
          slug: '2026-10-21-ai-ddd-11-governed-autonomy',
        },
      ],
    },
  ],
}

export const SPRING_BOOT_ANGULAR_COLUMN: ColumnSource = {
  id: 'spring-boot-angular',
  title: '《Spring Boot 4 & Angular 22 全栈微服务实战》',
  subtitle: '从 Java 26 微服务架构、响应式状态治理到容器化生产部署的全链路工程实践',
  badge: '精品专栏 · 全栈实战',
  status: 'completed',
  titlePrefix: 'Spring Boot & Angular 全栈实战',
  tags: ['Spring Boot', 'Angular', 'Java', 'TypeScript', '微服务', '全栈开发'],
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
          slug: '2026-10-23-spring-boot-angular-00-guide',
        },
        {
          order: 1,
          slug: '2026-10-23-spring-boot-angular-01-the-big-picture',
        },
        {
          order: 2,
          slug: '2026-10-23-spring-boot-angular-02-microservices-getting-started',
        },
        {
          order: 3,
          slug: '2026-10-23-spring-boot-angular-03-ai-development-assistant',
        },
      ],
    },
    {
      name: '阶段二：Spring Boot 微服务后端架构',
      description: '落地多范式持久化、企业级 RESTful API、统一网关、可观测性、安全鉴权与响应式编程。',
      chapters: [
        {
          order: 4,
          slug: '2026-10-23-spring-boot-angular-04-databases-repositories-spring-data',
        },
        {
          order: 5,
          slug: '2026-10-23-spring-boot-angular-05-application-services-apis',
        },
        {
          order: 6,
          slug: '2026-10-23-spring-boot-angular-06-service-discovery-api-gateway',
        },
        {
          order: 7,
          slug: '2026-10-23-spring-boot-angular-07-openapi-observability',
        },
        {
          order: 8,
          slug: '2026-10-23-spring-boot-angular-08-spring-security-jwt',
        },
        {
          order: 9,
          slug: '2026-10-23-spring-boot-angular-09-reactive-webflux',
        },
        {
          order: 10,
          slug: '2026-10-23-spring-boot-angular-10-building-packaging-backend',
        },
      ],
    },
    {
      name: '阶段三：Angular 现代前端与响应式治理',
      description: '掌握 Standalone 组件、响应式表单、Signals 与 SignalStore 状态流、客户端鉴权、SSR 与 SSE 集成。',
      chapters: [
        {
          order: 11,
          slug: '2026-10-23-spring-boot-angular-11-angular-project-architecture',
        },
        {
          order: 12,
          slug: '2026-10-23-spring-boot-angular-12-ai-assisted-frontend',
        },
        {
          order: 13,
          slug: '2026-10-23-spring-boot-angular-13-understanding-angular-forms',
        },
        {
          order: 14,
          slug: '2026-10-23-spring-boot-angular-14-implementing-reactive-forms',
        },
        {
          order: 15,
          slug: '2026-10-23-spring-boot-angular-15-signals-and-stores',
        },
        {
          order: 16,
          slug: '2026-10-23-spring-boot-angular-16-authentication-in-angular',
        },
        {
          order: 17,
          slug: '2026-10-23-spring-boot-angular-17-crud-state-management',
        },
        {
          order: 18,
          slug: '2026-10-23-spring-boot-angular-18-server-side-rendering',
        },
        {
          order: 19,
          slug: '2026-10-23-spring-boot-angular-19-real-time-data-angular',
        },
        {
          order: 20,
          slug: '2026-10-23-spring-boot-angular-20-building-deploying-frontend',
        },
      ],
    },
    {
      name: '阶段四：端到端联调与生产交付',
      description: '全链路打通前端 SSR 代理与微服务集群，编排容器化一键部署并验证生产环境高可用。',
      chapters: [
        {
          order: 21,
          slug: '2026-10-23-spring-boot-angular-21-connecting-frontend-backend-production',
        },
      ],
    },
  ],
}


export const RUST_SYSTEMS_COLUMN: ColumnSource = {
  id: "rust-systems-engineering",
  title: "《Rust 现代系统级工程实战》",
  subtitle: "从内存安全、零成本抽象到 Tokio 异步运行时与 Unsafe 底层契约",
  badge: "精品专栏 · 全景实战",
  status: "completed",
  titlePrefix: 'Rust 现代系统级工程实战',
  tags: ["Rust", "系统编程", "并发编程", "异步运行时", "Tokio", "内存安全"],
  focus: "系统编程",
  description: "基于 2026 年最新第 3 版《Programming Rust》深度重构。摒弃脱离生产的简单语法玩具，从生命周期与借用检查器物理本质出发，层层进阶攻克类型系统代数抽象、标准库集合与内存排布、Send/Sync 线程安全契约、Tokio 异步运行时与 Pinning 钉住、声明式与过程宏元编程，直至 Unsafe Rust 与 C-ABI FFI 跨语言边界交互。",
  highlights: [
    {
      title: "内存模型与所有权核心",
      desc: "借用检查器物理本质、移动语义不变量、引用生命周期推导与 RAII 资源治理。",
    },
    {
      title: "类型代数与多态抽象",
      desc: "结构体与枚举内存布局、Trait 虚表分发与单态化、运算符重载及通用模式。",
    },
    {
      title: "并发模型与异步运行时",
      desc: "Send/Sync 线程安全契约、无畏并发、Tokio 异步执行器与 Pin/Future 协程本质。",
    },
    {
      title: "元编程与底层边界突破",
      desc: "宏系统声明式与过程宏开发、Unsafe Rust 裸指针操作与跨语言 C-ABI FFI 安全封装。",
    },
  ],
  phases: [
    {
      name: "阶段一：语言核心与内存安全哲学",
      description: "建立 Rust 内存安全物理模型，掌握所有权、移动语义、借用检查器与生命周期核心不变量。",
      chapters: [
        {
          order: 0,
          slug: "2026-10-25-rust-systems-engineering-00-guide",
        },
        {
          order: 1,
          slug: "2026-10-25-rust-systems-engineering-01-why-rust",
        },
        {
          order: 2,
          slug: "2026-10-25-rust-systems-engineering-02-a-tour-of-rust",
        },
        {
          order: 3,
          slug: "2026-10-25-rust-systems-engineering-03-fundamental-types",
        },
        {
          order: 4,
          slug: "2026-10-25-rust-systems-engineering-04-ownership-and-moves",
        },
        {
          order: 5,
          slug: "2026-10-25-rust-systems-engineering-05-references",
        },
        {
          order: 6,
          slug: "2026-10-25-rust-systems-engineering-06-expressions",
        },
      ],
    },
    {
      name: "阶段二：类型抽象与工程组织",
      description: "掌握工业级错误传播、工作区与可见性治理、结构体对齐、代数数据类型与 Trait 泛型系统。",
      chapters: [
        {
          order: 7,
          slug: "2026-10-25-rust-systems-engineering-07-error-handling",
        },
        {
          order: 8,
          slug: "2026-10-25-rust-systems-engineering-08-crates-and-modules",
        },
        {
          order: 9,
          slug: "2026-10-25-rust-systems-engineering-09-structs",
        },
        {
          order: 10,
          slug: "2026-10-25-rust-systems-engineering-10-enums-and-patterns",
        },
        {
          order: 11,
          slug: "2026-10-25-rust-systems-engineering-11-traits-and-generics",
        },
        {
          order: 12,
          slug: "2026-10-25-rust-systems-engineering-12-operator-overloading",
        },
        {
          order: 13,
          slug: "2026-10-25-rust-systems-engineering-13-utility-traits",
        },
      ],
    },
    {
      name: "阶段三：函数式抽象与数据流",
      description: "精通闭包类型分层、零成本迭代器管道、标准库集合底层权衡与跨平台 I/O 缓冲流。",
      chapters: [
        {
          order: 14,
          slug: "2026-10-25-rust-systems-engineering-14-closures",
        },
        {
          order: 15,
          slug: "2026-10-25-rust-systems-engineering-15-iterators",
        },
        {
          order: 16,
          slug: "2026-10-25-rust-systems-engineering-16-collections",
        },
        {
          order: 17,
          slug: "2026-10-25-rust-systems-engineering-17-strings-and-text",
        },
        {
          order: 18,
          slug: "2026-10-25-rust-systems-engineering-18-input-and-output",
        },
      ],
    },
    {
      name: "阶段四：高并发、异步底层与系统边界",
      description: "深入 Send/Sync 并发公理、Tokio 异步运行时、Futures/Pinning 机制、宏元编程与 Unsafe/FFI 契约。",
      chapters: [
        {
          order: 19,
          slug: "2026-10-25-rust-systems-engineering-19-concurrency",
        },
        {
          order: 20,
          slug: "2026-10-25-rust-systems-engineering-20-asynchronous-programming",
        },
        {
          order: 21,
          slug: "2026-10-25-rust-systems-engineering-21-futures-and-pinning",
        },
        {
          order: 22,
          slug: "2026-10-25-rust-systems-engineering-22-macros",
        },
        {
          order: 23,
          slug: "2026-10-25-rust-systems-engineering-23-unsafe-code",
        },
        {
          order: 24,
          slug: "2026-10-25-rust-systems-engineering-24-foreign-functions",
        },
      ],
    },
  ],
}

export const DATA_INTENSIVE_COLUMN: ColumnSource = {
  id: "data-intensive-systems",
  title: "《数据密集型系统架构实战（第二版）》",
  subtitle: "深入解构分布式存储引擎、高可用复制、ACID 事务与流批一体演进",
  badge: "精品专栏 · 全景实战",
  status: "completed",
  titlePrefix: '数据密集型系统架构实战',
  tags: ["分布式系统", "数据架构", "存储引擎", "共识算法", "流处理", "DDIA"],
  focus: "数据架构",
  description: "基于 Martin Kleppmann 与 Chris Riccomini 2026 年最新第二版《Designing Data-Intensive Applications》全面重构。深入剖析现代数据密集型系统架构的权衡取舍：LSM-Tree 与 B-Tree 存储引擎、向量嵌入检索、多主与无主 Quorum 复制、弱隔离级别避坑、线性一致性与 Raft 共识算法，直至 CDC 日志流处理与数据库解构。",
  highlights: [
    {
      title: "数据模型与存储引擎演进",
      desc: "关系 vs 文档模型取舍、LSM-Tree 与 B-Tree 物理排布、向量嵌入高维检索索引。",
    },
    {
      title: "分布式复制、事务与共识",
      desc: "单主/多主/无主 Quorum 复制拓扑、弱隔离级别脏读幻读陷阱、Raft/Paxos 线性共识。",
    },
    {
      title: "衍生数据、批处理与流系统",
      desc: "MapReduce 与分布式数据流批处理、CDC 日志捕获、事件溯源与流处理端到端确切一次。",
    },
    {
      title: "未来架构：解构数据库与伦理合规",
      desc: "解构数据库思想、跨分区异构数据集成、强健审计跟踪与隐私保护伦理工程。",
    },
  ],
  phases: [
    {
      name: "阶段一：数据系统基石与存储引擎",
      description: "深入剖析单机极限、数据模型演变、LSM 与 B-Tree 底层索引及现代数据模式演化。",
      chapters: [
        {
          order: 0,
          slug: "2026-10-25-data-intensive-systems-00-guide",
        },
        {
          order: 1,
          slug: "2026-10-25-data-intensive-systems-01-trade-offs",
        },
        {
          order: 2,
          slug: "2026-10-25-data-intensive-systems-02-defining-nonfunctional-requirements",
        },
        {
          order: 3,
          slug: "2026-10-25-data-intensive-systems-03-data-models-and-query-languages",
        },
        {
          order: 4,
          slug: "2026-10-25-data-intensive-systems-04-storage-and-retrieval",
        },
        {
          order: 5,
          slug: "2026-10-25-data-intensive-systems-05-encoding-and-evolution",
        },
      ],
    },
    {
      name: "阶段二：分布式数据与一致性保障",
      description: "攻克多副本复制、数据动态分片、ACID 弱隔离级别陷阱、不可靠网络时钟与 Raft 共识状态机。",
      chapters: [
        {
          order: 6,
          slug: "2026-10-25-data-intensive-systems-06-replication",
        },
        {
          order: 7,
          slug: "2026-10-25-data-intensive-systems-07-sharding",
        },
        {
          order: 8,
          slug: "2026-10-25-data-intensive-systems-08-transactions",
        },
        {
          order: 9,
          slug: "2026-10-25-data-intensive-systems-09-the-trouble-with-distributed-systems",
        },
        {
          order: 10,
          slug: "2026-10-25-data-intensive-systems-10-consistency-and-consensus",
        },
      ],
    },
    {
      name: "阶段三：衍生数据与现代数据治理",
      description: "剖析离线批处理计算、CDC 实时流处理、流表二象性、解构数据库及数据伦理与合规治理。",
      chapters: [
        {
          order: 11,
          slug: "2026-10-25-data-intensive-systems-11-batch-processing",
        },
        {
          order: 12,
          slug: "2026-10-25-data-intensive-systems-12-stream-processing",
        },
        {
          order: 13,
          slug: "2026-10-25-data-intensive-systems-13-a-philosophy-of-streaming-systems",
        },
        {
          order: 14,
          slug: "2026-10-25-data-intensive-systems-14-doing-the-right-thing",
        },
      ],
    },
  ],
}

export const ALL_COLUMNS: ColumnSource[] = [
  DISTRIBUTED_GO_COLUMN,
  AI_DDD_COLUMN,
  SPRING_BOOT_ANGULAR_COLUMN,
  RUST_SYSTEMS_COLUMN,
  DATA_INTENSIVE_COLUMN,
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

const STATUS_TEXT: Record<ColumnStatus, (count: number) => string> = {
  completed: (count) => `${count} 篇已完结`,
  updating: (count) => `${count} 篇连载中`,
  planned: (count) => `预计 ${count} 篇`,
}

function chapterNumberFor(order: number): string {
  return order === 0 ? '导读' : `第 ${String(order).padStart(2, '0')} 篇`
}

/** 剥离章节标题里重复的专栏名前缀，章节序号已由 chapterNumber 表达 */
function stripColumnPrefix(title: string, prefix?: string): string {
  if (!prefix) return title
  const marker = `${prefix}（`
  if (!title.startsWith(marker)) return title
  const end = title.indexOf('）：', marker.length)
  if (end < 0) return title
  return title.slice(end + 2).trim() || title
}

/**
 * 把编辑信息与文章 frontmatter 合成完整专栏。
 * 章节标题、描述、标签、分类、篇数与更新日期只认 frontmatter，专栏源文件不再复制一份。
 */
export function hydrateColumn(
  source: ColumnSource,
  postsBySlug: ReadonlyMap<string, ChapterSourcePost>,
): ColumnInfo {
  const { titlePrefix, ...base } = source
  let category: string | undefined
  let latest: Date | undefined
  const chaptersByPhase = new Map<string, ChapterItem[]>()

  for (const phase of source.phases) {
    const chapters: ChapterItem[] = []
    for (const chapter of phase.chapters) {
      const post = postsBySlug.get(chapter.slug)
      if (!post) {
        throw new Error(
          `专栏「${source.title}」的章节 ${chapter.slug} 缺少对应文章文件（content/posts/${chapter.slug}.md）`,
        )
      }

      const postCategory = post.data.category
      if (postCategory) {
        if (category === undefined) category = postCategory
        else if (category !== postCategory) {
          throw new Error(
            `专栏「${source.title}」的章节分类（category）不一致：${chapter.slug} 为 ${postCategory}，其余为 ${category}`,
          )
        }
      }

      if (!latest || post.data.date > latest) latest = post.data.date
      chapters.push({
        order: chapter.order,
        chapterNumber: chapterNumberFor(chapter.order),
        slug: chapter.slug,
        title: stripColumnPrefix(post.data.title, titlePrefix),
        description: post.data.description ?? '',
        phase: phase.name,
        tags: post.data.tags,
      })
    }
    chaptersByPhase.set(phase.name, chapters)
  }

  const totalArticles = [...chaptersByPhase.values()].reduce(
    (sum, chapters) => sum + chapters.length,
    0,
  )

  return {
    ...base,
    category: category ?? '',
    totalArticles,
    statusText: STATUS_TEXT[source.status](totalArticles),
    updatedAt: latest ? latest.toISOString().slice(0, 10) : '',
    phases: source.phases.map((phase) => ({
      name: phase.name,
      description: phase.description,
      chapters: chaptersByPhase.get(phase.name) ?? [],
    })),
  }
}

let cachedColumns: ColumnInfo[] | null = null

function loadColumns(): ColumnInfo[] {
  if (cachedColumns) return cachedColumns
  // skipManifest：专栏合成必须与 frontmatter 同源，避免读到旧清单
  const posts = getCollection('posts', { skipManifest: true })
  const postsBySlug = new Map(posts.map((post) => [post.slug, post]))
  cachedColumns = ALL_COLUMNS.map((source) => hydrateColumn(source, postsBySlug))
  return cachedColumns
}

export function getAllColumns(): ColumnInfo[] {
  return loadColumns()
}

export function getColumn(id: string): ColumnInfo | undefined {
  return loadColumns().find((col) => col.id === id)
}

/**
 * 专栏文章的相邻导航应沿专栏章节顺序走，而不是全局文章日期序：
 * 专栏文章不进入文章列表，用全局上一篇/下一篇会把读者带到别的专栏或非专栏文章。
 * 返回值与 content.getAdjacentEntries 对齐（next=更新/后一章，prev=更早/前一章）。
 */
export function getColumnAdjacentEntries(
  columnId: string,
  slug: string,
): { prev: { title: string; slug: string } | null; next: { title: string; slug: string } | null } {
  const col = getColumn(columnId)
  if (!col) return { prev: null, next: null }
  const chapters = col.phases.flatMap((phase) => phase.chapters)
  const index = chapters.findIndex((chapter) => chapter.slug === slug)
  if (index < 0) return { prev: null, next: null }
  const prevChapter = index > 0 ? chapters[index - 1] : null
  const nextChapter = index < chapters.length - 1 ? chapters[index + 1] : null
  return {
    prev: prevChapter ? { slug: prevChapter.slug, title: prevChapter.title } : null,
    next: nextChapter ? { slug: nextChapter.slug, title: nextChapter.title } : null,
  }
}

/**
 * 构建期守卫：专栏目录与专栏文章必须一一对应。
 * 专栏文章不进文章列表，只靠专栏页暴露入口，一旦失配就会变成死链或孤儿文章，
 * 因此在构建时直接失败，而不是等到读者点击才发现。
 */
export function assertColumnsConsistent(): void {
  const posts = getCollection('posts', { skipManifest: true })
  const postsBySlug = new Map(posts.map((post) => [post.slug, post]))
  const columnIds = new Set(ALL_COLUMNS.map((col) => col.id))

  // 触发合成：缺章节、分类不一致会在这里直接失败
  for (const source of ALL_COLUMNS) {
    hydrateColumn(source, postsBySlug)
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
