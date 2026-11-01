---
title: Spring Boot & Angular 全栈实战（二）：微服务核心架构与业务领域拆解
date: 2026-10-23T00:02:00Z
description: 深入微服务架构设计原则，解构按业务能力拆分、工业级四层分层模型与 Record DTO 规范，搭建 Java 26 与 Spring Boot 4 核心微服务骨架。
category: fullstack
column: spring-boot-angular
tags:
  - Spring Boot
  - 微服务
  - 架构设计
  - Java
---

## 1. 架构选型与决策矩阵

| 架构维度 | 单体架构 (Monolith) | 微服务架构 (Microservices) | 决策依据与生产考量 |
| :--- | :--- | :--- | :--- |
| **部署与交付** | 集中式单包发布，协同窗口强绑定 | 服务级独立构建与蓝绿/金丝雀发布 | 满足业务高频敏捷迭代诉求 |
| **数据边界** | 共享单一数据库，跨表 ACID 强事务 | Database-per-Service 存储隔离，Saga 最终一致性 | 杜绝底层物理数据模型耦合与连接数耗尽 |
| **伸缩弹性** | 整体集群等比扩容，资源利用率低 | 针对热点服务（如库存查询）定向水平扩展 | 优化云资源投入产出比 |
| **容错隔离** | 局部内存泄漏或慢查询拖垮全局服务 | 舱壁隔离与 Resilience4j 熔断降级 | 消除级联崩溃雪崩风险 |
| **技术异构性** | 全局统一技术栈与依赖库版本 | 按业务特征选择存储（PostgreSQL / MongoDB） | 匹配特定业务场景的最佳存储模型 |

## 2. 工业级四层分层生产代码范式

### 2.1 领域实体层 (Model)
```java
package com.packt.bookstore.inventory.model;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;

@Entity
@Table(name = "books")
public class Book {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;
    private String author;
    private BigDecimal price;

    public Book() {}

    public Book(Long id, String title, String author, BigDecimal price) {
        this.id = id;
        this.title = title;
        this.author = author;
        this.price = price;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getAuthor() { return author; }
    public void setAuthor(String author) { this.author = author; }
    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }
}
```

### 2.2 不可变传输对象 (Record DTO)
```java
package com.packt.bookstore.inventory.dto;

import java.math.BigDecimal;

public record BookDTO(Long id, String title, String author, BigDecimal price) {
}
```

### 2.3 持久化仓储层 (Repository)
```java
package com.packt.bookstore.inventory.repository;

import com.packt.bookstore.inventory.model.Book;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface BookRepository extends JpaRepository<Book, Long> {
}
```

### 2.4 业务服务层与事务控制 (Service)
```java
package com.packt.bookstore.inventory.service;

import com.packt.bookstore.inventory.dto.BookDTO;
import com.packt.bookstore.inventory.repository.BookRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class BookService {

    private final BookRepository bookRepository;

    public BookService(BookRepository bookRepository) {
        this.bookRepository = bookRepository;
    }

    @Transactional(readOnly = true)
    public List<BookDTO> getAllBooks() {
        return bookRepository.findAll().stream()
            .map(book -> new BookDTO(
                book.getId(),
                book.getTitle(),
                book.getAuthor(),
                book.getPrice()
            ))
            .toList();
    }
}
```

### 2.5 表现控制器层 (Controller)
```java
package com.packt.bookstore.inventory.controller;

import com.packt.bookstore.inventory.dto.BookDTO;
import com.packt.bookstore.inventory.service.BookService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/books")
public class BookController {

    private final BookService bookService;

    public BookController(BookService bookService) {
        this.bookService = bookService;
    }

    @GetMapping
    public ResponseEntity<List<BookDTO>> getAllBooks() {
        return ResponseEntity.ok(bookService.getAllBooks());
    }
}
```

## 3. Bookstore 平台端到端微服务拓扑流图

```text
[ 浏览器客户端：Angular 22 SPA (Signals + Standalone) ]
                          │
            HTTPS / REST  │  JWT Bearer Token
                          ▼
        [ API 网关：Spring Cloud Gateway ] ──> [ Keycloak 认证中心 ]
        (统一路由 / JWT 鉴权校验 / 路径重写)       (OAuth 2.0 / OIDC 验签)
                          │
      ┌───────────────────┴───────────────────┐
      │ /packt/inventory/api/**               │ /packt/user/api/**
      ▼                                       ▼
[ 库存微服务: inventory-ms ]            [ 用户微服务: user-ms ]
(Spring Boot 4.1 + JPA)                 (Spring Boot 4.1 + Mongo)
      │                                       │
      ▼                                       ▼
 [ PostgreSQL 17 ]                       [ MongoDB 8 ]
      │                                       │
      └───────────────────┬───────────────────┘
                          │ Micrometer Tracing (TraceId / SpanId)
                          ▼
            [ 分布式链路监控：Zipkin ]
```

## 4. 微服务架构避坑清单 (Do's & Don'ts)

| 错误实践 (Don't) | 正确实践 (Do) |
| :--- | :--- |
| 跨微服务提取共享包含业务实体的 Common Jar 依赖库。 | 维护微服务边界自治，跨服务仅共享轻量 OpenAPI 契约或 DTO Spec。 |
| 将持久化 `@Entity` 直接作为 HTTP 控制器出参暴露。 | 使用不可变 Java `record` 作为 DTO，在服务层完成隔离映射。 |
| 多个微服务直连读写同一个底层物理数据库。 | 严格执行 Database-per-Service 规范，服务间数据交互一律经由 API 或领域事件。 |
| 沿技术维度切分服务（如 Controller 集中服务、Service 集中服务）。 | 遵循 DDD 限界上下文，按业务能力（库存、用户、订单）进行纵向切分。 |
| 依赖重型企业服务总线（ESB）完成复杂业务逻辑转换。 | 遵循“聪明端点，管道极简（Smart Endpoints, Dumb Pipes）”原则，业务收敛于微服务内部。 |

<!-- split -->

在上一章中，我们对 Spring Boot 与 Angular 生态系统建立了高层次的全局认知，为构建现代化、可伸缩的应用程序奠定了基石。在基础架构搭建完毕后，现在我们准备深入后端微服务开发的核心地带。

现代软件系统正在快速演进，业务对系统伸缩性（Scalability）、敏捷性（Agility）和高容错弹性（Resilience）的要求日益严苛。传统的单体架构在面对这些挑战时往往力不从心，这也促成了微服务架构（Microservices Architecture）的广泛采用。在本章中，我们将探索如何使用 Spring 生态系统（特别是 Java 26 与 Spring Boot 4.1.x，后序章节还将引入 Spring Cloud）来设计并实现一个微服务。我们的旅程将从理解微服务的本质及其重要性启程，随后深入探讨服务拆分模式、集成模式、分层技术架构以及核心最佳实践。

读完本章后，你将拥有一个结构清晰、具备伸缩能力且能够在生产环境中稳健运行的微服务工程骨架。本章为所有的后端组件打下了根基，在进一步深入之前为你提供必要的架构认知与环境配置。从数据库配置到业务逻辑实现，再到安全集成的所有细节，我们将在后续章节中按部就班地逐一攻坚。这一循序渐进的路径将助你从容构建一套完整且可投产的企业级解决方案。

本章核心涵盖以下主题：

- 微服务概述与核心概念（Introduction to microservices）
- 探索微服务设计模式（Exploring microservice design patterns）
- 理解微服务最佳实践（Understanding microservice best practices）
- 将微服务模式与实践应用于书店系统（Applying Microservices patterns and practices to the Bookstore application）
- 搭建开发环境（Setting up the development environment）
- 创建你的第一个 Spring Boot 微服务（Creating your first Spring Boot microservice）

> **注意**
>
> 书中的部分图片在纸质排版中可能细节较小。我们保留了这些完整的原始界面截图，以便大家能够参照自己屏幕上的实际界面一步步进行操作。你也可以通过《前言》（Preface）中提供的 *Graphics Bundle* 链接查看并放大所有高清原图。

## 技术准备工作（Technical requirements）

在深入探索使用 Angular 和 Spring Boot 构建全栈应用之前，我们先来回顾跟进本章实战所需的工具与技术栈：

| 工具 | 版本 | 用途 |
| :--- | :--- | :--- |
| Java JDK | 26 | 用于开发和运行 Spring Boot 后端（https://www.oracle.com/java/technologies/downloads） |
| Maven | 建议 3.9.x | 用于构建和运行后端服务（https://maven.apache.org） |
| Git | 任意版本 | 用于版本控制及使用本书的代码仓库（https://github.com/git-guides/install-git） |
| VS Code | 最新版 | 推荐的 Spring Boot 与 Angular 全栈开发 IDE（https://code.visualstudio.com） |
| GitHub Desktop | 最新版 | 用于 GitHub 仓库及相关操作的图形化管理工具（https://desktop.github.com/download） |

*表 2.1：所需开发工具清单*

本章源码可在此处获取：`https://github.com/PacktPublishing/Spring-Boot-and-Angular-2E_Backend/tree/main/chapter-02`

> **注意**
>
> 你可以在本章的“搭建开发环境”小节中找到这些工具的详细安装指南。此外，针对 macOS、Linux 和 Windows 平台的开发环境工具与类库配置分步说明及排错指南，均已直接提供在本章代码仓库的 README 和关联的子 README 文件中。

## 微服务概述（Introduction to microservices）

让我们在开启微服务之旅前先厘清事实：微服务绝非仅仅是一个技术流行词或宣传噱头。**微服务（Microservices）**代表着我们在构建与扩展现代化应用时思维模式的根本转变。我们不再维护一个庞大而紧密耦合的单体架构，而是将业务功能拆分为多个聚焦的小型服务，这些服务均可独立部署与治理。这种模式让研发团队能够更快创新、提高发布频率，并根据业务实际瓶颈实现精准水平伸缩，而无需牵一发而动全身。

那么，微服务究竟是什么？简而言之，它是一个封装了特定业务能力的小型自治单元。每个服务通过轻量级通信通道（如 REST API 或异步消息队列）与其他服务协作，且理想情况下拥有专属的数据存储。这意味着单个服务可以独立升级、扩容乃至完全重构，而不会对系统的其余部分造成中断。

一个设计优良的微服务具备以下关键特征：

- **松散耦合（Loose coupling）**：各个服务独立运行，彼此之间不存在强硬依赖。
- **高内聚（High cohesion）**：每个服务聚焦于单一业务目标或功能领域。
- **技术无关性（Technology agnosticism）**：可以根据业务特性为每个服务挑选最适配的技术栈与存储引擎。
- **去中心化数据与治理（Decentralized data and governance）**：每个服务全权掌控自身的数据生命周期与架构规则。
- **为失败而设计与高弹性（Built for failure and resilience）**：架构在设计之初就融入了故障隔离机制。

以下则是微服务**不应该**呈现的形态：

- **单纯技术层面的水平切分**：微服务切忌被机械地按技术分层切成“Controller 服务”、“Service 服务”或“Repository 服务”。相反，它们必须紧密贴合业务领域与业务能力进行纵向划分。
- **依赖重型中间件驱动的系统**：微服务不应依赖沉重的通信中间件来承载核心逻辑。业务逻辑必须内聚在各个微服务内部，遵循“聪明端点，管道极简（smart endpoints, dumb pipes）”的设计原则。
- **多个微服务共享单一数据库**：当多个服务依赖同一个物理数据库时，它们就失去了自治性并陷入底层耦合，这彻底违背了采用微服务的初衷。

在明确了基本定义与核心原则之后，更多深入内容可参考此文章：`https://microservices.io/microservices/antipatterns/-/the/series/2019/06/18/microservices-adoption-antipatterns.html`。接下来，让我们深入权衡在实际生产系统中采用微服务的收益与局限。

### 微服务的优势（Advantages of microservices）

对于软件团队而言，落地微服务往往就像解锁了一项超级能力。一旦实践得当，回报极为可观：更快的交付周期、更强的容错韧性，以及能够精准响应业务诉求的伸缩能力。但与任何架构选型一样，微服务伴随着前置必须正视的权衡（Trade-offs）。

微服务的核心吸引力体现在：

- **敏捷且独立的发布部署**：每个服务都可以按照自身的迭代节奏独立完成构建、测试与上线。
- **多语言与多技术栈共存（Polyglot development）**：团队可以自由地根据每个服务的业务特性选择不同的编程语言、工具或框架。
- **原生的高伸缩设计**：系统扩容时，仅需扩展承受高并发压力的特定服务，而无需整体扩容。

### 微服务的局限性（Limitations of microservices）

尽管微服务优势显著，但迈向微服务的道路并非一马平川。事实上，与单体架构相比，微服务引入了可观的系统复杂度，尤其对小型团队或早期产品阶段而言更是如此。原本单一的可部署单元演变成了分布式系统，随之而来的是分布式计算的所有经典挑战：

- **运维复杂度飙升（Operational complexity）**：必须具备高度自动化的 DevOps 实践，包括全自动化部署、统一监控指标收集与故障自愈机制。
- **分布式系统调试排错困难（Debugging distributed systems）**：在单体系统中，一个调试会话通常就能揪出 Bug。而在微服务中，单次用户请求可能跨越数个微服务调用链，根因分析必须深度依赖 Trace ID / 关联 ID（Correlation IDs）、分布式链路追踪工具以及集中式日志采集平台。
- **测试复杂度增加（Testing challenges）**：端到端（E2E）集成测试变得极具挑战，因为必须协同多个微服务、Mock 外部依赖或拉起整套完整的集成测试环境。契约测试（Contract Testing）与测试数据管理从“锦上添花”变成了“不可或缺”。
- **本地开发难度加大（Local development difficulty）**：在本地运行一个单体应用轻而易举。但要同时本地运行 5 个微服务、1 个 API 网关、服务注册发现中心以及若干数据库，就需要借助容器编排工具、Docker Compose 或本地 Kubernetes。如果环境搭建缺乏全自动化，新成员入职配置环境的效率将大打折扣。
- **数据一致性挑战（Data consistency challenges）**：分布式系统天然面对最终一致性（Eventual Consistency）与网络延迟的制约。
- **网络开销与交互频次增加（Increased network chatter）**：服务间的远程网络调用会引入额外的延迟与网络开销。

核心启示是什么？微服务赋予了架构真正的弹性与伸缩力，但这是有成本的。是否走向微服务，应当由你所在团队的技术成熟度、基础设施准备情况以及业务实际场景来综合决策。在理解了“为什么做”之后，让我们把目光从“为什么”转向“如何做”，深入探讨在实践中让微服务架构成功落地的核心设计模式。

## 探索微服务设计模式（Exploring microservice design patterns）

在本节中，我们将系统梳理一套经过实战检验的设计模式。它们将指导你如何深思熟虑地拆解系统、治理服务间交互，并全面确保整个应用的高可用性与可观测性。每一种模式都根植于工业界工程实践，并针对 Spring Boot 与 Spring Cloud 技术栈给出了针对性的落地指导。

> **注意**
>
> 在阅读这些设计模式时，请记住：你将在后续章节中亲身进行代码实操，届时我们将在书店微服务项目中一步步将它们彻底落地。

### 服务拆分模式（Decomposition patterns）

在构建微服务之前，我们首先要弄清楚如何将系统拆解为有意义的高内聚单元。拆分是至关重要的第一步，不合理的拆分往往会导致无谓的复杂度。

我们推荐两种行之有效的拆分策略：

- **按业务能力拆分（Decompose by Business Capability）**：围绕端到端的业务能力进行拆分，例如支付中心、库存管理或用户管理。这种方式能够使开发团队的领域认知高度对齐，并完美契合**领域驱动设计（DDD）**的核心思想。
- **按子域拆分（Decompose by Subdomain）**：将系统划分为核心子域（Core Domain）、支撑子域（Supporting Subdomain）和通用子域（Generic Subdomain）。这有助于在大型企业级复杂系统中实现更清晰的模块化治理。

有效拆分的实用建议：
- 以领域驱动设计（DDD）为指南；
- 在业务流程中寻找天然的边界（Bounded Context）；
- 切忌一开始就追求绝对完美——允许在迭代开发中适时重构。

当服务边界划分清晰后，接下来的挑战是如何让它们高效通信，这正是集成模式的用武之地。

### 服务集成模式（Integration patterns）

在微服务架构中，通信即生命线。服务之间必须彼此交互，而交互的方式将直接决定整个系统的性能、可靠性与研发体验。

以下是微服务体系中最常见的集成模式：

- **API 网关模式（API Gateway）**：作为外部客户端访问后台的统一入口，集中提供反向代理路由、负载均衡、集中式鉴权认证以及限流熔断等横切关注点。
- **BFF 模式（Backend for Frontend）**：针对不同类型的前端形态（如 Web 端、移动 App 端）量身定制专门的接入层 API，裁剪响应体积并降低前端调用的复杂性。
- **服务网格模式（Service Mesh）**：通过轻量级网络代理（如 Istio 或 Linkerd）透明地接管服务间通信，原生支持流量路由、统一可观测性以及自动重试等通信能力。
- **基于消息的异步通信模式（Message-Based Communication）**：利用异步消息中间件（如 RabbitMQ、Kafka）解耦服务间交互，落地事件驱动架构（EDA）。

最佳实践要点：
- 尽可能减少微服务间的同步强依赖；
- 优先采用异步通信解耦核心链路；
- 确保完备的全局异常处理与退避重试逻辑。

通信顺畅之后，我们还必须考虑各个微服务如何管理自身数据，并彻底避免数据层的紧密耦合。

### 数据管理模式（Data management patterns）

微服务的精髓在于高度自治，而数据独立则是自治的基石。但在实践中，既要保证各服务互不逾矩（数据模型无交集），又要维持系统整体的数据一致性，绝非易事。

以下是常见的数据管理模式：

- **每个服务独享数据库（Database per Service）**：每个微服务全权拥有并管理自身独立的数据库实例或架构 Schema。彻底杜绝共享底层表结构，从源头上斩断数据耦合。
- **事件溯源（Event Sourcing）**：不直接持久化实体的最终状态，而是将所有导致状态变更的领域事件作为不可变日志完整持久化。
- **Saga 模式（Saga Pattern）**：通过编排式（Orchestrated）或协同式（Choreographed）的事务事件序列，在跨微服务场景下安全管理长事务（Long-Running Transactions）。

在设计微服务数据架构时，仅仅选对设计模式还不够，还必须恪守几项关键工程准则，以确保系统在高并发下具备高可用性、高伸缩性且易于维护。在后续章节中你将亲手落地这些模式。以下是最核心的设计准则：

- **优先拥抱最终一致性，而非严苛的跨服务 ACID 强一致性**：在分布式微服务架构中，通常应接纳数据在时间维度上的最终一致（Eventual Consistency），而非像传统单体数据库事务那样苛求所有服务实时步调一致。这大幅降低了系统间的耦合度，并在跨网络、跨机房部署时极大释放了水平伸缩潜力。
- **保证事件的幂等性（Idempotent）与可追溯性（Traceable）**：确保同一个领域事件（例如订单确认事件）即使被重复消费多次，产生的结果也完全相同，不出现重复扣减或副作用。这为应对网络瞬时重试与消息重复投递提供了坚固屏障。同时，每个事件应携带全局唯一的业务流水号与 Metadata，以便在全链路中溯源排查。
- **集中化审计与日志排错（Centralized Event Logging）**：将全系统所有的领域事件汇聚存储在中央日志或事件中心。这使团队能够清晰审视数据在整个分布式系统中的流转脉络，完成审计合规追溯，并在出现异常时快速定位根因。

在完成服务拆分、通信打通并确保数据自治后，我们必须为不可避免的异常做好防御准备。分布式系统中的故障必然会发生，关键在于我们如何从容应对。

### 可靠性模式（Reliability patterns）

在分布式系统中，故障不是“如果会发生”，而是“一定会发生”。核心问题是：当某个依赖服务不可用时，你如何确保你的核心系统依然屹立不倒？可靠性设计模式正是为此而生。

常见的可靠性设计模式包括：

- **断路器模式（Circuit Breaker）**：当下游依赖服务出现持续故障时主动切断请求调用链，避免资源耗尽。通常使用 Resilience4j 等工业级类库实现。
- **指数退避重试模式（Retry with Backoff）**：在遇到瞬时网络抖动时，按递增的时间间隔自动发起重试，给予下游服务缓冲恢复的时间。
- **舱壁隔离模式（Bulkhead）**：通过隔离线程池或并发信号量，将单点故障严格限制在局部，避免波及全局线程资源。
- **超时与降级回退模式（Timeouts and Fallbacks）**：为所有远程调用设定严格的超时阈值，并在发生超时或熔断时执行预置的兜底降级逻辑（Graceful Degradation）。

最佳实践要点：
- 主动监控各项阈值并建立灵敏的告警规则；
- 在所有核心远程集成调用点引入成熟的容错库（如 Resilience4j、Spring Retry）；
- 核心服务应当面向“优雅降级”设计——降级部分边缘服务，保全系统整体可用性。

容错弹性只是硬币的一面。我们还需要全面洞悉系统内部的运行状态，这便引出了“可观测性”体系。

### 可观测性模式（Observability patterns）

要高效运维与掌控微服务，你必须能够透视系统内部运作细节。可观测性绝不仅仅意味着打印几行日志，而是指在生产环境中对复杂链路交互具备深度洞察与调试分析的能力。

核心可观测性模式包括：

- **集中式日志分析（Centralized Logging）**：使用 ELK Stack（Elasticsearch, Logstash, Kibana）或 Fluentd / OpenSearch 等平台统一聚合解析各节点日志。
- **分布式链路追踪（Distributed Tracing）**：通过 OpenTelemetry、Zipkin 或 Jaeger，对跨服务的调用链实施全局 Trace ID 跟踪。
- **指标收集与监控（Metrics Collection）**：借助 Prometheus 与 Grafana 采集并可视化系统的核心 KPI（如请求延迟、QPS 吞吐量、错误率以及 JVM 运行时指标）。
- **健康检查与探针（Health Checks）**：为 Kubernetes 等容器编排平台提供精准的存活探针（Liveness）与就绪探针（Readiness）。

核心实践要领：
- 可观测性必须在研发阶段就规划引入，绝非上线后的临时补丁；
- 所有请求一律透传关联 ID（Correlation ID / Trace ID）；
- 可视化服务拓扑与调用链，极大加速根因定位速度。

掌握了上述设计模式之后，我们接着探讨如何保障微服务的长期健康运转。接下来我们将深入剖析在开发流程、运维卓越与团队协作方面的工程最佳实践。

## 理解微服务最佳实践（Understanding microservice best practices）

构建微服务绝不仅仅是机械套用设计模式，更在于你在整个研发生命周期中所秉持的严谨与一致性。在本节中，我们将带你全面掌握那些至关重要的最佳实践，确保你的微服务不仅在编码阶段顺畅，更在自动化测试、部署发布以及长期演进中稳健自如。

> **注意**
>
> 上一节介绍的设计模式偏重宏观架构策略，而这里的最佳实践则聚焦日常工程编码与落地手法。接下来的示例代码片段旨在让你提前感受后续章节的实操风格，现阶段建议着重领会其分层意图与设计思想，后序章节我们将逐步编码实现。

我们将这些最佳实践分为三大维度：研发流程规范、卓越运维与 DevOps 实践，以及团队协作实践。首先来看如何让微服务更容易演进与维护。

### 研发流程最佳实践（Development process best practices）

为了具象化研发流程的最佳实践，本节我们将以一套基于 **Java 26**、**Spring Boot 4.1.0** 以及 **Spring Cloud** 的微服务工程为例进行说明。这一探索将覆盖整个开发生命周期，涵盖架构分层、编码规范与测试体系的顶级实践。

#### 架构分层最佳实践

在动手编写具体代码之前，让我们先思考为什么需要如此重视分层架构。把软件架构想象成房屋建筑蓝图：如果没有蓝图，你可能会盖出一间华丽的厨房，却发现根本没有预留进门的走廊！在软件工程中，清晰的分层架构绝非可有可无的花架子，而是让系统在功能膨胀过程中依然保持高内聚、易维护、易测试的核心骨架。特别是在复杂度呈指数级扩散的微服务体系中，规范的结构是阻隔混乱的坚固防火墙。

当然，并没有一套放之四海而皆准的绝对唯一架构。在本章中，我们为书店（Bookstore）微服务采用工业界广泛验证的经典分层规范作为学习基线，这种结构职责分明，极易上手和测试。

从底层数据模型到上层 RESTful 端点，让我们逐层拆解微服务内部的组件构成，展示它们如何严丝合缝地协同工作：

- **领域与仓储层（Domain and Repository Layer）**：负责底层数据库持久化与数据访问。
- **DTO 与对象映射层（DTO/Mapper Layer）**：负责在内部领域实体与对外网络传输契约之间执行安全转换。
- **业务服务层（Service Layer）**：封装核心领域业务规则与事务逻辑。
- **控制器层（Controller Layer）**：负责监听 HTTP 请求、解析入参并封装规范的 HTTP 响应体。

这种层级隔离确保了代码高度模块化、易于单元测试且重构成本极低。下面我们通过简化的书店领域代码来逐一审视各层实现。

#### 领域与仓储层（Domain and repository layer）

首先定义你的领域实体模型。例如，在构建图书库存业务时定义 `Book` 实体类：

```java
@Entity
public class Book {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String title;
    private String author;
    // getters and setters
}
```

接下来定义对应的 Repository 接口，直接继承 Spring Data JPA 提供的内建能力，无需编写任何多余代码即可获得全套开箱即用的 CRUD 与分页功能：

```java
public interface BookRepository extends JpaRepository<Book, Long> {}
```

#### DTO 与映射器（DTO and mapper）

声明一个不可变的数据传输对象（DTO），专门用于通过网络对外暴露图书数据：

```java
public record BookDTO(Long id, String title, String author) {}
```

随后配合手写工具类或引入 `MapStruct`，实现 `Book` 实体与 `BookDTO` 之间的无缝互转。有关 DTO 与 MapStruct 的高阶用法将在后序章节深入展开。

#### 业务服务层（Service layer）

在 `BookService` 类中实现核心业务逻辑，并与底层仓储交互：

```java
@Service
public class BookService {
    private final BookRepository bookRepository;

    public BookService(BookRepository bookRepository) {
        this.bookRepository = bookRepository;
    }

    public List<BookDTO> getAllBooks() {
        return bookRepository.findAll().stream()
            .map(book -> new BookDTO(book.getId(),
                book.getTitle(), book.getAuthor()))
                .collect(Collectors.toList());
    }
}
```

#### 控制器层（Controller layer）

在表现层中，我们定义 `BookController` 类，通过 Spring Boot 声明式注解暴露 RESTful API 端点（`/books`）。该控制器拦截 HTTP GET 请求，委派 `BookService` 获取图书列表，将结果包装为 `BookDTO` 集合，并最终以标准化的 `ResponseEntity` 结构返回给调用方。这种模式彻底隔离了关注点：Controller 仅专注于 HTTP 契约与报文装配，核心业务逻辑完整收敛于 Service 层：

```java
@RestController
@RequestMapping("/books")
public class BookController {

    private final BookService bookService;

    public BookController(BookService bookService) {
        this.bookService = bookService;
    }

    @GetMapping
    public ResponseEntity<List<BookDTO>> getAllBooks() {
        return ResponseEntity.ok(bookService.getAllBooks());
    }
}
```

清晰的分层架构绝非纸上谈兵，它能让你写出整洁、具备高可测性与高维护性的代码，为书店系统后续的无缝扩展筑牢地基。当每个层级各司其职时，你便能胸有成竹地推进业务演进。

#### 编码最佳实践（Coding best practices）

干净、一致且可维护的代码是微服务健康运行的根基。以下是值得日常严格贯彻的编码准则：

- **遵循整洁架构原则（Clean architecture principles）**：使用分层架构严格隔离关注点（*Controller → Service → Repository → Mapper/DTO*）。在库存微服务中，`BookController` 专注处理 HTTP 请求，`BookService` 封装业务规则，`BookRepository` 专注数据库读写，`BookMapper` 负责实体与 DTO 转换。严禁将业务逻辑泄露至 Controller，严禁在 Service 层直接拼接 SQL 或暴露底层持久化细节。
- **审慎合理地使用 DTO 与 Mapper**：坚决禁止将内部领域实体（`@Entity`）直接作为 API 返回值暴露给外部客户端。统一返回 `BookDTO`，确保内部字段、数据库关联关系或未来的表结构变更不会意外破坏对外开放的公共 API 契约。
- **编写严密的测试矩阵（单元测试、集成测试与契约测试）**：每个微服务必须具备独立验证自身行为的能力。例如，`BookService` 应通过 Mock Repository 进行纯粹的业务单元测试；Controller 层则通过 MockMvc 验证请求拦截与响应状态码。在跨服务协同前，务必保证各个组件单体测试全绿。
- **保持服务职责单一且专注**：每个微服务仅掌控一项核心业务能力并力求做到极致。例如用户微服务（User Service）全权负责用户档案管理与身份认证关注点，绝不与库存逻辑发生交叉，保持清晰的限界上下文与独立部署能力。
- **坚决避免通过共享公共类库封装核心业务逻辑**：在书店项目中，我们严禁将业务规则抽取到跨服务的通用公共 JAR 包中。每个服务拥有完全独立的领域逻辑。通过共享库下发业务代码极易在微服务间引入隐式强耦合与版本锁死。

这些实践并非脱离现实的学院派理论，而是能让微服务长久保持模块化、易读且易于横向扩展的工程定海神针。

### 卓越运维与 DevOps 最佳实践（Operational excellence and DevOps best practices）

引入 Spring Boot Actuator 可以让微服务实时对外暴露自身运行健康状态、就绪探针以及性能指标，这对于运维监控、故障自愈与系统可靠性维系至关重要。

通过在工程中引入依赖并在 `application.properties` 中添加如下配置启用 Actuator：

```properties
management.endpoints.web.exposure.include=health,info,metrics
```

开发人员、运维团队或 Kubernetes 编排平台可以通过以下核心端点洞察服务状态，并自动执行故障 Pod 重启或根据负载动态扩缩容：

- `/actuator/health` —— 供存活探针（Liveness）与就绪探针（Readiness）健康检测使用；
- `/actuator/metrics` —— 暴露关键性能与运行时指标。

在微服务体系中，构建高度自动化、可重复且透明可观测的发布环境是核心抓手。以下最佳实践将助力你规范化日常运维：

- **使用 Docker 进行服务容器化**：保障构建产物的高度便携性与环境一致性；
- **打通自动化 CI/CD 流水线**：借助 GitHub Actions、Jenkins 或 GitLab CI 自动化执行从代码扫描、测试到镜像构建与上线的全流程；
- **推行严谨的 API 与微服务版本控制**：杜绝破坏性变更（Breaking changes），保障上下游平滑升级；
- **结构化日志输出**：统一采用 JSON 格式输出日志，并携带全局请求跟踪 ID 与规范的日志级别；
- **全面启用健康检查与指标端点**：无缝对接云原生监控与编排底座。

将卓越运维与 DevOps 最佳实践融入日常工作，能够大幅消弭研发与运维之间的沟通鸿沟，带来更高的发布频次与更强健的系统表现。

### 团队协作最佳实践（Team collaboration best practices）

当研发团队的组织架构与他们所维护的微服务边界高度一致时，微服务才能发挥出最大威力。即便是我们这套精简的书店系统案例，你也能直观感受到服务边界是如何明确划定系统归属与职责分工的。

在此阶段，我们结合当前项目给出务实落地的协作建议，避免陷入繁琐的组织理论：

- **围绕业务领域组建跨职能团队**：充分顺应康威定律（Conway's Law，即系统设计往往映射了组织的沟通架构）。即便在小型团队中，以业务能力划分开发职责也能从源头避免权责交叉。
- **确立清晰的服务归属权（Service ownership）**：每个微服务从需求设计、编码测试到生产运维的全生命周期，都应有明确的团队全权负责。
- **使用 Swagger/OpenAPI 等标准化工具书写 API 文档**：清晰严谨的接口契约能消弭 90% 以上的跨团队联调故障。
- **建设开发者门户与服务目录（Service catalogs）**：让其他协同团队能够轻松发现、调用与复用已有微服务。
- **建立轻量级工程治理准则**：在命名规范、版本号升级策略、统一异常结构与安全防线方面确立基线准则。
- **兼顾微服务自治与全局规范**：微服务赋予了极高的局部自治权，但缺乏章法的自治必然滑向混乱。轻量级治理在不扼杀创新的前提下确保了系统的全局一致性。

随着业务发展与更多研发团队的加入，这些朴素的工程习惯将自然进阶为更加规范的领域对齐团队、集中式服务目录与治理中台。当下最重要的是建立清晰的技术与业务边界，为未来的顺畅协作铺平道路。

在接下来的内容中，我们将通过 Spring Boot 与 Spring Cloud 亲手将上述设计付诸实践。让我们卷起袖子，正式进入架构实操！

## 将微服务模式与实践应用于书店系统（Applying microservices patterns and practices to the Bookstore application）

理论讲解告一段落，现在是时候卷起袖子动真格了！我们将把刚才讨论的所有抽象概念——从设计模式、分层策略到 Spring Cloud 核心工具链——全部代入一个真实的工业级实战案例中。在本节中，我们将剖析这套基于 Spring 生态构建的现代云原生在线书店（Bookstore）系统的全栈架构。这一案例真实还原了电商核心业务场景，让你能在实战中编码、调试并演进这套微服务应用。

### 架构设计：微服务全链路分层流转

让我们首先从宏观上审视整个系统的全景设计。书店后端由**两大核心 Spring Boot 微服务**（**图书库存微服务 Book Inventory** 与 **用户管理微服务 User Management**）、一个**基于 Spring Cloud 构建的统一 API 网关**，以及**基于 Keycloak 的集中式安全认证鉴权中心**组成。前端采用 Angular 22 打造，统一通过 API 网关与后端交互。全链路可观测性则通过 Spring Boot Actuator、Micrometer Tracing 与 Zipkin 深度集成。

下图展示了系统高层次端到端架构，直观呈现了前端、网关、各微服务、多范式数据库、安全认证中心与可观测性工具链之间的协同流转：

![图 2.1：书店应用程序的整体架构](/media/posts/spring-boot-angular/img-08896.png)

*图 2.1：书店应用程序的整体架构*

图中的每一个组件均已实现容器化，并通过 Docker Compose 进行本地编排联动，同时无缝支持本地调试与基于 CI/CD 的持续交付流水线。

### 微服务内部垂直分层架构

下图展示了图书库存（Book Inventory）与用户管理（User Management）两大微服务内部所采纳的标准分层架构。这种分层方式大幅降低了后期维护成本，增强了单元测试覆盖率，并实现了极高的代码关注点隔离。

![图 2.2：书店微服务的分层架构](/media/posts/spring-boot-angular/img-08898.png)

*图 2.2：书店微服务的分层架构*

每个微服务内部严格划分为：

- **控制器层（Controller Layer）**：对外暴露支持分页检索的 RESTful 端点；
- **业务服务层（Service Layer）**：封装核心领域逻辑，以无状态且易测试的方式编排业务规则；
- **数据仓储层（Repository Layer）**：库存微服务使用 Spring Data JPA（连接 PostgreSQL 关系数据库），用户微服务使用 Spring Data MongoDB（连接 MongoDB 文档数据库）；
- **DTO 映射层（DTO Layer）**：严密把控网络传输模型与内部持久化实体之间的映射转换。

### 微服务技术栈全景图

下图清晰列出了支撑我们微服务体系的具体 Spring 生态组件。图中的每一个组件都经过精心遴选，旨在在框架抽象、灵活性与工业级生产力之间取得最佳平衡。

![图 2.3：Spring Boot 微服务技术栈概览](/media/posts/spring-boot-angular/img-08900.png)

*图 2.3：Spring Boot 微服务技术栈概览*

这种架构设计在简化维护成本的同时大幅提升了可测性，保障了代码分层的极致整洁。

技术栈全景图中展示的核心组件各司其职：

- **Spring Boot REST API**：作为微服务接入基座，内嵌高性能 Web 容器，提供声明式 RESTful 端点支持；
- **Spring Data JPA**：针对 PostgreSQL 关系数据库提供高层级的声明式 Repository 持久化抽象；
- **Spring Data MongoDB**：针对 MongoDB 文档存储提供高效的领域对象映射与查询能力；
- **Spring Cloud**：全面提供统一 API 网关、动态服务发现与分布式熔断容错治理。

### 安全鉴权与 API 网关集成（Security and gateway integration）

安全在任何生产系统中都是头等大事。在本书架构中，我们采用 Keycloak 统筹负责全系统 JWT 令牌的签发与公钥验签，并结合 Spring Security 严密防护所有受保护端点。Spring Cloud Gateway 承担整个后端的统一入口，负责在网络边缘拦截并解析校验 JWT，并利用 Resilience4j 实施断路保护。

网关配置核心要点：

> **注意**
>
> **网关核心路由映射规则**：`/packt/inventory/api/**` 路由转发至库存微服务，`/packt/user/api/**` 路由转发至用户管理微服务。

- **JWT 深度支持**：网关在边界拦截校验令牌合法性，并将解析出的用户身份等元数据作为 HTTP 请求头透传给下游内部微服务；
- **Keycloak Realm 领域配置**：精细配置了普通用户（User）与管理员（Admin）角色权限体系。

这一架构筑牢了一套高伸缩、安全可控且全局可观测的微服务后端底座，能够与 Angular 22 前端无缝咬合，成为在线书店系统的坚实中枢。

在动手开发前后端服务之前，首先必须搭建一套稳固可靠的本地开发环境。让我们在下一节中将其配置到位。

## 搭建开发环境（Setting up the development environment）

在本节中，我们将带你完成本地开发所需的所有工具与运行时的安装配置，确保你能够无缝开发、测试并运行全栈代码。

针对更详尽的安装指导、特定操作系统（macOS、Linux 和 Windows）的特殊配置细节以及常见排错方案，请参阅本章 GitHub 仓库中的环境配置文件：`https://github.com/PacktPublishing/Spring-Boot-and-Angular-2E_Backend/blob/main/chapter-02/ENVIRONMENT_SETUP.md`

该文档会随着各运行时的更新而持续维护，可作为环境搭建的权威参考源。

### 安装 Java 26

开发和运行 Spring Boot 后端必须在系统中安装并正确配置 **Java 开发工具包（JDK）**。在本书中，我们统一采用 Java 26 进行开发实战，以便充分发挥模式匹配与结构化并发等前沿语言特性的威力。Spring Boot 4.1.0 最低要求 Java 17，但为了与本书代码仓库完全一致，强烈建议安装 JDK 26。

请按照以下步骤下载、安装并验证 Java 26：

1. 访问 Oracle 官方网站下载并安装最新的 JDK 26：`https://docs.oracle.com/en/java/javase/26/install/`。
2. 配置 `JAVA_HOME` 环境变量。
3. 将 JDK 的 `bin` 目录追加至系统环境变量 `PATH` 中。
4. 在终端中验证默认 JDK 版本是否为 26：

```bash
java --version
```

5. 在 macOS 系统中，若默认版本未切换为 26，可以使用如下命令快速切换：

```bash
/usr/libexec/java_home -v 26 --exec javac -version
export JAVA_HOME=`/usr/libexec/java_home -v 26`
```

6. 再次运行版本验证命令确认生效：

```bash
java --version
```

此外，你也可以使用 `SDKMAN` 工具——这是一个极其简便强大的 Java 与多 SDK 版本管理工具。通过运行下列命令，SDKMAN 会自动完成 Java 26 的下载、解压安装与默认环境变量绑定，彻底免去手动配置系统变量的繁琐步骤。这对于经常在不同 Java 版本间切换的开发者尤为方便。你可以访问官网 `https://sdkman.io/install/` 安装 SDKMAN：

```bash
sdk version
sdk list java
sdk install java <java-26-identifier>
```

下图展示了 SDKMAN 在终端中的执行过程：下载、安装并将 Java 26（`java 26-oracle`）设为系统默认 JDK，并输出配置成功的提示信息：

![图 2.4：使用 SDKMAN 安装 Java 26](/media/posts/spring-boot-angular/img-08902.png)

*图 2.4：使用 SDKMAN 安装 Java 26*

### 安装 Maven（建议 3.9.x）

为了编译、打包和管理 Spring Boot 工程，系统中需要配置 Apache Maven。访问 Maven 官方网站 `https://maven.apache.org`，根据指导下载压缩包、配置环境变量，并通过下列命令验证安装是否成功：

```bash
mvn --version
```

### 安装 Visual Studio Code

访问 `code.visualstudio.com` 下载并安装适用于你操作系统的 VS Code 最新版。

### 安装 Docker

为了运行容器化依赖（如 PostgreSQL、MongoDB、Keycloak 等）并保证跨环境一致性，本地必须安装 Docker。访问 Docker 官网 `https://docker.com` 获取安装指南。你可以安装 Docker Desktop，或选择轻量级开源替代方案（如 Rancher Desktop），借助其图形化界面轻松在本地构建、运行与管理容器镜像。详细信息可参阅 Docker Desktop 文档 `https://docs.docker.com/desktop/` 或 Rancher Desktop 官网 `https://rancherdesktop.io/`。

### 安装 Git

为了拉取本书代码、实施版本控制及开展协作，必须安装 Git。可前往 Git 官方网站 `https://git-scm.com/downloads` 下载安装。如果你倾向于图形化界面操作，可以安装 GitHub Desktop：`https://desktop.github.com/download/`。

### 克隆书店项目代码仓库

在基础环境准备就绪后，接下来克隆贯穿全书实战的核心代码仓库。你需要同时获取后端与前端仓库，以完整演练全栈书店系统：

```bash
git clone https://github.com/PacktPublishing/Spring-Boot-and-Angular-2E
git clone https://github.com/PacktPublishing/Spring-Boot-and-Angular-2E_Backend
git clone https://github.com/PacktPublishing/Spring-Boot-and-Angular-2E_Frontend
```

克隆这些仓库后，你就可以跟随全书章节逐步构建、调试与运行完整的 Bookstore 系统。

开发环境与代码均已齐备，接下来我们将一步步构建一个整洁、可维护且符合生产规范的微服务。

## 创建你的第一个 Spring Boot 微服务（Creating your first Spring Boot microservice）

亲手从零搭建起第一个微服务总有一种让人兴奋的魔力。在这里，软件架构走向落地，设计蓝图转化为可执行的代码。在本节中，我们将通过 VS Code 完整走完构建第一个 Spring Boot 微服务的全流程：从 IDE 插件配置，到使用 Spring Initializr 生成工程脚手架，再到划分 Controller、Service、Repository 与 DTO 分层包结构。

哪怕你此前没有深入接触过 Spring 生态也无需担忧，我们将稳扎稳打地逐步推进。

### 第 1 步：配置集成开发环境（IDE）

在敲下第一行 Java 代码前，我们首先让 VS Code 具备完整的 Spring Boot 开发支持。

#### 配置 VS Code 专属 Profile

我们通过配置专属开发配置方案（Profile）来优化工作区：

1. 打开 Visual Studio Code。
2. 进入配置管理界面：依次点击 **File**（文件）| **New Window with Profile**（使用配置文件新建窗口）| **New Profile…**（新建配置文件…）。也可以直接使用快捷键 *Ctrl* + *Shift* + *X*（macOS 为 *Cmd* + *Shift* + *X*）唤出面板。
3. 点击 **New Profile** 按钮，在模板选项中选择 **From Template** | **Java Spring**。
4. 按照图 2.5 所示配置新模板信息。
5. 点击 **Create**（创建）。

![图 2.5：创建名为 "Packt Java Spring" 的 VS Code 配置文件](/media/posts/spring-boot-angular/img-08904.png)

*图 2.5：创建名为 "Packt Java Spring" 的 VS Code 配置文件*

#### 安装 VS Code Java 与 Spring 扩展插件

现在我们在 VS Code 中安装核心扩展插件：

1. 打开 VS Code。
2. 进入插件市场面板（**Extensions**，快捷键 *Ctrl* + *Shift* + *X*）。
3. 搜索并安装下列扩展包：
   - 微软出品的 **Extension Pack for Java**（包含 Java 语言智能提示、Maven 支持与调试器）：

![图 2.6：安装 Extension Pack for Java](/media/posts/spring-boot-angular/img-08906.png)

*图 2.6：安装 Extension Pack for Java*

   - VMware 出品的 **Spring Boot Extension Pack**（包含 Spring Initializr 向导、Boot Dashboard 与配置文件智能补全等）：

![图 2.7：安装 Spring Boot Extension Pack](/media/posts/spring-boot-angular/img-08908.png)

*图 2.7：安装 Spring Boot Extension Pack*

安装完毕后，VS Code 将变身为智能的 Spring 开发利器——支持类型自动推导、样板代码快速生成，并与 Spring Boot 生命周期工具深度融合。

> **注意**
>
> 当 VS Code 与 GitHub Copilot 结合使用时，编码效率将实现质的飞跃。在编写 Spring Boot 业务逻辑、设计 REST 端点或生成样板类时，AI 结对助手将带来极大助力。我们将在*第 3 章*中详细拆解如何在 VS Code 中深度配置并用好 GitHub Copilot。

### 第 2 步：使用 Spring Initializr 生成工程脚手架

创建 Spring Boot 工程最便捷的途径是使用官方的 Spring Initializr 网页生成器：

1. 打开浏览器并访问 `https://start.spring.io`。
2. 按照以下技术参数配置项目：
   - **Project**：**Maven**
   - **Language**：**Java**
   - **Spring Boot**：**4.1.0**
   - **Group**：`com.packt.bookstore`
   - **Artifact**：`inventory-ms`
   - **Dependencies**：添加 **Spring Boot DevTools**、**Spring Web**、**Spring Boot Actuator**。

![图 2.8：使用 Spring Initializr 配置新的 Spring Boot 微服务项目](/media/posts/spring-boot-angular/img-08910.png)

*图 2.8：使用 Spring Initializr 配置新的 Spring Boot 微服务项目*

3. 点击 **Generate** 按钮下载生成的工程 ZIP 压缩包。
4. 解压该 ZIP 文件，并在 VS Code 中打开该文件夹。
5. 若系统弹出提示“*Do you trust the authors of the files in this folder?*”（是否信任此文件夹中文件的作者？），点击选择 **Yes, I trust the authors**。
6. 根据界面提示开启项目源码分析并接受相关数据许可协议，完成初始化加载。

此时，在 VS Code 左侧资源管理器中便能看到完整的 Maven 标准工程目录树。

### 第 3 步：运行微服务应用程序

为了验证工程脚手架一切正常，在项目路径 `src/main/java/...` 下找到并打开主启动类 `InventoryMsApplication.java`，直接点击编辑区上方的 **Run** 按钮。

![图 2.9：VS Code 项目视图展示启动类](/media/posts/spring-boot-angular/img-08912.png)

*图 2.9：VS Code 项目视图展示启动类*

或者打开终端进入工程根目录，通过 Maven Wrapper 启动应用：

```bash
./mvnw spring-boot:run
```

在终端输出日志中，你将看到 Spring 经典的字符画 Banner 与启动日志，末尾输出形如 **Started InventoryMsApplication** 的提示信息。祝贺你，你的第一个微服务已成功运行！

![图 2.10：VS Code 终端展示项目成功运行](/media/posts/spring-boot-angular/img-08914.png)

*图 2.10：VS Code 终端展示项目成功运行*

需要注意的是，不同开发人员的本地操作系统与环境可能存在较大差异。操作系统类型、多 JDK 版本共存、环境变量 PATH 缺失、IDE 扩展冲突或后台端口被占用等情况，都可能导致启动或构建失败。如果遇到常规排查无法解决的问题，请参阅代码仓库中的官方排错专栏获取详细的诊断指南与跨平台解决方案：

`https://github.com/PacktPublishing/Spring-Boot-and-Angular-2E_Backend/blob/main/TROUBLESHOOTING.md`

### 第 4 步：规划微服务工程分层包结构

为了构建一套易伸缩、高维护性的工业级微服务，让我们为应用建立规范的模块化分层包结构。在项目主包 `com.packt.bookstore.inventory` 下，推荐建立如下目录层级：

![图 2.11：库存微服务目录结构](/media/posts/spring-boot-angular/img-08916.png)

*图 2.11：库存微服务目录结构*

请在 `src/main/java/com/packt/bookstore/inventory` 目录下手动创建对应的子包（`controller`、`service`、`repository`、`dto`、`model` 等）。这种清晰的分层结构与工业界大型团队的微服务工程标准完全同构，能够对多人协作、模块化测试以及持续集成流水线提供最佳支持。

现在你的开发环境已校准就绪，基础脚手架也搭建完毕，你已具备了进一步扩展微服务、集成高级特性并迎接实际业务挑战的坚实基础。在接下来的章节中，我们将首先深入探索如何将 AI 作为代码开发助手，包括具体的环境配置以及如何高效驾驭 AI 提示词以释放其最大生产力。

## 本章小结（Summary）

设计微服务既是一门严谨的工程科学，也是一门平衡的架构艺术。本章通过搭建全栈开发环境并剖析微服务架构体系，为书店系统后端开发奠定了核心基础。我们通过配置搭载 Java 与 Spring 插件的 VS Code 环境提升了编码效能，拉取了全套项目初始代码，并安装配置了 Maven 与 Git 来管理构建和版本生命周期。

在架构设计与开发环境就绪后，你现在已拥有了借助现代工程工具链加速软件研发的充分底气。

下一章我们将引入专属的 AI 开发助手，详细演示如何使用 GitHub Copilot 等工具辅助生成代码、高效完成安全重构，并以更快的节奏和更强的信心探索与驾驭 Spring Boot 工程。
