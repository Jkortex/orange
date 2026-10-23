---
title: Spring Boot & Angular 全栈实战（六）：Spring Cloud 服务发现与统一 API 网关
date: 2026-10-23T00:06:00Z
description: 基于 Eureka 构建微服务动态注册与健康感知，实战 Spring Cloud Gateway 的动态路由编排、过滤器链路与跨域治理。
category: fullstack
column: spring-boot-angular
tags:
  - Spring Cloud
  - 微服务网关
  - 服务发现
  - Eureka
  - API Gateway
---

> 💡 **专栏导读**：本文收录于专栏 [《Spring Boot 4 & Angular 22 全栈微服务实战》](/columns/spring-boot-angular)。全专栏共 22 篇，深度覆盖 Java 26 微服务拆分、Spring Cloud 网关与安全鉴权、Angular 22 Signals 状态治理以及端到端容器化交付的全链路工程实践。

在前几章中，我们完成了 `Bookstore` 系统领域服务层与 REST API 的工程实现，构建了高内聚的商品库存服务与用户微服务。然而，在分布式生产环境中，微服务实例的 IP 和端口通常是动态变动的（如容器调度、弹性伸缩、故障自愈）。

如果调用方直接依赖硬编码的静态地址，整个系统架构将变得异常脆弱。此外，外部客户端（如 Angular 单页应用或移动端）直接面对分散在不同内网端口的微服务，会面临跨域难题、安全鉴权重复实现、协议暴露过多等诸多挑战。

本文我们将全面引入微服务通信的两大基石：
1. **服务发现（Service Discovery）**：基于 Spring Cloud Netflix Eureka 搭建高可用注册中心，实现微服务的自动注册、心跳健康检测与动态寻址。
2. **API 网关（API Gateway）**：采用反应式（Reactive）的 Spring Cloud Gateway 构建统一流量入口，实现动态路由转发、路径重写、跨域收敛以及基于 Resilience4j 的网关级熔断降级。

---

## 1. 微服务架构下的服务寻址困境与动态发现

### 静态解析 vs 动态注册中心

在传统的单体架构中，模块之间通过进程内的 JVM 方法直接调用。一旦拆分为分布式微服务，每个服务运行在独立的容器或虚拟机中，拥有独立的生命周期和网络标识。

最简单也最原始的调用方式是将依赖服务的地址以硬编码方式写入配置文件（**静态服务解析**）：

```properties
# 静态配置示例：脆弱且难以维护
book.user-service.url=http://192.168.1.105:8082
```

当系统在测试、预发、生产环境之间流转，或者在 Kubernetes 集群中触发 Pod 漂移扩缩容时，静态地址配置将迅速引发灾难：
- 节点伸缩或崩溃后，调用端无法感知失效节点，导致请求超时堆积。
- 新增节点需要手动修改配置并滚动重启消费端服务。

**动态服务解析（Dynamic Service Discovery）** 彻底解耦了服务调用者与提供者的物理绑定关系。每个服务实例在启动时主动将自身元数据（IP、端口、服务名、健康状态）注册至注册中心；服务消费者在调用时只需根据逻辑服务名向注册中心查询健康实例列表，并结合客户端负载均衡发起调用。

| 对比维度 | 静态解析 (Static Discovery) | 动态服务发现 (Dynamic Discovery) |
| :--- | :--- | :--- |
| **实例寻址方式** | 配置文件或环境变量手动硬编码 IP/端口 | 启动时自动上报至中央注册中心，按名称寻址 |
| **弹性伸缩适应力** | 需手动修改配置并重新部署客户端 | 实例上线/下线实时感知，毫秒/秒级生效 |
| **故障转移与负载均衡** | 依赖外部硬件/DNS，缺乏细粒度实例健康感知 | 结合客户端心跳探测与负载均衡器（LoadBalancer）动态故障剔除 |
| **适用场景** | 小型单体原型、简单的双机热备环境 | 云原生分布式集群、容器化微服务体系 |

### DNS 寻址与应用级注册中心的工程权衡

部分工程师会考虑：“既然网络层已有 DNS，为什么不能完全依靠 DNS 做内部微服务寻址？”

| 方案 | 优势 | 局限性与不足 |
| :--- | :--- | :--- |
| **DNS 方案** | 基础设施原生支持，无需额外部署应用级组件 | 受到客户端/操作系统 DNS 缓存及 TTL 影响，故障切换延迟大；缺乏微服务元数据（版本、环境、灰度权重）；无法细粒度追踪实例健康细节 |
| **注册中心（Eureka / Consul / Nacos）** | 专为微服务通信设计，支持丰富的实例元数据、动态心跳感知、客户端软负载均衡与故障快恢 | 需要维护额外的注册中心集群依赖 |

从架构层次上看：
- **基础设施级发现**：如 Kubernetes 原生基于 `ClusterIP Service` 与 `CoreDNS` 的服务发现，在平台层统一处理。
- **应用级发现**：以 **Netflix Eureka** 为代表，与 Spring Boot / Spring Cloud 紧密集成，支持客户端就近路由、丰富元数据注入以及极简的本地联调体验。

在我们的技术栈中，选用 Eureka 与 Spring Cloud 体系作为服务治理核心，能够在脱离复杂 K8s 集群开销的前提下，清晰掌握动态注册、心跳保活与客户端负载均衡的完整闭环。

---

## 2. 搭建 Eureka Server 服务注册中心

Eureka 采用了 P2P（Peer-to-Peer）的高可用对等架构，各个 Server 节点之间通过对等复制同步注册表，没有复杂的选举 Leader 延迟，具备极高的可用性（AP 体系）。

![服务注册与发现流程图](/media/posts/spring-boot-angular/img-08968.png)

### 步骤 1：创建 `discovery-server` 工程

基于 Spring Boot 4.1.0 与 Java 26 构建独立的注册中心服务。

`pom.xml` 核心依赖声明：

```xml
<parent>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-parent</artifactId>
  <version>4.1.0</version>
  <relativePath />
</parent>

<properties>
  <java.version>26</java.version>
  <spring-cloud.version>2025.1.2</spring-cloud.version>
</properties>

<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>org.springframework.cloud</groupId>
      <artifactId>spring-cloud-dependencies</artifactId>
      <version>${spring-cloud.version}</version>
      <type>pom</type>
      <scope>import</scope>
    </dependency>
  </dependencies>
</dependencyManagement>

<dependencies>
  <!-- Eureka 服务端核心依赖 -->
  <dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-eureka-server</artifactId>
  </dependency>

  <!-- 运维监控端点 -->
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
  </dependency>
  
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-devtools</artifactId>
    <scope>runtime</scope>
    <optional>true</optional>
  </dependency>
</dependencies>
```

### 步骤 2：启用 Eureka Server

在应用引导类上标注 `@EnableEurekaServer`：

```java
package com.packt.bookstore.discovery_server;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.netflix.eureka.server.EnableEurekaServer;

@SpringBootApplication
@EnableEurekaServer
public class DiscoveryServerApplication {
    public static void main(String[] args) {
        SpringApplication.run(DiscoveryServerApplication.class, args);
    }
}
```

### 步骤 3：配置 `application.yml`

单机开发环境下，Eureka Server 本身也是一个标准的 Eureka Client，默认会尝试向其他节点注册并拉取注册表。我们需要显式关闭该行为：

```yaml
server:
  port: 8761

spring:
  application:
    name: eureka-server

eureka:
  client:
    # 单机开发模式：禁止将自身作为客户端向 Eureka 注册
    register-with-eureka: false
    # 单机开发模式：禁止从远端同步注册表
    fetch-registry: false
  server:
    # 禁用空注册表同步等待，加速单机模式启动过程
    wait-time-in-ms-when-sync-empty: 0
```

- `server.port: 8761`：Eureka 官方约定的默认控制台端口。
- `register-with-eureka: false` 与 `fetch-registry: false`：确保当前节点作为权威注册中心运行，避免产生自我寻找失败的异常日志。

### 步骤 4：启动与面板验证

启动 `DiscoveryServerApplication`，访问 `http://localhost:8761/`，即可看到 Eureka 运维仪表盘。当前由于尚未接入任何微服务，**Instances currently registered with Eureka** 列表中显示为空。

![Eureka 注册中心初始化面板](/media/posts/spring-boot-angular/img-08971.png)

---

## 3. 书店微服务自动化注册与健康探测

有了注册中心，接下来我们将已有的库存微服务（`inventory-ms`）和用户微服务（`user-ms`）改造为 Eureka Client，实现服务上线自注册与心跳健康感知。

### 步骤 1：引入 Client 依赖与 Actuator

在 `inventory-ms` 与 `user-ms` 的 `pom.xml` 中引入 Eureka 客户端与健康检查组件：

```xml
<dependency>
  <groupId>org.springframework.cloud</groupId>
  <artifactId>spring-cloud-starter-netflix-eureka-client</artifactId>
</dependency>

<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```

> 💡 **版本提示**：在 Spring Boot 4.0+ 与新版 Spring Cloud 体系下，类路径引入 `spring-cloud-starter-netflix-eureka-client` 即可自动激活客户端发现机制，启动类无需强制添加 `@EnableEurekaClient` 注解。

### 步骤 2：配置客户端心跳与注册元数据

修改 `inventory-ms` 的 `application.yml`：

```yaml
server:
  port: 8081
  servlet:
    context-path: /inventory

spring:
  application:
    # 核心：服务注册标识，将作为服务发现的逻辑 Service ID
    name: inventory-service

eureka:
  client:
    service-url:
      defaultZone: http://localhost:8761/eureka/
  instance:
    hostname: localhost
    # 在容器与分布式网络中优先上报 IP 地址，避免跨主机域名解析异常
    prefer-ip-address: true
    # 构造唯一实例标识：应用名:端口号
    metadata-map:
      instanceId: ${spring.application.name}:${server.port}

management:
  endpoints:
    web:
      exposure:
        include: health, info
  endpoint:
    health:
      show-details: always
```

- `spring.application.name: inventory-service`：决定了微服务在注册中心的逻辑名称，后续 API 网关路由编排时将直接通过 `lb://inventory-service` 进行匹配。
- `eureka.instance.prefer-ip-address: true`：跨主机或 Docker 容器环境下至关重要，防止使用不可路由的容器内部 hostname 导致通信失败。
- `management.endpoint.health.show-details: always`：Eureka 结合 Actuator 的 `/actuator/health` 端点全面探测数据库连接池、磁盘空间等底层健康指标，若状态异常则自动标记为 DOWN。

同样地，配置 `user-ms`（服务名设为 `user-ms`，端口为 `8082`，`context-path: /user`）。

### 步骤 3：多实例启动与注册验证

依次启动 Eureka Server、库存微服务与用户微服务：

```bash
# 终端 1
cd discovery-server && ./mvnw spring-boot:run

# 终端 2
cd inventory-ms && ./mvnw spring-boot:run

# 终端 3
cd user-ms && ./mvnw spring-boot:run
```

刷新 Eureka 控制台 `http://localhost:8761/`，可以看到两个业务微服务均已成功入网注册，且状态显示为 `UP (1) - 192.168.x.x:inventory-service:8081`。

![微服务实例成功注册至 Eureka 控制台](/media/posts/spring-boot-angular/img-08973.png)

---

## 4. API 网关模式的核心价值与技术选型

### 为什么微服务必须配备 API 网关？

当服务拆分越来越细，如果外部前端（Angular 应用）直接调用底层各个微服务，系统将迅速面临以下困境：
1. **客户端复杂度激增**：前端需要硬编码管理大量微服务的不同域名和端口。
2. **安全风险暴露**：每个微服务都不得不独立暴露公网端口并重复实现 JWT 校验、CORS 跨域策略和防刷限流。
3. **架构重构受限**：微服务后端的重构、拆分或合并将直接迫使前端修改代码。

![API 网关统一流量分发示意图](/media/posts/spring-boot-angular/img-08975.png)

**API 网关（API Gateway）** 作为微服务集群的唯一公共大门，处于反向代理位置，统揽所有入站流量：
- **统一路由（Centralized Routing）**：客户端只需与网关（如 `http://api.bookstore.com`）通信，内部服务拓扑对外完全透明。
- **协议与路径转换**：通过路径重写（Path Rewrite），抹平内部各服务 context-path 的不一致。
- **横切关注点收敛**：统一在此落地身份鉴权（OAuth2 / JWT）、安全防刷、CORS 跨域处理与全链路可观测性日志。
- **BFF（Backend for Frontend）演进**：未来可针对 PC Web 端、移动 App 端分别部署定制的 BFF 网关层，灵活组装差异化数据。

### 网关技术方案横向对比

| 网关方案 | 架构核心 | 适用场景与优劣势 |
| :--- | :--- | :--- |
| **Netflix Zuul 1.x** | 基于阻塞式 Servlet IO 模型 | 早期 Spring Cloud 默认网关，高并发长连接性能较差，目前已被 Spring 官方弃用 |
| **Kong** | 基于 OpenResty (Nginx + Lua) | C 级极致性能，插件生态极为丰富；但非 Java/Spring 原生体系，定制复杂业务过滤器成本较高 |
| **Google Apigee** | 企业级全托管 API 治理与变现平台 | 功能全面但商业化开销大，偏向对外商业化开放 API 平台治理 |
| **Spring Cloud Gateway** | 基于 **Project Reactor** 与 **Netty** 反应式非阻塞模型 | **Spring 原生首选**。与 Spring Cloud、Eureka、Resilience4j、Security 深度契合，代码极简，支持高度灵活的自定义过滤器与断言 |

对于 Java / Spring Boot 技术栈全栈工程，**Spring Cloud Gateway** 无疑是生产力与架构协同的最佳之选。

---

## 5. Spring Cloud Gateway 核心架构与处理管线

Spring Cloud Gateway 抛弃了传统的 Servlet 阻塞模型，完全基于 Netty 和 Spring WebFlux 反应式编程构建。其底层核心由三大概念构成：
1. **Route（路由）**：网关的基本构建块，由 ID、目标 URI、断言（Predicates）集合与过滤器（Filters）集合组成。
2. **Predicate（断言）**：基于 Java 8 `Predicate` 函数，根据 HTTP 请求的属性（路径、Method、请求头、Query 参数、时间戳等）判断当前请求是否命中该路由。
3. **Filter（过滤器）**：包含 `GatewayFilter` 与 `GlobalFilter`，可以在请求向下游转发前（Pre 阶段）修改请求头或参数，或在下游返回后（Post 阶段）修改响应体、记录链路耗时。

![Spring Cloud Gateway 核心架构与反应式处理管线](/media/posts/spring-boot-angular/img-08976.png)

整个请求的处理生命周期如下：
1. **客户端发起请求**：流量到达 Gateway Handler Mapping。
2. **路由断言匹配**：遍历配置的路由规则，所有配置的 Predicates 均返回 `true` 时判定路由命中。
3. **Pre-Filter 链式执行**：例如添加认证令牌头、重写请求 URL 路径、启动链路计时。
4. **服务动态寻址（Handler Mapping）**：若目标 URI 格式为 `lb://service-name`，网关触发 Spring Cloud LoadBalancer 向 Eureka 查询健康的下游节点，并完成负载均衡路由。
5. **下游服务响应返回**。
6. **Post-Filter 链式执行**：追加统一安全响应头、收集性能监控指标或执行数据脱敏。
7. **客户端接收最终响应**。

---

## 6. 构建与配置 Spring Cloud Gateway

### 步骤 1：创建 `gateway-server` 工程

添加网关专属依赖：

```xml
<dependencies>
  <!-- 反应式网关核心 -->
  <dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-gateway-server-webflux</artifactId>
  </dependency>

  <!-- Eureka 客户端：支持 lb:// 动态解析 -->
  <dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-eureka-client</artifactId>
  </dependency>

  <!-- Actuator 监控网关路由 -->
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
  </dependency>
</dependencies>
```

> ⚠️ **避坑指南**：Spring Cloud Gateway 基于 WebFlux 运行，**绝对不能**在项目中引入 `spring-boot-starter-web`（传统的 Tomcat Servlet 依赖），否则会导致启动冲突直接崩溃。

### 步骤 2：网关启动类与监控开放

```java
package com.packt.bookstore.gateway_server;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class GatewayServerApplication {
    public static void main(String[] args) {
        SpringApplication.run(GatewayServerApplication.class, args);
    }
}
```

在 `application.yml` 中开放 Gateway 的 Actuator 管理端点：

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health, info, gateway
  endpoint:
    health:
      show-details: always
    gateway:
      access: read-only
```

访问 `http://localhost:8080/actuator/gateway/routes` 即可随时查看当前已生效的路由拓扑。

### 步骤 3：路由编排实战

Spring Cloud Gateway 提供了两种路由编排方式：**声明式 YAML 配置** 与 **编程式 Java DSL**。

#### 方案 A：声明式 YAML 路由配置（适合配置驱动与外部化治理）

```yaml
server:
  port: 8080

spring:
  application:
    name: gateway-server

  cloud:
    gateway:
      server:
        webflux:
          discovery:
            locator:
              # 启用基于注册中心的服务发现路由支持
              enabled: true
              lower-case-service-id: true
          routes:
            # 库存微服务路由
            - id: bookstore-inventory-route
              uri: lb://inventory-service
              predicates:
                - Path=/packt/inventory/api/**
              filters:
                # 正则重写：将外部公开前缀重写为内部服务的真实 context-path
                - RewritePath=/packt/inventory/api/(?<segment>.*), /inventory/api/${segment}

            # 用户微服务路由
            - id: bookstore-user-route
              uri: lb://user-ms
              predicates:
                - Path=/packt/user/api/**
              filters:
                - RewritePath=/packt/user/api/(?<segment>.*), /user/api/${segment}
```

**关键配置解析**：
- `uri: lb://inventory-service`：`lb://` 协议告知网关启用客户端负载均衡（LoadBalancer），结合 Eureka 自动解析 `inventory-service` 的所有可用节点。
- `RewritePath`：前端请求 `http://localhost:8080/packt/inventory/api/books` 时，网关会自动将路径改写为 `/inventory/api/books` 并转发给后端节点。

#### 方案 B：编程式 Java DSL 路由配置（适合动态规则与复杂策略）

对于需要动态注入业务条件、复杂鉴权逻辑或编程式熔断的场景，Java DSL 能够提供更强的类型安全与灵活性：

```java
package com.packt.bookstore.gateway_server.config;

import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class GatewayRouteConfig {

    @Bean
    public RouteLocator customRouteLocator(RouteLocatorBuilder builder) {
        return builder.routes()
                // 1. 库存微服务路由配置
                .route("packt-inventory-service", r -> r
                        .path("/packt/inventory/api/**")
                        .filters(f -> f
                                .rewritePath("/packt/inventory/api/(?<segment>.*)", "/inventory/api/${segment}")
                                .addResponseHeader("X-Processed-By", "Spring-Cloud-Gateway")
                        )
                        .uri("lb://inventory-service")
                )
                // 2. 用户微服务路由配置
                .route("packt-user-service", r -> r
                        .path("/packt/user/api/**")
                        .filters(f -> f
                                .rewritePath("/packt/user/api/(?<segment>.*)", "/user/api/${segment}")
                                .addResponseHeader("X-Processed-By", "Spring-Cloud-Gateway")
                        )
                        .uri("lb://user-ms")
                )
                .build();
    }
}
```

### 步骤 4：端到端网关代理测试

启动网关工程（端口 8080）。此时 Eureka 面板中将汇聚 3 个活跃服务实例：

![Eureka 控制台同时显示微服务与 Gateway 实例](/media/posts/spring-boot-angular/img-08979.png)

使用终端或 HTTP 客户端发起测试：

```bash
# 测试库存微服务路由
curl -i http://localhost:8080/packt/inventory/api/authors

# 测试用户微服务路由
curl -i http://localhost:8080/packt/user/api/users
```

响应结果中不仅成功返回了对应微服务的数据，还能在响应头中观察到网关过滤器注入的元数据：
```http
HTTP/1.1 200 OK
Content-Type: application/json
X-Processed-By: Spring-Cloud-Gateway
```

客户端从此无需关心后端到底运行在 8081 还是 8082 端口，全站请求被统一定位至 8080 网关入口。

---

## 7. 基于 Resilience4j 实现网关级熔断降级

在分布式系统中，级联故障（Cascading Failures）是导致雪崩的元凶。当库存微服务因数据库死锁或网络拥堵出现高延迟时，网关的大量工作线程将被耗尽挂起，进而影响其他无关微服务（如用户服务）的正常请求。

**熔断器模式（Circuit Breaker）** 能够在检测到下游依赖出现持续错误或超时后快速切断流量（打开状态），直接返回预设的友好降级响应（Fallback），从而保护系统整体的高可用性。

### 步骤 1：引入 Resilience4j 反应式依赖

在 `gateway-server` 的 `pom.xml` 中引入 Spring Cloud CircuitBreaker 依赖：

```xml
<dependency>
  <groupId>org.springframework.cloud</groupId>
  <artifactId>spring-cloud-starter-circuitbreaker-reactor-resilience4j</artifactId>
</dependency>
```

### 步骤 2：在网关路由中装配 CircuitBreaker 过滤器

修改 Java 路由配置，为库存路由添加熔断器拦截：

```java
@Configuration
public class GatewayRouteConfig {

    @Bean
    public RouteLocator customRouteLocator(RouteLocatorBuilder builder) {
        return builder.routes()
                .route("packt-inventory-service", r -> r
                        .path("/packt/inventory/api/**")
                        .filters(f -> f
                                .rewritePath("/packt/inventory/api/(?<segment>.*)", "/inventory/api/${segment}")
                                .addResponseHeader("X-Processed-By", "Spring-Cloud-Gateway")
                                // 配置网关级熔断器
                                .circuitBreaker(config -> config
                                        .setName("inventoryCircuitBreaker")
                                        .setFallbackUri("forward:/fallback/inventory")
                                        .setRouteId("packt-inventory-service")
                                )
                        )
                        .uri("lb://inventory-service")
                )
                .build();
    }
}
```

### 步骤 3：编写网关本地降级端点

降级端点应当由网关自身直接处理，无需也不能继续依赖已经失效的下游服务：

```java
package com.packt.bookstore.gateway_server.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/fallback")
public class FallbackController {

    @GetMapping("/inventory")
    public ResponseEntity<Map<String, Object>> inventoryFallback() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of(
                        "status", 503,
                        "error", "Service Unavailable",
                        "message", "图书库存服务暂时不可用或响应超时，请稍后重试。",
                        "timestamp", System.currentTimeMillis()
                ));
    }
}
```

### 步骤 4：验证故障降级自愈

1. 在正常状态下调用 `GET http://localhost:8080/packt/inventory/api/books`，返回正常的图书 JSON 列表。
2. 手动终止 `inventory-ms` 进程模拟服务宕机或断网。
3. 再次发起该请求，网关熔断机制立即触发，迅速返回 503 与 JSON 降级提示：
```json
{
  "status": 503,
  "error": "Service Unavailable",
  "message": "图书库存服务暂时不可用或响应超时，请稍后重试。",
  "timestamp": 1730000000000
}
```
整个过程请求在网关内部毫秒级截断，避免了长时间无意义的 TCP 挂起，且其他微服务（如用户接口）调用丝毫不受影响。

---

## 8. 总结与架构演进思考

在本文中，我们彻底告别了脆弱的静态端口调用，完成了微服务基础设施层的重要跃升：
1. **服务发现治理**：利用 Eureka 构建了微服务注册中心，实现了实例上下线自动感知与软负载均衡能力。
2. **API 网关统一收敛**：通过 Spring Cloud Gateway 打造了全站入口，运用 Predicate 与 Filter 实现了动态路由与路径映射。
3. **架构韧性加固**：结合 Resilience4j 在网关层构筑了熔断与降级防线，有效阻断微服务间的雪崩蔓延。

当所有流量统一经过网关流转，新的关键问题随之而来：
- 前端与三方团队如何准确理解这些 API 契约？
- 当一次用户请求横跨网关与多个内部微服务且发生慢查询时，我们如何定位是哪一步造成的瓶颈？

在下一篇中，我们将深入探讨 **OpenAPI 规范驱动与全链路可观测性落地**，基于 SpringDoc 自动生成 Swagger 契约文档，并结合 Actuator、Micrometer Tracing 与 Zipkin 搭建分布式链路追踪体系。
