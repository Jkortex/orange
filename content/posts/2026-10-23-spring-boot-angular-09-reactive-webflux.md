---
title: Spring Boot & Angular 全栈实战（九）：Spring WebFlux 响应式流与 SSE 实时消息推送
date: 2026-10-23T00:09:00Z
description: 探索 Reactor 非阻塞反应式编程模型，构建 Server-Sent Events (SSE) 实时通道，实现图书上新与库存变动的流式推送。
category: fullstack
column: spring-boot-angular
tags:
  - WebFlux
  - 响应式编程
  - SSE
  - Reactor
  - 实时通信
---

> 💡 **专栏导读**：本文收录于专栏 [《Spring Boot 4 & Angular 22 全栈微服务实战》](/columns/spring-boot-angular)。全专栏共 22 篇，深度覆盖 Java 26 微服务拆分、Spring Cloud 网关与安全鉴权、Angular 22 Signals 状态治理以及端到端容器化交付的全链路工程实践。

在上一篇中，我们完成了系统的安全加固：引入 Keycloak 集中式认证中心、在 Spring Cloud Gateway 构建了 OAuth2/JWT 资源服务器校验层，并确立了跨微服务传播身份上下文的安全契约。此时，系统已经具备清晰的信任边界。

然而，**“安全”并不自动等同于“高并发可扩展”**。

在网上书店的实际业务中，当某本爆款新书上线促销时，成千上万的用户会同时涌入系统：有人浏览商品目录，有人等待秒杀降价，还有外部聚合平台需要实时捕获库存变动。如果仍基于传统的 Servlet 阻塞模型，服务器将迅速陷入线程饥渴。

本文我们将重构 Inventory（库存）微服务，打破经典的“每请求一线程（Thread-per-request）”思维定式，引入基于 **Project Reactor** 的 **Spring WebFlux** 响应式框架，构建健壮的 **Server-Sent Events (SSE)** 实时流推送管道，实现图书上新与价格变动的零轮询即时通知。

---

## 一、传统 Servlet 阻塞模型与高并发瓶颈

### 1. 传统 API 调用：Thread-per-request 的资源浪费

在传统的 Spring MVC 架构中，Tomcat 等 Servlet 容器为每个入站 HTTP 请求从线程池中分配一个工作线程。该线程全权负责请求的整个生命周期：从 Controller、Service 逻辑计算，到通过 JPA 发起数据库阻塞查询，直到最后序列化并回写响应：

![传统 API 调用处理机制](/media/posts/spring-boot-angular/img-09029.png)

在这个链路中，**高并发下的核心资源瓶颈往往不是 CPU 算力，而是无意义的 I/O 等待**。如下图所示，在等待数据库响应的 100~200 毫秒内，该线程处于挂起阻塞状态：

![阻塞式 API 请求处理](/media/posts/spring-boot-angular/img-09030.png)

当瞬时并发达到数千时，线程池迅速被打满。操作系统频繁进行线程上下文切换（Context Switching），内存占用激增，排队延迟恶化，系统吞吐量断崖式下跌。

### 2. 轮询（Polling） vs 流式推送（Streaming）

在“图书降价与到货通知”场景下，传统的做法是客户端前端定时轮询（如每隔 5 秒发一次 GET 请求）。
- **轮询的弊端**：在 99% 的轮询周期内，商品数据并未改变，但服务器却要承受海量无效请求、执行无意义的 SQL 查询，并反复传输冗余数据；
- **流式推送的优势**：客户端只需建立一次长连接订阅，服务端仅在“真正发生状态改变”时，主动将事件推送至客户端。无变更时不产生任何网络开销，事件一旦发生即刻送达。

但若在传统阻塞 Servlet 容器中维持成千上万个长期存活的 HTTP 长连接，就意味着必须长期占用对应数量的物理线程，服务器资源将迅速崩溃。

### 3. 非阻塞 I/O 与 Netty 事件循环（Event Loop）

为了以极低的资源代价维系海量长连接，必须切换到**非阻塞事件驱动模型（Non-blocking Event Loop）**。Spring WebFlux 默认以内嵌 **Netty** 作为底层运行时：

![Event Loop 事件循环处理模型](/media/posts/spring-boot-angular/img-09031.png)

Netty 并不为每个连接分配独占线程，而是依靠少数几个核心事件循环线程（通常为 CPU 核心数的 1~2 倍）多路复用（Multiplexing）管理成千上万的客户端通道。当 I/O 尚未就绪时，事件循环线程立即去处理其它连接的事件；当底层的 Socket 缓冲区可读或异步数据准备完毕时，系统发出就绪信号，事件循环再回调执行后续逻辑。

这种机制彻底消除了“一个长连接绑定一个线程”的致命消耗，使单机维持数万个实时推送通道成为现实。

### 4. 架构反思：何时不应盲目引入响应式？

响应式编程绝非放之四海皆准的银弹。它引入了异步回调的思维切换、更加复杂的调用栈跟踪与调试难度，以及严格的无阻塞纪律。若系统满足以下特征，传统的 Spring MVC 依然是更稳健的选择：
- 低流量或中小型内部管理系统；
- 绝大部分属于纯 CPU 密集型运算；
- 强依赖大量缺乏非阻塞驱动的第三方遗留库。

在书店业务中，我们并非推倒重来，而是采取**渐进式混合架构**：常规增删改查仍保留成熟的 JPA 持久层，而将 WebFlux 精准应用在**实时状态分发与 SSE 流式推送**关键路径上。

---

## 二、深入理解 Project Reactor 响应式内核

Spring WebFlux 的底层基石是 **Project Reactor**。当我们从 Controller 返回 `Mono<Book>` 或 `Flux<BookEvent>` 时，我们并非直接返回数据，而是构建了一条符合 **Reactive Streams** 规范的声明式、惰性执行的数据流管道。

### 1. Reactive Streams 规范与背压（Backpressure）机制

Reactive Streams 规范定义了四项核心接口：`Publisher<T>`（发布者）、`Subscriber<T>`（订阅者）、`Subscription`（订阅关系）以及 `Processor<T, R>`。其最核心的架构价值在于引入了**背压（Backpressure）协商机制**：

![Reactive Streams 契约与背压流转](/media/posts/spring-boot-angular/img-09032.png)

在传统盲目 Push 模式下，若生产者发送过快，消费能力较弱的下游客户端会因瞬时高负载导致内存溢出或响应卡死。而在 Reactive Streams 协议中：
1. `Subscriber` 向 `Publisher` 发起订阅；
2. `Publisher` 返回 `Subscription` 凭证；
3. `Subscriber` 通过 `subscription.request(n)` 主动向发布者声明当前具备处理能力的元素数量；
4. `Publisher` 严格按照配额只推送不超过 $n$ 个数据项。

在我们的书店通知系统中，`NotificationService` 是事件发布者，前端浏览器建立的 SSE 连接是订阅者。通过 Reactor 框架，下游的消费速率直接制约着上游的数据流速，构建起天然的流量韧性屏障。

### 2. Mono 与 Flux 的生命周期语义

- **Mono<T>**：代表包含 **0 或 1 个元素**的异步序列。
- **Flux<T>**：代表包含 **0 到 N 个元素（可无限流转）**的异步序列。

理解 Reactor 最核心的心智模型是**惰性求值（Laziness）**：
> “Nothing happens until you subscribe.”（在被显式订阅之前，一切代码只是静态的执行计划，不会产生实际数据操作）。

在 Spring WebFlux 中，Controller 返回的 `Mono` 或 `Flux` 会被框架自动在底层发起订阅，并按信号流（Signal）驱动输出：
- `onNext(T)`：发出一个数据项；
- `onComplete()`：序列正常终止；
- `onError(Throwable)`：序列发生异常并终止。

### 3. 常用反应式操作符实战

响应式操作符是操纵数据流的语法工具：

```java
// 1. 过滤与转换
notificationService.streamEvents()
    .filter(event -> event.getEventType() == EventType.PRICE_CHANGE)
    .map(this::enrichForClient);

// 2. 声明式错误恢复，而非粗暴抛出异常
findOneReactive(id)
    .onErrorResume(ex -> Mono.error(new BusinessException("Lookup failed", ex)));

// 3. 线程调度切换：保护 Event Loop 的关键！
Mono.fromCallable(() -> blockingJpaRepository.findById(id))
    .subscribeOn(Schedulers.boundedElastic());
```

---

## 三、库存微服务的“渐进式响应式”混合架构

在 Inventory 微服务中，如果全盘重构为 R2DBC 响应式数据库，不仅需要重构所有复杂关系表映射，还会失去 JPA 丰富的生态积累。因此，我们选择了一种务实且成熟的工程方案：**混合架构（Hybrid Architecture）**。

### 1. 引入 WebFlux 依赖

在 `inventory-ms/pom.xml` 中，用 `spring-boot-starter-webflux` 替换原有的 `spring-boot-starter-web`：

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-webflux</artifactId>
</dependency>
```

引入此依赖后，Spring Boot 会自动卸载 Tomcat，换由 **Netty** 提供非阻塞服务底座。

### 2. 核心纪律：严禁在 Netty Event Loop 上执行阻塞 I/O

JPA 与 PostgreSQL JDBC 驱动是彻底的阻塞模型。**若直接在 Netty 的事件循环线程中调用 JPA 查询，事件循环线程被挂起，将连带阻塞由该线程承载的所有其它并发连接！**

为此，凡是必须在反应式链条中调用的 JPA 操作，必须强制切换至弹性阻塞调度器（`Schedulers.boundedElastic()`）：

```java
public Mono<BookResponse> findBookByIdReactive(Long id) {
    return Mono.fromCallable(() -> bookRepository.findById(id))
            .subscribeOn(Schedulers.boundedElastic()) // 剥离到专属阻塞线程池执行
            .flatMap(optional -> optional
                    .map(book -> Mono.just(bookMapper.toResponse(book)))
                    .orElseGet(() -> Mono.error(new ResourceNotFoundException("Book not found"))));
}
```

而在常规的增删改业务中，依旧维持标准的同步执行，仅在数据库事务提交完成后，向反应式管道发射一个领域事件。

### 3. 响应式安全上下文管理

在 Servlet 模型下，安全上下文（`SecurityContext`）保存在 `ThreadLocal` 中。但在响应式管道里，一次请求的执行可能在多个不同线程之间流转切换。

WebFlux 依托 Reactor 提供的 **Context（上下文容器）** 自动传递认证状态。对于需要鉴权的受保护 SSE 或 API 路由，网关传来的认证令牌会在建立 SSE 握手连接时被校验，保障数据管道的安全性。

---

## 四、领域事件模型设计：信封-载荷模式

事件流绝非随意散落的 JSON 碎片，必须具备清晰的自解释性与面向未来的扩展能力。我们采用**信封-载荷（Envelope-and-Payload）**模式定义领域事件。

### 1. 统一事件外层信封：BookEvent

`BookEvent.java` 是所有实时流推送的顶层契约：

```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BookEvent {
    // 基础信封元数据
    private String eventId;          // 事件全局唯一 UUID，用于防重与链路追踪
    private EventType eventType;      // 事件类型枚举：NEW_BOOK, PRICE_CHANGE 等
    private LocalDateTime timestamp;  // 事件生成时间戳
    
    // 关键领域定位锚点
    private Long bookId;
    private String bookTitle;
    private String isbn;
    
    // 异构多态业务载荷
    private Object eventData;
}
```

### 2. 新书上线载荷：NewBookEventData

新书上线事件承载完整的图书业务属性。我们不建议仅推送一个 `bookId` 让前端再发起一次 HTTP 回查，而应提供自闭环的上下文：

```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NewBookEventData {
    private String authorName;
    private String genre;
    private BigDecimal price;
    private Integer quantity;
    private LocalDate published;
    private String description;
    private Integer pageCount;
    private String coverImageUrl;
}
```

### 3. 价格变更载荷：PriceChangeEventData

价格变动不能只推送“当前新价格”，而必须表达“状态跃迁”的过程：

```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PriceChangeEventData {
    private BigDecimal oldPrice;
    private BigDecimal newPrice;
    private BigDecimal priceChange;       // 差价绝对值（newPrice - oldPrice）
    private Double percentageChange;      // 涨跌百分比
}
```

客户端接收到此类事件后，无需比对历史快照，即可直接高亮促销降价标签或触发降价提醒。

### 4. 关键原则：严格在事务提交后发射事件

**在分布式事件驱动设计中，绝不能在数据持久化成功之前发射事件！** 否则，一旦后续数据库事务因唯一键冲突或校验失败而回滚，前端已接收到“新书上线”通知，造成严重的脏数据感知：

```java
@Transactional
public BookResponse createBook(BookCreateRequest req) {
    validateSemanticsForCreate(req);
    Author author = resolveAuthorById(req.authorId());
    Book entity = bookMapper.toEntity(req, author);
    
    // 1. 阻塞执行持久化
    Book saved = bookRepository.save(entity);
    
    // 2. 数据库写入成功后，发射 NEW_BOOK 领域事件至响应式流
    publishNewBookEvent(saved);
    
    return bookMapper.toResponse(saved);
}

@Transactional
public BookResponse updatePrice(Long bookId, BigDecimal newPrice) {
    Book existing = bookRepository.findById(bookId)
            .orElseThrow(() -> new ResourceNotFoundException("Book not found"));
    
    BigDecimal oldPrice = existing.getPrice();
    boolean priceChanged = newPrice != null && newPrice.compareTo(oldPrice) != 0;
    
    existing.setPrice(newPrice);
    Book saved = bookRepository.save(existing);
    
    // 价格确实发生变更时才触发推送
    if (priceChanged) {
        publishPriceChangeEvent(saved, oldPrice, newPrice);
    }
    
    return bookMapper.toResponse(saved);
}
```

---

## 五、响应式通知管道与 SSE 实时端点落地

### 1. 基于 Sinks 构建进程内多播事件总线

在 `NotificationService` 中，我们使用 Reactor 提供的 `Sinks.Many` 构建微服务内部的热发布（Hot Publisher）事件分发中心：

```java
@Service
@Slf4j
public class NotificationService {

    // 核心事件多播 Sink：支持背压缓冲 256 个溢出事件
    private final Sinks.Many<BookEvent> sink = 
            Sinks.many().multicast().onBackpressureBuffer(256);

    /**
     * 向管道推送领域事件
     */
    public void publish(BookEvent event) {
        Sinks.EmitResult result = sink.tryEmitNext(event);
        if (result.isFailure()) {
            log.warn("无法发射事件 [ID: {}]，原因: {}", event.getEventId(), result);
        }
    }

    /**
     * 暴露只读的 Flux 视图供 Controller 订阅
     */
    public Flux<BookEvent> getEventStream() {
        return sink.asFlux();
    }
}
```

- `Sinks.many().multicast()`：采用**多播模式**。所有目前连接的客户端共享同一事件流，一条事件广播到所有在线订阅者；
- `onBackpressureBuffer(256)`：为每个订阅通道保留 256 个背压环形缓冲区，当某些客户端网络短暂抖动时，缓冲堆叠数据，避免连接直接被重置；
- 这是一个热数据源（Hot Stream）：客户端只接收连接建立后发生的最新事件，历史旧数据不作回溯。

### 2. 暴露 Server-Sent Events (SSE) 流式端点

在 `NotificationController` 中，对外暴露响应式实时流接口：

```java
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@Slf4j
public class NotificationController {

    private final NotificationService notificationService;

    /**
     * SSE 实时事件流端点
     */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<BookEvent>> streamEvents() {
        return notificationService.getEventStream()
                .map(event -> ServerSentEvent.<BookEvent>builder()
                        .id(event.getEventId())
                        .event(event.getEventType().name())
                        .data(event)
                        .build())
                .doOnSubscribe(sub -> log.info("新的客户端建立 SSE 实时通道"))
                .doOnCancel(() -> log.info("客户端断开 SSE 实时通道"));
    }

    /**
     * 带有类型过滤的针对性订阅
     */
    @GetMapping(value = "/stream/{type}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<BookEvent>> streamEventsByType(@PathVariable EventType type) {
        return notificationService.getEventStream()
                .filter(event -> event.getEventType() == type)
                .map(event -> ServerSentEvent.<BookEvent>builder()
                        .id(event.getEventId())
                        .event(event.getEventType().name())
                        .data(event)
                        .build());
    }
}
```

- `produces = MediaType.TEXT_EVENT_STREAM_VALUE`：这是让 HTTP 连接转变为 SSE 长连接的关键声明。Spring WebFlux 识别此媒体类型后，将不再关闭 HTTP 通道，而是以 `text/event-stream` 格式持续分块（Chunked）刷新输出；
- **连接生命周期自动化管理**：当客户端关闭浏览器标签页或断开连接时，Netty 探测到底层 TCP 通道关闭，主动触发 `doOnCancel()` 并注销订阅，彻底消除了内存泄漏和孤儿线程（Ghost Connections）隐患。

---

## 六、端到端测试与流式管道验证

### 1. 终端命令行建立 SSE 长连接订阅

打开一个独立终端（Terminal 1），使用 `curl` 监听 SSE 实时端点：

```bash
# 监听全局事件流
curl -N -H "Accept: text/event-stream" http://localhost:8080/packt/inventory/api/notifications/stream
```

> [!TIP]
> `-N` 参数（`--no-buffer`）对 curl 至关重要，它能关闭 curl 的本地输出缓存，确保服务端推送的 SSE 消息能立即在终端控制台实时逐行打出。

### 2. 触发领域变更事件

打开另一个终端（Terminal 2），通过 API Gateway 依次触发创建书籍与修改价格：

```bash
# 1. 录入一本新书
curl -X POST http://localhost:8080/packt/inventory/api/books \
  -H "Authorization: Bearer ${AUTHOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Reactive Spring Boot 4 in Action",
    "isbn": "978-7-111-88888-8",
    "authorId": 1,
    "price": 89.00
  }'
```

```bash
# 2. 调整该图书的价格（模拟促销降价）
curl -X PATCH http://localhost:8080/packt/inventory/api/books/1 \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"price": 69.00}'
```

### 3. 观察 SSE 实时接收报文

此时切换回 Terminal 1，可以看到长连接无需刷新，自动推送了标准格式的 SSE 帧：

```http
id:550e8400-e29b-41d4-a716-446655440000
event:NEW_BOOK
data:{"eventId":"550e8400-e29b-41d4-a716-446655440000","eventType":"NEW_BOOK","timestamp":"2026-10-23T10:30:00","bookId":1,"bookTitle":"Reactive Spring Boot 4 in Action","isbn":"978-7-111-88888-8","eventData":{"authorName":"Josh Long","price":89.00,"quantity":50}}

id:660f9511-f30c-52e5-b827-557766551111
event:PRICE_CHANGE
data:{"eventId":"660f9511-f30c-52e5-b827-557766551111","eventType":"PRICE_CHANGE","timestamp":"2026-10-23T10:35:00","bookId":1,"bookTitle":"Reactive Spring Boot 4 in Action","isbn":"978-7-111-88888-8","eventData":{"oldPrice":89.00,"newPrice":69.00,"priceChange":-20.00,"percentageChange":-22.47}}
```

### 4. 验证分类通道过滤隔离

测试定制化过滤端点：
- 启动终端 A：`curl -N http://localhost:8080/packt/inventory/api/notifications/stream/NEW_BOOK`
- 启动终端 B：`curl -N http://localhost:8080/packt/inventory/api/notifications/stream/PRICE_CHANGE`

再次触发价格调整时，只有终端 B 会捕获到数据，终端 A 保持静默。这验证了 WebFlux 操作符在服务端进行流过滤分发的精准性。

---

## 七、总结与全栈展望

在微服务技术架构中，从“传统的阻塞式请求-响应”跃迁至“响应式实时流”，是一次重大的架构升级：

1. **资源利用率的质的飞跃**：借助 Netty 的 Event Loop 机制，我们将长连接占用的开销从昂贵的操作系统物理线程转换为轻量的非阻塞通道对象，单机轻松抗住海量在线推送；
2. **务实的混合架构落地**：不盲目全盘改造，把阻塞 JPA 与响应式 WebFlux 有序隔离在不同的线程调度域（`Schedulers.boundedElastic`），既保护了核心事件循环的响应性，又最大化复用了成熟业务持久层逻辑；
3. **领域驱动的自包含设计**：通过统一的 `BookEvent` 信封模型，将“有业务价值的完整状态转移”推送到消费端，从根本上杜绝了无意义的轮询与反向查询。

随着后端服务已经具备完整的微服务拆分、服务发现、网关安全以及实时推送能力，下一篇我们将进入生产工程化交付阶段——**微服务容器化构建与多阶段镜像打包（Docker & OCI）**，探索如何将所有服务标准化打包并为 Kubernetes 部署做好准备。
