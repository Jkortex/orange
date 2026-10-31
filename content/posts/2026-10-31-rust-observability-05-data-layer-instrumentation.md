---
title: "Rust 分布式可观测性实战（五）：数据访问层与存储引擎深度插桩"
date: 2026-10-31T02:05:00Z
description: "对 PostgreSQL、Redis 与消息队列进行语义化插桩，透明捕获连接池排队延迟、慢查询与死锁等待。"
category: rust
column: rust-observability
tags: [PostgreSQL, Redis, 连接池, 数据库插桩, 慢查询]
---

# 第 5 章：数据访问层与存储引擎深度插桩

## 引言：追踪进入 SQL 执行的世界（第 3 跳）

在第 4 章中，我们对系统外层的 HTTP 边界进行了深度插桩——这是请求在分布式系统中穿行的前两跳。然而，当我们审视第一条端到端结账追踪时，却遭遇了熟悉的困境：`orders: POST /orders` 这个 Span 耗费了 800ms，但在它之下的所有细节依然漆黑一片。业务处理器本身依然是一个未知的黑盒：我们明知这个微服务处理缓慢，却根本不知道*它内部的哪段代码*在拖后腿。

本章将跟随请求继续向下探索，深入**第 3 跳：底层数据库 SQL 查询**。我们将对 SQLx 进行语义化插桩，生成一等公民的数据库 Span，精准揭示底层数据访问的真实面貌——执行了哪些 SQL、以何种顺序执行、以及每条查询到底耗费了多少微秒。读完本章后，OpenTel 电商系统中的每一次数据库操作都将化身为归属严密、挂载在其父级请求之下的标准 Span，完全契合 OpenTelemetry 官方的数据库语义约定。如果说第 4 章构建的是遥测骨架，那么本章注入的就是真正执行物理操作的肌肉与器官：真正承载业务落盘的数据库访问层。

**本章将涵盖以下核心主题：**

- 面向数据库 Span 的 OpenTelemetry 官方语义约定（Semantic Conventions）
- 设计稳定且低基数的数据库 Span Schema
- 深入理解 SQLx 框架与仓储层（Repository Pattern）设计模式
- 读查询深度插桩（单行点查、分页列表与 404 数据不存在场景）
- 写查询深度插桩（库存锁定扣减与订单批量持久化）
- 将数据库本地物理事务封装为一等公民的独立 Span
- 暴露连接池排队与饱和度可见性
- 在 Jaeger UI 中深度剖析数据库 Span

**本章明确不涵盖的内容**：本章专注于提供**透明的观测可见性**，而非具体的 SQL 性能调优。复杂的慢查询索引优化、死锁与行级锁排查、以及连接池容量规划，将特意留待第 11 章（数据库瓶颈专题）展开深入剖析。在此处，我们的核心使命是奠定足以支撑后续排障分析的高保真插桩基石。

## 面向数据库的 OpenTelemetry 语义约定

首先，我们需要遵循一套标准化的通用“词汇表”，即**语义约定（Semantic Conventions）**。它们实质上是为常见的系统属性（如数据库名称、主机网络地址等）赋予业界公认的统一命名。当所有微服务都遵循相同的命名时，Jaeger 等工具便能毫不费力地对所有跨语言、跨服务的遥测数据进行无缝聚合与多维检索。

### 为什么标准约定至关重要

如果没有统一的行业规范，不同开发团队很快就会陷入自创私有字段的混乱泥潭：
- 团队 A 自创：`query.duration` 与 `table_name`
- 团队 B 自创：`db.latency_ms` 与 `db.table`
- 团队 C 自创：`sql.time` 与 `collection`

缺乏标准，团队间各说各话，导致系统大盘根本无法跨服务拼装出全局视角的宏观图景。统一的语义约定确保了整个技术体系说同一种通用语言。

### 核心数据库属性速查

以下标准属性构成了构建高质量数据库 Span 的基石：

| 语义属性键名 | 数据类型 | 属性含义说明 | 典型取值示例 |
| --- | --- | --- | --- |
| `db.system.name` | 字符串 | 底层数据库管理系统引擎标识 | `postgresql` |
| `db.namespace` | 字符串 | 数据库名、Schema 逻辑空间或 Catalog 标识 | `products` |
| `db.operation.name` | 字符串 | 当前执行的核心 SQL 操作动词 | `SELECT`, `INSERT`, `UPDATE` |
| `db.collection.name` | 字符串 | 目标数据表名称或集合名称 | `products`, `inventory` |
| `db.query.text` | 字符串 | 参数化脱敏后的完整 SQL 查询模板 | `SELECT * FROM products WHERE uuid = $1` |
| `server.address` | 字符串 | 目标数据库服务器主机名或服务名 | `postgres`, `localhost` |
| `server.port` | 整数 | 数据库监听的网络物理端口 | `5432` |

*表 5.1 – 面向数据库 Span 的 OpenTelemetry 官方核心语义属性*

> **提示**
>
> 坚决避免在代码中到处手写类似 `"db.system.name"` 的字符串硬编码！请始终依赖 `opentelemetry-semantic-conventions` 官方 crate。这不仅能通过编译器防止拼写笔误，更能保证你使用的常量始终与国际工业界规范保持绝对一致。

除非另有显式说明，本章使用的所有属性均来自 OpenTelemetry 官方发布的稳定版语义规范。你可以放心依赖它们，无需担心在未来 SDK 升级时发生破坏性变动。

### 属性遵从级别规范

并非每一个 Span 都必须盲目塞入全部属性。OpenTelemetry 官方将字段约束划分为了不同的合规级别：
- **强制必须（Required）**：任何场景下均必须包含。
- **条件具备（Conditionally Required）**：当满足特定先决条件时必须提供。
- **官方推荐（Recommended）**：只要运行时能够提取，就强烈建议带上。
- **显式启用（Opt-In）**：出于数据隐私或安全性考量，仅在开发者显式配置开启时才记录。

对于关系型 SQL 数据库，官方规范的核心建议如下：
- `db.system.name`：**强制必须**（在我们的技术栈中固定为 `"postgresql"`）。
- `db.namespace`：只要能够获取就**强烈建议附带**（即各服务对应的 Schema 名称）。
- `db.operation.name`：**官方推荐**，用单个动词精准刻画当前操作。
- `db.collection.name`：**官方推荐**，指明当前查询聚焦的目标数据表。
- `db.query.text`：**官方推荐**，但**必须经过严格参数化脱敏**！

### 核心铁律：严格遵守低基数原则

贯穿语义规范的核心原则是**低基数（Low Cardinality）**。Span 的名称与通用属性的取值中，绝对不能夹杂高频变动的任意动态数据（如动态生成的 UUID、纳秒级时间戳或用户输入的明文字符串），以此防止监控后端因时序维度无限爆炸而崩溃。

- **❌ 严重错误（高基数灾难）**：
  ```
  span_name: "SELECT * FROM products WHERE uuid = 'a7f3c5d2-1234-5678-9abc-def012345678'"
  ```
- **✅ 官方正解（高低维度分明）**：
  ```
  span_name: "SELECT products"
  attribute db.query.text: "SELECT * FROM products WHERE uuid = $1"
  ```

Span 的名称负责将同质化的操作聚拢在一起，以便在大盘中进行宏观统计与性能百分位数聚合；而具体单次调用的细枝末节则通过属性字段进行精准记录。这种动静分离对于按名称聚合链路的监控后端至关重要。

### SQL 文本的安全脱敏原则

`db.query.text` 属性需要格外引起安全重视。你可能会担忧在追踪中捕获 SQL 会意外泄漏用户密码或身份证号等敏感隐私数据。幸运的是，`SQLx` 原生基于**参数化查询（Parameterized Queries）**机制，它在底层物理通信协议上就将 SQL 语法骨架与具体字面量数据彻底分离开来。

参数化查询从物理层面阻止了敏感数据流入分布式追踪系统。我们捕获的并非原始的拼装 SQL：

```sql
SELECT * FROM users WHERE email = 'customer@example.com' AND password_hash = 'abc123...'
```

追踪链路中记录的仅仅是完全脱敏的安全参数模板：

```sql
SELECT * FROM users WHERE email = $1 AND password_hash = $2
```

在使用 SQLx 的参数化查询时，你的 SQL 语句模板天然就是安全的。分布式追踪只捕获查询骨架结构（如 `WHERE email = $1`），而具体的敏感字面量参数由数据库驱动直接走专属二进制管道传输。这既赋予了你对系统“内部正在发生什么操作”的全景可见性，又从源头上彻底根绝了个人隐私信息（PII）泄露的合规风险。

## 设计稳定且低基数的数据库 Span Schema

在前一节中，我们审视了官方的标准属性。在本节中，我们将为 OpenTel 电商系统定制一套**专属的遥测 Schema 规范**：将通用的工业级约定与系统专属的业务领域属性（统一以 `otelmart.*` 为前缀）有机熔炼在一起。

### Span 命名规范策略

Span 名称必须保持低基数，并精准表达操作的物理意图。我们统一推行如下命名范式：

```
{operation} {target}
```

其中 `{operation}` 为标准 SQL 动词，`{target}` 为目标数据表名称或物理实体名词。使用标准 SQL 动词（`SELECT`、`INSERT`、`UPDATE`）结合逻辑实体，而非随意的上层业务动作描述，能够确保即便上层业务逻辑频繁重构，底层的数据库观测指标依然固若金汤、高度稳定。

**标准命名示例：**

| 物理业务操作 | 统一规范的 Span 名称 |
| --- | --- |
| 根据主键拉取单个商品详情 | `SELECT products` |
| 带复杂过滤条件的分页商品列表 | `SELECT products` |
| 执行库存锁定预留操作 | `SELECT reserve_stock` |
| 创建订单主表记录 | `INSERT orders` |
| 批量持久化订单明细记录 | `INSERT order_items` |
| 结账本地长事务包裹 | `TRANSACTION checkout` |

*表 5.2 – 遵循 {operation} {target} 范式的数据库 Span 标准命名*

请特别注意：针对同一张数据表的不同查询（例如 `SELECT * FROM products` 与 `SELECT count(*) FROM products`）共享**完全相同**的 Span 名称：`SELECT products`。这使得我们能够在 Grafana 大盘中直接度量整个 `products` 数据表的综合吞吐量与 P99 延迟表现。若要区分具体的查询细节，可以下钻查看其属性字段（如 `db.query.text`）。

### 全系统数据库 Span 的通用标配属性

在 OpenTel 电商系统中，发往 PostgreSQL 的每一个数据库 Span 都必须携带以下基础属性：

```rust
fields(
    db.system.name = "postgresql",
    server.address = "postgres",  // Docker Compose 内部网络的服务名
    server.port = 5432,
)
```

在 Rust 工程实践中，这类属性通过两级体系注入：
1. **全局 Resource 属性**：刻画当前微服务自身的全局画像（在系统启动时一次性注入）。
2. **局部 Span 属性**：精准描述当前特定 SQL 执行的操作特征（在执行查询时动态附带）。

### 区分各微服务的命名空间属性

每个微服务依据其绑定的专属 Schema，为数据库 Span 补充上下文：

| 微服务名称 | `db.namespace` 映射取值 | 归属该微服务管辖的核心业务数据表 |
| --- | --- | --- |
| Products | `products` | `products`, `categories`, `ratings` |
| Inventory | `inventory` | `product_inventory`, `product_pricing` |
| Orders | `orders` | `orders`, `order_items`, `payments`, `shipping_addresses` |
| OtelMart | `users` | `users`, `user_sessions`, `user_addresses` |

*表 5.3 – 各微服务的数据库 Schema 命名空间与归属数据表*

### 领域级专属业务属性（Business Attributes）

除了底层标准的数据库参数外，我们使用前缀 `otelmart.*` 注入高价值的领域上下文：

| 自定义业务属性键名 | 核心业务用途 | 取值示例 |
| --- | --- | --- |
| `otelmart.product.uuid` | 将该数据库操作与特定商品实体紧密锚定 | `a7f3c5d2-...` |
| `otelmart.order.id` | 将数据库持久化操作绑定至特定业务订单号 | `ord_12345` |
| `otelmart.quantity` | 记录本次扣减或变更的业务数量级 | `5` |
| `otelmart.customer.email_hash` | 经伪匿名化（加盐 SHA256 哈希）后的客户标识 | `sha256:abc...` |

*表 5.4 – otelmart.* 命名空间下的业务上下文属性*

这些属性使得排障人员能够在不触犯隐私合规（PII）的前提下，直接根据具体的业务实体 ID 检索整条数据库调用链路。

### 显式禁止的危险反模式

- **严禁直接拼接包含字面量的原生 SQL**：任何未经参数化的动态拼接 SQL 绝不允许录入 Span。
- **严禁记录客户明文隐私（PII）**：绝对禁止在 Span 中记录未脱敏的客户真实邮箱、电话或物理地址。
- **严禁泄露内部物理自增 ID**：对外暴露和跨链路检索一律使用 UUID。
- **严禁在 Span 名称中使用高基数动态值**：Span 名称中绝不能包含 UUID 或时间戳。

## SQLx 插桩工程实践与仓储层模式

为了构建高保真的追踪链路，我们必须首先理清 `SQLx` 的底层机制，并明确为什么要在特定的架构分层上实施手动插桩。

### SQLx 在项目中的配置基线

在 `Cargo.toml` 中，我们对 SQLx 的依赖声明如下：

```toml
sqlx = { version = "0.8.6", features = [
    "runtime-tokio-rustls",
    "postgres",
    "chrono",
    "uuid",
    "json",
    "bigdecimal",
    "migrate"
]}
```

请留意我们特意**没有开启** `sqlx/tracing` 特性。因为 SQLx 内置的自动化 Tracing 往往过于嘈杂，默认直接将一整长串复杂的原始 SQL 语句粗暴地作为 Span 的名称，引发严重的高基数灾难，且完全缺乏与业务领域相关的上下文属性。

### 为什么选择在仓储层进行手动插桩

正如我们在第 4 章中对 HTTP 处理器实施精准插桩一样，我们在**仓储层（Repository Layer）**实施精细化插桩，背后有充分的架构考量：
1. **稳定低基数的命名掌控权**：不再是发散的原始 SQL 文本，而是生成形如 `SELECT products` 这样高度契合数据表维度的规整名称。
2. **注入丰满的领域业务上下文**：能够直接把数据库驱动层根本一无所知的业务字段（如 `otelmart.product.uuid`、`otelmart.cart.total`）无缝绑定在当前 Span 上。
3. **安全内建**：所有数据字段显式声明捕获，从编译期杜绝敏感信息被意外打印。
4. **编译期强校验**：`#[instrument]` 属性宏在编译期间对语法进行严密校验。
5. **高度契合 Rust 哲学**：显式优于隐式（Explicit over Implicit）。

### 仓储模式的分层拓扑

OpenTel 电商系统严格遵循经典的仓储分层架构：

```
HTTP 端点处理器（HTTP Layer）
    ↓
仓储层实现函数（包含核心业务逻辑与结构化 SQL）
    ↓
SQLx 异步执行引擎
    ↓
PostgreSQL 物理实例
```

*图 5.1 – 从 HTTP 处理器、仓储函数、SQLx 到底层 PostgreSQL 的分层调用链条*

我们选择在**仓储层函数**上进行插桩，是因为它精准承载了**真实的业务意图**。一个名为 `get_product_by_uuid` 的函数承载了明确的业务语义，而其内部的具体 SQL 语法仅仅是实现细节而已。

### 数据库底层包装器设计

每个微服务在底层均对连接池进行了轻量包装：

```rust
impl Database {
    pub async fn new(database_url: &str, max_connections: u32) -> Result<Self> {
        // 1. 配置物理连接参数
        let mut connect_opts = PgConnectOptions::from_str(database_url)?
            .disable_statement_logging(); // 禁用驱动默认日志，避免控制台冗余刷屏
        connect_opts = connect_opts.application_name("products-service"); // 设置应用名以利于 DBA 辨识

        // 2. 初始化连接池
        let pool = PgPoolOptions::new()
            .max_connections(max_connections)
            // 3. 配置每个物理连接建立后的初始化动作
            .after_connect(|conn, _meta| {
                Box::pin(async move {
                    sqlx::query("SET search_path TO products, public")
                        .execute(conn)
                        .await?;
                    Ok(())
                })
            })
            .connect_with(connect_opts)
            .await?;

        Ok(Self { pool })
    }
}
```

通过 `after_connect` 钩子动态执行 `SET search_path TO products, public`，保证了当前连接池在执行查询时默认只检索自己专属的 Schema。

## 将数据库 Span 无缝挂载至 HTTP 父 Span 之下

一条完整的端到端追踪，要求数据库底层操作能够严密嵌套在发起的 HTTP 请求之下。在第 4 章中，`OtelAxumLayer` 已经成功在 HTTP 边界创建了服务端 Span。现在，我们新增的数据库 Span 是如何自动挂载上去的？

### 单进程服务内部的自动化上下文延续

Rust 生态中的 `tracing` crate 会在异步任务（Task）内部全自动维护活跃 Span 上下文。正如在第 4 章中所阐述的，`#[instrument]` 宏会利用异步任务的 Task-Local 机制，在跨越任何 `.await` 挂起点时稳固维系上下文。

当你在一个带有插桩的 HTTP 处理器内部直接调用带有插桩的数据库仓储函数时，仓储层的 Span 会**自动将当前活跃的 HTTP Span 识别为自己的物理父节点**：

```rust
// 由 OtelAxumLayer 自动创建的外层 HTTP Server Span
pub async fn get_product_by_id(
    State(pool): State<PgPool>,
    Path(uuid): Path<Uuid>,
) -> impl IntoResponse {
    // 调用该仓储函数时，其内部创建的数据库 Span 会自动作为当前 HTTP Span 的【子节点】入栈！
    match db::get_product_by_uuid(&pool, uuid).await {
        Ok(Some(product)) => (StatusCode::OK, Json(product)).into_response(),
        Ok(None) => not_found_error("商品未找到", /* ... */),
        Err(e) => internal_error("获取商品详情失败", e.to_string()),
    }
}
```

不需要开发者在函数签名里到处手动传递任何 Context 对象，Rust 的异步任务调度机制在底层全自动完成了这一关联。

### 跨越物理网络的跨进程上下文传播

而对于跨越网络的微服务调用（例如 Orders 服务调用 Inventory 服务），追踪上下文依然依赖我们在第 4 章中构建的 HTTP `traceparent` 请求头在网络中接力传递。下游服务中执行的所有数据库操作，其 Span 会作为下游服务 HTTP Handler 的子节点，而该 Handler 又通过 `traceparent` 严密挂载在上游服务的 Client Span 之下。

![](/media/posts/rust-observability/img-06207.png)

*图 5.2 – 跨服务追踪上下文流转：追踪上下文跨越网络从订单服务注入库存服务，并严密维系数据库子 Span*

**核心逻辑归纳：在单体微服务内部，追踪上下文通过异步运行时的 Task 机制透明流转；跨越物理网络边界时，上下文通过 W3C HTTP 标准请求头无缝接力。**

## 读查询插桩实战

我们首先从最简单的只读查询入手，对商品微服务实施深度插桩。

### 单行主键点查（Single-Row Fetch）

```rust
// products/src/db/repository.rs

#[instrument(
    name = "SELECT products",
    skip(pool),
    fields(
        otel.kind = "client",
        db.system.name = "postgresql",
        db.namespace = "products",
        db.operation.name = "SELECT",
        db.collection.name = "products",
        db.query.text = "SELECT p.*, c.*, AVG(r.rating), COUNT(r.id) FROM products p LEFT JOIN ... WHERE p.uuid = $1",
        otelmart.product.uuid = %uuid
    )
)]
pub async fn get_product_by_uuid(
    pool: &PgPool,
    uuid: Uuid,
) -> Result<Option<ProductDetail>, sqlx::Error> {
    sqlx::query_as::<_, ProductDetail>(r#"..."#)
        .bind(uuid)
        .fetch_optional(pool)
        .await
}
```

**关键技术决策：**
- `name = "SELECT products"`：严格遵循低基数的 `{operation} {target}` 命名范式。
- `skip(pool)`：从日志和属性中屏蔽连接池对象本身，消除无效噪点。
- `otel.kind = "client"`：将数据库查询明确声明为出站客户端调用。
- `otelmart.product.uuid`：注入核心业务实体凭证。

### 复杂分页列表检索（List Queries）

对于需要支持多条件动态过滤与分页的查询：

```rust
// products/src/db/repository.rs

#[instrument(
    name = "SELECT products",
    skip(pool, params),
    fields(
        otel.kind = "client",
        db.system.name = "postgresql",
        db.namespace = "products",
        db.operation.name = "SELECT",
        db.collection.name = "products",
        db.query.text = "SELECT * FROM products WHERE ... ORDER BY ... LIMIT ... OFFSET ...",
        otelmart.page = page,
        otelmart.page_size = page_size,
        otelmart.category.id = ?params.category_id,
        otelmart.brand = ?params.brand
    )
)]
pub async fn list_products(
    pool: &PgPool,
    params: &ProductQueryParams,
    page: i32,
    page_size: i32,
    offset: i32,
) -> Result<(Vec<ProductWithRating>, i64), sqlx::Error> {
    // 复杂分页查询业务实现
}
```

请注意：无论是单行点查还是复杂列表检索，生成的 Span 名称**完全相同**，皆为 `SELECT products`。而在下钻排查时，两者的区别清晰映射在属性字段上：前者携带 `otelmart.product.uuid`，后者则携带了 `otelmart.page` 与 `otelmart.category.id` 等丰富维度。

### 优雅处理“数据未找到”（404 Not Found）场景

在数据库层，查询不到某条记录绝对不等于发生了“数据库系统故障”；它是一次完全符合物理预期的合法查询结果。仓储函数应当正常返回 `Ok(None)`，交由上层 Web 处理器决定业务响应：

```rust
// 仓储层：返回 Option，数据缺失不抛出底层错误
pub async fn get_product_by_uuid(
    pool: &PgPool,
    uuid: Uuid,
) -> Result<Option<ProductDetail>, sqlx::Error> {
    sqlx::query_as::<_, ProductDetail>(/* ... */)
        .bind(uuid)
        .fetch_optional(pool)  // 若查无此人，优雅返回 None
        .await
}

// HTTP 处理器层：根据业务契约将 None 解释为 HTTP 404
pub async fn get_product_by_id(
    State(pool): State<PgPool>,
    Path(uuid): Path<Uuid>,
) -> impl IntoResponse {
    match db::get_product_by_uuid(&pool, uuid).await {
        Ok(Some(product)) => (StatusCode::OK, Json(product)).into_response(),
        Ok(None) => not_found_error(
            "目标商品不存在",
            serde_json::json!({"uuid": uuid.to_string()}),
        ),
        Err(e) => internal_error("查询商品底层异常", e.to_string()),
    }
}
```

在此场景下，数据库 Span 属于正常完成（Status 为 Unset/Ok），因为底层 SQL 查询本身完美成功执行。将“数据不存在”转化为 404 响应是上层 Web 业务逻辑的职责，绝不能把正常的业务查询缺失在底层数据库 Span 上强行标记为系统级崩溃。

## 写查询插桩实战

写操作（`INSERT`、`UPDATE`、`DELETE`）直接改变系统物理状态，承载着沉重的业务责任，且往往伴随着行级锁争用，必须接受更高标准的遥测审视。

### 库存并发锁定预留

`reserve_stock` 是整个 OpenTel 电商系统中并发争用最剧烈、最凶险的操作。它在数据库内部调用预置的存储函数，原子化地校验可用库存并创建锁定记录：

```rust
// inventory/src/db/repository.rs

#[instrument(
    name = "SELECT reserve_stock",
    skip(pool),
    fields(
        otel.kind = "client",
        db.system.name = "postgresql",
        db.namespace = "inventory",
        db.operation.name = "SELECT",
        db.collection.name = "product_inventory",
        db.query.text = "SELECT reserve_stock($1, $2)",
        otelmart.product.uuid = %product_uuid,
        otelmart.quantity = quantity
    )
)]
pub async fn reserve_stock(
    pool: &PgPool,
    product_uuid: Uuid,
    quantity: i32,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar::<_, bool>(r#"SELECT reserve_stock($1, $2)"#)
        .bind(product_uuid)
        .bind(quantity)
        .fetch_one(pool)
        .await
}
```

**设计决策：**
- **存储函数保证原子并发**：将库存可用性校验与行锁更新下沉至 PostgreSQL 的 `reserve_stock()` 内部完成，从根本上杜绝了在应用层由于并发重试导致的超卖风险。
- **动词严密贴合 SQL 语法**：虽然函数内部执行了更新，但对外调用的物理动词为 `SELECT`，因此 `db.operation.name` 规范记录为 `"SELECT"`。
- **业务校验失败不污染系统错误率**：当函数返回 `false`（库存不足）时，底层的物理查询本身是成功执行的。我们避免将其标记为底层 Span 崩溃，从而守护监控指标中系统物理可用率的纯净性。

### 延后延迟记录：使用 `tracing::field::Empty` 捕获受影响行数

有些关键属性在 SQL 实际执行完毕之前是无法获知的（例如一条 `UPDATE` 语句究竟实际命中了多少行数据）。Rust 的 `tracing` 提供了极为强大的模式：先在 `#[instrument]` 中用 `tracing::field::Empty` 提前占位，待拿到物理执行结果后，再调用 `Span::current().record()` 进行动态反填。

以下以 `update_stock` 为例演示这一标准模式：

```rust
// inventory/src/db/repository.rs

#[instrument(
    name = "UPDATE inventory",
    skip(pool),
    fields(
        otel.kind = "client",
        db.system.name = "postgresql",
        db.namespace = "inventory",
        db.operation.name = "UPDATE",
        db.collection.name = "product_inventory",
        db.query.text = "UPDATE product_inventory SET stock_quantity = $1 ... WHERE product_uuid = $4",
        otelmart.product.uuid = %product_uuid,
        otelmart.quantity = quantity,
        db.response.returned_rows = tracing::field::Empty  // 此时暂不可知，先在元数据中占位
    )
)]
pub async fn update_stock(
    pool: &PgPool,
    product_uuid: Uuid,
    quantity: i32,
    reorder_level: Option<i32>,
    reorder_quantity: Option<i32>,
) -> Result<Option<i32>, sqlx::Error> {
    let result = sqlx::query(...) // 执行真实的更新
        .execute(pool)
        .await?;

    // SQL 物理执行完毕后，回填实际受影响的行数！
    let rows_affected = result.rows_affected();
    Span::current().record("db.response.returned_rows", rows_affected);

    Ok(...)
}
```

**为什么必须预先占位？**
因为 `tracing` 内部基于严格的高性能结构化设计，如果在宏展开时没有显式声明该字段，运行时便无法为其预留内存插槽，后续的 `record()` 调用将被底层直接静默忽略。

这一特性对于数据库运维排障极其致命：在执行 `UPDATE` 时，返回的行数是 `0` 还是 `1` 有着天壤之别——`0` 说明并发条件下数据已经被其他事务抢先处理或数据根本不存在，而 `1` 则明确宣告操作成功。

### 数据库物理异常的高保真记录

数据库底层的系统级错误（如唯一主键冲突、外键约束失败、锁等待超时或死锁）与纯粹的应用级业务判断错误有着本质区别。我们需要在 Span 中捕获这些深层错误，并完好保留底层的 PostgreSQL 物理错误码（Error Code），以便在监控系统中实施精确检索：

```rust
fn record_db_error(span: &tracing::Span, error: &sqlx::Error) {
    // 将 OpenTelemetry Span 的全局状态打上 ERROR 标记
    span.record("otel.status_code", "ERROR");

    // 尝试向下转型提取真实的底层数据库物理异常
    if let sqlx::Error::Database(db_err) = error {
        if let Some(code) = db_err.code() {
            // 记录标准的 PostgreSQL 物理错误码（如 40001 死锁）
            span.record("db.response.status_code", code.to_string());
        }
    }
}
```

线上排障时常见的典型 PostgreSQL 错误码速查：
- **`23505`**：唯一键约束冲突（如重复提交、邮箱重复注册）
- **`23503`**：外键约束破坏（如引用了不存在的商品主键）
- **`40001`**：事务并发串行化失败（严重并发锁争用）
- **`40P01`**：内核检测到死锁（Deadlock Detected）

将这些物理错误码固化进 Span 之后，你可以在 Jaeger 中直接执行诸如 `db.response.status_code = 40001` 的精准过滤，秒级定位高并发争用热点。

## 将数据库物理事务封装为一等公民的独立 Span

数据库事务（Transaction）将一系列离散的 SQL 操作包裹为一个不可分割的原子执行单元：要么全盘成功，要么彻底回滚。本节的核心工程目标，就是让这个底层的原子边界在分布式追踪大盘中清晰呈现。

### 为什么事务边界必须在追踪中独立呈现

回顾整个电商结账的完整流转：
1. 校验商品详情
2. 跨网络发起远程库存锁定（通过 HTTP 调用 Inventory 服务）
3. 插入本地订单主表记录（本地 SQL 事务）
4. 插入本地订单明细条目（本地 SQL 事务）

如果第 4 步执行崩溃，本地数据库事务（步骤 3 和 4）会在 PostgreSQL 内部自动执行物理回滚。然而，在步骤 2 中通过网络发起的**远程库存锁定**早已在远端完成，根本脱离了本地数据库事务的管辖！它必须依赖上层的 Saga 补偿逻辑进行手动释放。

如果没有一个显式的事务 Span，在追踪大盘中看到的只是一堆零散孤立的 SQL 语句先后报错，完全丢失了它们原本作为一个“原子单元”在运行的核心上下文。事务专属 Span 补全了这块至关重要的拼图：
- **原子性耗时全貌**：统揽该物理事务从 `BEGIN` 到 `COMMIT/ROLLBACK` 的绝对时间跨度。
- **最终命运裁决**：明确在属性中记录当前事务最终是成功 `commit` 还是发生 `rollback`。
- **因果关系收敛**：将事务内部执行的所有细分子查询，严密收敛聚合在同一个父 Span 下。

![](/media/posts/rust-observability/img-06209.png)

*图 5.3 – 包含 TRANSACTION 事务聚合 Span 的结账追踪图谱*

### 事务通用包装器实现

为了让编写带遥测的事务代码变得极度优雅，我们实现了一个通用的闭包包装器：

```rust
// orders/src/db/transaction.rs

#[instrument(
    name = "TRANSACTION",
    skip(pool, f),
    fields(
        otel.kind = "client",
        db.system.name = "postgresql",
        db.operation.name = "transaction",
        otelmart.transaction.name = %name,
        otelmart.transaction.outcome = tracing::field::Empty
    )
)]
pub async fn with_transaction<F, T, E>(
    pool: &PgPool,
    name: &'static str,
    f: F,
) -> Result<T, E>
where
    F: for<'c> FnOnce(
        &'c mut Transaction<'_, Postgres>,
    ) -> Pin<Box<dyn Future<Output = Result<T, E>> + Send + 'c>>,
    E: From<sqlx::Error>,
{
    // 1. 开启底层数据库事务
    let mut tx = pool.begin().await.map_err(E::from)?;

    // 2. 执行传入的业务闭包
    match f(&mut tx).await {
        Ok(result) => {
            // 业务执行成功，正式提交事务并记录 commit 状态
            tx.commit().await.map_err(E::from)?;
            Span::current().record("otelmart.transaction.outcome", "commit");
            Ok(result)
        }
        Err(e) => {
            // 业务失败，显式执行回滚并记录 rollback 状态
            if let Err(rb_err) = tx.rollback().await {
                tracing::warn!(error = %rb_err, "事务显式回滚失败");
            }
            Span::current().record("otelmart.transaction.outcome", "rollback");
            Err(e)
        }
    }
}
```

### 在结账业务中优雅运用事务包装器

在订单服务的 `create_order` 处理器中，数据库写入逻辑蜕变为如下模样：

```rust
pub async fn create_order(
    State(state): State<AppState>,
    Json(request): Json<CreateOrderRequest>,
) -> impl IntoResponse {
    // ... 经过上游校验并通过网络调用完成远程库存锁定 ...

    // 在具备深度可观测性的事务包裹中执行所有订单持久化
    let result = with_transaction(state.pool(), "checkout", |tx| {
        Box::pin(async move {
            // 1. 生成唯一订单编号
            let order_number = db::generate_order_number(tx).await?;

            // 2. 插入订单主表
            let created_order = db::create_order(
                tx,
                &order_number,
                &customer_email,
                customer_phone.as_deref(),
                &totals,
            ).await?;

            // 3. 批量持久化订单明细条目
            db::create_order_items(tx, created_order.id, &items).await?;

            // 4. 记录收货地址
            db::create_shipping_address(tx, created_order.id, &shipping_address).await?;

            // 5. 记录支付凭据
            let payment_reference = db::generate_payment_reference(tx).await?;
            db::create_payment(tx, created_order.id, &payment, &payment_reference, &total).await?;

            // 6. 更新订单流水状态
            db::update_order_payment_status(tx, created_order.id, "paid", "processing").await?;

            Ok::<_, OrderError>(created_order)
        })
    }).await;

    match result {
        Ok(order) => (StatusCode::CREATED, Json(order)).into_response(),
        Err(e) => /* 触发逆向补偿并返回错误响应 */,
    }
}
```

### 事务 Span 在大盘中的多态呈现

如果事务顺利提交，Jaeger 中会展现出层次分明的优美树状拓扑：顶层的 `TRANSACTION` Span 紧紧包裹着其内部的全部 7 个子查询：

![](/media/posts/rust-observability/img-06211.png)

*图 5.4 – 顺利提交的结账事务：包含其内部的 7 个原子 SQL 子 Span*

而一旦在执行途中不幸崩溃，追踪瀑布图会以震撼的视觉形式呈现事故现场：展示出在引发灾难的报错语句之前究竟执行到了哪一步，并清晰标注 `otelmart.transaction.outcome: rollback`：

![](/media/posts/rust-observability/img-06213.png)

*图 5.5 – 发生回滚的事务 Span：精准复盘在触发插入失败前所完成的局部查询*

## 暴露连接池排队与饱和度可见性

当大盘中某个数据库 Span 显示耗时 500ms 时，并不代表这条 SQL 语句真的在数据库引擎里执行了半秒钟。在高并发压力之下，**连接池耗尽（Pool Exhaustion）**往往体现为严重的延迟暴涨，而非直接报错。

### SQLx 连接池的幕后机制

在默认情况下，SQLx 会在发起查询时从连接池借出物理连接，并在查询完毕后自动归还。这意味着你的数据库 Span 所度量的持续耗时，实质上是**从连接池等待获取物理连接的耗时 + 真实的 SQL 执行耗时**两者的叠加总和。

在低负载工况下，由于池中始终有空闲连接就绪，获取连接仅需耗费几个微秒，此时 Span 耗时能如实反映 SQL 执行耗时。

### 危机爆发：当连接池彻底干涸

在业务高峰冲击下，一旦连接池中可用的空闲连接跌落至零，新发起的查询请求将被强行挂起，排队等待其他工作任务归还连接。这种排队等待时间会被无情累加到你的 Span 持续耗时中，使一条本来仅需 5ms 的轻量点查，**在外在表象上显得异常迟缓（看起来像 500ms 的慢查询）**！

### 核心诊断特征（Diagnostic Signature）

在日常排障中，牢牢把握连接池枯竭的典型指征：
1. **Span 耗时极大，但数据库原生慢日志却毫无踪迹**：应用端 Span 显示耗时 500ms，而 PostgreSQL 慢查询日志里该语句实际物理执行仅耗时 5ms。剩余的 495ms 全在排队等池子分配连接！
2. **同服务的所有数据库 Span 发生无差别的全员延迟膨胀**。
3. **延迟的激增仅与当前系统的瞬时并发请求量强相关，而与具体的 SQL 语句复杂度毫无关联**。

一旦在追踪中捕获到这种特征，你手头有两个针对性的解决方向：要么直接在配置中适当调大连接池的 `max_connections`；要么通过优化核心事务，缩短持锁与占用连接的时间窗口。我们将在第 11 章中专门构建针对连接池状态的实时度量指标与饱和度看板。

## 在 Jaeger UI 中深度剖析数据库 Span

本章所设计的所有规范、低基数策略、仓储层插桩以及事务包装器，在此刻迎来最终的可视化成果。

### 触发真实流量并验证

确保本地 Docker Compose 集群正在运行，并在浏览器中执行如下操作：
1. **浏览商品**：访问 `http://localhost:4200/products`，触发读查询。
2. **完成结账**：将商品加入购物车并在 `http://localhost:4200/checkout` 提交，触发完整的事务写入。

### 引入数据库插桩前后的对比

在第 4 章完成 HTTP 插桩时，结账链路的追踪长成这样：

![](/media/posts/rust-observability/img-06215.png)

*图 5.6 – 第 4 章时的结账追踪：整整 315ms 的数据库工作完全隐匿在黑盒之中*

`orders: POST /orders` 耗时 880ms，但其子 Span 仅仅解释了 565ms 的去向。那凭空消失的 315ms 到底去哪了？完全不得而知。

而现在，随着数据访问层深度插桩就绪，同一条结账链路展现出了纤毫毕现的透明度：

![](/media/posts/rust-observability/img-06217.png)

*图 5.7 – 本章深度插桩后的结账追踪全貌：每一条原子 SQL 及其耗时一览无余*

那消失的 315ms 被彻底复原：30ms（查询商品） + 5ms（生成订单号） + 45ms（插入订单主表） + 35ms（插入订单项） + 15ms（插入地址） + 5ms（生成支付单） + 20ms（记录支付） + 15ms（更新状态） = 170ms 的真实物理 SQL 执行，再加上各步骤之间约 145ms 的业务内存编排耗时！

### 解读经典调用链路

#### 场景 A：健康的只读点查链路

![](/media/posts/rust-observability/img-06219.png)

*图 5.8 – 健康的商品读取追踪：展示 SELECT products 及其标准 OpenTelemetry 语义属性*

- **严整的拓扑分层**：清晰展示从最外层网关（HTTP）、到微服务业务处理、再到底层数据库物理查询的调用链条。
- **可聚合的低基数命名**：统一的 `SELECT products` 使得监控系统可以跨请求统计该表的综合表现。
- **脱敏的查询模板**：`db.query.text` 仅展示带 `$1` 参数的模板，安全透明。
- **领域凭证锚定**：挂载的 `otelmart.product.uuid` 实现了技术性能与商业实体的瞬间对齐。

#### 场景 B：完整的分布式事务写入链路

![](/media/posts/rust-observability/img-06221.png)

*图 5.9 – 成功的完整结账追踪：展示网关、订单处理器、跨服务调用与内部的 TRANSACTION 事务聚合*

- **事务聚合视角**：`TRANSACTION (checkout)` 作为父级节点，将所有的数据库原子写入牢固包揽其中。
- **关键路径无所遁形**：清晰揭示哪一个远程跨服务调用（远端库存锁定）真正占据了整体时延的统治地位。
- **确凿的提交证据**：`otelmart.transaction.outcome: commit` 铁证般地宣告了该笔商业交易的持久化落盘。

#### 场景 C：业务拒绝引发的快速失败（Fail-Fast）

当用户尝试购买一件已经脱销的商品时：

![](/media/posts/rust-observability/img-06223.png)

*图 5.10 – 遭遇库存不足 409 冲突的失败结账追踪：数据库事务尚未开启即快速失败*

追踪在 HTTP 跨网络层便戛然而止。订单服务识别出业务冲突，直接向客户端返回 409，**链路中完全没有出现任何 `TRANSACTION` 或 `INSERT` 数据库 Span**。这确凿地证明了系统的健全性：在最早的边界实现快速失败，避免了对底层宝贵数据库资源的无端浪费。

#### 场景 D：隐蔽的分布式数据不一致——“幽灵库存锁定”

这是微服务架构中最令人胆寒的分布式长事务故障：

![](/media/posts/rust-observability/img-06225.png)

*图 5.11 – 孤儿库存泄漏追踪：远程库存锁定已成功完成，但本地数据库事务因外键违规发生回滚*

**故障现场复原：**
1. **远程副作用已先行动工**：库存服务的预留操作成功返回 HTTP 200。
2. **本地事务崩塌**：随后的本地数据库事务在执行插入时遭遇外键约束失败（PostgreSQL Error `23503`），触发了本地事务的强制物理回滚（`otelmart.transaction.outcome: rollback`）。
3. **灾难的种子已然埋下**：本地数据库订单没有生成，但在远端库存微服务中，那份宝贵的物理库存已被死死冻结！

**这就是分布式追踪无可比拟的威慑力**：如果没有这幅追踪图谱，库存数据的泄漏在触发全盘财务对账之前将完全处于不可知的隐匿状态。而现在，遥测数据将这场不一致的现场还原得一清二楚，第一时间为调度后台的逆向补偿提供了精准的数据证据。

## 本章小结

在本章中，我们将分布式追踪的触角从外围的 HTTP 网络边缘，一路深推到底层的数据持久化层：

![](/media/posts/rust-observability/img-06227.png)

*图 5.12 – 贯穿 HTTP 处理器、仓储层、SQLx 与连接池、直至 PostgreSQL 的完整请求流经全貌*

**核心落地成果：**
- **全面拥抱官方标准规范**：规范应用了 `db.system.name`、`db.namespace` 与 `db.operation.name` 等稳定规范。
- **低基数聚合命名体系**：推行 `{operation} {target}` 命名范式，使得百万级请求可在监控后端高效聚合。
- **丰富的业务领域附注**：注入 `otelmart.*` 属性，打破了底层物理 SQL 耗时与上层商业价值之间的认知壁垒。
- **使用 Empty 字段实现后置动态回填**：捕获物理执行后才能获知的受影响行数。
- **将数据库长事务封装为一等公民的独立 Span**：完整还原原子操作内部的时序与最终命运（Commit/Rollback）。

| 维度对比 | 改造前（第 4 章） | 改造后（第 5 章） |
| --- | --- | --- |
| 整体耗时归因 | 仅知“订单微服务处理耗费了 880ms” | “订单主表写入 45ms、明细写入 35ms、远程调库 520ms” |
| 内部故障定位 | 处理器内部报错原因不明 | 精确捕获底层 SQL 错误码（如 23503 外键约束冲突） |
| 分布式副作用观测 | 远程长事务状态脱节完全不可见 | “本地事务虽然回滚，但远程库存已被预留锁定”的事故现场纤毫毕现 |

*表 5.6 – 完成数据访问层插桩前后系统的观测能力质变*

分布式追踪极其擅长展示时间消耗在了**哪里**，以及各个操作之间的**因果拓扑**。然而，单个孤立的追踪链路并不能完全回答一个更为宏观的问题：我们底层连接池的平均水位究竟是多少？系统在全天维度的读写吞吐量走向如何？

为了解答这些宏观集群维度的全局问题，我们必须引入可观测性的第二大核心支柱——**指标（Metrics）**。

在接下来的**第 6 章**中，我们将构建一套工业级的指标监控体系：依托 RED 与 USE 方法论，将单个请求的离散追踪，熔炼为能够全盘洞察系统宏观脉搏的 Prometheus 实时度量大盘！
