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

# 原著完整参考：端到端联调、网络代理与生产级编排

在分布式全栈工程体系中，系统的最终价值必须建立在各组件紧密协同、稳定运转的交付物之上。

本文以 Nginx 作为边缘入口层，利用 Docker Compose 统筹编排 PostgreSQL、MongoDB、Keycloak、Zipkin、Eureka 注册中心、Spring Cloud Gateway、Spring Boot 业务微服务集群以及 Angular SSR 前端容器，完成生产级全栈一键拉起与六大维度端到端实测验证。

:::en
> **Original**: Production orchestration unifies multi-service microarchitectures behind a reverse-proxy ingress, orchestrating lifecycle health checks to guarantee deterministic delivery.

**📌 核心术语与语境解析**：
- **Reverse-Proxy Ingress** [rɪˈvɜːrs ˈprɑːksi ˈɪnɡres]：*反向代理入口*。作为整个分布式网络最外侧边界接收全部入站网络流量的统一路由前哨。
- **Deterministic Delivery** [dɪˌtɜːrmɪˈnɪstɪk dɪˈlɪvəri]：*确定性交付*。依靠容器化与标准化编排蓝图，消除环境差异导致部署结果产生偏差的工程交付准则。
:::

## 1. 全栈生产架构与双层代理拓扑分工

在现代全栈系统中，存在两层职责截然分立的网络代理：
1. **Nginx 边缘代理（Edge Proxy）**：
   - 作为整个平台的**唯一对外暴露入口**，统一监听 80 端口（生产环境下升级为 443 端口并终结 TLS 证书）；
   - 负责承接全部外部公网流量：将页面导航与静态资源请求转给 Angular SSR 容器；将以 `/packt/*` 开头的 API 调用（包含 `HttpClient` 与 `EventSource` 长连接）透明转发给 Spring Cloud Gateway。
2. **Express 内部代理（Internal SSR Proxy）**：
   - 驻留在 Angular 前端容器内部，负责处理 SSR 渲染期间由 Node 进程发起的本地数据抓取；
   - 在服务端渲染 `/books` 路由时，`BookService` 发起的 `/packt/inventory/api/books` 请求在容器内被 Express 拦截，跨 Docker 内部网络直接穿透到 `http://gateway-server:8080`。

双层代理的工程价值：
- **消除跨域（CORS）**：浏览器与服务接口完全处于同源上下文；
- **配置一致性**：前端无需区分环境或分支，全量统一使用相对前缀 `/packt`；
- **纵深防御**：内部微服务集群无需对外暴露端口，杜绝攻击暴露面。

:::en
> **Original**: A two-tiered proxy pattern cleanly separates external client traffic ingress from internal server-side data re-fetching, eliminating CORS overhead across environments.

**📌 核心术语与语境解析**：
- **Two-tiered Proxy** [tuː tɪərd ˈprɑːksi]：*双层反向代理*。边缘网关与应用容器内部代理协同工作的分层网络转发架构。
- **Origin Uniformity** [ˈɔːrɪdʒɪn ˌjuːnɪˈfɔːrməti]：*源同质性/同源一致*。客户端页面与数据 API 运行于同一协议、主机与端口下，完全免除浏览器同源策略限制的特征。
:::

## 2. 编写 Nginx 边缘代理与 SSE 长连接优化配置

在 `containerization/nginx/nginx.conf` 中配置转发规则与 SSE 优化项：

```nginx
upstream angular {
    server ng-bookstore:4000;
}

upstream gateway {
    server gateway-server:8080;
}

server {
    listen 80;

    location /packt/ {
        proxy_pass         http://gateway;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;

        # SSE (Server-Sent Events) 专项优化指令
        proxy_buffering           off;
        proxy_cache               off;
        proxy_set_header          Connection '';
        proxy_http_version        1.1;
        chunked_transfer_encoding off;
        proxy_read_timeout        3600s;
    }

    location / {
        proxy_pass         http://angular;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

核心指令剖析：
- `proxy_buffering off`：关闭 Nginx 响应缓冲区，确保每一条推送事件实时穿透至浏览器；
- `proxy_cache off`：禁用响应缓存，防止长连接数据被拦截；
- `proxy_read_timeout 3600s`：长连接超时拉长至 1 小时，防止心跳空闲期误断连接。

:::en
> **Original**: Disabling proxy buffering and chunked transfer encoding allows Nginx to stream Server-Sent Events instantaneously to connected clients without buffering stalls.

**📌 核心术语与语境解析**：
- **Proxy Buffering** [ˈprɑːksi ˈbʌfərɪŋ]：*代理响应缓冲*。反向代理在收到上游响应时先暂存于内部内存或临时文件，聚合成大块后再传输给客户端的优化策略。
- **Buffering Stall** [ˈbʌfərɪŋ stɔːl]：*缓冲停滞/挂起*。流式响应因未填满中间代理缓冲区而导致客户端长时间收不到数据的卡顿现象。
:::

## 3. 生产级依赖条件强化：service_healthy 探针治理

在微服务拓扑中，容器启动（`service_started`）绝不等于服务已就绪（`service_healthy`）。

Keycloak 在首次启动时需要初始化数据库表并导入 Realm 配置，耗时通常达 60~90 秒。如果 Spring Cloud Gateway 仅依赖 Keycloak 容器启动就匆忙初始化，抓取 Keycloak 的 JWKS 公钥端点失败将导致网关崩溃，引发整条链路容器雪崩。

因此，微服务与网关对依赖组件必须使用 `condition: service_healthy` 严格探活：

```yaml
depends_on:
  keycloak:
    condition: service_healthy
```

:::en
> **Original**: Declarative `service_healthy` conditions enforce deterministic start orders, preventing boot race conditions when dependencies require protracted initialization phases.

**📌 核心术语与语境解析**：
- **Boot Race Condition** [buːt reɪs kənˈdɪʃn]：*启动时序竞态*。上游服务过早启动连接尚未完全就绪的下游依赖而引发的级联初始化失败。
- **Health Check Probe** [helθ tʃek proʊb]：*健康检查探针*。周期性对服务进程或 HTTP 端点发起心跳探测以评估其实际可用性的诊断机制。
:::

## 4. 纳入 Angular SSR 服务与内网隔离设计

在 Docker Compose 编排中追加 Angular 前端服务：
- **环境变量注入**：`API_URL: "http://gateway-server:8080"`，使 Node 进程在 SSR 渲染时精准定位网关服务名；
- **探针集成**：使用 `wget --spider http://localhost:4000` 执行就绪探活；
- **端口安全封闭**：不声明任何外部 `ports` 端口映射，前端容器仅能被 Nginx 通过 Docker 桥接网络访问，彻底消除非法探针暴露面。

:::en
> **Original**: Internalizing frontend container network bindings isolates application processes within private Docker networks, exposing access exclusively through hardened ingress nodes.

**📌 核心术语与语境解析**：
- **Network Isolation** [ˈnetwɜːrk ˌaɪsəˈleɪʃn]：*网络隔离*。通过虚拟化网段与访问控制将核心业务容器封闭在私有网络层级之中的安全实践。
- **Hardened Ingress** [ˈhɑːrdnd ˈɪnɡres]：*安全加固入口*。经过配置审查、白名单限制与漏洞收敛的单点入站网关。
:::

## 5. 跨代理层的端到端认证流转与契约闭环

1. **客户端鉴权链路**：
   用户在前端登录后获取 JWT，后续发起的 `/packt/...` 请求自动挂载 `Authorization: Bearer <token>`。Nginx 原样透明透传该头至 Spring Cloud Gateway；网关校验公钥有效性后向下游服务注入用户主体头信息。
2. **SSR 服务端数据抓取**：
   Node.js 渲染引擎抓取的是公开目录（`/packt/inventory/api/books`）。网关将公共目录配置为匿名放行，SSR 执行期间无需携带任何 Mock Token，消除了凭据泄漏与环境复杂性。

:::en
> **Original**: The authentication contract guarantees seamless token forwarding across proxies, while server-side pre-fetching consumes public endpoints anonymously by architectural design.

**📌 核心术语与语境解析**：
- **Token Forwarding** [ˈtoʊkən ˈfɔːrwərdɪŋ]：*令牌中继传递*。代理层在跨网段转发请求时原样无损传递身份凭证与上下文报头的过程。
- **Anonymous Pre-fetching** [əˈnɑːnɪməs ˌpriːˈfetʃɪŋ]：*匿名预取*。服务端在渲染公共页面时不依赖特定用户身份信息直接拉取通用公开数据的无状态机制。
:::

## 6. 全平台一键拉起与六大维度端到端实测

通过一条声明式指令拉起全栈：

```bash
docker compose up -d
```

等待 10 个容器全部转为 `healthy` 状态后，按照六大维度全面验收：
1. **图书目录 SSR 渲染实测**：`curl http://localhost/books` 返回包含真实数据库记录的完整 HTML 表格骨架，贯通 7 级跨容器链路；
2. **预渲染静态页直出验证**：`curl http://localhost/privacy` 秒级直出构建期静态 HTML；
3. **客户端鉴权路由**：访问 `/auth/signin`，CSR 模式瞬时挂载表单界面；
4. **注册登录与个人中心流转**：端到端连通 Keycloak、MongoDB、网关与前端状态；
5. **图书 CRUD 增删改**：前端模态框提交新书，自动持久化至 PostgreSQL 并触发视图信号更新；
6. **跨标签页 SSE 实时推送**：多标签页联动，A 窗口提交新书，B 窗口实时收到 Toast 提示并局部刷新表格；
7. **端口隔离复核**：`80` 端口畅通，`4000` 端口外部访问被物理拦截拒绝。

:::en
> **Original**: End-to-end verification validates the entire distributed architecture across server rendering, transactional mutations, and asynchronous SSE streaming in a unified topological harness.

**📌 核心术语与语境解析**：
- **Topological Harness** [ˌtɑːpəˈlɑːdʒɪkl ˈhɑːrnɪs]：*拓扑测试环境/验收框架*。在贴合真实生产网络结构与多节点依赖关系的体系中执行的综合验收环境。
- **Transactional Mutation** [trænˈzækʃənl mjuːˈteɪʃn]：*事务性变更*。具备 ACID 事务完整性保证的数据创建、更新与删除操作。
:::

## 7. 全书总结与全栈工程思维升华

从第一章起步至终局编排，全栈架构实现了三大层面的工业级跃迁：
1. **服务端架构**：基于 **Java 26** 与 **Spring Boot 4** 构建高内聚微服务集群，依托 Eureka 动态发现、Spring Cloud Gateway 统一路由、Keycloak 无状态鉴权以及 WebFlux SSE 实时通知；
2. **客户端架构**：基于 **Angular 22** Standalone 架构与 **Signals** 细粒度响应系统，融合 SSR 服务端渲染、SSG 预渲染与增量水合优化；
3. **交付体系**：打破前后端壁垒，以 **Docker Compose** 为编排蓝图、**Nginx** 为边缘哨卡，实现高内聚、易运维、全链路自治的一键交付体系。

:::en
> **Original**: True full-stack mastery harmonizes domain-driven microservice boundaries with fine-grained reactive clients, bound together by cloud-native container orchestration.

**📌 核心术语与语境解析**：
- **Full-stack Mastery** [fʊl stæk ˈmæstəri]：*全栈工程精通*。贯通系统底层并发模型、分布式微服务网络、前端响应式视图与云原生交付管线的全局架构能力。
- **Cloud-native Orchestration** [klaʊd ˈneɪtɪv ˌɔːrkɪˈstreɪʃn]：*云原生编排*。基于容器化、声明式配置与微服务解耦理念实现应用自治部署与自愈维护的管理体系。
:::
