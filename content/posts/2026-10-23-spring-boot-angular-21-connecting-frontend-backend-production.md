---
title: Spring Boot & Angular 全栈实战（二十一）：端到端联调、网络代理与生产级编排
date: 2026-10-23T00:21:00Z
description: 汇聚全栈成果，利用 Docker Compose 统筹编排 PostgreSQL、MongoDB、Keycloak、Eureka、网关、业务微服务与 Angular 前端，实现生产级一键交付。
category: fullstack
column: spring-boot-angular
tags:
  - 全栈实战
  - Docker Compose
  - 生产交付
  - 端到端联调
  - 微服务架构
---

> 💡 **专栏导读**：本文收录于专栏 [《Spring Boot 4 & Angular 22 全栈微服务实战》](/columns/spring-boot-angular)。全专栏共 22 篇，深度覆盖 Java 26 微服务拆分、Spring Cloud 网关与安全鉴权、Angular 22 Signals 状态治理以及端到端容器化交付的全链路工程实践。

在上一章中，我们完成了 Angular 前端的生产级打包，在 SSR 服务中内嵌了 API 代理中间件，并通过多阶段构建打造了干净自包含的 Node.js 镜像。然而在独立验证时，由于缺乏后端支持，SSR 页面渲染出的图书列表依然是空的。

现在，到了将全栈成果融会贯通、完成终局拼图的时刻。本章我们将以 **Nginx** 作为边缘入口层，利用 **Docker Compose** 统筹编排整个书店系统：囊括 PostgreSQL、MongoDB、Keycloak、Zipkin、Eureka 注册中心、业务微服务、Spring Cloud Gateway，以及最新构建的 Angular SSR 前端。

通过声明式的系统编排，全栈系统将能够通过一条简单的 `docker compose up -d` 命令完成一键拉起，并通过唯一的 80 端口对外提供服务。无论是服务端渲染 HTML、预渲染静态页面、客户端路由，还是上一章构建的 SSE 实时推送流，都将在统一的生产网络拓扑中顺畅流通。

---

## 1. 全栈生产架构与双层代理拓扑

在编写具体编排配置之前，我们必须首先理清全栈运行态的通信拓扑。在整套系统中，存在两层职责截然不同的网络代理：

![](/media/posts/spring-boot-angular/img-09140.png)
*图 21.1：以 Nginx 作为边缘入口的全栈生产架构拓扑*

### 双层代理的设计分工
1. **Nginx 边缘代理（Edge Proxy）**：
   - 作为整个平台的**唯一对外暴露入口**，统一监听 80 端口（生产环境下升级为 443 端口并终结 TLS 证书）；
   - 负责承接浏览器的全部外部流量：将页面导航与静态资源请求转给 Angular SSR 容器；将以 `/packt/*` 开头的客户端 API 调用（包含 `HttpClient` 与 `EventSource` 长连接）透明转发给 Spring Cloud Gateway。
2. **Express 内部代理（Internal SSR Proxy）**：
   - 驻留在 Angular 前端容器内部，负责处理 SSR 渲染期间由 Node 进程发起的 API 数据抓取；
   - 在服务端渲染 `/books` 路由时，`BookService` 发起的 `/packt/inventory/api/books` 请求在容器内被 Express 拦截，并直接跨 Docker 内部网络穿透到 `http://gateway-server:8080`。

### 为什么必须采用双层代理？
- **环境配置的一致性**：在前端代码中，我们的生产 API 地址配置为相对路径 `apiUrl: '/packt'`。得益于双层代理，无论请求是从浏览器客户端发出，还是由服务端的 Node 进程发出，都不需要针对 SSR 和 CSR 编写任何差异化分支代码；
- **彻底消除 CORS 跨域问题**：浏览器访问前端页面的域名是 `http://localhost`，向网关发起的请求也是同源的 `http://localhost/packt/...`。两者源完全相同，因此浏览器永远不会产生复杂的 CORS Preflight 预检请求；
- **网络隔离与安全防护**：除了 Nginx 暴露 80 端口外，内部的 Angular 容器、微服务集群和数据库完全不对外暴露宿主机端口，构筑了严密的内网防护纵深。

---

## 2. 编写 Nginx 边缘代理与长连接配置

我们首先为 Nginx 编写反向代理配置。在 `containerization/nginx` 目录下新建 `nginx.conf`：

```nginx
upstream angular {
    server ng-bookstore:4000;
}

upstream gateway {
    server gateway-server:8080;
}

server {
    listen 80;

    # 1. 客户端 API 请求及 SSE 实时推送 -> 转发至 Spring Cloud Gateway
    location /packt/ {
        proxy_pass         http://gateway;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;

        # SSE (Server-Sent Events) 流式传输核心配置
        proxy_buffering           off;
        proxy_cache               off;
        proxy_set_header          Connection '';
        proxy_http_version        1.1;
        chunked_transfer_encoding off;
        proxy_read_timeout        3600s;
    }

    # 2. 页面路由与静态资源 -> 转发至 Angular SSR 容器
    location / {
        proxy_pass         http://angular;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

### 关键配置项剖析

#### 1. Docker DNS 与 Upstream 服务名解析
在 `upstream` 块中，我们直接使用 Docker Compose 定义的服务名：`ng-bookstore:4000` 与 `gateway-server:8080`。在 Docker 内部的 Bridge 网络中，内嵌 DNS 服务器会自动将这些别名解析为容器的实际内网 IP。

#### 2. SSE（Server-Sent Events）专项优化指令
普通 HTTP 请求倾向于开启缓冲区以提高传输效率，但对于 SSE 这种单向持久长连接而言，默认配置会导致流式推送完全瘫痪。为此必须显式调整：
- `proxy_buffering off`：**至关重要的指令**。关闭 Nginx 的响应缓冲区，使网关发送的每一条 SSE 事件能够即时、无延迟地透传给浏览器的 `EventSource`；
- `proxy_cache off`：禁用响应缓存，防止长连接数据被缓存拦截；
- `Connection ''` 与 `proxy_http_version 1.1`：清空 Hop-by-hop 的连接标头并启用 HTTP/1.1，维持与后端网关的长连接池；
- `chunked_transfer_encoding off`：关闭分块传输重组，直通流式字节；
- `proxy_read_timeout 3600s`：将读取超时拉长至 1 小时，防止在没有图书事件产生的空闲期间 Nginx 误判后端超时而强行切断连接。

---

## 3. 封装 Nginx 边缘容器镜像

在 `containerization/nginx` 目录下编写 `Dockerfile`：

```dockerfile
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

基于极简的 `nginx:alpine`，仅需覆盖默认站点配置即可完成封装。在 `containerization` 目录下执行构建与打标推送：

```bash
docker build -t bookstore/nginx:v0.0.1 ./nginx

# 打标并推送至镜像仓库
docker tag bookstore/nginx:v0.0.1 <dockerhub-username>/nginx:v0.0.1
docker tag bookstore/nginx:v0.0.1 <dockerhub-username>/nginx:latest
docker push <dockerhub-username>/nginx:v0.0.1
docker push <dockerhub-username>/nginx:latest
```

---

## 4. 全栈编排设计：整合基础设施、微服务与前端

现在，我们将前端和 Nginx 正式融入我们在后端构建的 `docker-compose.yml` 中。整套系统在 Docker Compose 的四大核心维度（服务、网络、存储卷、就绪依赖）下完成系统化组装。

### 生产级依赖条件强化：`service_healthy`

在微服务拓扑中，容器启动（`service_started`）绝不等于服务已就绪（`service_healthy`）。
例如，Keycloak 在首次启动时需要初始化数据库表结构并导入 Realm 配置，耗时通常达 60~90 秒。如果网关仅依赖 Keycloak 容器启动就匆忙初始化，网关在抓取 Keycloak 的 JWKS 公钥端点时就会失败崩溃，从而引发整条链路上游容器的级联启动失败。

因此，我们必须将 `user-service` 和 `gateway-server` 对 Keycloak 的依赖提升为严格的健康检查模式：

```yaml
# user-service 与 gateway-server 关键依赖升级
depends_on:
  keycloak:
    condition: service_healthy
```

### 纳入 Angular SSR 服务

在 `gateway-server` 之后追加 Angular 前端服务：

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

- **环境变量注入**：将 `API_URL` 明确赋予网关的内部服务地址 `http://gateway-server:8080`，使得前端 Node 进程在 SSR 渲染图书列表时能准确找到网关；
- **健康检查探针**：利用 `wget --spider` 探活 Node SSR 服务的可用性；
- **严禁端口映射**：未声明 `ports: 4000:4000`，彻底隔绝外部直接探访前端容器的可能性。

### 纳入 Nginx 边缘网关

紧随前端之后，声明边缘入口服务：

```yaml
  # Nginx 反向代理边缘入口
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

Nginx 是全栈中**唯一定义对外端口映射**的容器（`80:80`）。它严格依赖 `ng-bookstore` 与 `gateway-server` 两大上游均通过健康检查后才启动接收流量。

> [!NOTE] 启动依赖的架构考量
> Nginx 在启动加载配置时，如果 upstream 中的主机域名（如 `ng-bookstore`）在 Docker DNS 中无法解析，会导致 Nginx 进程直接报错退出。通过 `depends_on: service_healthy` 可以保证上游服务就绪后 Nginx 稳妥启动。在超大型生产集群中，亦可通过配置 Nginx 内置变量配合 `resolver 127.0.0.11` 动态解析，并兜底返回自定义 502/503 维护页。

---

## 5. 跨代理层的端到端认证与通信契约

随着 Nginx 与 Express 代理双双就绪，系统内部的请求流动与安全鉴权呈现出清晰的闭环：

### 1. 客户端带权请求链路
在前端中，我们在第十六章编写了基于 Signals 的响应式 `authInterceptor`。用户在浏览器登录后，Token 存储在前端状态中，后续所有向 `/packt/...` 发起的请求均携带：
```http
Authorization: Bearer <jwt-token>
```
Nginx 接收到请求后，会无损透明地透传全部 Header（包括 `Authorization`、Cookie 等）至 Spring Cloud Gateway。网关截获请求，根据 Keycloak 颁发的公钥验签合法性，并将解析出的用户主体信息向下游库存与用户微服务传递。

### 2. SSR 抓取与无会话设计
在服务端渲染期间，Node 渲染引擎抓取的是公开目录（如 `/packt/inventory/api/books`）。网关将公共目录配置为允许匿名放行（Permit All），因此 SSR 渲染过程无需任何 Mock Token，既简单又安全。涉及用户个人信息等鉴权敏感页面（如 `/auth/signin`、用户详情等），在路由设计中已被配置为 CSR 模式，仅在浏览器端挂载后才发起抓取，杜绝了 SSR 状态下的权限泄露。

---

## 6. 全平台一键拉起与全链路实战验收

在 `containerization` 目录下，我们通过 Docker Compose 启动整套系统：

```bash
# 1. 确保拉取最新镜像
docker compose pull

# 2. 一键在后台启动整个技术栈
docker compose up -d

# 3. 实时观测所有容器状态与健康度
docker compose ps
```

控制台将输出所有 10 个容器的运行态：`bookstore-postgres`、`mongodb`、`zipkin`、`keycloak`、`eureka-server`、`inventory-service`、`user-service`、`gateway-server`、`bookstore-ng-frontend` 以及 `bookstore-nginx`。在首次冷启动时，Keycloak 与各服务就绪需要约 2~3 分钟时间，等待所有容器状态均标记为 `healthy`。

随后，我们按照以下六大维度进行端到端全链路验收：

### 维度 1：图书目录 SSR 渲染实测
直接通过 Nginx 的 80 端口请求书籍页面，观察返回的 HTML 源码：

```bash
curl http://localhost/books
```

控制台输出的原始 HTML 结构中，赫然呈现了完整的 `<table>` 骨架及从 PostgreSQL 中动态查询出的真实书名与作者！
**链路追踪**：`客户端 curl` → `Nginx (80)` → `ng-bookstore (4000)` → `Express 代理` → `gateway-server (8080)` → `inventory-service` → `PostgreSQL`，完整走通了 7 级跨容器通信。

### 维度 2：预渲染静态页直出验证
请求隐私协议页面：

```bash
curl http://localhost/privacy
```

内容秒级直出，完全由 Angular 构建期预渲染生成，无需触发后端网关调用。

### 维度 3：客户端鉴权路由
浏览器访问 `http://localhost/auth/signin`，页面以纯客户端渲染（CSR）方式秒级挂载表单界面。

### 维度 4：注册、登录与个人主页端到端流转
在浏览器注册新账户并登录，系统跳转到用户主页并展示当前用户名：
- 注册/登录链路：`浏览器` → `Nginx` → `Gateway` → `User Service` → `Keycloak` & `MongoDB`；
- 个人主页链路：携带 JWT Token 向网关发起受保护资源的抓取，验证鉴权链通畅无阻。

### 维度 5：图书 CRUD 增删改
在书籍管理弹窗中新增一本图书。提交后，书籍列表即时刷新并展示新增书籍，验证了前端通过 Nginx 向上游网关提交写操作并持久化落库的能力。

### 维度 6：跨标签页 SSE 实时推送与响应式刷新
1. 在浏览器中同时开启两个并排标签页，均打开图书目录 `http://localhost/books`；
2. 在标签页 A 中点击新增一本书籍；
3. **观察标签页 B**：无需手动刷新页面，界面下方立即弹出全局 Snackbar 消息提示，且书籍列表的数据信号（Signal）被自动激活更新！
这充分证实了 SSE 穿透 Nginx（`proxy_buffering off`）、跨网关中继直至浏览器 `EventSource` 的流式管道坚如磐石。

### 端口暴露安全复核
- `http://localhost:80`：正常响应，Nginx 承担统一门户；
- `http://localhost:4000`：外部访问被彻底拒绝（`Connection refused`），验证了前端 SSR 容器处于安全的内网封闭状态。

---

## 7. 生产部署避坑指南与微服务常见暗礁

在整合并交付分布式全栈系统的过程中，我们沉淀了一批具有普遍工程参考价值的实战经验：

### 1. Express 挂载前缀剥离暗坑
Express 的 `app.use('/packt', proxy)` 在转发前会静默裁减 `/packt` 前缀。这一问题在本地独立开发时极难察觉，但在容器化网关鉴权体系下会导致所有路由全部报 404。必须使用 `pathRewrite: (path) => '/packt' + path` 进行显式还原。

### 2. 严防 `service_started` 假就绪陷阱
在 Compose 编排中，简单声明 `depends_on: [keycloak]` 只代表 Keycloak 容器进程已被创建，其内部 JVM 与数据库迁移可能远未完成。所有下游强依赖服务必须强制使用 `condition: service_healthy`，并配以科学的健康探针配置（如给予 Keycloak 120 秒的 `start_period`）。

### 3. 反向代理的 Host Header 与 SSR 安全限制
现代化前端框架的 SSR 引擎（如 Angular 的 `AngularNodeAppEngine`）默认包含防御 SSRF 的安全机制。在 Nginx 转发中设置 `proxy_set_header Host $host;` 时，必须确保前端在初始化引擎时将 `localhost` 与 `127.0.0.1` 显式列入 `allowedHosts` 白名单。

### 4. Nginx 缓冲区对流式协议的毁灭性破坏
Nginx 默认启用的 `proxy_buffering on` 是 SSE、WebSocket 等长连接协议的“隐形杀手”。它会将零散到达的流事件滞留在内存缓冲区，直到缓冲区填满或连接断开才一次性喷涌，导致客户端实时监控彻底失效。务必在流式路由块中明确关闭缓冲与缓存。

### 常用运维排障指令速查

```bash
# 查看所有微服务运行与健康状态
docker compose ps

# 跟踪查看网关与前端容器的实时日志
docker compose logs -f --tail=200 gateway-server ng-bookstore

# 重启单个异常的微服务
docker compose restart gateway-server

# 清理并强制移除孤儿容器与挂起状态容器
docker compose down
docker rm -f $(docker ps -a --filter "name=bookstore-" -q)

# 彻底重置所有数据库数据卷（慎用）
docker compose down -v
docker compose up -d
```

---

## 8. 全书总结与全栈工程思维升华

从第一章的空项目骨架起步，到如今拥有完整微服务集群与现代化响应式前端的企业级全栈平台，我们共同跨越了一条坚实的工程技术进阶之路：

```mermaid
flowchart TD
    Client["Browser (Port 80)"] -->|HTTP / SSE| Nginx["Nginx Edge Proxy"]
    Nginx -->|/ (HTML / JS / CSS)| Frontend["Angular SSR (Node.js)"]
    Nginx -->|/packt/* (API / SSE)| Gateway["Spring Cloud Gateway"]
    Frontend -.->|Internal SSR API Fetch| Gateway
    Gateway --> Eureka["Eureka Discovery"]
    Gateway --> Keycloak["Keycloak (OIDC/JWT)"]
    Gateway --> Inventory["Inventory Microservice"]
    Gateway --> User["User Microservice"]
    Inventory --> Postgres[("PostgreSQL")]
    User --> Mongo[("MongoDB")]
    Inventory -.->|Tracing| Zipkin["Zipkin APM"]
    User -.->|Tracing| Zipkin
```

1. **后端技术跃迁**：基于 **Java 26** 与 **Spring Boot 4** 体系，拆分领域业务为高内聚、松耦合的独立微服务；利用 Spring Data JPA 与 MongoDB 实现多数据源治理；接入 Eureka 实现动态服务发现，利用 Spring Cloud Gateway 打造统一的流量哨卡，并基于 Keycloak 深度构建了 OAuth 2.0 / OpenID Connect 的无状态 JWT 安全体系。
2. **前端范式演进**：告别陈旧复杂的 NgModule，拥抱 **Angular 22** 的 Standalone 单组件架构与 **Signals** 细粒度响应式状态治理；在保持 CSR 丰富交互的同时，融合服务端渲染（SSR）与静态路由预渲染（Prerendering），并通过 SSE 机制将单向事件推送丝滑注入前端响应式流中。
3. **交付体系落地**：打破了前端与后端各自为战的割裂状态，以 Docker 容器化技术为纽带，以多阶段构建为抓手，以 Nginx 为边缘哨兵，以 Docker Compose 为编排蓝图，实现了全栈系统的端到端自治交付。

软件工程是一场永无止境的探索与实践。这套基于现代化规范与云原生理念构建的全栈书店系统，不仅是一个功能完备的项目，更是一套经得起工业级推敲的全栈工程方法论。愿你在未来的系统架构与研发征途上，持续探究本质、挑战复杂，构筑出更加优雅、坚固的数字化基石！
