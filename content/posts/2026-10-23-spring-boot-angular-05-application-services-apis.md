---
title: Spring Boot & Angular 全栈实战（五）：应用服务层与企业级 RESTful API 实战
date: 2026-10-23T00:05:00Z
description: 深入 Spring Boot 服务分层设计，构建具备 Record DTO 转换、参数校验、RFC 9457 全局异常治理与分页能力的生产级 REST API。
category: fullstack
column: spring-boot-angular
tags:
  - Spring Boot
  - REST API
  - DTO
  - 数据校验
  - 异常处理
---

## 1. 架构选型与决策矩阵

### 1.1 依赖注入模式决策矩阵

| 注入模式 | 声明形式 | 不可变性保障 | 纯单元测试友好度 | 循环依赖风险 | 架构推荐级别 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **构造器注入 (Constructor)** | `private final Dep dep; public Service(Dep dep) {...}` | **完全不可变 (final)** | **极佳（直接 new 传入 Mock 对象）** | 启动期即刻显式暴露并失败 | **生产唯一推荐首选** |
| **Setter 注入** | `@Autowired public void setDep(Dep dep) {...}` | 允许运行时二次篡改 | 需调用 setter 手动设值 | 运行时可能掩盖架构设计异味 | 仅在极少数可选依赖使用 |
| **字段注入 (Field)** | `@Autowired private Dep dep;` | 破坏封装与不可变性 | 恶劣（强依赖反射或 Spring 容器） | 难以追踪与防御循环依赖 | **严禁在生产代码中使用** |

### 1.2 RESTful API 版本化策略决策矩阵

| 版本策略 | 实现范例 | URL 纯净度 | 网关与 CDN 缓存友好度 | 客户端调试成本 | 生产适用场景 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **URI 路径版本化** | `/api/v1/books` | 含有版本前缀 | **极高（天然作为缓存 Key）** | **极低（浏览器与 cURL 直接可测）** | **企业公网与前后端分离系统首选** |
| **Header 请求头版本化** | `X-API-VERSION: 2` | 保持纯净 | 中等（需配置 Vary 头协同缓存） | 较高（需构造自定义 Header） | 内部微服务调用或协议严格稳定的系统 |
| **MIME 内容协商版本化** | `Accept: application/vnd.bookstore.v2+json` | 保持纯净 | 较低（多维度 Vary 规则较重） | 高（需要精确请求 Accept 报文） | 成熟超媒体 RESTful 规范（HATEOAS） |

## 2. 生产级高内聚服务与 API 代码范式

### 2.1 不可变 Record DTO 与 Bean Validation 校验契约

```java
package com.packt.bookstore.inventory.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;

public record BookRequest(
        @NotBlank(message = "Title is required and cannot be blank")
        String title,

        @NotBlank(message = "ISBN is required")
        @Pattern(regexp = "^[0-9-]{10,17}$", message = "ISBN must be 10-17 digits and may include dashes")
        String isbn,

        @NotNull(message = "Author ID is required")
        Long authorId,

        @NotNull(message = "Price is required")
        @PositiveOrZero(message = "Price must be greater than or equal to 0")
        BigDecimal price,

        @PositiveOrZero(message = "Quantity must be >= 0")
        Integer quantity,

        String genre,
        LocalDate published,
        String description,
        Integer pageCount,
        String coverImageUrl
) {}
```

### 2.2 生产级业务服务层（`BookService` 核心逻辑与语义校验）

```java
package com.packt.bookstore.inventory.service.impl;

import com.packt.bookstore.inventory.dto.*;
import com.packt.bookstore.inventory.entity.*;
import com.packt.bookstore.inventory.exception.*;
import com.packt.bookstore.inventory.mapper.BookMapper;
import com.packt.bookstore.inventory.repository.*;
import com.packt.bookstore.inventory.service.IBookService;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
public class BookService implements IBookService {

    private final BookRepository bookRepository;
    private final AuthorRepository authorRepository;
    private final BookMapper bookMapper;

    public BookService(BookRepository bookRepository, 
                       AuthorRepository authorRepository, 
                       BookMapper bookMapper) {
        this.bookRepository = bookRepository;
        this.authorRepository = authorRepository;
        this.bookMapper = bookMapper;
    }

    @Override
    @Transactional(readOnly = true)
    public List<BookResponse> findAll(int page, int size, String sortSpec) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("title").ascending());
        return bookRepository.findAll(pageRequest).getContent().stream()
                .map(bookMapper::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public BookResponse findOne(Long id) {
        Book book = bookRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Book with ID " + id + " not found"));
        return bookMapper.toResponse(book);
    }

    @Override
    @Transactional
    public BookResponse create(BookRequest req) {
        if (req.authorId() == null) {
            throw new DomainRuleViolationException("Author ID is required");
        }
        if (req.price() != null && req.price().compareTo(BigDecimal.ZERO) < 0) {
            throw new DomainRuleViolationException("Price cannot be negative");
        }
        if (req.isbn() != null && bookRepository.existsByIsbnIgnoreCase(req.isbn())) {
            throw new DomainRuleViolationException("ISBN must be unique within the catalog");
        }
        Author author = authorRepository.findById(req.authorId())
                .orElseThrow(() -> new ResourceNotFoundException("Author with ID " + req.authorId() + " not found"));
        Book saved = bookRepository.save(bookMapper.toEntity(req, author));
        return bookMapper.toResponse(saved);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        if (!bookRepository.existsById(id)) {
            throw new ResourceNotFoundException("Book with ID " + id + " not found");
        }
        bookRepository.deleteById(id);
    }
}
```

### 2.3 RFC 9457 统一错误信封与全局异常切面

```java
package com.packt.bookstore.inventory.dto;

import java.time.Instant;

public record ApiError(
        String type,
        String title,
        int status,
        String detail,
        String instance,
        Instant timestamp
) {
    private static final String BASE_TYPE_URL = "https://api.bookstore.com/errors/";

    public static ApiError of(String errorKey, String title, int status, String detail, String instance) {
        return new ApiError(BASE_TYPE_URL + errorKey, title, status, detail, instance, Instant.now());
    }
}
```

```java
package com.packt.bookstore.inventory.exception;

import com.packt.bookstore.inventory.dto.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiError> handleNotFound(ResourceNotFoundException ex, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiError.of("not-found", "Not Found", 404, ex.getMessage(), req.getRequestURI()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest req) {
        String detail = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .findFirst().orElse("Validation failed");
        return ResponseEntity.badRequest()
                .body(ApiError.of("bad-request", "Bad Request", 400, detail, req.getRequestURI()));
    }

    @ExceptionHandler(DomainRuleViolationException.class)
    public ResponseEntity<ApiError> handleDomainRule(DomainRuleViolationException ex, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(ApiError.of("unprocessable-entity", "Domain Rule Violation", 422, ex.getMessage(), req.getRequestURI()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiError> handleConflict(DataIntegrityViolationException ex, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiError.of("conflict", "Data Conflict", 409, "A data conflict occurred in database", req.getRequestURI()));
    }
}
```

## 3. 全局参数校验与异常状态码映射拓扑流图

```text
[ 客户端 HTTP 请求 ]
       │
       ▼
[ Web 控制器层: @Valid 参数结构校验 ] ──(格式校验失败)──> [ 400 Bad Request ]
       │ (结构合法)
       ▼
[ 服务层: validateSemantics 业务语义校验 ] ──(语义冲突)──> [ 422 Unprocessable Entity ]
       │ (业务合法)
       ▼
[ 仓储与实体检索: findById ] ──────────(主键未命中)───> [ 404 Not Found ]
       │ (找到实体)
       ▼
[ 持久化写入: save ] ──────────────────(唯一索引冲突)─> [ 409 Conflict ]
       │ (持久化成功)
       ▼
[ 成功响应: 200 OK / 201 Created (Location Header) / 204 No Content ]
```

## 4. API 与服务层避坑清单 (Do's & Don'ts)

| 错误实践 (Don't) | 正确实践 (Do) |
| :--- | :--- |
| 在 Controller 中混杂业务规则计算、直接操作 Repository 或开启事务。 | 保持 Thin Controller 设计，所有业务与事务一律封装在 `IBookService` 服务契约中。 |
| 在生产代码中盲目依赖 `@Autowired` 字段注入。 | 强制采用构造器注入（Constructor Injection），声明 `private final` 字段。 |
| 直接把内部 `@Entity` 持久化对象序列化返回给外部客户端。 | 使用 Java `record` 作为不可变 DTO，通过独立 Mapper 隔绝持久化细节与外部契约。 |
| 全量 API 一律返回 `200 OK`，并在 JSON 内部自造 `{ code: 500, msg: "..." }`。 | 严格遵从 HTTP 动词与 RFC 9457 标准状态码（200/201/204/400/404/422/500）。 |
| 在每个 Controller 方法中层层包裹 `try/catch` 吞没异常。 | 使用 `@RestControllerAdvice` 集中捕获特定异常并统一映射为标准化错误信封。 |

<!-- split -->

# 原著完整参考：第 5 章 使用 Spring Boot 构建应用服务与 API（Building Application Services and APIs with Spring Boot）

在上一章中，我们掌握了任何工业级现实应用的底层支柱：持久化数据管理。我们为关系型 SQL 与 NoSQL 两类微服务均搭建了稳健的仓储层，掌握了借助 JPA 与 MongoDB 映射领域模型的高阶技巧，确保了在线书店系统能够安全、高效地持久化所有业务数据。然而，数据持久化仅仅是基石，真正赋予微服务以生命力的是**业务服务层（Service Layer）**。在这一层中，我们编排领域业务规则、落地业务工作流，并将冰冷的底层数据转化为对终端用户有意义的业务体验。同时，这里也是我们通过健壮、安全且设计周全的 RESTful API 将微服务能力向外界暴露的枢纽。

在本章中，我们将架起数据持久层与终端用户真实业务诉求之间的桥梁。我们将全面展示 Spring Boot 如何依托其强大的**依赖注入（Dependency Injection, DI）**与声明式注解体系，赋能开发者构建出整洁、易维护且易扩展的应用服务。随后，我们将深入探索如何设计不仅能正常工作、更能让调用方获得愉悦接入体验的现代化 RESTful API——确保接口语义清晰、具备严密版本控制、容错能力强劲且安全可控。贯穿全书的书店实战案例仍将作为核心载体，将每个抽象概念落实到具体的工程代码中。随着对服务分层架构、REST 控制器设计以及 API 最佳实践的逐步探索，你将清晰领会各个组件如何在现代化可投产的微服务架构中严丝合缝地协同运作。

本章核心涵盖以下主题：

- 深入理解 Spring Boot 依赖注入与组件扫描（Understanding Spring Boot dependency injection and component scanning）
- 业务领域逻辑与异常感知工作流实战（Diving into business logic & exception-aware workflows）
- 使用 Spring Boot 精心设计 RESTful API（Designing RESTful APIs with Spring Boot）

> **注意**
>
> 书中的部分图片在纸质排版中可能细节较小。我们保留了这些完整的原始界面截图，以便大家能够参照自己屏幕上的实际界面一步步进行操作。你也可以通过《前言》（Preface）中提供的 *Graphics Bundle* 链接查看并放大所有高清原图。

## 技术准备工作（Technical requirement）

本章涉及的相关示例源码可在如下地址获取：`https://github.com/PacktPublishing/Spring-Boot-and-Angular-2E_Backend/tree/main/chapter-05`

此外，针对本章及后续章节所开发的全部 RESTful API，官方已备好配套的 Postman 测试集合：`https://github.com/PacktPublishing/Spring-Boot-and-Angular-2E_Backend/tree/main/Postman-Collection`。

## 深入理解 Spring Boot 依赖注入与组件扫描

在深入构建业务服务与对外 API 之前，透彻理解 Spring 提供的基础注解与核心组件模型至关重要。这些注解绝非表面的语法糖，它们构成了整个微服务体系的骨架，精确定义了每个类的职责归属、依赖如何装配，以及 Spring Boot 如何引导整个应用上下文。

同样值得明确的是：依赖注入（DI）并非 Spring 独创的私有概念。DI 是现代软件工程中被广泛采用的通用设计原则，横跨众多编程语言与框架，其核心宗旨在于实现组件解耦、拔高可维护性与可测试性。而 Spring Boot 凭借其成熟的控制反转（IoC）容器与 Bean 生命周期管理机制，为该原则提供了当今业界最优雅、对开发者最友好的工业级实现。

在本节中，我们将逐一剖析 Spring 最核心的注解矩阵：`@Component`、`@Service`、`@Repository`、`@Controller`、`@Configuration`、`@Bean`、`@Autowired`、`@Qualifier` 与 `@Value`。我们不会脱离实际空谈语法，而是将其深度代入书店微服务的真实上下文中。读完本节后，你将对何时选用何种注解、为何选用该注解，以及它们如何协同拼装出清晰的分层架构胸有成竹。

### 用于组件扫描的构造型注解（Stereotypes）

**构造型注解（Stereotype Annotations）**本质上是向 Spring 发出指示：“*请将这个类作为受管 Bean 纳入容器管理*”。IoC 容器通过组件扫描（由主启动类上的 `@SpringBootApplication` 隐式触发）自动发现这些类。虽然 `@Component` 是所有构造型注解的元注解（通用的基类注解），但 Spring 针对不同分层衍生出的特化注解能够更精准地表达架构意图，并解锁额外的框架切面能力。

![图 5.1：Spring 组件模型及各类组件协作关系](/media/posts/spring-boot-angular/img-08959.png)

*图 5.1：Spring 组件模型及各类组件协作关系*

在接下来的几个小节中，我们将逐一拆解 `@Component`、`@Repository`、`@Service` 等核心注解，阐明它们在 Spring Boot 应用中的具体分工。每个注解在支撑组件扫描、自动装配与维持关注点分离方面均发挥着不可替代的作用。

#### @Component：通用的 Spring 受管 Bean

从本质上讲，`@Component` 标识一个普通的 Java 类由 Spring 容器统一管理其生命周期。它是最通用的构造型注解，通常在目标类无法精确归入“业务服务”、“持久层仓储”或“表现层控制器”等特定层级时选用。

你可以将其视为容器级的“兜底标记”。例如，在书店系统的库存微服务中，我们需要一个**对象映射工具（Mapper utility）**，负责在 JPA 实体与暴露给 REST API 的**数据传输对象（DTO）**之间相互转换。这类工具组件既不承载领域业务规则，也不直接读写底层数据库，但它们是整个微服务协同中不可或缺的支撑组件，理应由 Spring 统一管理：

```java
@Component
public class BookMapper {

    public Book toEntity(BookRequest req, Author author) {
        Book book = Book.builder()
                .title(req.title())
                .isbn(req.isbn())
                .author(author)
                .price(req.price())
                .genre(req.genre())
                .published(req.published())
                .description(req.description())
                .pageCount(req.pageCount())
                .coverImageUrl(req.coverImageUrl())
                .build();
        return book;
    }

    public void overwrite(Book target, BookRequest req, Author author) {
        target.setTitle(req.title());
        target.setIsbn(req.isbn());
        target.setAuthor(author);
        target.setPrice(req.price());
        target.setGenre(req.genre());
        target.setPublished(req.published());
        target.setDescription(req.description());
        target.setPageCount(req.pageCount());
        target.setCoverImageUrl(req.coverImageUrl());
    }
}
```

通过标注 `@Component`，`BookMapper` 将模型转换逻辑收敛在内聚、显式的小方法中。这种集中映射机制使 Service 层能完全解放双手，全身心聚焦于核心规则与业务编排。将 `BookMapper` 标记为 `@Component` 后，Spring 可以在任何需要的地方自动将其注入，消除了繁琐的手动实例化，维护了代码的松散耦合。

> **提示**
>
> 当没有更具象的特化注解适用时（例如辅助类 Helper、对象映射器 Mapper 或通用工具类 Utility），优先使用 `@Component`。

#### @Repository：数据访问持久层

我们在前一章已经频繁使用过 `@Repository` 注解。它是专门面向持久化分层的特化构造型注解，明确标识该类或接口专门负责与底层数据库打交道（无论是基于 Spring Data JPA、原始 JDBC 还是 MongoDB）。

例如，在库存微服务中，我们需要仓储组件来管理持久化在 PostgreSQL 中的作者与图书实体。通过标注 `@Repository`，Spring 不仅将其注册为数据访问 Bean，更在底层自动启用了数据访问异常转换切面——将各种厂商各异的底层 SQL 异常自动包装为统一、层次分明的 `DataAccessException` 异常继承树，大幅简化了跨数据库技术栈时的异常处理逻辑：

```java
@Repository
public interface BookRepository extends JpaRepository<Book, Long> {
    Optional<Book> findByIsbnIgnoreCase(String isbn);
    boolean existsByIsbnIgnoreCase(String isbn);
}

@Repository
public interface AuthorRepository extends JpaRepository<Author, Long> {
    Author findByName(String name);
}
```

仓储层必须保持“贫血与轻薄”，严禁在其中掺杂任何业务逻辑，从而确保 Service 层始终是领域规则的唯一可信源。在接口中声明 `existsByIsbnIgnoreCase` 能够支持快速的唯一性检查，便于在上层将其优雅映射为 HTTP 409 Conflict 响应。

> **提示**
>
> 保持 `@Repository` 的职责单一性：仅负责持久化读写交互，将业务校验与调用编排坚决上推至 Service 层。

#### @Service：应用业务逻辑的封装枢纽

虽然 `@Component` 覆盖一切，但 `@Service` 是专门为承载**核心业务逻辑**的类打造的特化注解。服务层负责协调多次仓储调用、执行领域校验规则，并与其他微服务进行上下游编排。在书店系统中，`BookService` 负责拉取图书库存数据并执行业务运算，随后将标准结果交付给控制器层：

```java
@Service
public class BookService implements IBookService {

    private final BookRepository bookRepository;
    private final AuthorRepository authorRepository;
    private final BookMapper bookMapper;

    // 构造器注入协作组件
    @Override
    public List<BookResponse> findAll(int page, int size, String sortSpec) {
        Sort sortBy = parseSort(sortSpec);
        PageRequest pageRequest = PageRequest.of(page, size, sortBy);
        // 得益于 @EntityGraph 或明确的查询契约，此处一次性抓取图书及其作者
        Page<Book> books = bookRepository.findAll(pageRequest);
        return books.getContent()
                .stream()
                .map(bookMapper::toResponse)
                .collect(Collectors.toList());
    }
}
```

使用 `@Service` 极大地增强了代码的自解释性：任何阅读代码的开发者都能一目了然该类是领域逻辑的核心阵地。此外，这允许 Spring（以及 AOP 切面框架）针对服务层应用事务管理（`@Transactional`）等企业级横切关注点。

> **提示**
>
> **关于 @Service 的核心工程纪律**：保持服务类无状态（Stateless）且职责专注；坚决不在 Service 中手写拼接 SQL，一切底层交互统一委派给 Repository。

#### @Controller 与 @RestController：应用的外部流量入口

控制器是微服务面向外部客户端（如 Angular 前端、移动端或外部第三方服务）的门面。它们负责暴露 REST 端点、解析并校验请求报文，并封装规范的响应实体。`@Controller` 是传统 Spring MVC 的表现层注解，通常用于配合 JSP 或 Thymeleaf 渲染 HTML 视图模板；而 `@RestController` 则是一个组合便利注解，它内部由 `@Controller` 与 `@ResponseBody` 复合而成，是当今微服务暴露标准 JSON RESTful API 的绝对首选：

```java
@RestController
@RequestMapping("/api/books")
public class BookController {

    private final BookService bookService;

    public BookController(BookService bookService) {
        this.bookService = bookService;
    }

    @GetMapping
    public ResponseEntity<List<BookResponse>> getAllBooks(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String sort) {
        List<BookResponse> books = bookService.findAll(page, size, sort);
        return ResponseEntity.ok(books);
    }
}
```

在上述实现中，Controller 将具体的检索与组装逻辑全权委派给 `BookService`，Service 层再进一步与底层仓储协作。这种分层模式彻底隔离了关注点，使 Controller 层专注于网络路由、入参反序列化与 HTTP 状态码的编排，具备极高的可测性。

> **提示**
>
> 践行“Thin Controller（轻量薄控制器）”设计哲学：严禁在 Controller 中编写繁复的业务分支判断与持久化代码，将繁重逻辑下沉至 Service。

#### @Configuration 与 @Bean：显式声明基础设施配置

尽管 Spring Boot 的自动化装配机制极其强大，但在引入第三方类库、定制复杂对象映射器或配置跨微服务基础设施组件时，显式定义 Bean 依然不可或缺。

`@Configuration` 标识一个类为 Bean 声明源；而标注在方法上的 `@Bean` 注解则通知 Spring：该方法返回的对象应被纳入 IoC 容器作为单例 Bean 进行托管。典型的应用场景包括注册 HTTP 客户端、全局时钟、加密工具或分布式缓存管理器：

```java
@Configuration
public class AppConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
```

通过这种机制，Spring 能够在整个微服务生命周期中单例复用这一组件，而无需开发者在各个业务类中手动 `new Clock()`。

> **提示**
>
> 将横切基础设施组件集中在此管理。第三方类库的实例或复杂的定制化初始化逻辑，一律优先通过 `@Bean` 声明。

在清晰掌握了各类构造型注解与配置注解的语义后，下一个核心课题随之而来：“这些孤立的 Bean 在运行时究竟如何紧密咬合？”掌握组件的声明方式仅仅是故事的前半部分，后半部分的关键在于**依赖如何在各层之间显式、安全且具备高可测性地流转**。

### 依赖注入（Dependency Injection, DI）

当 Bean 注册就绪后，它们必须协同作战。Spring 的**依赖注入（DI）**机制能够自动化完成 Bean 之间的组装流转。DI 是一种成熟的软件设计哲学，对象不再自行在内部创建其所依赖的协作者，而是从外部环境被动接收依赖。在 Spring 中，IoC 容器在运行时全权负责各层 Bean 的实例化、依赖解析与精准注入。这一模式让代码从繁杂的生命周期管理中彻底解脱，大幅提升了系统的可维护性与测试敏捷度。

#### 为什么 DI 至关重要？

在真实工程实践中，依赖注入为系统架构带来了以下决定性优势：
- **松散耦合（Loose coupling）**：高层组件仅依赖抽象契约，与协作者的具体实例化细节完全解耦；
- **极高的可测性（Easier testing）**：在单元测试中，可以轻而易举地使用 Mockito 对外部依赖进行打桩替代，无需拉起重型数据库；
- **集中化治理（Centralized configuration）**：Bean 的作用域范围（Scope）、生命周期回调与配置属性全部收敛在容器统一管控。

#### 主流依赖注入范式剖析

在编写具体代码之前，我们需要审视 Spring 支持的几种注入方式。不同注入方式在代码清晰度、不可变性与测试便利性上存在显著差异。

#### 构造器注入（强烈推荐的标准范式）

**构造器注入（Constructor Injection）**被公认为现代 Spring 工程落地的黄金标准。通过在类的构造函数中显式要求全部必需依赖，你的组件在设计上就具备了高度的显式性与健壮性。它不仅消除了运行时意外漏注依赖引发空指针的隐患，更天然支持将依赖字段声明为 `private final`，保障了对象在并发运行时的不可变性（Immutability）：

```java
@Service
public class BookService {

    private final BookRepository bookRepository;

    public BookService(BookRepository bookRepository) {
        this.bookRepository = bookRepository;
    }
}
```

#### Setter 方法注入

构造器注入适用于强制必需的依赖项，但在某些极少数场景下，部分依赖属于纯粹的可选项，或者需要在对象创建完毕后动态替换。此时**Setter 注入（Setter Injection）**提供了灵活的晚绑定机制：

```java
@Service
public class BookService {

    private BookRepository bookRepository;

    @Autowired
    public void setBookRepository(BookRepository bookRepository) {
        this.bookRepository = bookRepository;
    }
}
```

#### 属性字段注入（Field Injection，生产应尽量避免）

**字段注入**是形式上最为简短的注入方式——只需在类私有字段上追加一行 `@Autowired`，Spring 便会通过反射暴力注入。然而，这种语法上的偷懒在工业界被普遍视为架构坏味道。它不仅破坏了类的封装性，使得在没有 Spring 容器介入的纯单元测试环境中极难直接初始化该类，更掩盖了单个类可能存在的“上帝类（God Class）”过度耦合隐患：

```java
@Service
public class BookService {

    @Autowired
    private BookRepository bookRepository;
}
```

> **注意**
>
> **工程最佳实践**：字段注入虽然编写省事，但严重损害了代码的自解释性与单元测试体验；生产代码一律推行**构造器注入**（整洁、不可变、极易测试）；Setter 注入仅用于极少数非核心可选依赖。

在依赖注入机制打通后，我们的 Java 类各司其职，专注实现自身的核心关注点。这为我们迈向下一层级奠定了坚实基础：**深入业务领域逻辑与异常感知工作流**。

## 业务领域逻辑与异常感知工作流实战

有了统一且集中的全局异常处理防护网后，我们便能从容构建出遵循领域通用语言、且在异常分支下具备清晰意图的 Service 层。在本节中，我们将首先确立标准的服务层契约边界，随后实现严谨的业务规则（包括超越简单 DTO 语法层面的深层语义校验），并确保在遇到非法状态时抛出准确的领域异常，使对外 API 始终返回语义严密的标准化 HTTP 状态码。

### 服务契约接口定义（面向 Web 表现层的端口）

**业务服务接口（Service Interface）**是 Web 表现层所依赖的核心防腐边界。它完全以业务用例的视角声明操作签名，并向表现层交付结构稳定的传输模型：

```java
public interface IBookService {
    List<BookResponse> findAll(int page, int size, String sort);
    BookResponse findOne(Long id);
    BookResponse create(BookRequest req);
    BookResponse replace(Long id, BookRequest req);
    BookResponse patch(Long id, BookRequest req);
    void delete(Long id);
}
```

Controller 仅面向 `IBookService` 契约编程，严禁跨层直接渗透访问 Repository。统一返回 `BookResponse` 能够彻底杜绝内部持久化细节外泄。

### 服务层核心实现落地

在库存微服务中，`BookService` 负责编排仓储调用、执行领域规则校验，并借助 `BookMapper` 实现实体与 DTO 的流式互转。所有协作者统一经由构造器注入：

```java
@Service
public class BookService implements IBookService {

    private final BookRepository bookRepository;
    private final AuthorRepository authorRepository;
    private final BookMapper bookMapper;

    public BookService(BookRepository bookRepository,
                       AuthorRepository authorRepository,
                       BookMapper bookMapper) {
        this.bookRepository = bookRepository;
        this.authorRepository = authorRepository;
        this.bookMapper = bookMapper;
    }
}
```

下面我们将 `BookService` 的核心实现拆解为若干高内聚、易测试的业务用例分别阐述。

#### 只读查询用例（Queries）

只读查询方法必须保持纯粹的幂等性与无副作用特征，为客户端提供可预测、高可用的数据视图。当请求的目标资源不存在时，统一显式抛出 `ResourceNotFoundException`，以便全局处理器能够将其精确转换为标准的 HTTP 404 响应：

```java
@Override
public List<BookResponse> findAll(int page, int size, String sortSpec) {
    Sort sortBy = parseSort(sortSpec);
    PageRequest pageRequest = PageRequest.of(page, size, sortBy);

    Page<Book> books = bookRepository.findAll(pageRequest);
    return books.getContent()
            .stream()
            .map(bookMapper::toResponse)
            .collect(Collectors.toList());
}

@Override
public BookResponse findOne(Long id) {
    var book = bookRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Book " + id + " not found"));
    return bookMapper.toResponse(book);
}
```

在 `findAll` 中，我们解析前端传入的分页与动态排序参数，构造 `PageRequest` 委托仓储查询，并逐一将其转换为 `BookResponse` DTO。在 `findOne` 中，我们借助 `Optional.orElseThrow` 防御性地拦截空结果。

#### 创建图书业务命令（The create command）

`create` 方法负责向书店目录录入一本全新的图书，它必须同时满足业务语义规则与数据库参照完整性。

请注意该方法上的 `@Transactional` 注解：它确保了包含作者校验、实体映射以及数据保存的整个业务链路运行在一个原子性数据库事务中。一旦中途遭遇任何运行时异常，事务将自动回滚，杜绝脏数据残留：

```java
@Override
@Transactional
public BookResponse create(BookRequest req) {
    validateSemanticsForCreate(req);
    var author = resolveAuthorById(req.authorId());
    var toSave = bookMapper.toEntity(req, author);
    var saved = trySave(toSave);
    return bookMapper.toResponse(saved);
}
```

该方法的流转逻辑极为严谨：首先通过 `validateSemanticsForCreate` 执行非负价格与 ISBN 唯一性前置校验；随后通过 `resolveAuthorById` 解析归属作者；接着经由 `BookMapper` 生成待持久化的实体对象；最后调用 `trySave` 完成事务性落盘并返回 DTO。

> **AI 提示词范例**
> `// Add a create book method with semantic validation and mapping`

#### 完整替换图书业务命令（The replace command）

`replace` 方法对应 HTTP PUT 语义，用于对既有图书记录执行全量状态覆盖：

```java
@Override
@Transactional
public BookResponse replace(Long id, BookRequest req) {
    validateSemanticsForReplace(req);
    var existing = bookRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Book " + id + " not found"));
    var author = resolveAuthorById(req.authorId());
    bookMapper.overwrite(existing, req, author);
    var saved = trySave(existing);
    return bookMapper.toResponse(saved);
}
```

若目标图书不存在，立即抛出 `ResourceNotFoundException`（映射 404）；若存在，则校验新入参语义，解析最新作者信息，并利用 `bookMapper.overwrite` 完全重写既有实体的各个属性字段，保障更新操作的原子性。

> **AI 提示词范例**
> `// Add a replace method that overwrites book fields and throws 404 if missing`

#### 局部更新图书业务命令（The patch command）

`patch` 方法对应 HTTP PATCH 语义，允许调用方仅传输发生变动的字段，对目标实体执行差量增量合并：

```java
@Override
@Transactional
public BookResponse patch(Long id, BookRequest req) {
    var existing = bookRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Book " + id + " not found"));
    validateSemanticsForPatch(req, existing);
    Author author = null;
    if (req.authorId() != null) {
        author = resolveAuthorById(req.authorId());
    }
    bookMapper.patch(existing, req, author);
    var saved = trySave(existing);
    return bookMapper.toResponse(saved);
}
```

需要说明的是，本工程目前采纳了业界最务实的轻量级 PATCH 约定：未传递的 null 属性被视为“保持现状”，而非“清空为 null”。

> **AI 提示词范例**
> `// Add a patch method that updates only the provided book fields`

#### 安全删除图书业务命令（The delete command）

`delete` 方法负责在物理或逻辑层面移除一本图书。在 REST 规范中，删除操作应具备幂等性：

```java
@Override
@Transactional
public void delete(Long id) {
    if (!bookRepository.existsById(id)) {
        throw new ResourceNotFoundException("Book " + id + " not found");
    }
    bookRepository.deleteById(id);
}
```

首先调用 `existsById(id)` 进行存在性断言，若不存在则显式反馈 404；若确认存在则执行删除，成功后上层将返回 `204 No Content` 报文。

> **AI 提示词范例**
> `// Add a delete method that throws 404 if the book does not exist`

#### 横切关注点与私有辅助方法

为了避免主干业务方法陷入杂乱无章的技术细节中，我们将排序解析、关联作者加载以及持久化异常边界抽取为私有辅助工具方法：

```java
private Sort parseSort(String sortSpec) {
    if (sortSpec == null || sortSpec.isBlank()) {
        return Sort.by("title").ascending();
    }
    var parts = sortSpec.split(",", 2);
    var field = parts[0].trim();
    var dir = parts.length > 1 ? parts[1].trim().toLowerCase() : "asc";
    return "desc".equals(dir) ? Sort.by(field).descending() : Sort.by(field).ascending();
}

private Author resolveAuthorById(Long id) {
    if (id == null) {
        throw new DomainRuleViolationException("Author ID is required");
    }
    return authorRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Author " + id + " not found"));
}

private Book trySave(Book entity) {
    try {
        return bookRepository.save(entity);
    } catch (DataIntegrityViolationException e) {
        throw e;
    }
}
```

- `parseSort`：将类似 `price,desc` 的文本参数优雅转换为 Spring Data `Sort` 领域模型，并在缺省时智能回退到以书名正序排列的默认值；
- `resolveAuthorById`：高内聚收敛作者校验与抓取逻辑，拦截作者 ID 为空或不存在的非法情形；
- `trySave`：为未来统一追加监控埋点、事务重试或底层约束异常转换预留了唯一的切入屏障。

#### 领域语义校验逻辑（Semantic validation）

虽然 DTO 层面的注解能够拦截空字符串、格式错误的 ISBN 等语法级缺陷，但更为深层的**业务规则完整性**必须由 Service 层把控：例如校验商品单价不得小于 0，以及校验当前 ISBN 是否在全库中发生冲突重复：

```java
private void validateSemanticsForCreate(BookRequest req) {
    if (req.authorId() == null) {
        throw new DomainRuleViolationException("Author ID is required");
    }
    if (req.price().compareTo(BigDecimal.ZERO) < 0) {
        throw new DomainRuleViolationException("Price cannot be negative");
    }
    // 主动探测唯一性，提供语义清晰的业务异常
    if (req.isbn() != null && bookRepository.existsByIsbnIgnoreCase(req.isbn())) {
        throw new DomainRuleViolationException("ISBN must be unique");
    }
}

private void validateSemanticsForReplace(BookRequest req) {
    if (req.authorId() == null) {
        throw new DomainRuleViolationException("Author ID is required");
    }
    if (req.price().compareTo(BigDecimal.ZERO) < 0) {
        throw new DomainRuleViolationException("Price cannot be negative");
    }
}

private void validateSemanticsForPatch(BookRequest req, Book existing) {
    if (req.price() != null && req.price().compareTo(BigDecimal.ZERO) < 0) {
        throw new DomainRuleViolationException("Price cannot be negative");
    }
    // 仅当 ISBN 被显式变更时才触发唯一性校验
    if (req.isbn() != null && !req.isbn().equalsIgnoreCase(existing.getIsbn())) {
        if (bookRepository.existsByIsbnIgnoreCase(req.isbn())) {
            throw new DomainRuleViolationException("ISBN must be unique");
        }
    }
}
```

一旦违反业务规则，统一抛出 `DomainRuleViolationException`，全局处理器将在边界处将其映射为标准的 `422 Unprocessable Entity` 错误信封，让调用方能获得极其明确的业务反馈。

### 业务服务层单元测试实战

服务层测试能够让我们在完全脱离真实数据库与 HTTP 容器的前提下，以毫秒级的极速对业务逻辑进行全覆盖验证。我们利用 Mockito 模拟 Repository 与 Mapper 的行为，深度审视 `BookService`：

```java
@ExtendWith(MockitoExtension.class)
class BookServiceTest {

    @Mock private BookRepository bookRepository;
    @Mock private AuthorRepository authorRepository;
    @Mock private BookMapper bookMapper;

    @InjectMocks private BookService bookService;

    private Author author;
    private Book book;
    private BookRequest bookRequest;
    private BookResponse bookResponse;
    private AuthorResponse authorResponse;

    @BeforeEach
    void setUp() {
        author = Author.builder().id(1L).name("Ahmad Gohar").build();
        authorResponse = new AuthorResponse(1L, "Ahmad Gohar", null, null);
        book = Book.builder()
                .id(1L)
                .title("Spring Boot and Angular 2E")
                .isbn("1234567890")
                .author(author)
                .price(BigDecimal.TEN)
                .build();
        bookRequest = new BookRequest("Spring Boot and Angular 2E",
                "1234567890", 1L, BigDecimal.TEN, null, null, null, null, null);
        bookResponse = new BookResponse(1L, "Spring Boot and Angular 2E",
                "1234567890", authorResponse, BigDecimal.TEN, null, null, null, null, null);
    }

    @Test
    void findAll_shouldReturnBookResponses() {
        Page<Book> page = new PageImpl<>(List.of(book));
        when(bookRepository.findAll(any(PageRequest.class))).thenReturn(page);
        when(bookMapper.toResponse(book)).thenReturn(bookResponse);

        List<BookResponse> result = bookService.findAll(0, 10, "title,asc");
        assertEquals(1, result.size());
        assertEquals(bookResponse, result.get(0));
    }

    @Test
    void findOne_shouldThrowResourceNotFoundException() {
        when(bookRepository.findById(2L)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> bookService.findOne(2L));
    }

    @Test
    void create_shouldSaveAndReturnBookResponse() {
        when(authorRepository.findById(1L)).thenReturn(Optional.of(author));
        when(bookMapper.toEntity(bookRequest, author)).thenReturn(book);
        when(bookRepository.save(book)).thenReturn(book);
        when(bookMapper.toResponse(book)).thenReturn(bookResponse);

        BookResponse result = bookService.create(bookRequest);
        assertEquals(bookResponse, result);
    }

    @Test
    void create_shouldThrowDomainRuleViolationExceptionForNegativePrice() {
        BookRequest badRequest = new BookRequest("Spring Boot and Angular 2E",
                "1234567890", 1L, BigDecimal.valueOf(-1), null, null, null, null, null);
        assertThrows(DomainRuleViolationException.class, () -> bookService.create(badRequest));
    }

    @Test
    void replace_shouldUpdateAndReturnBookResponse() {
        when(bookRepository.findById(1L)).thenReturn(Optional.of(book));
        when(authorRepository.findById(1L)).thenReturn(Optional.of(author));
        doNothing().when(bookMapper).overwrite(book, bookRequest, author);
        when(bookRepository.save(book)).thenReturn(book);
        when(bookMapper.toResponse(book)).thenReturn(bookResponse);

        BookResponse result = bookService.replace(1L, bookRequest);
        assertEquals(bookResponse, result);
    }

    @Test
    void delete_shouldRemoveBook() {
        when(bookRepository.existsById(1L)).thenReturn(true);
        doNothing().when(bookRepository).deleteById(1L);

        assertDoesNotThrow(() -> bookService.delete(1L));
        verify(bookRepository).deleteById(1L);
    }

    @Test
    void delete_shouldThrowResourceNotFoundException() {
        when(bookRepository.existsById(2L)).thenReturn(false);
        assertThrows(ResourceNotFoundException.class, () -> bookService.delete(2L));
    }
}
```

测试矩阵覆盖了常规路径与异常分支，确保后续任何针对实体结构或数据库驱动的重构都能得到即时回归保护。

服务层构建完毕后，我们便拥有了一套封装了业务规则、事务完备且具备高度弹性的领域内核。接下来，我们将正式进入面向外部客户端的开放门户——**使用 Spring Boot 设计现代 RESTful API**。

## 使用 Spring Boot 精心设计 RESTful API

在编写表现层控制器之前，我们首先需要从外部调用方的视角审视 API 的设计哲学。在微服务架构中，RESTful API 是应用对外交互的门面。遵循业内广泛认可的 HTTP 动词语义、精准的状态码反馈以及标准化的错误信封，能够让前后端联调效率成倍提升。

我们以库存微服务（*inventory-ms*，包路径 `com.packt.bookstore.inventory`）为核心实操场景，全面展开控制器实战。

### REST 核心基石（HTTP 动词与状态码）

如果将你的 API 比作一间商铺，那么 HTTP 协议就是推开商铺的大门把手。严格遵循成熟的 HTTP 方法规范能够让你的 API 无需多余的额外文档解释便能被全球开发者直观理解。

#### 核心 HTTP 动词规范

- **GET**：只读检索资源，具备**安全性**（不改变服务器状态）与**幂等性**（相同请求执行任意次结果恒定）；
  - 例如：`GET /api/v1/books` 获取图书列表；`GET /api/v1/books/42` 获取特定图书详情。
- **POST**：用于创建新资源，**非幂等**（重复提交将产生多次创建副作用）；
  - 例如：`POST /api/v1/books` 提交图书载荷，成功创建后统一返回 `201 Created` 及指向新资源的 Location 头。
- **PUT**：用于对既有资源执行**全量状态覆盖更新**，具备**幂等性**；
  - 例如：`PUT /api/v1/books/42` 提供完整的图书属性替换既有状态。
- **PATCH**：用于对既有资源执行**局部差量字段更新**，仅变更载荷中显式携带的字段属性；
  - 例如：`PATCH /api/v1/books/42` 仅传输 `{"title": "Clean Coder - Updated"}`。
- **DELETE**：用于销毁指定资源，具备**幂等性**；
  - 例如：`DELETE /api/v1/books/42` 移除图书，成功时返回 `204 No Content` 报文。

#### 常见 HTTP 状态码意图映射

状态码是服务向客户端传递处理结果的标准化信号灯：
- `200 OK`：请求已成功处理，并在响应体中携带预期数据载荷；
- `201 Created`：全新资源已被成功创建并落盘；
- `204 No Content`：请求已被成功处理，但响应体故意不返回任何数据（常见于成功的 DELETE 或部分 UPDATE）；
- `400 Bad Request`：请求报文存在语法错误或未能通过前置结构校验（如必填项缺失、格式非法）；
- `401 Unauthorized`：请求尚未通过身份鉴权；
- `403 Forbidden`：调用方已通过身份认证，但其所属角色权限被系统判定无权执行当前操作；
- `404 Not Found`：客户端请求的目标资源在系统中根本不存在；
- `409 Conflict`：当前写操作与服务器上资源的现有状态产生致命冲突（例如尝试录入一个已被占用的全局唯一 ISBN）；
- `422 Unprocessable Entity`：请求数据格式完备，但未能通过业务领域的深度语义校验（如提交了负数价格）；
- `500 Internal Server Error`：服务端内部发生未预料到的严重运行时异常。

#### DTO 设计与 Bean Validation 前置防御

在请求跨越网络进入业务层之前，必须对其进行严格的结构化参数校验。

Spring Boot 默认未将校验依赖打包在基础 Web Starter 中，我们需要在 `pom.xml` 中显式引入校验起步依赖：

```xml
<!-- Spring Boot 参数校验起步依赖 -->
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-validation</artifactId>
</dependency>
```

我们通过将输入契约（`BookRequest`）与输出契约（`BookResponse`）解耦定义为 Java Record，并声明 Jakarta 校验约束：

```java
public record BookRequest(
    @NotBlank(message = "Title is required")
    String title,

    @NotBlank(message = "ISBN is required")
    @Pattern(regexp = "^[0-9-]{10,17}$", message = "ISBN must be 10-17 chars/dashes")
    String isbn,

    @NotNull(message = "Author ID is required")
    Long authorId,

    @NotNull(message = "Price is required")
    @PositiveOrZero(message = "Price must be >= 0")
    BigDecimal price,

    String genre,
    LocalDate published,
    String description,
    Integer pageCount,
    String coverImageUrl
) {}
```

- `@NotBlank`：约束字符串字段既不能为 null，也不能为空字符串或纯空白符；
- `@Pattern`：利用严密的正则表达式锁定国际标准书号 ISBN 的格式；
- `@PositiveOrZero`：确保商品价格必须大于或等于零。

对应的输出契约模型保持精简与纯粹，无需掺杂任何校验注解：

```java
public record BookResponse(
    Long id,
    String title,
    String isbn,
    AuthorResponse author,
    BigDecimal price,
    String genre,
    LocalDate published,
    String description,
    Integer pageCount,
    String coverImageUrl
) {}
```

在 Controller 方法形参前追加 `@Valid` 即可自动激活拦截校验：

```java
@PostMapping
public ResponseEntity<BookResponse> createBook(@Valid @RequestBody BookRequest request) {
    BookResponse created = bookService.create(request);
    return ResponseEntity.status(HttpStatus.CREATED).body(created);
}
```

一旦请求参数违反任何约束规则，Spring 会自动打断方法执行并抛出 `MethodArgumentNotValidException`，移交全局异常处理器拦截。

### RESTful API 控制器实战落地

在 `src/main/resources/application.yml` 中统一指定微服务名称、独立端口及应用上下文路径（Context Path）：

```yaml
spring:
  application:
    name: inventory-service
server:
  port: 8081
  servlet:
    context-path: /inventory
```

这意味着库存微服务的所有接口均挂载在 `http://localhost:8081/inventory` 前缀之下。

下面呈现 `BookController` 的完整端点落地代码：

```java
@RestController
@RequestMapping("/api/books")
public class BookController {

    private final BookService bookService;

    public BookController(BookService bookService) {
        this.bookService = bookService;
    }

    // 1. 获取分页图书列表（支持动态排序）
    @GetMapping
    public ResponseEntity<List<BookResponse>> getAllBooks(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String sort) {
        List<BookResponse> books = bookService.findAll(page, size, sort);
        return ResponseEntity.ok(books);
    }

    // 2. 根据主键获取单本图书详情
    @GetMapping("/{id}")
    public ResponseEntity<BookResponse> getBookById(@PathVariable Long id) {
        BookResponse book = bookService.findOne(id);
        return ResponseEntity.ok(book);
    }

    // 3. 创建全新图书
    @PostMapping
    public ResponseEntity<BookResponse> createBook(@Valid @RequestBody BookRequest request) {
        BookResponse created = bookService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    // 4. 全量替换图书状态 (PUT)
    @PutMapping("/{id}")
    public ResponseEntity<BookResponse> replaceBook(@PathVariable Long id,
                                                   @Valid @RequestBody BookRequest request) {
        BookResponse updated = bookService.replace(id, request);
        return ResponseEntity.ok(updated);
    }

    // 5. 局部增量修改图书 (PATCH)
    @PatchMapping("/{id}")
    public ResponseEntity<BookResponse> updateBook(@PathVariable Long id,
                                                   @RequestBody BookRequest request) {
        BookResponse patched = bookService.patch(id, request);
        return ResponseEntity.ok(patched);
    }

    // 6. 销毁指定图书 (DELETE)
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteBook(@PathVariable Long id) {
        bookService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
```

### 企业级 API 版本控制策略

API 绝非一旦发布便一成不变的化石，它们是随着业务持续演进的动态契约。如果没有清晰的版本控制策略，任何新字段的调整或破坏性改动都极易造成客户端大面积崩溃。业界主流的 API 版本演进策略包括：

#### URI 路径版本控制（最为直观、推荐首选）

将版本号直接固化在 URL 路径中（例如 `/inventory/api/v1/books` 与 `/inventory/api/v2/books`）：

![图 5.2：API 版本控制策略 —— URI 路径版本控制](/media/posts/spring-boot-angular/img-08960.png)

*图 5.2：API 版本控制策略 —— URI 路径版本控制*

```java
@RestController
@RequestMapping("/api/v1/books")
public class BookControllerV1 {
    @GetMapping("/{id}")
    public ResponseEntity<String> getBook(@PathVariable Long id) {
        return ResponseEntity.ok("Book v1 - ID: " + id);
    }
}
```

这种方案最大的优势在于**所见即所得**：对浏览器、cURL、Postman 及 CDN 缓存极度友好，排障极其透明，是绝大部分开放平台（如 GitHub、Stripe）的首选范式。

#### HTTP 请求头版本控制（Header Versioning）

保持 URL 路径永久不变（如 `/api/books/{id}`），但在 HTTP 请求头中传入专门的版本标识（例如 `X-API-VERSION: 2`）：

![图 5.3：API 版本控制策略 —— HTTP 请求头版本控制](/media/posts/spring-boot-angular/img-08961.png)

*图 5.3：API 版本控制策略 —— HTTP 请求头版本控制*

```java
@RestController
@RequestMapping("/api/books")
public class BookControllerHeader {
    @GetMapping(value = "/{id}", headers = "X-API-VERSION=2")
    public ResponseEntity<String> getBookV2(@PathVariable Long id) {
        return ResponseEntity.ok("Book v2 - ID: " + id);
    }
}
```

该方案保持了 URI 的绝对干净，但调试时必须依赖开发者工具显式注入 Header，且对 CDN 边缘缓存的配置要求较高。

#### 媒体类型内容协商版本控制（Content Negotiation / MIME Type）

利用标准 HTTP `Accept` 报头传递期望的数据版本与形态（例如 `Accept: application/vnd.bookstore.v3+json`）：

![图 5.4：API 版本控制策略 —— 媒体类型（MIME Type）内容协商版本控制](/media/posts/spring-boot-angular/img-08962.png)

*图 5.4：API 版本控制策略 —— 媒体类型（MIME Type）内容协商版本控制*

```java
@RestController
@RequestMapping("/api/books")
public class BookControllerContentNegotiation {
    @GetMapping(value = "/{id}", produces = "application/vnd.bookstore.v3+json")
    public ResponseEntity<String> getBookV3(@PathVariable Long id) {
        return ResponseEntity.ok("Book v3 - ID: " + id);
    }
}
```

这种方案严格遵循 REST 原生哲学，但调试与联调门槛最高，要求客户端具备严密的契约治理意识。

版本控制策略综合选型对比：

| 版本策略 | 核心优势 | 潜在代价 | 典型应用范例 |
| :--- | :--- | :--- | :--- |
| **URI 路径版本控制** | 直观清晰、极易调试、缓存极其友好 | 版本过多时路由映射可能膨胀 | GitHub、Google Cloud、Stripe API |
| **Header 请求头版本控制** | 保持 URL 路径整洁永恒 | 隐蔽性强、依赖特定网关鉴权过滤 | Microsoft Graph API、企业内网微服务 |
| **媒体类型内容协商** | 最符合纯粹 REST 哲学 | 调试成本高、对客户端技术素养要求严格 | 复杂企业级 SOA、高阶开放标准 |

*表 5.1：API 版本控制策略全方位综合比对*

对于绝大部分项目，**URI 路径版本控制**在研发体验与工程规范之间取得了最佳平衡。

### 全局统一的健壮异常处理体系

在分布式系统中，异常不可避免。专业级微服务与劣质系统的核心分水岭，正在于**面对异常时的反馈是否规范、严密且透明**。在每个 Controller 方法中层层包裹 `try/catch` 是极其糟糕的反模式。

Spring Boot 提供了 `@RestControllerAdvice` 机制，允许我们在一个切面中集中拦截全系统的异常，并统一格式化为符合 **RFC 9457（Problem Details for HTTP APIs）** 国际标准的标准化错误信封。

#### 声明领域专属业务异常

```java
// 针对资源缺失场景
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}

// 针对领域规则违反场景
public class DomainRuleViolationException extends RuntimeException {
    public DomainRuleViolationException(String message) {
        super(message);
    }
}
```

#### 定义标准化错误响应信封（ApiError Record）

```java
public record ApiError(
    String type,
    String title,
    int status,
    String detail,
    String instance,
    Instant timestamp
) {
    private static final String ERROR_TYPE_BASE = "https://api.bookstore.com/errors/";

    public static ApiError notFound(int status, String title, String detail, String instance) {
        return new ApiError(ERROR_TYPE_BASE + "not-found", title, status, detail, instance, Instant.now());
    }

    public static ApiError badRequest(int status, String title, String detail, String instance) {
        return new ApiError(ERROR_TYPE_BASE + "bad-request", title, status, detail, instance, Instant.now());
    }

    public static ApiError conflict(int status, String title, String detail, String instance) {
        return new ApiError(ERROR_TYPE_BASE + "conflict", title, status, detail, instance, Instant.now());
    }

    public static ApiError unprocessable(int status, String title, String detail, String instance) {
        return new ApiError(ERROR_TYPE_BASE + "unprocessable-entity", title, status, detail, instance, Instant.now());
    }
}
```

#### 集中式全局异常处理器（GlobalExceptionHandler）

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiError> notFound(ResourceNotFoundException ex, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiError.notFound(404, "Not Found", ex.getMessage(), req.getRequestURI()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> badRequest(MethodArgumentNotValidException ex, HttpServletRequest req) {
        String detail = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .findFirst()
                .orElse("Validation failed");
        return ResponseEntity.badRequest()
                .body(ApiError.badRequest(400, "Bad Request", detail, req.getRequestURI()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiError> conflict(DataIntegrityViolationException ex, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiError.conflict(409, "Conflict", "Data integrity constraint violation", req.getRequestURI()));
    }

    @ExceptionHandler(DomainRuleViolationException.class)
    public ResponseEntity<ApiError> unprocessable(DomainRuleViolationException ex, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(ApiError.unprocessable(422, "Unprocessable Entity", ex.getMessage(), req.getRequestURI()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> fallback(Exception ex, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiError("https://api.bookstore.com/errors/internal", "Internal Server Error",
                        500, "An unexpected error occurred", req.getRequestURI(), Instant.now()));
    }
}
```

异常到 HTTP 响应的映射矩阵：

| 异常类型 | HTTP 状态码 | REST 语境含义 | 书店实战典型触发场景 |
| :--- | :--- | :--- | :--- |
| `ResourceNotFoundException` | **404 Not Found** | 客户端定位的特定资源在底层不存在 | 查询 ID 为 99 的不存在图书 |
| `DomainRuleViolationException` | **422 Unprocessable Entity** | 数据格式合规，但深度违反业务规则 | 商品单价填入负数或作者 ID 缺失 |
| `DataIntegrityViolationException` | **409 Conflict** | 触发底层数据库唯一索引约束冲突 | 录入已在库中存在的唯一 ISBN |
| `MethodArgumentNotValidException` | **400 Bad Request** | DTO 未能通过前置参数注解校验 | 书名未填或 ISBN 格式正则不符 |
| `Exception` 通用兜底 | **500 Internal Server Error** | 未受管的底层严重故障 | 空指针或未捕获的运行时错误 |

*表 5.2：微服务分层异常到标准 HTTP 状态码的映射矩阵*

### RESTful API 控制器切片测试实战

通过 `@WebMvcTest` 与 `MockMvc`，我们能够在完全不拉起底层数据库、不启动实际 Web 端口的毫秒级时延下，精准校验表现层的网络协议契约。

![图 5.5：API 参数校验与异常处理流转链路全貌](/media/posts/spring-boot-angular/img-08963.png)

*图 5.5：API 参数校验与异常处理流转链路全貌*

```java
@WebMvcTest(controllers = BookController.class)
@ContextConfiguration(classes = {InventoryMsApplication.class, ValidationAutoConfiguration.class})
public class BookControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockitoBean private JpaMetamodelMappingContext jpaMetamodelMappingContext;
    @MockitoBean private BookService bookService;

    private BookRequest bookRequest;
    private BookResponse bookResponse;

    @BeforeEach
    void setUp() {
        var authorResponse = new AuthorResponse(1L, "Ahmad Gohar", null, null);
        bookRequest = new BookRequest("Spring Boot and Angular 2E", "1234567890",
                1L, BigDecimal.valueOf(44.99), "Tech", LocalDate.now(), "Desc", 400, "http://cover.jpg");
        bookResponse = new BookResponse(1L, "Spring Boot and Angular 2E", "1234567890",
                authorResponse, BigDecimal.valueOf(44.99), "Tech", LocalDate.now(), "Desc", 400, "http://cover.jpg");
    }

    @Test
    void getAllBooks_shouldReturnBooks() throws Exception {
        when(bookService.findAll(anyInt(), anyInt(), anyString())).thenReturn(List.of(bookResponse));

        mockMvc.perform(get("/api/books")
                .param("page", "0")
                .param("size", "10")
                .param("sort", "title,asc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0].title").value("Spring Boot and Angular 2E"))
                .andExpect(jsonPath("$[0].isbn").value("1234567890"))
                .andExpect(jsonPath("$[0].author.name").value("Ahmad Gohar"));
    }

    @Test
    void getBookById_shouldReturnBook() throws Exception {
        when(bookService.findOne(1L)).thenReturn(bookResponse);

        mockMvc.perform(get("/api/books/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1L))
                .andExpect(jsonPath("$.title").value("Spring Boot and Angular 2E"))
                .andExpect(jsonPath("$.price").value(44.99));
    }

    @Test
    void createBook_shouldReturnCreatedBook() throws Exception {
        when(bookService.create(any(BookRequest.class))).thenReturn(bookResponse);

        mockMvc.perform(post("/api/books")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(bookRequest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1L))
                .andExpect(jsonPath("$.title").value("Spring Boot and Angular 2E"));
    }

    @Test
    void replaceBook_shouldReturnUpdatedBook() throws Exception {
        when(bookService.replace(eq(1L), any(BookRequest.class))).thenReturn(bookResponse);

        mockMvc.perform(put("/api/books/1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(bookRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1L));
    }

    @Test
    void updateBook_shouldReturnPatchedBook() throws Exception {
        when(bookService.patch(eq(1L), any(BookRequest.class))).thenReturn(bookResponse);

        mockMvc.perform(patch("/api/books/1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(bookRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1L));
    }

    @Test
    void deleteBook_shouldReturnNoContent() throws Exception {
        doNothing().when(bookService).delete(1L);

        mockMvc.perform(delete("/api/books/1"))
                .andExpect(status().isNoContent());
    }

    @Test
    void createBook_withInvalidData_shouldReturnBadRequest() throws Exception {
        BookRequest invalidRequest = new BookRequest("", "1234567890",
                1L, BigDecimal.valueOf(44.99), null, null, null, null, null);

        mockMvc.perform(post("/api/books")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.detail").exists());
    }
}
```

这些契约测试构成了坚固的安全阀：确保对外暴露的路由清晰、参数绑定无误、JSON 字段序列化严谨，且业务状态码（200/201/204/400/404）分毫不差。

#### 服务与控制器设计实战避坑指南 (Do's & Don'ts)

| 推荐实践 (Do) | 应当避免 (Don't) |
| :--- | :--- |
| **保持控制器轻薄（Thin Controller）**：将业务逻辑全权委派给服务层 | 在 Controller 中编写冗长复杂的业务分支或直接操作持久层 |
| **将核心领域规则封装在服务层（@Service）** | 将业务校验零散混杂在 Repository 或 Mapper 中 |
| **使用不可变 DTO 作为对外 API 契约** | 将 JPA 持久化实体类直接序列化暴露给外部客户端 |
| **使用 @RestControllerAdvice 集中治理全局异常** | 在各个 Controller 内部层层手工包裹 try/catch 块 |
| **必需依赖项强制推行构造器注入（Constructor Injection）** | 在生产代码中盲目依赖反射式字段注入（@Autowired private ...） |
| **在 Service 核心业务方法上严密声明 @Transactional** | 将事务管控逻辑上浮混杂在表现层 Controller 中 |
| **为服务层与表现层分别构建严密的自动化单元测试** | 盲信人工手动测试，忽视自动化回归矩阵建设 |
| **严格遵循 RESTful 规范（动词、状态码与统一 URI）** | 闭门造车发明自制 HTTP 协议（如一律返回 200 配内部 code: 500） |
| **在服务层落地精细的业务语义防线** | 仅依赖底层数据库的硬性报错进行无谓被动兜底 |
| **推行严密的 API 版本化管控（URI Versioning）** | 随意做出破坏性接口变更，破坏上下游兼容性 |

*表 5.3：业务服务与表现层控制器设计黄金法则对照表*

## 本章小结（Summary）

在本章中，我们通过在持久化底座之上构建高内聚的业务服务层，并以标准化 RESTful API 形式对外暴露，让书店系统的库存微服务真正焕发了业务生机。我们系统盘点了 Spring 核心组件模型与构造型注解（`@Service`、`@Repository`、`@RestController` 等）的协同分工，明确了构造器注入在构建高可测、不可变架构中的核心价值。

在坚实的组件模型支撑下，我们打造了具备异常感知能力的业务服务层——它不仅能处理持久化交互，更能严密筑牢领域规则防线，优雅分流业务异常。接着，我们深入 REST API 实战，系统映射了 HTTP 动词与状态码，引入了基于 `@Valid` 的 DTO 前置防御校验，确立了以 URI 路径为核心的版本演进策略，并基于 RFC 9457 规范构建了全局统一的异常处理体系。最后，通过针对 Controller 与 Service 的全套切片测试矩阵，确保了接口契约的高可用性与可预测性。

至此，你已完全掌握了使用 Spring Boot 构建稳健、敏捷且工业级就绪的单个微服务的全套本领。

在接下来的第 6 章中，我们将从单个微服务的微观视角抽身出来，站在全局分布式架构的高度，深入探索 **Spring Cloud API Gateway（API 网关模式）**——学习如何在系统网络边缘集中接管动态路由、安全鉴权与限流熔断等核心横切关注点，确保分布式微服务集群在规模膨胀过程中依然紧密咬合、易于消费与治理。
