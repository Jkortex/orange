---
title: Spring Boot & Angular 全栈实战（二）：微服务核心架构与业务领域拆解
date: 2026-10-23T00:02:00Z
description: 双栏独立滚动对照：深入微服务架构设计原则，解构按业务能力拆分、工业级四层分层模型与 Record DTO 规范，搭建 Java 26 与 Spring Boot 4 核心微服务骨架。
category: fullstack
column: spring-boot-angular
tags:
  - Spring Boot
  - 微服务
  - 架构设计
  - Java
---

> 💡 **双栏独立滚动工作台导读**：本文采用双栏对照架构。**左栏**为核心技术决策矩阵、生产级代码范式与避坑清单；**右栏**为技术实现演化参考，并提供关键段落的英文原文展开与难词解析。左右两栏可独立滚动，并支持顶栏自定义宽度比例（7:3 / 5:5 / 3:7）与拖拽调节。

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

# 原著完整参考：微服务核心架构与业务领域拆解

现代企业级软件系统面临着高伸缩性、敏捷迭代与高可用容错的严苛诉求。传统的单体架构在面对复杂的业务扩张和大型团队协作时往往面临维护瓶颈。

本文从微服务架构设计哲学的本质出发，解构核心设计模式与工程分层规范，并通过 Bookstore 电商实战案例完成核心业务领域的拆解，最后使用 Java 26 与 Spring Boot 4 搭建起工业级微服务工程骨架。

:::en
> **Original**: Microservices architecture structures an application as a collection of loosely coupled, highly cohesive, and independently deployable services organized around business domains.

**📌 核心术语与语境解析**：
- **Microservices** [ˈmaɪkrəʊˌsɜːvɪsɪz]：*微服务*。以轻量级通信机制协同工作的自治服务集合架构。
- **Loose Coupling** [luːs ˈkʌplɪŋ]：*松散耦合*。各微服务保持协议与运行依赖最小化，演进互不制约。
- **High Cohesion** [haɪ kəʊˈhiːʒn]：*高内聚*。单个微服务内聚单一领域职责，变更范围收敛在边界内。
- **Anti-Pattern** [ˈænti ˈpætən]：*反模式*。看似有效但在生产环境中带来更高维护成本或系统性风险的错误范式。
:::

## 1. 微服务的本质与反模式剖析

微服务是构建大型分布式软件系统的一次范式转变。其核心逻辑是将原本紧密耦合的大型单体系统，按业务边界划分为一组小而专注、自治解耦、可独立部署和演进的微小服务单元。

### 1.1 优良微服务架构的核心特征

一个遵循现代云原生规范的微服务系统具备以下关键特征：

1. **松散耦合（Loose Coupling）**：各微服务独立运行与发布，彼此之间无强物理依赖，协议层严格解耦；
2. **高内聚（High Cohesion）**：单个服务专注于单一业务能力或领域边界，职责专一；
3. **技术无关性（Technology Agnosticism）**：在保持统一契约的前提下，允许不同微服务根据业务场景选择最适宜的技术栈（如关系型库或文档型库）；
4. **去中心化数据与自治治理（Decentralized Data & Governance）**：各服务自主掌控其存储与数据生命周期，禁止跨服务跨库直接访问；
5. **为失败而设计（Built for Failure & Resilience）**：分布式网络充满不确定性，系统在架构层原生具备故障隔离、降级与自我恢复机制。

### 1.2 常见的微服务反模式（Anti-Patterns）

在工程实践中，微服务落地初期容易陷入误区，必须警惕以下反模式：

- **单纯技术维度的横向分层拆分**：将系统强行切分为“Controller 服务”、“Service 服务”或“DAO 服务”，违背了微服务初衷。微服务的划分必须沿**业务领域（Business Domain）**纵向切割，而非技术层；
- **智能管道与哑终端（Smart Pipes, Dumb Endpoints）**：过度依赖复杂的集中式 ESB 或重型中间件做业务逻辑路由与消息转换。微服务推崇“**聪明端点，管道极简（Smart Endpoints, Dumb Pipes）**”，业务逻辑必须内聚于服务内部；
- **共享单一数据库（Shared Database）**：多个独立微服务直接读写同一个底层物理数据库。这不仅剥夺了服务的自治性，造成致命的数据模型耦合，还会导致数据库瓶颈无法随服务扩容而解除。

---

## 2. 架构权衡：微服务的工程红利与分布式复杂性

任何架构设计都是基于权衡（Trade-offs）的艺术。微服务能够释放极大的业务迭代效率，但也必然引入分布式系统固有的一系列技术挑战。

```text
                ┌─────────────────────────────────┐
                │        单体架构 vs 微服务架构    │
                └────────────────┬────────────────┘
                                 │
         ┌───────────────────────┴───────────────────────┐
         ▼                                               ▼
┌──────────────────┐                            ┌──────────────────┐
│   单体架构优势   │                            │   微服务核心红利 │
├──────────────────┤                            ├──────────────────┤
│ • 本地调用极速   │                            │ • 敏捷独立发布   │
│ • 单体事务强 ACID│                            │ • 业务边界隔离   │
│ • 本地单断点调试 │                            │ • 精准弹性伸缩   │
│ • 极简单一发布包 │                            │ • 异构技术选型   │
└──────────────────┘                            └──────────────────┘
         │                                               │
         ▼ 演进瓶颈                                     ▼ 对应代价
┌──────────────────┐                            ┌──────────────────┐
│ 牵一发而动全身   │                            │ 分布式链路与排障 │
│ 编译发布周期冗长 │                            │ 最终一致性妥协   │
│ 数据库连接数瓶颈 │                            │ 容器编排运维门槛 │
└──────────────────┘                            └──────────────────┘
```

### 2.1 微服务的核心优势

- **敏捷独立部署**：不同团队可以依据各自迭代节奏对微服务独立打包、测试并灰度发布，不再受限于庞大的发布窗口；
- **按需精准弹性伸缩**：仅对高吞吐服务（如秒杀查询、库存扣减）实施针对性水平扩容，无需为局部负载放大整体集群资源；
- **故障隔离与容错**：某个非关键微服务崩溃不会直接拖垮全站核心业务，系统具备优雅降级空间。

### 2.2 分布式系统引入的现实挑战

架构设计必须清醒地面对以下工程复杂度：

1. **运维自动化门槛**：从单应用部署跃升为数十甚至上百个容器节点的协同治理，强依赖 CI/CD、Docker 容器化与 Kubernetes 编排；
2. **分布式排障与链路追踪**：单一 HTTP 请求会沿网关、业务服务、鉴权中心与存储层跳跃流转，传统的本地 Debug 失效，必须依赖统一的 Trace ID、Correlation ID 及全链路追踪平台；
3. **测试维度复杂化**：端到端集成测试需要搭建完备的联调环境或依赖契约测试（Contract Testing）与环境 Mock；
4. **数据最终一致性**：跨服务的事务边界打破了单库强 ACID 特性，必须借助分布式事务解决方案或基于 Saga、事件驱动的最终一致性保障机制。

:::en
> **Original**: Architectural decisions require deliberate trade-offs; microservices deliver continuous deployment velocity and elastic scalability at the cost of distributed data consistency and operational complexity.

**📌 核心术语与语境解析**：
- **Trade-off** [ˈtreɪd ɒf]：*架构权衡*。在收益（如独立伸缩、故障隔离）与系统代价（分布式链路、最终一致性）之间权衡决策。
- **Eventual Consistency** [ɪˈventʃuəl kənˈsɪstənsi]：*最终一致性*。在没有强事务锁的前提下，数据经过异步协同后达到一致状态的分布式保证。
- **Fault Tolerance** [fɔːlt ˈtɒlərəns]：*容错性*。系统在局部节点发生崩溃或网络超时情况下维持核心功能可用的能力。
:::

---

## 3. 微服务核心设计模式工程全景

为了系统化化解上述分布式挑战，在 Spring Boot 与 Spring Cloud 体系中，设计模式归纳为五大类：

### 3.1 服务拆分模式（Decomposition Patterns）

- **按业务能力拆分（Decompose by Business Capability）**：围绕企业的核心业务价值流划分服务（例如：图书库存管理、用户与权限中心、支付结算、订单交易）。每个服务由跨职能特性团队（Feature Team）端到端维护；
- **按 DDD 子领域拆分（Decompose by Subdomain）**：基于领域驱动设计（DDD），将系统解构为核心域（Core Domain）、支撑域（Supporting Domain）与通用域（Generic Domain），划定明确的限界上下文（Bounded Context）。

### 3.2 通信与集成模式（Integration Patterns）

- **API 网关模式（API Gateway）**：作为整个后端微服务集群对外的唯一接入网关，承担统一路由分发、TLS 终结、请求鉴权、限流削峰与统一跨域配置（采用 Spring Cloud Gateway）；
- **BFF 模式（Backend for Frontend）**：针对不同客户端形态（如 Web 端、移动 App、小程序）构建专有 BFF 层，针对特定前端视图编排裁剪数据；
- **异步消息驱动（Message-Based Communication）**：利用 Kafka、RabbitMQ 等消息队列实现事件的发布与订阅，将业务主链路与旁路动作彻底解耦。

### 3.3 数据管理模式（Data Management Patterns）

- **独立数据库模式（Database per Service）**：每个微服务独享其专属数据库实体。Inventory 微服务使用 PostgreSQL，而 User 微服务选用 MongoDB；
- **Saga 事务模式（Saga Pattern）**：跨微服务的长业务流程由一系列本地事务链条组成，通过事件协同（Choreography）或集中编排器（Orchestration）在出现异常时触发补偿事务；
- **设计原则**：业务事件设计必须天然具备**幂等性（Idempotency）**与**可追踪性（Traceability）**，为跨服务的数据重放提供保障。

### 3.4 稳定性与容错模式（Reliability Patterns）

- **熔断机制（Circuit Breaker）**：借助 Resilience4j 监控服务调用的健康状况，在下游服务发生持续故障时就地切断请求链路，快速失败并返回降级兜底数据，避免雪崩效应；
- **指数退避重试（Retry with Backoff）**：应对分布式网络偶发抖动，以渐增间隔时间自动发起重试；
- **舱壁隔离（Bulkhead）**：限制特定下游依赖的线程池或并发信号量配额，防止单一慢调用占满全部宿主资源。

### 3.5 可观测性模式（Observability Patterns）

- **集中式日志（Centralized Logging）**：结构化 JSON 格式日志输出，通过统一采集器汇总分析；
- **分布式追踪（Distributed Tracing）**：使用 OpenTelemetry / Micrometer Tracing 自动透传 `traceId` 与 `spanId`，配合 Zipkin 呈现完整调用拓扑；
- **指标度量与健康探针（Metrics & Probes）**：Spring Boot Actuator 原生暴露 `/actuator/health`（提供 Kubernetes Liveness 与 Readiness 探针）及 `/actuator/metrics`。

:::en
> **Original**: Enterprise patterns such as API Gateway, Saga choreography, and Circuit Breaker provide foundational reliability for coordinating distributed microservices.

**📌 核心术语与语境解析**：
- **API Gateway** [ˌeɪ piː ˈaɪ ˈɡeɪtweɪ]：*API 网关*。反向代理流量入口，集中处理认证鉴权、路由转换、SSL 终结与流量限速。
- **Saga Pattern** [ˈsɑːɡə ˈpætən]：*Saga 模式*。由一系列本地事务与正向/补偿事件组成的跨服务分布式长事务治理模型。
- **Circuit Breaker** [ˈsɜːkɪt ˈbreɪkə]：*熔断器*。监控下游异常率，在阈值超标时快速失败降级以防止服务雪崩的稳定性组件。
:::

---

## 4. 工业级工程分层规范与编码准则

微服务内部的代码组织结构是保证服务可演化性与可测试性的生命线。微服务内部严格实施经典四层架构模型：

```text
                ┌───────────────────────────────┐
                │ Controller Layer (表现控制器层) │
                └──────────────┬────────────────┘
                               │ HTTP Request / Response (DTO)
                               ▼
                ┌───────────────────────────────┐
                │   Service Layer (业务服务层)   │
                └──────────────┬────────────────┘
                               │ Domain Logic & Transactions
                               ▼
                ┌───────────────────────────────┐
                │ Repository Layer (持久化仓储层)│
                └──────────────┬────────────────┘
                               │ Spring Data JPA / MongoDB
                               ▼
                ┌───────────────────────────────┐
                │   Database (专属独立物理存储)   │
                └───────────────────────────────┘
```

### 4.1 各层工程职责与代码实践

#### 1. 领域模型与仓储层（Domain & Repository Layer）
负责与底层数据库进行映射与交互。遵循 JPA 实体规范：

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

仓储层借助 Spring Data JPA 的泛型抽象接口，开箱即用获得通用 CRUD 与分页能力：

```java
package com.packt.bookstore.inventory.repository;

import com.packt.bookstore.inventory.model.Book;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface BookRepository extends JpaRepository<Book, Long> {
}
```

#### 2. DTO 与转换映射层（DTO & Mapper Layer）
严禁将内部 `@Entity` 直接暴露给外部 HTTP API。内部数据结构可能包含敏感字段、关系外键或即将变更的数据库模型。通过现代 Java 26 的 `record` 声明不可变传输对象（DTO）：

```java
package com.packt.bookstore.inventory.dto;

import java.math.BigDecimal;

public record BookDTO(Long id, String title, String author, BigDecimal price) {
}
```

#### 3. 业务服务层（Service Layer）
业务逻辑、事务声明与数据组装严格收敛于 Service 层：

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

#### 4. 表现控制器层（Controller Layer）
只处理 HTTP 协议解析、请求校验、状态码封装与 DTO 返回，不夹带业务规则：

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

### 4.2 核心编码准则

- **坚决禁止提取跨微服务共享的“业务公共库（Common Jar）”**：避免创建包含业务实体和工具方法的公共 Jar 包。一旦业务发生演进，所有服务都会被该依赖绑架，破坏微服务版本独立演进的自治性；
- **全方位测试金字塔覆盖**：单元测试对 Service 进行 Mockito 隔离打桩；集成测试采用 `@WebMvcTest` 或 `@SpringBootTest` 验证端到端契约；
- **契约先行（API-First）**：使用 OpenAPI / Swagger 固化 API 协议规范，提升前后端联调效率。

:::en
> **Original**: Adhering to a four-tier architecture isolates domain logic from infrastructure plumbing, while immutable record DTOs establish strict encapsulation boundaries.

**📌 核心术语与语境解析**：
- **Data Transfer Object (DTO)** [ˈdeɪtə trænsˈfɜːr ˈɒbdʒɪkt]：*数据传输对象*。跨网络传输数据的扁平化载体，隔离持久化实体与外部契约。
- **Separation of Concerns** [ˌsepəˈreɪʃn əv kənˈsɜːnz]：*关注点分离*。将控制器协议层、服务业务层与仓储持久层解耦的软件工程原则。
:::

---

## 5. Bookstore 实战系统架构设计与领域拆解

构建工业级电商系统——**在线书店（Bookstore Platform）**用以践行微服务理论。

### 5.1 系统全局端到端架构拓扑

系统的整体拓扑由 Angular 22 前端、Spring Cloud Gateway 统一 API 网关、Keycloak 统一身份鉴权中心、两套核心 Spring Boot 微服务以及 Zipkin 分布式链路监控构成：

![Bookstore 平台全局系统架构图](/media/posts/spring-boot-angular/img-08896.png)

1. **Angular 22 前端**：作为客户端统一入口，基于 Signals 驱动响应式状态，所有发往后端的 API 调用均统一路由至 Spring Cloud Gateway；
2. **Spring Cloud Gateway**：承载 API 网关职责，针对访问路径应用统一拦截器，校验 Keycloak 签发的 JWT 签名，并向内部微服务下游透传身份 Header；
3. **Keycloak 统一身份治理**：作为标准 OAuth 2.0 / OIDC 认证授权中心，集中管理用户角色（User/Admin）与凭证发放；
4. **Book Inventory 微服务**：负责图书目录、库存水位、价格计算等业务，采用关系型数据库 **PostgreSQL** 支撑；
5. **User Management 微服务**：负责用户画像、偏好设置、历史足迹等高弹性业务，采用文档型数据库 **MongoDB** 存储；
6. **可观测链路**：所有后端微服务统一集成 Spring Boot Actuator 与 Micrometer Tracing，调用链元数据自动上报至 **Zipkin**，实现全链路透明追踪。

### 5.2 微服务内部四层分层模型

在 Bookstore 的每一个微服务中，均严格遵循分层规范：

![Bookstore 微服务内部层级模型](/media/posts/spring-boot-angular/img-08898.png)

### 5.3 核心技术栈组合与选型

![Spring Boot 微服务技术栈矩阵](/media/posts/spring-boot-angular/img-08900.png)

- **Spring Boot REST API**：内嵌高性能 Web 容器，提供标准化 RESTful 资源操作；
- **Spring Data JPA**：针对关系型数据（PostgreSQL）提供标准 ORM 封装；
- **Spring Data MongoDB**：针对非关系型文档存储（MongoDB）提供直观的 Object-Document 映射；
- **Spring Cloud 组件**：提供响应式网关路由、Resilience4j 服务熔断与统一服务发现。

### 5.4 网关路由与安全接入配置

网关对外暴露统一接入端口，并根据请求路径进行转发：
- `/packt/inventory/api/**` $\rightarrow$ 路由转发至 Book Inventory 微服务；
- `/packt/user/api/**` $\rightarrow$ 路由转发至 User Management 微服务。

网关在转发前解析 Authorization Bearer Token，完成验签并剥离敏感信息，将用户身份字段注入下游微服务的请求头中。

:::en
> **Original**: Bounded contexts dictate database boundaries, pairing PostgreSQL for transactional inventory domains with MongoDB for agile document-centric user profiles.

**📌 核心术语与语境解析**：
- **Bounded Context** [ˈbaʊndɪd ˈkɒntekst]：*限界上下文*。DDD 核心概念，显式划分领域模型、业务词汇表与系统职责的作用域。
- **Polyglot Persistence** [ˈpɒliɡlɒt pəˈsɪstəns]：*多范式持久化*。依据不同微服务领域的数据读写特征混合搭配关系型与 NoSQL 数据库的架构策略。
:::

---

## 6. 从零搭建开发环境与首个 Spring Boot 微服务

### 6.1 配置 Java 26 与 SDKMAN 工具链

统一采用 **Java 26** 进行构建与运行。使用命令行工具 **SDKMAN!** 实现多 JDK 版本的秒级安装与切换：

```bash
# 查看 SDKMAN 提供的 Java 26 发行版本
sdk list java

# 安装推荐的 Java 26 发行版
sdk install java 26-oracle

# 验证当前 Java 版本
java --version
```

终端输出如下图所示，说明 Java 26 运行环境配置成功：

![使用 SDKMAN 安装与切换 Java 26](/media/posts/spring-boot-angular/img-08902.png)

对于开发构建工具 Maven，确保安装 3.9.x 及以上版本：

```bash
mvn --version
```

### 6.2 配置 VS Code 开发环境

VS Code 具备轻量内核与扩展生态，适合开发 Spring Boot + Angular 全栈项目。

1. **创建专属配置 Profile**：打开 VS Code，通过快捷键 `Ctrl` + `Shift` + `P` 执行 `Profiles: Create Profile`，选择模版 `Java Spring`：

![在 VS Code 中创建 Java Spring 专用 Profile](/media/posts/spring-boot-angular/img-08904.png)

2. **安装核心扩展**：
   - **Extension Pack for Java**（Microsoft 出品）：集成 Java 语法感知、Maven 依赖解析与本地 Debugger：
     ![安装 Extension Pack for Java](/media/posts/spring-boot-angular/img-08906.png)
   - **Spring Boot Extension Pack**（VMware 出品）：提供 Spring 配置文件智能提示、Boot Dashboard 与 Initializr 向导：
     ![安装 Spring Boot Extension Pack](/media/posts/spring-boot-angular/img-08908.png)

### 6.3 基于 Spring Initializr 快速脚手架工程

访问 `start.spring.io` 或在 VS Code 中直接唤醒向导，按以下参数配置项目：

- **Project**：Maven
- **Language**：Java
- **Spring Boot**：4.1.0
- **Group**：`com.packt.bookstore`
- **Artifact**：`inventory-ms`
- **Dependencies**：
  - `Spring Boot DevTools`（支持热重载）
  - `Spring Web`（提供 REST API 支持）
  - `Spring Boot Actuator`（提供健康检查与度量监控）

![通过 Spring Initializr 初始化配置 inventory-ms 微服务](/media/posts/spring-boot-angular/img-08910.png)

点击 **Generate** 下载并解压工程，使用 VS Code 打开项目根目录。

### 6.4 启动与验证微服务

定位至 `src/main/java/com/packt/bookstore/inventory/InventoryMsApplication.java`：

```java
package com.packt.bookstore.inventory;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class InventoryMsApplication {

    public static void main(String[] args) {
        SpringApplication.run(InventoryMsApplication.class, args);
    }
}
```

点击类上方的 **Run** 按钮，或者在终端使用 Maven 包装器命令：

```bash
./mvnw spring-boot:run
```

控制台打印出 Spring Boot Banner 与 `Started InventoryMsApplication in X.XXX seconds`，表明微服务实例已在默认的 `8080` 端口成功启动：

![控制台输出启动成功日志](/media/posts/spring-boot-angular/img-08914.png)

访问 `http://localhost:8080/actuator/health`，即可看到 Actuator 返回的系统健康状态 JSON：

```json
{
  "status": "UP"
}
```

### 6.5 规范化微服务目录层级

在 `src/main/java/com/packt/bookstore/inventory/` 目录下创建规范的四层业务包结构：

![Inventory 微服务规范目录层级划分](/media/posts/spring-boot-angular/img-08916.png)

- `controller/`：存放 HTTP 控制器类；
- `service/`：存放领域业务接口及具体实现；
- `repository/`：存放 Spring Data 存储接口；
- `model/`：存放持久化领域实体（Entity）；
- `dto/`：存放外部数据交互 Record / DTO 对象。

通过这套标准结构，团队成员能够迅速对齐设计认知，为后续业务逻辑实现打下坚实基础。

:::en
> **Original**: Spring Boot 4 combines opinionated starters with production-ready Actuator endpoints to standardize microservice bootstrapping.

**📌 核心术语与语境解析**：
- **Scaffolding** [ˈskæfəʊldɪŋ]：*脚手架工程*。通过 Initializr 等工具快速建立包含标准依赖与目录配置的基础骨架。
- **Actuator** [ˈæktʃueɪtə]：*执行器组件*。Spring Boot 提供的生产级健康检查（Health Probes）、指标采集与环境探针基础设施。
:::
