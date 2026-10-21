---
title: Go 分布式系统实战（四）：HTTP 服务与中间件链路：Go 1.22 原生路由与核心中间件
date: 2026-10-18T00:04:00Z
description: 基于 Go 1.22 net/http 增强路由构建洋葱模型中间件链，实现 Panic 恢复、Request ID 透传、slog 日志、连接排空与探针契约。
category: distributed-systems
column: distributed-go
tags:
  - Go
  - HTTP
  - 中间件
  - Web服务
  - Go1.22
---

> 💡 **专栏导读**：本文收录于专栏 [《Go 云原生分布式系统实战》](/columns/distributed-go)。全专栏共 17 篇，深入剖析现代 Go 在并发模型、微服务通信、JWT 鉴权、分布式事务、可观测性与生产集群落地的完整工程实践。

框架本质上就是别人写的中间件（A framework is someone else’s middleware）。这并不是一句贬损的话——框架确实非常有用。但如果你不理解中间件的底层工作原理，当它出现故障时你就无法进行调试；当框架无法覆盖你的特殊业务场景时，你也无法对其进行扩展；更无法在面对新框架的设计抉择时，客观评估其相较于替代方案的优劣。

本章将完全基于 Go 标准库 `net/http` 构建一个具备可组合中间件链（Composable Middleware Chain）的 HTTP 服务。完全不依赖任何第三方框架。学完本章后，你将彻底明白为什么 Gin、Chi、Echo 以及其他所有 Go HTTP 框架会做出它们各自的设计选择——因为你将亲自面对完全相同的设计权衡与工程决策。

---

## 1. Go 1.22 中的 net/http（net/http in Go 1.22）

Go 的 `net/http` 标准库在每个版本中都在稳步演进。Go 1.22 带来了多年来最重要的路由升级：标准库的 `ServeMux` 终于原生支持了**基于 HTTP 方法的路由**（Method-based Routing）以及**路径参数**（Path Parameters）。

在 Go 1.22 之前，标准库的 `mux` 仅支持基于路径前缀的简单匹配。市面上所有第三方路由库的存在，几乎都是为了填补这一空白。而 Go 1.22 在大多数场景下彻底消除了对第三方路由库的依赖：

```go
mux := http.NewServeMux()

// 带有 HTTP 方法前缀的模式匹配（Go 1.22 新增特性）
mux.HandleFunc("GET /orders/{id}", getOrder)
mux.HandleFunc("POST /orders", createOrder)
mux.HandleFunc("PUT /orders/{id}", updateOrder)
mux.HandleFunc("DELETE /orders/{id}", deleteOrder)

// 没有方法前缀的模式将匹配任意 HTTP 方法
mux.HandleFunc("/health", healthCheck)
```

路径参数可以通过 `r.PathValue` 直接提取：

```go
func getOrder(w http.ResponseWriter, r *http.Request) {
    id := r.PathValue("id")
    // id 是路由模式中 {id} 匹配到的字符串
}
```

通配符模式（Wildcard patterns）可以匹配剩余的完整路径：

```go
mux.HandleFunc("GET /files/{path...}", serveFile)
// r.PathValue("path") 返回剩余的完整路径
```

对于绝大多数服务而言，Go 1.22 的 `mux` 已经完全够用。唯有以下几种情况你可能仍需要选用第三方路由库：
- 需要使用带有共享中间件的路由分组（Route Groups with shared middleware）；
- 中间件需要针对具体路由单独配置，而非全局应用（Middleware applied per-route rather than globally）；
- 需要基于命名路由反向生成 URL（Named URL generation）；
- 团队已经非常习惯于某个特定框架的开发约定。

---

## 2. Handler 接口（The Handler Interface）

`net/http` 中的一切构件都是围绕着一个核心接口建立起来的：

```go
type Handler interface {
    ServeHTTP(ResponseWriter, *Request)
}
```

任何签名符合 `func(http.ResponseWriter, *http.Request)` 的函数都是一个处理函数（Handler）。

`http.HandlerFunc` 是一个适配器类型（Adapter），它能将上述签名的普通函数转换为 `http.Handler` 接口实例：

```go
var h http.Handler = http.HandlerFunc(
    func(w http.ResponseWriter, r *http.Request) {
        fmt.Fprintln(w, "hello")
    },
)
```

中间件（Middleware）本质上就是一个接收 `http.Handler` 并返回新的 `http.Handler` 的函数：

```go
type Middleware func(http.Handler) http.Handler
```

这就是函数组合（Function Composition）。中间件包裹了下一个 Handler，在其执行之前和之后运行自定义逻辑：

```go
func LoggingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()

        next.ServeHTTP(w, r) // 执行实际的处理函数（下层中间件或目标路由）

        slog.InfoContext(r.Context(), "request",
            "method", r.Method,
            "path", r.URL.Path,
            "duration_ms", time.Since(start).Milliseconds(),
        )
    })
}
```

`next.ServeHTTP` 是控制权的委托点（Delegation Point）：在它之前执行的代码属于**请求进入流程**（Request Inbound Processing），在它之后执行的代码属于**响应返回流程**（Response Outbound Processing）。这就是中间件的契约（Middleware Contract）。

---

## 3. 构建中间件链（Building a Middleware Chain）

当系统中存在多个中间件层时，你需要一种干净利落的方式来组合它们。`Chain` 函数按照从首至尾的顺序应用中间件，使得传入的第一个中间件成为最外层包裹：

```go
func Chain(h http.Handler, middleware ...Middleware) http.Handler {
    // 逆序应用，确保参数列表中的第一个中间件位于调用链的最外层
    for i := len(middleware) - 1; i >= 0; i-- {
        h = middleware[i](h)
    }
    return h
}
```

使用示例：

```go
handler := Chain(
    mux,
    RecoverMiddleware,                  // 最外层：捕获所有下层发生的 panic
    RequestIDMiddleware,                // 在记录日志之前分配请求 ID
    TimeoutMiddleware(10*time.Second),  // 设置超时
    LoggingMiddleware,                  // 在超时上下文就绪后记录日志
    BodyCloseMiddleware,                // 确保请求体被读取并关闭
)
```

整个请求的流转路径如下：

```mermaid
flowchart LR
    Client([HTTP 客户端]) --> M1[RecoverMiddleware<br/>异常恢复]
    M1 --> M2[RequestIDMiddleware<br/>请求 ID 注入]
    M2 --> M3["TimeoutMiddleware<br/>超时控制 (10s)"]
    M3 --> M4[LoggingMiddleware<br/>结构化日志]
    M4 --> M5[BodyCloseMiddleware<br/>连接排空与关闭]
    M5 --> Handler[Route Handler / mux<br/>路由业务处理]
    Handler -.-> M5
    M5 -.-> M4
    M4 -.-> M3
    M3 -.-> M2
    M2 -.-> M1
    M1 -.-> Client
```

请求依次穿透：`RecoverMiddleware` → `RequestIDMiddleware` → `TimeoutMiddleware` → `LoggingMiddleware` → `BodyCloseMiddleware` → 路由处理器（Route Handler）。每一层都能在请求进入时审视请求，并在响应返回时处理响应。循环中的逆序执行确保了 `RecoverMiddleware` 能够彻底包裹住其后的每一层中间件与处理逻辑。

中间件的顺序绝非微不足道的代码风格问题：
- **Recovery 必须位于最外层**——它需要捕获其下方所有中间件及业务代码中抛出的 panic；
- **Request ID 必须置于 Logging 之前**——日志组件需要提取并输出该请求 ID；
- **Timeout 应当较早介入**——下游的所有操作都应该遵循该超时限制。

错误的中间件顺序会导致程序看似能够正常编译并运行，但在生产环境中却会悄无声息地失效。

---

## 4. 核心必备中间件（The Essential Middleware）

以下是每一个生产级 HTTP 服务都必不可少的六个核心中间件。

### 4.1 异常恢复（Recovery）

处理函数内部发生的 panic 绝不应该导致整个服务进程崩溃。它们必须被拦截捕获、记录日志，并统一向客户端返回 500 内部错误：

```go
func RecoverMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        defer func() {
            if err := recover(); err != nil {
                slog.ErrorContext(r.Context(), "panic recovered",
                    "error", err,
                    "stack", string(debug.Stack()),
                    "method", r.Method,
                    "path", r.URL.Path,
                )
                // 仅在尚未写入响应头时才写入 500 状态码
                http.Error(w, "internal server error",
                    http.StatusInternalServerError)
            }
        }()
        next.ServeHTTP(w, r)
    })
}
```

这是最外层的中间件。它能够捕获来自其下方所有中间件和处理函数的 panic。日志中的堆栈轨迹（Stack Trace）能够准确定位到发生 panic 的代码行——这对线上故障排查而言价值连城。原始错误信息不会直接暴露给客户端；客户端只会收到通用的 500 错误响应。

这里存在一个微妙的边界场景：如果处理函数在发生 panic 之前已经向客户端写入了部分响应，那么此时你无法再次写入 500 响应头。在生产环境中，使用后文介绍的 `responseWriter` 包装器可以检测响应头是否已经发送。为保持简单明了，上述示例忽略了这种极端情况。

---

### 4.2 请求 ID（Request ID）

每个请求都应该分配一个全局唯一的 ID，并贯穿于该请求产生的所有日志行中：

```go
type contextKey string

const requestIDKey contextKey = "request_id"

func RequestIDMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // 优先采纳上游网关或负载均衡器传入的请求 ID，若不存在则生成新的 ID
        id := r.Header.Get("X-Request-ID")
        if id == "" {
            id = newUUID() // 可以使用任意 UUID 生成器
        }

        ctx := context.WithValue(r.Context(), requestIDKey, id)
        w.Header().Set("X-Request-ID", id)

        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

func RequestIDFromContext(ctx context.Context) string {
    id, _ := ctx.Value(requestIDKey).(string)
    return id
}
```

接收来自负载均衡器或 API 网关传入的 `X-Request-ID` 至关重要：它能让你将当前服务的日志与发起调用的上游服务的日志串联追踪起来。

---

### 4.3 结构化日志（Logging）

为每一个 HTTP 请求记录其最终处理结果。中间件需要获取到响应的 HTTP 状态码，这意味着必须拦截并捕获该状态：

```go
type responseWriter struct {
    http.ResponseWriter
    status      int
    wroteHeader bool
}

func (rw *responseWriter) WriteHeader(code int) {
    if !rw.wroteHeader {
        rw.status = code
        rw.wroteHeader = true
        rw.ResponseWriter.WriteHeader(code)
    }
}

func (rw *responseWriter) Write(b []byte) (int, error) {
    if !rw.wroteHeader {
        rw.WriteHeader(http.StatusOK)
    }
    return rw.ResponseWriter.Write(b)
}

func LoggingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        rw := &responseWriter{ResponseWriter: w, status: http.StatusOK}

        next.ServeHTTP(rw, r)

        slog.InfoContext(r.Context(), "request",
            "method", r.Method,
            "path", r.URL.Path,
            "status", rw.status,
            "duration_ms", time.Since(start).Milliseconds(),
            "request_id", RequestIDFromContext(r.Context()),
            "user_agent", r.UserAgent(),
            "remote_addr", r.RemoteAddr,
        )
    })
}
```

`wroteHeader` 标志位能够防止响应头被重复写入。
- 当处理函数显式调用 `WriteHeader` 时，包装器会精确捕获该状态码；
- 当处理函数未调用 `WriteHeader` 而直接调用 `Write` 输出内容时，包装器会捕获隐式的 `200 OK`。

这保证了记录到日志中的状态码永远是准确的。`slog.InfoContext` 将 Context 传递给日志记录器——本专栏第 12 章中实现的自定义日志处理器将能够自动从中提取 Trace ID。

---

### 4.4 请求体关闭（Body Close）

HTTP 请求体必须被完整读取并关闭，底层的 TCP 连接才能被安全复用：

```go
func BodyCloseMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        defer func() {
            if r.Body != nil {
                io.Copy(io.Discard, r.Body)
                r.Body.Close()
            }
        }()
        next.ServeHTTP(w, r)
    })
}
```

`io.Copy(io.Discard, r.Body)` 会在关闭连接前排空所有未读字节。如果处理函数在完全读完请求体之前就返回了错误，底层的原始 TCP 连接就无法被安全地复用——因为服务器无法断定请求数据究竟在哪里结束。排空操作确保了连接能够安全归还到底层连接池中。该操作对性能的影响微乎其微：因为在绝大多数情况下，处理函数已经将请求体完整读取了。

---

### 4.5 请求超时（Request Timeout）

每个进入的 HTTP 请求都应当在服务端设置处理截止时间（Deadline）：

```go
func TimeoutMiddleware(timeout time.Duration) Middleware {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            ctx, cancel := context.WithTimeout(r.Context(), timeout)
            defer cancel()

            done := make(chan struct{})
            panicChan := make(chan interface{}, 1)

            go func() {
                defer func() {
                    if p := recover(); p != nil {
                        panicChan <- p
                    }
                }()
                next.ServeHTTP(w, r.WithContext(ctx))
                close(done)
            }()

            select {
            case p := <-panicChan:
                panic(p) // 重新抛出 panic，由外层的 RecoverMiddleware 捕获
            case <-done:
                return
            case <-ctx.Done():
                w.WriteHeader(http.StatusGatewayTimeout)
            }
        })
    }
}
```

采用独立 Goroutine 的方式能够确保超时机制切实中断耗时过长的慢处理函数。如果不使用 Goroutine，`context.WithTimeout` 虽然设置了截止时间，但处理函数的 Goroutine 依然会一直运行直至返回——此时 Context 虽然已被取消，但那些未主动检查 `ctx.Done()` 的代码根本不会停止执行。通过引入 Goroutine 和 `select` 监听，一旦超时触发，中间件便能立即向客户端返回 504 Gateway Timeout。

对于所有下游代码都能严格且正确检查 Context 取消状态的轻量级服务，可以使用以下免 Goroutine 的简化版本：

```go
func TimeoutMiddlewareSimple(timeout time.Duration) Middleware {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            ctx, cancel := context.WithTimeout(r.Context(), timeout)
            defer cancel()
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }
}
```

---

### 4.6 跨域资源共享（CORS）

对于需要为来自不同域名的浏览器客户端提供 API 调用的服务：

```go
func CORSMiddleware(allowedOrigins []string) Middleware {
    allowed := make(map[string]bool, len(allowedOrigins))
    for _, o := range allowedOrigins {
        allowed[o] = true
    }

    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            origin := r.Header.Get("Origin")

            if origin != "" && (allowed["*"] || allowed[origin]) {
                w.Header().Set("Access-Control-Allow-Origin", origin)
                w.Header().Set("Access-Control-Allow-Methods",
                    "GET, POST, PUT, DELETE, OPTIONS")
                w.Header().Set("Access-Control-Allow-Headers",
                    "Authorization, Content-Type, X-Request-ID")
                w.Header().Set("Access-Control-Max-Age", "86400")
            }

            // 处理预检请求（Preflight）
            if r.Method == http.MethodOptions {
                w.WriteHeader(http.StatusNoContent)
                return
            }

            next.ServeHTTP(w, r)
        })
    }
}
```

CORS 预检请求（OPTIONS）必须返回 200 或 204，并附带相应的 CORS 响应头——浏览器正是利用这一机制来检查后续实际请求是否被允许。如果没有预检处理器，浏览器端客户端在发起任何实际业务请求之前就会直接遭遇 CORS 报错。

在生产环境中，建议使用社区成熟的 `rs/cors` 库，而不是自己手写实现——它严格且完整地实现了完整的 CORS 规范，包括 `Vary` 响应头的设置以及带凭证请求（Credential handling）的正确处理。

---

## 5. 结构化错误响应（Structured Error Responses）

系统中的每个服务都应以统一规范的 JSON 格式返回错误：

```go
type APIError struct {
    Code    string `json:"code"`
    Message string `json:"message"`
    Details any    `json:"details,omitempty"` // 可选的附加上下文信息
}

func WriteError(w http.ResponseWriter, status int, code, message string) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    if err := json.NewEncoder(w).Encode(
        APIError{Code: code, Message: message}); err != nil {
        slog.Error("failed to write error response", "error", err)
    }
}
```

包含规范错误处理的处理函数示例：

```go
func getOrderHandler(store OrderStore) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        id := r.PathValue("id")
        if id == "" {
            WriteError(w, http.StatusBadRequest,
                "MISSING_ID", "order ID is required")
            return
        }

        order, err := store.GetByID(r.Context(), id)
        if err != nil {
            switch {
            case errors.Is(err, ErrNotFound):
                WriteError(w, http.StatusNotFound,
                    "ORDER_NOT_FOUND", "order not found")
            case errors.Is(err, ErrForbidden):
                WriteError(w, http.StatusForbidden,
                    "FORBIDDEN", "access denied")
            default:
                slog.ErrorContext(r.Context(), "failed to get order",
                    "order_id", id,
                    "error", err,
                )
                WriteError(w, http.StatusInternalServerError,
                    "INTERNAL_ERROR", "internal server error")
            }
            return
        }

        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(order)
    }
}
```

`switch errors.Is` 模式清晰地将领域错误映射为了对应的 HTTP 状态码。内部错误细节只会被输出到系统日志中，绝不会直接暴露给客户端——底层的错误堆栈属于系统运维人员，而不是终端用户。

该处理函数采用构造函数模式（`getOrderHandler(store)`）返回一个 `http.HandlerFunc`。这是需要注入依赖的处理函数的标准 Go 惯用模式——`store` 依赖直接被闭包所捕获，而不需要穿透传递在 Context 中。

---

## 6. JSON 请求数据绑定（JSON Request Binding）

解析 HTTP 请求体中的 JSON 数据往往伴随着大量样板代码。编写一个轻量级的辅助函数可以显著减少冗余：

```go
func DecodeJSON(r *http.Request, v any) error {
    if r.Header.Get("Content-Type") != "application/json" {
        return fmt.Errorf("expected Content-Type: application/json")
    }

    dec := json.NewDecoder(r.Body)
    dec.DisallowUnknownFields() // 拒绝非预期的未知字段
    if err := dec.Decode(v); err != nil {
        return fmt.Errorf("decode JSON: %w", err)
    }

    // 确保 JSON 对象之后没有多余数据
    if dec.More() {
        return fmt.Errorf("request body must contain a single JSON object")
    }

    return nil
}
```

`DisallowUnknownFields` 会在请求体包含目标结构体中不存在的字段时抛出解码错误。这能有效防止**静默数据丢失**（Silent Data Loss）——如果客户端发送了 `{"quantity": 2, "priority": "high"}`，而你的结构体中并没有定义 `Priority` 字段，你必然希望系统立即报错，而不是默不作声地将其丢弃。

在处理函数中的使用方式：

```go
func createOrderHandler(store OrderStore, pub Publisher) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        var req struct {
            ProductID string `json:"product_id"`
            Quantity  int    `json:"quantity"`
        }

        if err := DecodeJSON(r, &req); err != nil {
            WriteError(w, http.StatusBadRequest,
                "INVALID_REQUEST", err.Error())
            return
        }

        if req.ProductID == "" {
            WriteError(w, http.StatusBadRequest,
                "MISSING_FIELD", "product_id is required")
            return
        }
        if req.Quantity < 1 {
            WriteError(w, http.StatusBadRequest,
                "INVALID_FIELD", "quantity must be >= 1")
            return
        }

        // ... 创建订单业务逻辑
    }
}
```

---

## 7. 健康检查模式（Health Check Patterns）

每个生产级服务都需要健康检查端点。Kubernetes 依据它来决定是否向该 Pod 路由流量；负载均衡器依据它来判断实例是否健康可用。这就是**云原生存活契约**（Cloud-native Liveness Contract）：你的服务主动向基础设施平台汇报自己能否承接流量，平台据此信号采取相应动作。

存活检查与就绪检查服务于完全不同的目的：

```go
func livenessHandler(w http.ResponseWriter, r *http.Request) {
    // 存活检查（Liveness）：我还活着吗？
    // 如果返回非 200，Kubernetes 将直接重启当前 Pod。
    // 除非当前进程处于不可恢复的死锁或致命状态，否则应始终返回 200。
    // 切勿在此处检查外部依赖项——下游数据库变慢绝不应该导致当前 Pod 被反复重启！
    w.WriteHeader(http.StatusOK)
}

func readinessHandler(db *pgxpool.Pool) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        // 就绪检查（Readiness）：我准备好对外服务了吗？
        // 如果返回非 200，Kubernetes 会将该 Pod 从负载均衡中摘除，但绝不会重启它。
        // 务必在此处检查关键依赖项。

        ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
        defer cancel()

        if err := db.Ping(ctx); err != nil {
            slog.WarnContext(r.Context(),
                "readiness check failed", "error", err)
            w.WriteHeader(http.StatusServiceUnavailable)
            json.NewEncoder(w).Encode(map[string]string{
                "status": "not ready",
                "reason": "database unavailable",
            })
            return
        }

        w.WriteHeader(http.StatusOK)
        json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
    }
}
```

注册这两个端点：

```go
mux.HandleFunc("GET /healthz/live", livenessHandler)
mux.HandleFunc("GET /healthz/ready", readinessHandler(db))
```

> [!CAUTION]
> **存活检查切勿依赖外部系统！**  
> 如果数据库宕机导致存活检查失败，Kubernetes 就会粗暴地重启 Pod——这不仅无济于事，反而会引发灾难性的雪崩抖动（Churn）。存活检查仅在进程自身崩溃、死锁或内存耗尽时才应失败；而就绪检查则在服务暂时无法承接业务时失败——例如服务刚启动加载时、突发高负载时，或关键下游依赖不可用时。

这就是云原生健康契约：编排器定时探测 `/healthz/live` 与 `/healthz/ready`，服务据实以告。无需沉重的编排库，无需框架。两个正确实现的 HTTP 端点即可。Kubernetes 的 Pod 配置清单能与这两个端点无缝对接：

```yaml
livenessProbe:
  httpGet:
    path: /healthz/live
    port: 8080
readinessProbe:
  httpGet:
    path: /healthz/ready
    port: 8080
```

相同的端点同样无缝支持 HashiCorp Nomad、AWS ECS 以及云厂商负载均衡器的健康检查。该契约具有通用性——这正是其核心价值所在。

---

## 8. 完整的服务实现（The Complete Service）

将上述所有模块组装在一起：

```go
func NewServer(cfg Config, store OrderStore, db *pgxpool.Pool) *http.Server {
    mux := http.NewServeMux()

    // 健康检查端点 —— 排除在认证中间件之外
    mux.HandleFunc("GET /healthz/live", livenessHandler)
    mux.HandleFunc("GET /healthz/ready", readinessHandler(db))

    // 业务 API 路由
    mux.HandleFunc("GET /orders/{id}", getOrderHandler(store))
    mux.HandleFunc("POST /orders", createOrderHandler(store))

    handler := Chain(
        mux,
        RecoverMiddleware,
        RequestIDMiddleware,
        TimeoutMiddleware(cfg.HTTPTimeout),
        LoggingMiddleware,
        BodyCloseMiddleware,
        CORSMiddleware(cfg.AllowedOrigins),
    )

    return &http.Server{
        Addr:              fmt.Sprintf(":%d", cfg.Port),
        Handler:           handler,
        ReadTimeout:       15 * time.Second,
        ReadHeaderTimeout: 5 * time.Second,
        WriteTimeout:      15 * time.Second,
        IdleTimeout:       60 * time.Second,
        MaxHeaderBytes:    1 << 20, // 1 MB
    }
}
```

`http.Server` 结构体上的四个超时字段构成了完全独立于中间件超时控制的另一层底层防护。它们负责在 TCP 协议层抵御慢客户端（Slow Clients）：
- **`ReadHeaderTimeout`**：防止建立连接后迟迟不发送请求头的客户端长期霸占连接；
- **`ReadTimeout`**：防止发送了请求头却一直不发完请求体的客户端；
- **`WriteTimeout`**：防止接收了响应头却迟迟不读取响应体的客户端；
- **`IdleTimeout`**：主动关闭长时间未活跃的 Keep-Alive 空闲连接。

这些参数是你抵御**连接耗尽攻击**（Connection Exhaustion Attacks，如 Slowloris）以及行为异常客户端的钢铁防线。而处理函数中的 `TimeoutMiddleware` 则负责抵御下游慢服务的拖累。二者相辅相成，缺一不可。

---

## 9. 测试 HTTP 处理函数（Testing HTTP Handlers）

标准库的 `httptest` 包让测试 HTTP 处理函数变得异常简单直观：

```go
func TestGetOrderHandler(t *testing.T) {
    store := NewFakeOrderStore()
    store.Create(context.Background(), Order{
        ID: "order-001", UserID: "user-001", Status: "pending",
    })

    handler := getOrderHandler(store)
    srv := httptest.NewServer(handler)
    defer srv.Close()

    resp, err := http.Get(srv.URL + "/orders/order-001")
    if err != nil {
        t.Fatalf("request: %v", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        t.Errorf("status: got %d, want 200", resp.StatusCode)
    }

    var order Order
    if err := json.NewDecoder(resp.Body).Decode(&order); err != nil {
        t.Fatalf("decode: %v", err)
    }
    if order.ID != "order-001" {
        t.Errorf("ID: got %q, want order-001", order.ID)
    }
}

func TestGetOrderHandler_NotFound(t *testing.T) {
    handler := getOrderHandler(NewFakeOrderStore())
    srv := httptest.NewServer(handler)
    defer srv.Close()

    resp, err := http.Get(srv.URL + "/orders/nonexistent")
    if err != nil {
        t.Fatalf("request: %v", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusNotFound {
        t.Errorf("status: got %d, want 404", resp.StatusCode)
    }

    var apiErr APIError
    json.NewDecoder(resp.Body).Decode(&apiErr)
    if apiErr.Code != "ORDER_NOT_FOUND" {
        t.Errorf("code: got %q, want ORDER_NOT_FOUND", apiErr.Code)
    }
}
```

`httptest.NewServer` 会在一个随机空闲端口上启动一个真实的 HTTP 服务器。测试发起真实的 HTTP 请求，并对真实的 HTTP 响应断言。这完整地覆盖了处理函数执行的全链路逻辑，包括 JSON 序列化、响应头设置以及 HTTP 状态码——而不仅仅是孤立地运行函数内部的代码。

---

## 10. Web 框架的附加价值（What Frameworks Add）

既然我们已经从零手写实现了这一切，那么像 Chi 或 Gin 这样的流行框架究竟在此之上额外提供了什么？
- **支持共享中间件的路由分组**：如 `r.Group("/api/v1", authMiddleware)`；
- **语法更简洁的命名路径参数**：如 `c.Param("id")`，而不用写 `r.PathValue("id")`；
- **URL 反向生成**：根据路由名称构建完整 URL，在重定向场景中非常实用；
- **自动化请求绑定与验证**：如 `c.ShouldBindJSON(&req)` 并结合字段校验标签；
- **丰富的中间件生态**：限流（Rate Limiting）、Gzip 压缩、CSRF 防护等开箱即用的中间件。

对于路由繁多、业务复杂的大型单体服务而言，这些特性确实带来了极大的便利。但其中的权衡代价同样明显：你引入了对框架中间件组合模型、请求上下文抽象以及版本迭代节奏的强依赖。对于拥有海量复杂路由的服务，这种开发便利性完全值得引入外部依赖；而对于微服务或功能清晰的轻量级服务，Go 标准库能够以零外部依赖的纯粹形态，赋予你完全相同的中间件模型。

---

## 11. 常见问题解答（Q&A）

### Q: 我到底该选择标准库还是第三方框架？
**答**：对于路由数量少于 20 个且路由逻辑直观的服务：坚决使用标准库。对于需要多级路由分组、针对不同分组挂载不同中间件，或是团队更偏好特定框架人体工程学的场景：选用框架。无论选用哪种方案，本章介绍的设计模式完全通用——Chi 和 Gin 本身同样实现了相同的 `http.Handler` 接口。

### Q: 如何仅对部分路由应用特定中间件？
**答**：有两种标准做法。

**第一种**：使用 `Chain` 针对单个路由处理器进行单独包装：
```go
adminHandler := Chain(
    adminRoutes, AuthMiddleware(secret), RequireRole("admin"))
mux.Handle("/admin/", adminHandler)
```

**第二种**：为受保护的路由创建独立的子 `ServeMux`，并将中间件链挂载到该子路由上：
```go
adminMux := http.NewServeMux()
adminMux.HandleFunc("GET /admin/users", listUsers)
mux.Handle("/admin/",
    Chain(adminMux, AuthMiddleware(secret), RequireRole("admin")))
```

### Q: 如何正确处理 CORS？
**答**：可以按照本章代码实现 `CORSMiddleware`，或者直接引入工业级的 `rs/cors` 库。核心细节包括：
1. 预检请求（OPTIONS）必须返回 200/204 状态码并附带相应的 CORS 响应头；
2. 当允许多个 Origin 时，响应头中必须包含 `Vary: Origin`，防止下游反向代理产生缓存污染；
3. 当客户端携带凭据请求（`withCredentials: true`）时，`Access-Control-Allow-Origin` 必须指定具体的单一起源，绝不能使用 `*`。

### Q: 服务器上的 ReadTimeout 与 WriteTimeout 有何区别？
**答**：`ReadTimeout` 覆盖了从 TCP 连接被接收（Accept）到请求体被完整读取完毕的整个时间段。`WriteTimeout` 则覆盖了从请求体读取完毕到响应数据完全写回客户端的整个时间段。如果你存在耗时较长的长轮询（Long Polling）或流式输出（Streaming）处理函数（例如执行 30 秒），那么 `WriteTimeout` 的阈值必须大于该处理函数的最大运行时长。`ReadHeaderTimeout` 的阈值通常设置得显著小于 `ReadTimeout`，以专门防御慢速请求头攻击。

### Q: responseWriter 包装器对服务性能会有影响吗？
**答**：影响微乎其微到完全可以忽略不计。每个 HTTP 响应仅增加了一次整数赋值操作。相较于任何真实处理函数中的网络 I/O 开销，这个微小的内存开销根本无法被测量到。更完善的包装器版本还会包装 `Hijack`（用于 WebSocket 协议升级）和 `Flush`（用于流式输出），但绝大多数普通 API 服务根本不需要这些高级特性。

### Q: 如何编写针对特定路由进行权限校验的中间件？
**答**：编写一个接收配置参数的中间件构造函数（Middleware Constructor）：

```go
func RequireScope(scope string) Middleware {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            claims, ok := ClaimsFromContext(r.Context())
            if !ok {
                WriteError(w, 401, "UNAUTHENTICATED", "not authenticated")
                return
            }
            if !claims.HasScope(scope) {
                WriteError(w, 403, "INSUFFICIENT_SCOPE",
                    "scope "+scope+" required")
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}

// 使用方式：
mux.Handle("DELETE /orders/{id}",
    Chain(deleteOrderHandler(store), RequireScope("orders:delete")),
)
```

---

## 12. SDK 沉淀（What Goes in the SDK）

本章构建的中间件链是整个分布式系统中复用率最高的基础组件。集群内的每一个服务都需要它。应当将其沉淀提取到内部公共基础设施库 `platform/middleware` 中：

```
platform/middleware/
├── chain.go       — Chain() 中间件编排函数
├── recover.go     — RecoverMiddleware 异常恢复中间件
├── requestid.go   — RequestIDMiddleware, RequestIDFromContext
├── logging.go     — LoggingMiddleware, responseWriter 包装器
├── bodyclose.go   — BodyCloseMiddleware 连接排空与关闭
├── timeout.go     — TimeoutMiddleware 超时控制中间件
├── cors.go        — CORSMiddleware 跨域处理中间件
├── errors.go      — APIError 统一错误类型, WriteError, DecodeJSON
└── health.go      — LivenessHandler, ReadinessHandler 构造器
```

任何业务服务只需导入 `platform/middleware` 包，即可通过单次导入获得一整套开箱即用的标准中间件链。各个业务服务只需在此基础之上叠加自身特定的路由级中间件（如鉴权、限流、权限范围校验等）。

标准 SDK 初始化示例：

```go
// 每个微服务启动时的标准初始化脚手架
handler := middleware.Chain(
    mux,
    middleware.Recover(),
    middleware.RequestID(),
    middleware.Timeout(cfg.HTTPTimeout),
    middleware.Logging(),
    middleware.BodyClose(),
)
```

`Recover()`、`Timeout()` 和 `Logging()` 等函数利用**函数式选项模式**（Functional Options Pattern）返回配置好的 `Middleware` 闭包值——调用方可以通过传入可选参数灵活定制中间件行为，而无需直接暴露中间件内部的结构体。这是最地道的 Go SDK API 设计哲学：**对外暴露返回预配置行为的构造函数，而不是让调用方去手动拼装暴露在外的内部结构体**。

---

你的中间件链现已能够严密守护并处理每一个进入系统的 HTTP 请求。但对于服务而言，每一个到来的网络请求依然来自“陌生人”。在接下来的第 5 章中，我们将为服务赋予辨明调用方身份的能力——构建跨服务边界运作的 JWT 分布式认证体系，无需在每次请求时向中央认证服务发起昂贵的远程网络往返。

---

> 💡 **专栏导航**：
> - 专栏目录：[《Go 云原生分布式系统实战》全集路线图](/columns/distributed-go)
> - 专栏广场：[浏览全部技术专栏](/columns)
> - 上一篇：[Go 分布式系统实战（三）：两个服务一条队列：HTTP 同步 vs 异步选型与 NATS 实战](/posts/2026-10-18-distributed-go-03-two-services-one-queue)
> - 下一篇：[Go 分布式系统实战（五）：跨服务认证与 JWT 鉴权：无状态验证与 JWKS 动态轮换](/posts/2026-10-18-distributed-go-05-auth-jwt)
