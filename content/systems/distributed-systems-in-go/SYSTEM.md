---
title: "Distributed Systems in Go：生产级分布式平台 SDK 与微服务实战"
description: "专栏《分布式 Go 系统工程》配套完整代码实战工程，涵盖并发模型、消息队列适配、Saga 编排、弹性容错与可观测性等生产级模式。"
date: 2026-11-02
category: systems
tags: [distributed-systems, go, saga, platform, microservices]
name: distributed-systems-in-go
language: Go
architecture: Platform SDK / Microservices Monorepo
version: 1.0.0
---

# Distributed Systems in Go 生产级系统工程实战

:::note
本项目是专栏 **[分布式 Go 系统工程](/columns/distributed-go)** 的全套配套实战代码库。读者可以在左侧工程目录树中随时切换各模块源码、看行号与实现细节，并支持一键下载全量工程源码进行本地调试。
:::

## 整体架构 (Architecture)

工程采用 **企业级平台 SDK (Company Platform SDK)** + **单体多服务 (Monorepo Microservices)** 架构：

- **`pkg/platform/`**：跨业务域沉淀的共享基础设施平台 SDK：
  - `concurrency/`：有界工作池（Worker Pool）、优雅平滑停机、Context 隔离解耦。
  - `messaging/`：Pub/Sub 抽象接口、内存 Fake Broker、生产级 NATS JetStream 与 Kafka 适配器。
  - `middleware/`：生产级 HTTP 中间件链（Recover、RequestID、结构化日志、Timeout、CORS、统一错误处理、健康检查）。
  - `auth/`：ECDSA (ES256) JWT 签名与验签、JWKS 公钥端点、RBAC 作用域鉴权、bcrypt 密码哈希。
  - `database/`：基于 `pgxpool` 的 PostgreSQL 连接池管理、事务包装、自动 Schema 迁移执行器。
  - `ctxutil/`：泛型类型安全 Context 值注入与提取、超时预算递减收窄。
  - `resilience/`：熔断器（Circuit Breaker）、带 Full Jitter（完全抖动）的指数退避重试机制。
  - `orchestration/`：基于 `errgroup` 的并行扇出、分散-聚集（Scatter-Gather）、最大努力降级与超时预算控制。
  - `consistency/`：分布式 Saga 编排器（正向步骤执行 + 逆向补偿回滚）、幂等性保证表、乐观并发锁重试。
  - `observability/`：基于 `slog` 的结构化日志（上下文 Trace 自动注入）、Prometheus 监控指标暴露、W3C TraceContext 跨进程链路追踪。
  - `config/`：结构体 Tag 声明式 12-Factor 环境变量加载与校验器。
  - `cli/`：服务健康探活与运维 CLI 辅助工具。
- **`cmd/`**：可独立启动运行的微服务应用（API Gateway、Auth、Orders 交易系统等）。
- **`internal/`**：各微服务的领域模型、Handler 控制层与服务实现（Auth、Orders、Inventory、Payment、Notifications）。
- **`deploy/`** & **`docker-compose.yml`**：本地一键容器化基础设施编排（PostgreSQL、NATS、Kafka、Prometheus、Tempo、Grafana）。
- **`tests/`**：端到端微服务订单流集成测试与实盘基础设施验证测试。

---

## 本地容器与基础设施运行 (Deployment & Infrastructure)

### 1. 使用 Podman（推荐：原生 `play kube`）

基础设施可直接使用 Podman 原生读取标准的 Kubernetes Pod 清单拉起：

```bash
# 一键拉起 Postgres、NATS 与 Kafka 联合 Pod
podman play kube deploy/kube/orderflow-infra.yaml

# 查看运行中的 Pod 与容器
podman pod ps
podman ps

# 停止并拆除本地基础设施
podman play kube --down deploy/kube/orderflow-infra.yaml
```

### 2. 使用 Docker Compose

```bash
docker compose up -d
```

---

## 测试套件执行 (Running Tests)

### 1. 单元测试与 Saga 编排测试（带竞态检测）

```bash
go test -v -race ./pkg/...
go test -v -race ./tests/orderflow_integration_test.go
```

### 2. 真实基础设施联调测试 (Live Infrastructure Tests)

在启动本地基础设施后，执行端到端联调测试：

```bash
go test -v ./tests/live_infra_test.go
```

该测试自动验证：
1. PostgreSQL 连接池健康与自动重试；
2. 数据库 Schema 迁移器自动执行 `migrations/*.up.sql`；
3. 基于 NATS 的高吞吐发布与订阅；
4. 基于 Apache Kafka (KRaft) 的 Producer 与 Consumer Group 消费机制。
