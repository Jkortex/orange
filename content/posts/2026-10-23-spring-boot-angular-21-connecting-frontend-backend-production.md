---
title: Spring Boot & Angular 全栈实战（二十一）：端到端联调、网络代理与生产级编排
date: 2026-10-23T00:21:00Z
description: 汇聚全栈成果，编写 Nginx 边缘流式反向代理与 Docker Compose 生产拓扑，统筹编排数据库、Keycloak、网关与 Angular SSR 前端实现一键交付。
category: fullstack
column: spring-boot-angular
tags:
  - 全栈实战
  - Docker Compose
  - 生产交付
  - 端到端联调
  - 微服务架构
---

## 1. 全栈生产拓扑与交付决策矩阵

| 技术维度 | 选型方案 | 替代方案 | 决策依据 |
| :--- | :--- | :--- | :--- |
| **边缘流量收敛** | Nginx 作为唯一暴露宿主机端口的边缘代理（`80:80`） | 前端、网关各自分别暴露宿主机公网端口 | 统一同源域，彻底规避 CORS 复杂跨域，隐藏内部拓扑构筑纵深安全防线。 |
| **SSE 穿透保障** | `proxy_buffering off` + 3600s 读取超时配置 | 默认开启 Nginx 响应缓冲与短超时 | 彻底消除 Nginx 缓存积压导致的事件流延迟或心跳空闲误断连接。 |
| **编排就绪约束** | 强校验 `depends_on: condition: service_healthy` | 弱约束 `condition: service_started` | 避免因 Keycloak 数据迁移初始化延迟导致上游服务在握手期崩溃雪崩。 |
| **双层代理架构** | Nginx 边缘代理 + Express SSR 容器内代理 | 单一外部代理或前端代码环境硬编码 | 抹平 CSR 与 SSR 的 API 请求路径差异，统一采用相对路径 `/packt`。 |
| **内网网络隔离** | 内部专用桥接网络（`bookstore-network`） | 默认 bridge 或 host 网络共享 | 仅 Nginx 对外监听，前端 Node 服务与后端微服务集群完全处于私有网段。 |

## 2. 生产级 Nginx 边缘代理配置范式 (`nginx.conf`)

```nginx
upstream angular {
    server ng-bookstore:4000;
}

upstream gateway {
    server gateway-server:8080;
}

server {
    listen 80;

    # 1. 客户端 API 请求及 SSE 实时推送流 -> 转发至 Spring Cloud Gateway
    location /packt/ {
        proxy_pass         http://gateway;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;

        # SSE 流式传输关键指令：关闭缓冲、禁用缓存、开启长连接与维持长超时
        proxy_buffering           off;
        proxy_cache               off;
        proxy_set_header          Connection '';
        proxy_http_version        1.1;
        chunked_transfer_encoding off;
        proxy_read_timeout        3600s;
    }

    # 2. 页面路由导航与静态资产托管 -> 转发至 Angular SSR 容器
    location / {
        proxy_pass         http://angular;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

## 3. 生产级 Docker Compose 编排范式 (`docker-compose.yml`)

```yaml
version: "3.8"

networks:
  bookstore-network:
    driver: bridge

services:
  # Angular SSR 渲染前端服务（内网封闭，不映射宿主机端口）
  ng-bookstore:
    image: bookstore/ng-bookstore:${IMAGE_TAG:-v0.0.1}
    container_name: bookstore-ng-frontend
    environment:
      PORT: 4000
      API_URL: "http://gateway-server:8080"
    depends_on:
      gateway-server:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:4000"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - bookstore-network

  # Nginx 反向代理边缘入口（唯一对外暴露端口服务）
  nginx:
    image: bookstore/nginx:${IMAGE_TAG:-v0.0.1}
    container_name: bookstore-nginx
    ports:
      - "80:80"
    depends_on:
      ng-bookstore:
        condition: service_healthy
      gateway-server:
        condition: service_healthy
    networks:
      - bookstore-network
```

## 4. 全栈生产环境双层代理与微服务编排拓扑

```mermaid
flowchart TD
    CLIENT["外部客户端 (浏览器 / 爬虫)"] -->|端口 80 访问| NGINX["Nginx 边缘网关 (唯一暴露端口)"]

    subgraph DOCKER_NETWORK ["内部私有桥接网络 (bookstore-network)"]
        NGINX -->|/* 页面与静态资源| FRONTEND["ng-bookstore (Angular SSR / Port 4000)"]
        NGINX -->|/packt/* 客户端调用与 SSE| GATEWAY["gateway-server (Spring Cloud Gateway / Port 8080)"]
        
        FRONTEND -.->|SSR 内部取数 (API_URL)| GATEWAY
        
        GATEWAY --> DISCOVERY["eureka-server (服务发现)"]
        GATEWAY --> AUTH["keycloak (OAuth2 / OIDC)"]
        GATEWAY --> USER_SVC["user-service (用户微服务)"]
        GATEWAY --> INV_SVC["inventory-service (库存微服务)"]
        
        USER_SVC --> MONGO[("MongoDB")]
        INV_SVC --> POSTGRES[("PostgreSQL")]
        
        USER_SVC -.-> TRACING["zipkin (分布式链路追踪)"]
        INV_SVC -.-> TRACING
    end
```

## 5. 全栈生产部署避坑清单 (Do's & Don'ts)

| 错误实践 (Don't) | 正确实践 (Do) |
| :--- | :--- |
| 为方便调试，在 Docker Compose 中为前端与后端所有容器暴露宿主机端口。 | 仅让 Nginx 暴露 80 端口，内部容器完全依靠 Bridge 网络服务名寻址通信。 |
| 在 Nginx 处理 `/packt/` 长连接时保留默认的响应缓冲配置。 | 显式配置 `proxy_buffering off; chunked_transfer_encoding off;` 确保流式推送零延迟。 |
| 服务依赖配置为 `depends_on: [keycloak]`（只要进程启动即认为就绪）。 | 使用 `condition: service_healthy` 严格等待后端 Keycloak 完成 Realm 导入与初始化。 |
| 前端代码针对生产与本地开发编写分立的 IP 硬编码请求地址。 | 统一配置相对路径 `apiUrl: '/packt'`，利用 Nginx 与 Express 双层代理自动抹平差异。 |
| 容器镜像长期依赖 `:latest` 动态浮动指针进行发布。 | 遵循语义化版本控制（Semantic Versioning），为每一次构建产物标注确定性版本号。 |

<!-- split -->
# 原著完整参考：第 21 章 在生产环境中连接前后端（Connecting Frontend and Backend in Production）

在上一章中，我们完成了 Angular 前端的生产级构建，在 SSR 服务中增加了用于 API 内部路由的 Express 代理中间件，编写了多阶段 Dockerfile，并成功将容器镜像发布到了 Docker Hub。前端现在已经成为一个便携、自包含的标准容器单元，但它仍处于单兵孤立运行状态。在上一章的测试中，`/books` 路由因缺少后端支持而渲染出了一张空表格。现在，是时候将容器化的 Angular 前端与 Spring Boot 后端微服务集群统一整合为单一的生产级部署体系，并引入 Nginx 作为边缘接入层将全栈系统严密串联起来。为此，我们将利用 Docker Compose 来编排整个平台：将 Angular SSR 容器、Nginx 反向代理、Spring Boot 业务微服务集群、API 网关以及多范式数据库作为声明式的统一软件栈加以管理，全面扩展我们在第 10 章为后端编写的 `docker-compose.yml`。

在本章结束时，整个全栈书店系统平台仅需一条 `docker compose up` 命令即可一键全部拉起，并统一通过单一外部入口——运行在 80 端口上的 Nginx 进行访问。无论是服务端直出渲染的页面、客户端接管的动态路由，还是来自第 19 章的实时 SSE 事件推送，都将顺畅无阻地穿透这套反向代理流水线。

本章我们将涵盖以下主题：

- 将 Docker Compose 作为面向生产的编排利器进行深度探索
- 剖析全栈生产拓扑架构
- 配置 Nginx 反向代理
- 构建 Nginx 容器镜像
- 面向生产环境容器化书店后端
- 使用前端服务扩展 Docker Compose 编排
- 鉴权凭据在代理链路中的端到端流转解析
- 全平台一键拉起与全维度功能验收
- Spring Boot 微服务容器化过程中的经典陷阱
- 生产部署中的宝贵实战经验教训
- 疑难排查权威指南
- 本章小结
- 结语与未来展望

## 技术要求

本章的完整源码可在此处获取：

`https://github.com/PacktPublishing/Spring-Boot-and-Angular-2E/tree/main/chapter-21/`

你需要在本地计算机上安装并正常运行 Docker 和 Docker Compose。你还需要我们在第 20 章构建发布的前端镜像（可在本地或 Docker Hub 上获取），以及在第 10 章构建的后端微服务镜像（同样可在本地或 Docker Hub 上获取）。

## 将 Docker Compose 作为面向生产的编排利器进行深度探索

Docker Compose 经常被初学者误当做仅仅用于本地开发调试的临时便利工具，但在真实的现代工程实践中，它往往扮演着整套系统全局架构蓝图的核心角色。单个声明式配置文件精确描述了系统的终态规格——包括运行哪些服务、各服务之间如何通信互联，以及各自依赖哪些前置条件，而无需开发者手动敲击一系列晦涩繁杂的底层命令。对于书店平台，Docker Compose 将底层基础设施与业务应用服务建模为一个不可分割的协同运行单元，提供了高度一致的启动体验、百分之百可复现的运行环境，以及界限分明的运维边界。Docker Compose 围绕四个核心概念组织容器化应用，我们在本章将自始至终贯彻这四大基石：

- **服务（Services）**：定义运行的单元。每个微服务与基础设施组件（如 PostgreSQL、Keycloak、API Gateway、Angular 前端）都作为独立的容器运行，拥有各自独立的运行配置、环境变量与健康检查指令。在我们的 `docker-compose.yml` 中，`services:` 下的每个顶级键名即声明了一个服务容器。
- **网络（Networks）**：定义服务间的互联互通机制。我们所有的服务均加入一个名为 `bookstore-network` 的共享 Bridge 桥接网络。在网络内部，容器之间通过服务逻辑名称（如 `postgres`、`gateway-server`、`ng-bookstore`）互相寻址通信，完全摆脱了对动态不可控的物理 IP 地址的依赖。Docker 内置的 DNS 服务会自动处理这些主机名的解析。这正是为什么我们的 Spring Boot 服务可以使用类似 `jdbc:postgresql://postgres:5432/inventory` 的连接串，而 Angular SSR 代理的目标地址可以优雅地指向 `http://gateway-server:8080`。
- **数据卷（Volumes）**：定义数据的持久化边界。PostgreSQL 和 MongoDB 分别挂载了命名数据卷（`postgres_data` 和 `mongo_data`），确保即使容器被频繁销毁、重建或升级，数据库落盘的数据依然完整无损。若没有数据卷，每次执行 `docker compose down` 都会导致全量图书和用户数据灰飞烟灭。
- **依赖编排（Dependencies）**：定义严格的拓扑启动时序。带有 `condition: service_healthy` 的 `depends_on` 指令能够确保下游服务只在上游依赖真正就绪后才被允许启动——这里的就绪不仅指容器进程被创建，更意味着其内部健康检查已经确实亮起绿灯。这在分布式系统中是性命攸关的：库存微服务必须等待 PostgreSQL 能够正常接收 SQL 连接，网关服务必须等待 Keycloak 能够正常校验 JWT 令牌，而 Nginx 必须等待 Angular 前端能够正常直出页面。

这四个核心构件——*服务*、*网络*、*数据卷*与*依赖*——构成了我们组装 `docker-compose.yml` 的标准积木。而具体的组装拓扑，则完全取决于平台的生产架构设计。

## 剖析全栈生产拓扑架构

在编写具体配置之前，我们必须清晰洞悉全栈部署的网络拓扑。整套架构包含两个代理层，各自承担着截然不同的技术使命：

![图 21.1：以 Nginx 作为边缘入口的全栈生产架构图](/media/posts/spring-boot-angular/img-09140.png)

*Figure 21.1: Full-stack production architecture with Nginx as the edge entry point*

- **Nginx（边缘反向代理）**：整个系统面向外部世界的**唯一开放端口**，监听标准的 80 端口。它统一承接所有来自浏览器端的请求：将常规页面访问路由到 Angular 前端容器，并将带有 `/packt/*` 前缀的请求透明反向代理给后端的 API 网关。这同时涵盖了来自 Angular 服务的普通 `HttpClient` 请求，以及我们在第 19 章构建的用于实时推送的 `EventSource`（SSE）长连接。
- **Express 代理（容器内部代理）**：专门处理在 Docker 内部由 SSR 引擎发起的内部 API 调用。当 Angular SSR 服务在 Node 进程中渲染 `/books` 路由时，`BookService` 会向自身的 Origin 发起针对 `/packt/inventory/api/books` 的内部调用。我们在第 20 章添加的 Express 代理中间件会截获该请求，并通过 Docker 内部的桥接网络将其转发给 `http://gateway-server:8080`。浏览器对此代理的存在完全无感知。

为什么必须采用这种双层代理拓扑？因为浏览器身处容器外部网络，它只能访问宿主机映射的 80 端口，必须经由 Nginx 转发 API；而 SSR 服务运行在 Docker 内部的专用网络中，为了渲染页面，它必须能在容器内部直连后端的微服务网关。双方在代码层面均消费 `environment.prod.ts` 中定义的相同的相对路径 `/packt`，但在底层各自通过不同的物理链路完成解析。整套系统不需要编写任何条件分支代码，也无需维护平台专用的环境配置分支。

> **提示**
>
> 在生产环境中，Nginx 还将作为 HTTPS 的 TLS 终端终结者，通过 Let's Encrypt 等权威 CA 签发的数字证书实现通信全程高强度加密。尽管配置 TLS 证书不在本章基础范畴之内，但我们即将搭建的 Nginx 架构已经为此做好了充分准备：只需在 Nginx 配置中挂载证书文件并将监听端口从 80 调整为 443，即可无缝完成升级。

明确了双层代理的骨架后，我们从边缘层入手，开始构建核心的反向代理。

## 配置 Nginx 反向代理

我们首先编写 Nginx 配置文件，将外部浏览器的流量精准导向对应的后端组件。截至第 20 章结束，前端的 `server.ts` 已经包含了三项面向生产的专属配置：

- `AngularNodeAppEngine` 上的 `allowedHosts` 选项，使 SSR 服务能够安全接收由 Nginx 透传的主机头；
- Express 代理中间件上的 `pathRewrite` 选项，确保在 SSR 期间向微服务网关转发请求时保留 `/packt` 前缀；
- `express.static` 上的 `index: false` 与 `redirect: false`，确保路由页面能够平滑穿透给 Angular 的路由渲染引擎。

我们在上一章发布的镜像已经内化了所有这些改动，因此本章可以全神贯注于基础设施层。我们在 `containerization/nginx/` 目录下创建 `nginx.conf`：

```nginx
upstream angular {
    server ng-bookstore:4000;
}

upstream gateway {
    server gateway-server:8080;
}

server {
    listen 80;

    # API 接口请求 -> Spring Cloud Gateway 微服务网关
    location /packt/ {
        proxy_pass         http://gateway;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;

        # SSE 实时长连接支持 - 禁用缓冲实现真正的流式下发
        proxy_buffering    off;
        proxy_cache        off;
        proxy_set_header   Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding off;
        proxy_read_timeout 3600s;
    }

    # 其它所有请求 -> Angular SSR 服务端渲染引擎
    location / {
        proxy_pass         http://angular;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

逐一剖析该配置文件的关键指令：

- `upstream` 负载均衡块直接使用 Docker Compose 的服务名称作为主机名。在 Docker 内部桥接网络中，`ng-bookstore` 会被自动解析为 Angular 容器的私有 IP，`gateway-server` 会被解析为网关容器的私有 IP。
- `location /packt/` 块负责拦截来自浏览器的全部 API 调用。包括前端 Angular 服务的 `HttpClient` 网络请求以及 `NotificationService` 发起的 `EventSource` SSE 长连接。`proxy_pass http://gateway` 指令将这些请求转发至 Spring Cloud Gateway；网关会为受保护端点校验 JWT，而对公共图书目录和 SSE 推送端点执行免认证放行。
- **针对 SSE 的专属指令链**至关重要。在第 19 章中，我们使用 `EventSource` 构建了实时推送通知。SSE 建立在长期保持的 HTTP 单向连接之上，服务器向其中增量推送事件片段。在默认情况下，Nginx 会对后端的 HTTP 响应开启全局缓冲（Buffering），直到缓冲区填满或响应结束才一次性下发给客户端，这会导致 SSE 的实时推送被硬生生堵死！`proxy_buffering off` 彻底禁用了该缓冲机制，确保后端网关一产生新事件，Nginx 就会立即推给浏览器。`proxy_cache off` 防止 Nginx 尝试缓存流式响应。`chunked_transfer_encoding off` 让 Nginx 直接透传流式报文，保护不规范的中间代理。`Connection ''` 与 `proxy_http_version 1.1` 确保 Nginx 与上游网关保持 HTTP/1.1 Keep-Alive 长连接连接池。`proxy_read_timeout 3600s` 将连接空闲超时时间延长至 1 小时，防止在业务低谷期连接被意外掐断。缺少这套指令组合，我们在第 19 章编写的 `NotificationService` 就会遭遇事件大面积滞后甚至频繁闪断崩溃。
- `location /` 兜底块负责拦截所有非 `/packt/` 请求，并全量转发给 Angular SSR 容器。这涵盖了页面路由导航（`/books`、`/auth/signin`、`/privacy`）、静态资源加载（从 `dist/browser/` 下发的 JS 与 CSS 包）以及预渲染的 HTML 页面。Angular 容器内部会根据第 18 章配置的服务端路由规则，精确决定是输出 SSR 直出 HTML、预渲染静态文本，还是客户端渲染的 SPA 外壳。

配置文件就绪后，我们将其打包为一个独立的容器镜像。

## 构建 Nginx 容器镜像

在 `containerization/nginx/` 目录下创建 `Dockerfile`：

```dockerfile
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

这是全书最简洁的 Dockerfile，仅需三行。官方的 `nginx:alpine` 基础镜像自带轻量高效的 Nginx 运行时。我们用自己编写的反向代理配置替换其默认的 default.conf。因为不需要编译任何代码，所以无需使用多阶段构建。

在 `containerization` 目录下执行镜像构建：

```bash
docker build -t bookstore/nginx:v0.0.1 ./nginx
```

随后为镜像打上标签并推送到 Docker Hub（请将 `<dockerhub-username>` 替换为你真实的用户名）：

```bash
docker tag bookstore/nginx:v0.0.1 <dockerhub-username>/nginx:v0.0.1
docker tag bookstore/nginx:v0.0.1 <dockerhub-username>/nginx:latest
docker push <dockerhub-username>/nginx:v0.0.1
docker push <dockerhub-username>/nginx:latest
```

至此，全栈系统的所有组件均已成为标准的容器镜像并托管至远程 Registry：包括第 10 章构建的后端微服务、第 20 章构建的 Angular 前端，以及刚刚构建的 Nginx 边缘代理。接下来我们开始进行终极编排。

## 面向生产环境容器化书店后端

我们先来系统梳理定义在 `docker-compose.yml` 中的后端基础设施与服务定义，体会它是如何将散落的独立服务紧密粘合成一个有机整体的。

### 步骤 1：定义 PostgreSQL 关系型数据库

库存微服务依赖 PostgreSQL 存储图书与作者数据：

```yaml
postgres:
  image: postgres:17.11
  container_name: bookstore-postgres
  environment:
    POSTGRES_USER: bookstore
    POSTGRES_PASSWORD: bookstore123
    POSTGRES_DB: inventory
  volumes:
    - postgres_data:/var/lib/postgresql/data
```

这通过官方镜像拉起数据库，指定了容器显式名称，通过环境变量预初始化了库名与账号，并通过 `postgres_data` 命名卷实现了数据的持久化。

### 步骤 2：定义 MongoDB 文档数据库

用户微服务采用 MongoDB 存储用户档案：

```yaml
mongodb:
  image: mongo:${MONGO_IMAGE_TAG:-8.0.30}
```

遵循多范式微服务设计原则：每个微服务独享其专属数据库，实现数据底层的完全解耦。

### 步骤 3：定义 Zipkin 分布式链路追踪

```yaml
zipkin:
  image: openzipkin/zipkin:3.6.1
```

用于统一采集全链路的 OpenTelemetry 分布式跟踪数据，使跨网关、库存与用户服务的请求调用链一览无余。

### 步骤 4：定义 Keycloak 认证中心

```yaml
keycloak:
  image: quay.io/keycloak/keycloak:26.7.3
  volumes:
    - ./Keycloak/bookstore-realm.json:/opt/keycloak/data/import/bookstore-realm.json:ro
```

在启动时自动挂载预配置的 Realm 领域模型，提供 OAuth 2.0 与 OpenID Connect 协议支持。

### 步骤 5：定义 Eureka 服务注册中心

```yaml
eureka-server:
  image: ansgohar/eureka-server:${IMAGE_TAG:-latest}
  depends_on:
    zipkin:
      condition: service_healthy
```

所有的微服务启动后都会自动向 Eureka 注册心跳并发现彼此。Eureka 自身配置了对 Zipkin 的健康依赖，确保链路跟踪从最开始的服务注册阶段就保持完整。

### 步骤 6 与 7：定义业务微服务（Inventory 与 User）

```yaml
inventory-service:
  image: ansgohar/inventory-ms:${IMAGE_TAG:-latest}
  environment:
    SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/inventory
```

两个业务微服务通过 Docker 逻辑服务名（如 `postgres` 和 `mongodb`）无缝连接数据存储层，无需硬编码任何物理 IP。

### 步骤 8 与 9：定义网关、网络与存储卷

网关 `gateway-server` 充当后端的统一入口。在文件尾部声明共享桥接网络 `bookstore-network` 以及数据卷 `postgres_data` 与 `mongo_data`。

全套后端的声明式拓扑就此稳固确立。

## 使用前端服务扩展 Docker Compose 编排

现在我们在 `containerization/docker-compose.yml` 中正式引入前端服务与 Nginx。

### 强化 Keycloak 的依赖状态判定

在加入前端之前，必须对已有的后端依赖做出一处关键升级：将 `user-service` 和 `gateway-server` 对 Keycloak 的依赖条件从原先简陋的 `condition: service_started` 强制升级为 `condition: service_healthy`：

```yaml
# 在 user-service 的 depends_on 中：
keycloak:
  condition: service_healthy

# 在 gateway-server 的 depends_on 中：
keycloak:
  condition: service_healthy
```

`service_started` 仅仅判断容器是否被创建，而 Keycloak 在初次启动时需要花费高达一两分钟来初始化数据表并导入 Realm。由于现在整套依赖链条一路延伸到了前端与 Nginx，如果网关过早启动，它会因无法获取 Keycloak 的 JWKS 公钥而健康检查失败，进而阻断前端与 Nginx 的启动，引发整栈级联雪崩。将其锁定为 `service_healthy` 能够彻底根除启动竞态。

### 声明 Angular SSR 前端服务

在 `gateway-server` 之后追加前端服务声明：

```yaml
# Angular SSR 前端服务
ng-bookstore:
  image: <dockerhub-username>/ng-bookstore:${IMAGE_TAG:-latest}
  container_name: bookstore-ng-frontend
  environment:
    PORT: 4000
    API_URL: "http://gateway-server:8080"
  depends_on:
    gateway-server:
      condition: service_healthy
  healthcheck:
    test:
      [
        "CMD",
        "wget",
        "--quiet",
        "--tries=1",
        "--spider",
        "http://localhost:4000",
      ]
    interval: 10s
    timeout: 5s
    retries: 5
  networks:
    - bookstore-network
```

- `API_URL: "http://gateway-server:8080"` 注入给了我们在第 20 章编写的 Express 代理中间件，使得在 SSR 服务端直出渲染时，内部的 `/packt` 请求能够通过 Docker DNS 直达网关，彻底解决了在第 20 章独立测试时空表格的难题。
- `depends_on` 确保在网关真正健康之前前端绝不冒进启动。
- **完全不暴露端口（No Ports Mapping）**：Angular 容器故意不对宿主机映射任何端口，杜绝了外部绕过网关直连前端的后门隐患。所有的外部流量必须且只能经由 Nginx 规范进入。

### 声明 Nginx 反向代理服务

作为整个平台的统一边缘门户：

```yaml
# Nginx 反向代理（边缘总入口）
nginx:
  image: <dockerhub-username>/nginx:${IMAGE_TAG:-latest}
  container_name: bookstore-nginx
  ports:
    - "80:80"
  depends_on:
    ng-bookstore:
      condition: service_healthy
    gateway-server:
      condition: service_healthy
  networks:
    - bookstore-network
```

> **注意**
>
> **关于启动等待的权衡考量**
> Nginx 默认会在配置加载的一瞬间对 `upstream` 里的主机名（如 `ng-bookstore`）进行一次性 DNS 解析。如果上游尚未就绪，Nginx 会直接报错退出。让 Nginx 依赖上游健康能够规避启动崩溃，但代价是 Nginx 会成为整条链路上最后一个启动的容器，启动期间 80 端口暂时无法对外响应。在超大型生产环境中，通常会在 Nginx 中配置 `resolver 127.0.0.11 valid=10s;` 并使用变量传递代理目标，配合自定义的 502/503 优雅维护降级页。在当前的微服务单机编排中，基于 Compose 的强时序等待是最简明稳健的选择。

整个平台的终极依赖链条清晰确立：`postgres + mongodb + zipkin + keycloak` → `eureka-server` → `inventory-service + user-service` → `gateway-server` → `ng-bookstore` → `nginx`。所有服务均加入共享网络 `bookstore-network`。

镜像版本通过 `${IMAGE_TAG:-latest}` 变量驱动，支持在命令行按需指定确定版本（如 `IMAGE_TAG=v0.0.1 docker compose up -d`）。

## 鉴权凭据在代理链路中的端到端流转解析

在正式拉起系统前，我们深入透视 JWT 认证体系在两层代理穿透下的完整闭环。

在第 16 章中，我们编写了函数式 `authInterceptor`，它自动在发出的 HTTP 请求上附带 `Authorization: Bearer <token>` 请求头。在生产部署中，这一机制原样生效，无需编写任何补丁代码。当用户在浏览器完成登录后，令牌被持久化在本地存储并写入 `AuthStore`。当用户在页面上发起数据写操作时，请求带着该令牌飞向宿主机 80 端口的 Nginx，Nginx 忠实地透传所有 HTTP 请求头给背后的 API 网关，网关利用本地缓存的 Keycloak 公钥严密验证该令牌的数字签名，提取调用者身份，并由网关亲自将解析出的用户 ID 注入给下游库存微服务。

关于**跨域资源共享（CORS）**：在我们的生产架构中，CORS 被物理级根除！浏览器加载页面的地址是 `http://localhost`（80 端口，由 Nginx 提供），而页面发出的所有 API 请求目标同样是 `http://localhost/packt/...`（同源地址，由 Nginx 内部反向代理至网关）。由于协议、域名与端口完全一致，浏览器绝对不会触发任何 CORS 预检请求（Preflight OPTIONS）。这就是采用反向代理统一边缘入口相比于在多个端口上暴露微服务带来的巨大架构红利。

对于服务端发起的 SSR 直出请求（如服务端渲染 `/books` 目录），由于无需用户会话，拦截器不会附加任何令牌，而作为公共开放接口，网关也会予以直接放行。对于像个人中心这样的鉴权页面，其渲染模式早已被锁定为纯客户端渲染（CSR），完全避免了在服务端渲染时无令牌可用导致的访问控制混乱。

## 全平台一键拉起与全维度功能验收

所有的设计、镜像与依赖编排在此刻全部收敛为一条优雅的命令。

在 `containerization` 目录下，首先拉取最新镜像：

```bash
docker compose pull
```

一键拉起全栈平台：

```bash
docker compose up -d
```

查看各服务健康状态：

```bash
docker compose ps
```

在控制台中，你应该看到 10 个服务全部呈现为 `running` 或 `healthy`：`postgres`、`mongodb`、`zipkin`、`keycloak`、`eureka-server`、`inventory-service`、`user-service`、`gateway-server`、`ng-bookstore` 以及 `bookstore-nginx`。由于需要等待 Keycloak 完整初始化，初次拉起通常需要约两分钟。一旦全员亮起绿灯，按照以下六大维度验收清单进行系统终验：

### 1. 图书目录服务端渲染（SSR）验收

向公网边缘入口发起请求，审视服务端直出的 HTML 内容：

```bash
curl http://localhost/books
```

检查返回的 HTML 正文：其中应当赫然包含真正的 `<table>` 标签，以及从数据库动态读取出的书名与作者名称。与第 18 章本地测试相比，现在的请求历经了：`浏览器/curl → Nginx:80 → Angular SSR:4000 → Express内部代理 → API Gateway:8080 → Inventory微服务 → PostgreSQL` 并原路返回，全链路完全打通！

### 2. 静态预渲染页面（SSG）验收

```bash
curl http://localhost/privacy
```

直接返回在构建期生成的静态隐私政策 HTML，无需触发任何后端数据库查询。

### 3. 客户端渲染页面（CSR）验收

在浏览器中打开 `http://localhost/auth/signin`。页面以下发极简 HTML 外壳并在前端通过 JavaScript 动态激活的方式呈现出登录表单。

### 4. 完整身份认证流体验

点击注册新账号，随后登录系统，点击右上角个人资料图标：页面平滑跳转至个人中心并完整展示当前用户的注册信息。这验证了前端拦截器、Nginx 代理、网关 JWT 校验、User 微服务与 MongoDB 的全流程协作。

### 5. 完整数据 CRUD 操作

在已登录状态下，点击 **Add New Book** 添加一本新书。列表自动刷新并呈现新入库的书目。验证了带 JWT 鉴权的写操作在生产代理链下的正确流转。

### 6. Nginx 代理下的实时 SSE 跨标签页推送

在浏览器中同时打开两个独立的标签页并访问图书列表。在第一个标签页中点击新增图书；几毫秒内，第二个标签页下方立刻弹出精美轻量提示条，通知“📚 New book added: [书名]”，且第二页的书架全自动刷新呈现出这本新书！这证实了 Nginx 的 `proxy_buffering off` 成功保障了流式长连接的实时吞吐能力。

### 架构端口安全检查

- `http://localhost`（80 端口）：Nginx 正常响应，这是外界访问系统的**唯一合规门户**；
- `http://localhost:4000`：宿主机无法访问，证明前端容器被安全隔离在内部网络；
- `http://localhost:8080`：仅在开发调试期映射供观测，生产环境下可通过防火墙直接封堵。

常用运维控制命令：

```bash
docker compose ps                              # 查看各服务状态与健康度
docker compose logs -f --tail=200              # 追踪所有容器的综合日志流
docker compose logs -f --tail=200 ng-bookstore # 追踪特定前端容器的日志
docker compose restart gateway-server          # 单独重启某个服务
docker compose down                            # 停止整套系统
docker compose down -v                         # 停止并彻底销毁数据持久化卷
```

系统能够稳定运转是令人兴奋的，但在迈向真实生产的道路上，我们还必须复盘那些在本地容易被掩盖、但在生产环境中往往会引发灾难的经典技术陷阱。

## Spring Boot 微服务容器化过程中的经典陷阱

许多初学者容易产生一种天真的错觉：认为 Spring Boot 应用在容器里跑起来与在本地 IDE 里运行没有任何区别。这种忽视往往会导致系统上线后变得脆弱不堪：

1. **镜像体积庞大且臃肿**：采用单阶段 Dockerfile 基于完整的 JDK 镜像直接打包并运行，把编译器等大量只在构建期使用的工具连同 JAR 一同带到了生产环境，不仅导致镜像高达几百兆甚至上 G，增加了拉取与存储成本，还无形中放大了安全攻击面。应当始终采用多阶段构建，在运行时阶段仅采用精简的 JRE 或 Distroless 基础镜像。
2. **将环境配置硬编码在镜像内部**：直接把 `localhost`、生产数据库密码写死在 `application.yml` 中，导致镜像与特定部署环境死锁绑定。优秀的容器镜像必须是环境无关的，所有数据库连接串、服务地址和凭据必须全部外部化为环境变量。
3. **把容器内部的 localhost 误当做其他服务**：在容器网络中，每个容器拥有独立的 Network Namespace，容器内部的 `localhost` 仅代表它自己。服务之间通信必须使用 Docker 逻辑服务名，依靠内部 DNS 进行动态寻址。
4. **混淆“容器启动”与“服务就绪”**：Compose 虽然能控制容器拉起的物理顺序，但容器进程启动绝不代表内部的 Java 运行时已经可以接收流量。缺少显式的健康检查（Healthcheck），就会导致上游服务在下游数据库尚未完成初始化时盲目发起连接而频繁报错崩溃。
5. **忽视 Spring Boot 分层 JAR（Layered JARs）特性**：默认打包的 Fat JAR 会把依赖项和业务代码全部揉成一个整体。利用 Spring Boot 的分层打包能力，Docker 可以将很少变动的第三方库与频繁变动的业务代码拆分为不同的镜像层，从而在重新构建时实现毫秒级的极速缓存复用。
6. **在运行时镜像中混杂构建工具**：把 Maven 或 Gradle 等构建工具留存在最终生产镜像中，不仅增加了不必要的体积，更是极其危险的安全后门。

容器化绝不仅仅是写个简单的 Dockerfile，它是关于如何在编排、隔离、弹性伸缩和灾难恢复的复杂环境中打造高健壮性服务的系统工程。

## 生产部署中的宝贵实战经验教训

在将整套书店系统全面集成与跑通的过程中，我们遇到并解决了一系列具有极高参考价值的真实工程陷阱：

- **Express 挂载点路径剥离陷阱**：在首次联调 SSR 内部代理时，图书列表始终呈现空表格。排查发现，当 Express 将请求路由至挂载路径 `/packt` 时，会默认切除该前缀再传给代理中间件，导致网关收到缺少前缀的路径并报 404。通过在代理中间件中配置 `pathRewrite: (path) => `/packt${path}``，成功解决了该问题。由于普通的浏览器请求直接走 Nginx，这一 Bug 仅在 SSR 内部存在，在本地开发时极难察觉。
- **service_started 与 service_healthy 的生死之别**：早期配置中依赖 Keycloak 使用了 `service_started`，导致微服务与网关在 Keycloak 尚未完成 Realm 初始化时就提前介入，触发连锁健康检查超时。将其收紧为 `service_healthy` 后，整条依赖时序才真正稳定下来。
- **反向代理透传引发的 Host 拒绝**：Nginx 转发请求给 Angular 容器时，Angular SSR 引擎一度拒绝服务，报错主机头不合法。我们在第 18 章提前配置的 `allowedHosts: ['localhost', '127.0.0.1']` 正是为此铺平道路，使镜像在任何反向代理背后均能安全自洽。
- **Nginx 默认缓冲扼杀 SSE 实时流**：Nginx 默认的反向代理缓冲机制会把长连接响应截留在缓冲区，导致前端要么迟迟收不到事件，要么连接超时。在 `/packt/` 规则下显式配置 `proxy_buffering off` 以及关闭缓存、开启 Keep-Alive，是打通实时流推送的核心钥匙。
- **残留的孤儿容器阻碍新服务拉起**：当在不同目录或分支间切换 Compose 文件时，带有固定 `container_name` 的旧容器可能会变成孤儿容器残留在宿主机上，导致再次拉起时报错“容器名已被占用”。使用 `docker rm -f` 强制清理残留是保证干净拉起的前提。

这些问题的共同特征是：它们只在服务跨越真实的生产网络边界时才会暴露。

## 疑难排查权威指南

当系统拉起遇到异常时，请依照以下诊断方案由表及里地追溯根因：

### 端口冲突被占用

如果宿主机的 80、8080 或 5432 端口被其他软件占用：

```bash
lsof -nP -iTCP:80 -sTCP:LISTEN
lsof -nP -iTCP:8080 -sTCP:LISTEN
lsof -nP -iTCP:5432 -sTCP:LISTEN
```

关闭冲突进程或调整 `docker-compose.yml` 中的外部端口映射。

### Keycloak 启动失败或反复重启

```bash
docker compose logs keycloak
```

最常见原因是 Realm JSON 文件路径配置错误。检查 `containerization/Keycloak/bookstore-realm.json` 是否存在。如果 Docker 打印出“Is a directory”，说明挂载路径写错导致 Docker 把文件误建成了空目录。删除错误目录并修正相对路径即可。

### 服务持续处于 Unhealthy 状态

```bash
docker compose ps
docker compose logs --tail=200 gateway-server
docker compose logs --tail=200 ng-bookstore
```

通常是因为 Keycloak 初次启动较慢导致下游等待超时。等待 Keycloak 彻底健康后，单独重启异常服务：

```bash
docker compose restart gateway-server
```

### 容器名重名冲突

```bash
docker rm -f $(docker ps -a --filter "name=bookstore-" -q)
docker compose up -d
```

### MongoDB 身份认证失败

检查 User 微服务的连接字符串是否与 Compose 声明一致：`mongodb://bookstore:bookstore123@mongodb:27017/userDB?authSource=admin`。若此前残留了旧数据卷导致权限错乱，重置持久化卷：

```bash
docker compose down -v
docker compose up -d
```

### 终极终极清理重启

当环境彻底混乱时，彻底清除所有容器、卷与网络并重新来过：

```bash
docker compose down -v --remove-orphans
docker compose pull
docker compose up -d
```

## 本章小结

在本章中，我们将第 20 章容器化的 Angular 前端与 Spring Boot 后端微服务集群进行了深度整合，打造了一套完备的高内聚生产级部署环境。我们利用 Docker Compose 将整个分布式平台建模为声明式的系统蓝图；设计了精巧的双层代理架构，通过 Nginx 作为统一的边缘反向代理，无缝调度流向 Angular SSR 容器与 Spring Cloud Gateway 的外部流量；并在 Nginx 中配置了针对 SSE 优化的流式代理指令以捍卫实时推送通道。

我们升级了关键依赖的健康检查时序，剖析了 JWT 鉴权凭据在代理链路中的无感穿透，并在物理层面消除了跨域 CORS 问题。最后，我们对系统实施了全维度端到端验收：从服务端直出、静态预渲染、纯客户端渲染，到高交互身份认证、CRUD 数据闭环，再到跨终端实时推送，整套系统仅凭一条 `docker compose up -d` 即可在几分钟内整装拉起。

这标志着我们全栈实战之旅的完美闭环。整套架构完全遵从企业级生产规范：微服务各自独立自治、基础设施完全代码化声明，且研发与部署体验高度收敛于一条极简命令之中。

## 结语与未来展望

你手握一个空白工程与一份基础需求开启了本书的阅读之旅。而现在，你站在了一套完整、现代、面向生产级全栈平台的终点线上。一路走来，我们从零亲手设计并实现了分层的 Spring Boot 微服务后端集群，使用 Keycloak 构建了高安全性的工业级身份中枢，利用现代 Angular 独立组件、Signals 响应式状态管理以及 Events 插件构建了优雅健壮的前端，通过清晰的 API 契约与代理边界打通了前后端的数据通信，并最终利用 Docker 和 Docker Compose 完成了平台的全套容器化编排。

比单纯构建出这套书店系统更宝贵的是：我们自始至终在追求“知其然，更知其所以然”。我们先手工编写核心模式以透彻理解底层机制，在模式成熟后引入 AI 辅助工具倍增研发效能，对生成的代码保持审慎的审查与微调，并时常从局部代码中抽身出来，在系统全局的高度审视整套架构的协同运作。这些架构思维与工程习惯，将在你未来的职业生涯中持续释放巨大的价值。

接下来你应该做些什么？我们的建议是：不要急着盲目开始下一个基础教程，而是以此为起点，把这套书店系统变成完全属于你自己的作品！你可以为书店增加全文搜索、书评与星级打分、管理员后台仪表盘、异步消息队列，或者更复杂的基于角色的细粒度访问控制。在运维层面，你可以为 Nginx 配置真实的 TLS 证书，通过 GitHub Actions 搭建自动化的 CI/CD 构建发布流水线，甚至将这套 Compose 配置迁移扩展到 Kubernetes（K8s）容器编排平台之上。

更重要的是，将你在这里学到的全栈架构思维与工程规范，应用到解决你自己身边的实际问题中去。书店系统是一个载体，真正的目标是培养你对前后端边界划分、分布式系统设计、数据流向、安全防御、系统可观测性、容器化部署，以及生成式 AI 研发协同的全局驾驭能力。

感谢你陪伴我们一路同行，直至翻阅到全书的最后一页。软件工程是一场永无止境的探索之旅，读完本书绝非终点，而是你构建更庞大系统、更深层次审视架构决策、更勇于探索全新可能性的坚实起点。

无论你的下一个项目是什么，保持好奇、保持质疑、在代码与架构中持续精进！祝你在未来的全栈与架构征途中大放异彩！
