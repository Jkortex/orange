---
title: Spring Boot & Angular 全栈实战（四）：Spring Data 多范式持久化（PostgreSQL 与 MongoDB）
date: 2026-10-23T00:04:00Z
description: 结合关系型数据库 PostgreSQL 与 NoSQL 文档数据库 MongoDB，实战 Spring Data JPA 与 Spring Data MongoDB 的实体建模、Repository 设计与多范式持久化架构。
category: fullstack
column: spring-boot-angular
tags:
  - Spring Boot
  - Spring Data
  - PostgreSQL
  - MongoDB
  - 持久化
---

## 1. 架构选型与多范式持久化决策矩阵

| 架构维度 | PostgreSQL 17 (关系型 / Spring Data JPA) | MongoDB 8 (文档型 NoSQL / Spring Data Mongo) | 决策依据与架构考量 |
| :--- | :--- | :--- | :--- |
| **存储数据模型** | 表 (Tables)、行 (Rows)、外键关联 | 集合 (Collections)、BSON 嵌套文档 (Documents) | 库存强关联结构 vs 用户画像深层嵌套 |
| **Schema 规范性** | 强 Schema，字段变更需 Flyway/DDL 迁移版本化 | 动态模式（Schema-less），按需灵活扩展 | 用户配置与偏好频繁演进无需锁表变更 |
| **事务一致性** | 跨表 ACID 强事务、行级锁并发控制 | 单文档内原子更新，多文档分布式事务成本高 | 库存扣减要求绝对一致；用户画像单文档内高内聚 |
| **关联与查询** | SQL / JPQL，支持多表 JOIN 与 `JOIN FETCH` | 点路径嵌套穿透，避免重型 `$lookup` 聚合 | JPA 规约规范；MongoDB 读吞吐极佳（单文档免 JOIN） |
| **测试切片工具** | `@DataJpaTest`（配合 Testcontainers / PostgreSQL） | `@DataMongoTest`（配合 Testcontainers / Mongo） | 毫秒级持久层切片单元测试 |
| **微服务边界归属** | **库存微服务 (inventory-ms)** | **用户微服务 (user-ms)** | 严格践行 Database-per-Service 原则 |

## 2. 生产级高内聚多范式持久化代码范式

### 2.1 JPA 实体与 N+1 查询治理（`JOIN FETCH`）

```java
package com.packt.bookstore.inventory.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "books")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = false)
public class Book extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, unique = true)
    private String isbn;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Column(nullable = false)
    private int quantity;

    // 生产规范：显式声明 LAZY 懒加载，严禁使用默认 EAGER
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id", nullable = false)
    private Author author;

    private String genre;
    private LocalDate published;

    @Column(length = 2000)
    private String description;
}
```

```java
package com.packt.bookstore.inventory.repository;

import com.packt.bookstore.inventory.entity.Book;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface BookRepository extends JpaRepository<Book, Long> {

    // 关键优化：JOIN FETCH 强制单次 SQL 抓取关联实体，杜绝 1 + N 次查询
    @Query("SELECT b FROM Book b JOIN FETCH b.author")
    List<Book> findAllWithAuthors();
}
```

### 2.2 Specification 动态组合规约查询范式

```java
package com.packt.bookstore.inventory.repository.spec;

import com.packt.bookstore.inventory.entity.Book;
import org.springframework.data.jpa.domain.Specification;
import java.math.BigDecimal;

public final class BookSpecifications {

    private BookSpecifications() {}

    public static Specification<Book> hasTitleLike(String keyword) {
        return (root, query, cb) -> (keyword == null || keyword.isBlank())
            ? cb.conjunction()
            : cb.like(cb.lower(root.get("title")), "%" + keyword.toLowerCase() + "%");
    }

    public static Specification<Book> priceBetween(BigDecimal min, BigDecimal max) {
        return (root, query, cb) -> {
            if (min == null && max == null) return cb.conjunction();
            if (min != null && max != null) return cb.between(root.get("price"), min, max);
            if (min != null) return cb.greaterThanOrEqualTo(root.get("price"), min);
            return cb.lessThanOrEqualTo(root.get("price"), max);
        };
    }
}
```

### 2.3 MongoDB 内嵌文档与点路径查询范式

```java
package com.packt.bookstore.usermanagement.document;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "users")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    private String id; // 映射 MongoDB 底层 _id (ObjectId 字符串形式)

    @Indexed(unique = true)
    private String email;

    @Indexed(unique = true)
    private String username;

    private Profile profile;         // 内嵌实体：免 JOIN 单文档聚合
    private Preferences preferences; // 内嵌配置
}
```

```java
package com.packt.bookstore.usermanagement.repository;

import com.packt.bookstore.usermanagement.document.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface UserRepository extends MongoRepository<User, String> {

    // 点路径 (Dot notation) 穿透内嵌文档 JSON 字段
    @Query("{ 'preferences.language': ?0 }")
    List<User> findByLanguagePreference(String language);
}
```

## 3. 多范式微服务数据持久化拓扑流图

```text
┌────────────────────────────────────────────────────────┐
│           Bookstore 多范式数据持久化边界拓扑            │
└───────────────────────────┬────────────────────────────┘
                            │
       ┌────────────────────┴────────────────────┐
       ▼                                         ▼
[ 库存微服务: inventory-ms ]            [ 用户微服务: user-ms ]
├── 领域模型: 实体关联与强事务约束           ├── 领域模型: 嵌套文档与灵活 Schema
├── 框架引擎: Spring Data JPA + Hibernate  ├── 框架引擎: Spring Data MongoDB
├── 查询抽象: JPQL / Specification / ILIKE ├── 查询抽象: JSON Query / MongoTemplate
└── 持久边界: PostgreSQL 17 (5432)        └── 持久边界: MongoDB 8 (27017)
```

## 4. 持久层架构避坑清单 (Do's & Don'ts)

| 错误实践 (Don't) | 正确实践 (Do) |
| :--- | :--- |
| 在生产或预发环境开启 `spring.jpa.hibernate.ddl-auto: update`。 | 生产显式设为 `validate` 或 `none`，使用 Flyway/Liquibase 执行版本化迁移脚本。 |
| 开启 Open Session In View（`open-in-view: true`）隐式持有连接。 | 显式配置 `open-in-view: false`，强制懒加载与数据访问必须在 `@Transactional` 服务边界内完成。 |
| 在 JPA 实体多对一或一对多关系中使用默认的 `FetchType.EAGER`。 | 始终显式声明 `FetchType.LAZY`，并在需要关联列表的场景使用 `JOIN FETCH`。 |
| 跨微服务在应用层执行伪分布式跨库关联（Cross-service DB joins）。 | 严守 Database-per-Service 规则，跨微服务数据通过 API 聚合或消息总线领域事件交互。 |
| 在无索引支持的字段上高频执行模糊正则匹配或深度点路径扫描。 | 对常用过滤字段（如 `email`, `username`, `isbn`）声明唯一或组合索引。 |

<!-- split -->

在上一章中，我们探索了现代软件开发者如何利用类似 GitHub Copilot 这样的生成式 AI 工具实现研发效能跃升。你已经看到这些工具如何协助快速生成 Spring 控制器骨架、智能推导仓储查询方法以及编写单元测试切片，从而显著加快微服务开发节奏。

而在本章中，我们将为你全面夯实使用 Spring Data 实现数据持久化所需的一切技能基石。我们将分别搭建用于处理结构化关系数据的 **PostgreSQL**，以及用于存储非结构化文档型用户档案的 **MongoDB**。你将系统掌握如何将 Java 类映射为关系数据表与文档集合、深度运用 Spring Data 仓储体系，并严格遵循工程最佳实践打造干净、可维护的持久化分层架构。

我们将紧密围绕书店（Bookstore）实战项目，通过真实业务案例逐步推进每种数据库的配置，利用 JPA 注解构建实体模型，并设计兼具优雅表达与高效性能的仓储接口。读完本章后，你不仅能透彻理解理论机制，更将拥有两套完全集成真实数据库、支持开箱即用测试的微服务工程。

本章核心涵盖以下主题：

- 深入理解数据库类型（Understanding database types）
- 构建由关系型 SQL 数据库支撑的库存微服务（Building the Inventory microservice backed by SQL DB）
- 构建由 NoSQL MongoDB 驱动的用户微服务（Building the User microservice powered by NoSQL MongoDB）
- 仓储最佳实践横向对比：MongoDB 与 JPA
- 仓储层测试实战指南（Testing your repository layer）

> **注意**
>
> 书中的部分图片在纸质排版中可能细节较小。我们保留了这些完整的原始界面截图，以便大家能够参照自己屏幕上的实际界面一步步进行操作。你也可以通过《前言》（Preface）中提供的 *Graphics Bundle* 链接查看并放大所有高清原图。

## 技术准备工作（Technical requirement）

本章涉及的相关示例源码可在如下地址获取：`https://github.com/PacktPublishing/Spring-Boot-and-Angular-2E_Backend/tree/main/chapter-04`

## 深入理解数据库类型（Understanding database types）

数据库有多种形态与设计哲学。有些数据库像电子表格一样高度结构化（**关系型数据库**），而另一些则呈现为非结构化或半结构化、灵活多变的 JSON 文档（**NoSQL 数据库**）。深刻理解何种场景选择何种数据库，是构建高伸缩微服务架构的基本功。为了打造全栈在线书店系统，我们将采用**多范式持久化（Polyglot Persistence）**架构方案——其核心思想是根据每个微服务的具体业务领域模型与访问特征，量体裁衣地选择最适配的存储引擎。

### 关系型与 NoSQL 数据库特性剖析

让我们更细致地审视这两类主流数据库：

- **关系型数据库（RDBMS）—— 结构严谨、强一致性**：关系型数据库通过具备固定 Schema 的严谨二维表存储数据。典型代表包括 **PostgreSQL**、**MySQL** 与 **Oracle**。每一条记录（或行）均遵循严格一致的列结构，并利用外键约束来维护表间实体关联。这种架构极其适用于苛求数据强一致性、高度范式化（Normalization）以及需要支持复杂的多表关联查询（JOIN）的业务场景。

在我们的书店库存微服务中，核心需要管理图书、作者及关联元数据。此时你必然要求严密的实体数据完整性（决不能出现没有作者归属的幽灵孤儿图书！），并且需要支持复杂的业务查询，例如：“*查询所有有库存、按评分倒序排列、且作者国籍为埃及的图书列表*”。

- **NoSQL 数据库 —— 模式灵活、高横向扩展力**：与之相反，NoSQL 数据库抛弃了僵化的预设表结构。数据通常以键值对、文档、图或宽列的形式存储。在本书实战中，我们选用 **MongoDB** 作为典型的面向文档的 NoSQL 数据库代表。

NoSQL 数据库在灵活性、横向扩展性以及极高的读吞吐方面优势独具，尤其在读密集型或弱结构化场景中大放异彩。在实际业务中，用户档案（User Profile）往往处于高速演化之中：最初阶段可能只存储姓名和邮箱；随着产品迭代，很快需要追加个性化偏好设置、多渠道通知配置等。这正是 MongoDB 的强项所在——你完全不需要每次业务微调都去执行繁重耗时的数据库 DDL 结构迁移，而是可以直接嵌套子文档、内嵌集合数组并敏捷迭代。如果把这类频繁变动的结构硬塞进僵化的 SQL 表结构中，最终往往会导致多表 JOIN 泛滥或产生大量冗余的 NULL 空列。

### 为各微服务精准选型数据库

微服务不仅需要在业务逻辑层保持自治，更必须在**数据层实现绝对自治**。切忌让多个微服务跨服务直接读写共享同一个底层数据库。每个微服务都应当全权掌控并管理自身的专属数据存储。核心考量如下：
- 单个服务可针对自身负载特性实施独立的垂直或水平伸缩；
- 业务数据边界与所有权责任（Ownership）权责分明；
- 彻底斩断跨模块底层数据表耦合带来的隐式副作用与回归风险。

在书店系统中，我们根据微服务内聚的领域上下文，审慎制定了差异化的存储选型：
- **库存微服务（Inventory microservice）** → PostgreSQL + Spring Data JPA
- **用户管理微服务（User Management microservice）** → MongoDB + Spring Data MongoDB

我们将在后文中逐步搭建这两套微服务。但在编码之前，首先要在本地完成这两套数据库运行时的安装与配置。下表系统对比了两大类存储引擎的关键维度差异：

| 特性维度 | PostgreSQL | MongoDB |
| :--- | :--- | :--- |
| 数据模型 | 二维表、行记录、强类型列 | 类似 JSON 的灵活 BSON 文档 |
| 模式约束（Schema） | 严格、前置预定义的静态结构 | 动态演化、高度灵活的半结构化模式 |
| 查询语言 | 标准化 SQL | 面向文档的 BSON 查询语法与聚合管道 |
| 关联查询（Joins） | 原生高效支持复杂多表 JOIN | 关联能力受限，推崇内嵌（Embedding）文档设计 |
| 事务支持 | 完整且严苛的 ACID 事务强一致性 | 支持单文档原子性与跨文档分布式事务 |
| 最适业务场景 | 结构清晰、关系严密的核心事务数据 | 灵活敏捷、高速演化的高吞吐数据 |
| 书店系统对应服务 | 图书模型、作者模型（库存微服务） | 用户账户、个性化档案（用户微服务） |

*表 4.1：微服务架构下 PostgreSQL 与 MongoDB 特性全方位对比*

这种差异化选型带来了极佳的架构收益：PostgreSQL 天然契合库存微服务，因为图书与作者之间的业务边界明确、实体关联度高，外键完整性校验、复合索引与 JOIN 查询至关重要；而 MongoDB 则是用户微服务的最佳拍档，用户画像往往包含复杂的嵌套住址、阅读偏好及动态扩展属性，文档的无模式特性能够免去频繁线上表迁移的包袱。

接下来，我们将首先为库存微服务搭建并配置 PostgreSQL 容器，打通 Spring Boot 与数据库的物理链路，创建数据表结构并支撑仓储层完成标准的 CRUD 持久化操作。

## 构建由关系型 SQL 数据库支撑的库存微服务

明确了数据库分类哲学与 PostgreSQL 的选型依据后，现在进入工程实操环节。在本节中，我们将指导你完成 PostgreSQL 的容器化拉起、将其与 Spring Boot 工程整合，并在声明实体与仓储之前验证连接链路。

我们将利用 Docker 快速拉起数据库容器，通过 `application.yml` 声明数据源参数，随后构建代表图书与作者的核心 JPA 实体模型。

> **注意**
>
> 有关 Docker 容器化构建与发布流水线的高阶规范，我们将在*第 10 章*中深入展开。在此之前，我们使用现成的容器镜像加速本地后端开发。

### 为库存微服务配置 PostgreSQL 数据库

借助 Docker，你可以彻底避免在宿主机操作系统上繁复安装各种数据库软件所带来的环境污染，且该方案能够在 Windows、macOS 与 Linux 跨平台上表现出完全一致的运行行为。

#### 使用 Docker 本地启动 PostgreSQL 容器

在终端中执行下列命令，拉取并运行容器化数据库实例：

```bash
docker run -d   --name bookstore-postgres   -e POSTGRES_USER=bookstore   -e POSTGRES_PASSWORD=bookstore123   -e POSTGRES_DB=inventory   -p 5432:5432   postgres:17
```

上述 `docker run` 命令专门为我们的书店库存微服务拉起了一个 `PostgreSQL 17` 容器，无需在本地安装任何多余软件即可获得完全隔离、可复现的数据库实例。环境变量 `POSTGRES_USER` 将用户名初始化为 `bookstore`，`POSTGRES_PASSWORD` 将访问密码设为 `bookstore123`，后续 Spring Boot 应用将使用这组凭据进行数据源鉴权。`POSTGRES_DB` 参数指示容器启动时自动创建名为 `inventory` 的数据库，完美契合库存服务的领域限界上下文；参数 `-p 5432:5432` 将容器内部的标准 PostgreSQL 端口暴露映射到宿主机，使外部应用能够通过标准 JDBC 驱动直连。这一做法践行了现代化云原生 DevOps 准则，将数据库作为可抛弃的基础设施管理，确保了开发、测试与生产环境的高度一致。

你可以通过执行如下过滤命令，验证名为 `bookstore-postgres` 的容器是否已处于稳健运行状态：

```bash
docker ps --filter "name=bookstore-postgres"
```

你应当能看到容器列表输出，确认 PostgreSQL 实例已正常启动。

![图 4.1：使用 docker ps 验证 PostgreSQL 容器运行状态](/media/posts/spring-boot-angular/img-08933.png)

*图 4.1：使用 docker ps 验证 PostgreSQL 容器运行状态*

你也可以在终端中通过端口探测命令，确认宿主机 5432 端口已被数据库进程成功监听：

```bash
lsof -i :5432
```

终端预期将输出占用 5432 端口的进程详情：

![图 4.2：验证 PostgreSQL 容器在 5432 端口上运行](/media/posts/spring-boot-angular/img-08935.png)

*图 4.2：验证 PostgreSQL 容器在 5432 端口上运行*

#### 为库存微服务引入 PostgreSQL 驱动与 Spring Data JPA 依赖

在 Spring Boot 应用能够与 PostgreSQL 通信并发挥 JPA 的 ORM 威力前，必须在工程的 `pom.xml` 中声明对应的 Maven 依赖：

1. 首先添加 Lombok 类库依赖，通过声明式注解消除冗长死板的样板代码：

```xml
<!-- Lombok 类库用于消除实体样板代码 -->
<dependency>
  <groupId>org.projectlombok</groupId>
  <artifactId>lombok</artifactId>
  <optional>true</optional>
</dependency>
```

2. 接下来引入 PostgreSQL JDBC 驱动包，建立与数据库的底层传输通道：

```xml
<!-- PostgreSQL JDBC 驱动 -->
<dependency>
  <groupId>org.postgresql</groupId>
  <artifactId>postgresql</artifactId>
</dependency>
```

3. 引入 Spring Boot 的 JPA 起步依赖，统一集成 Spring Data JPA、Hibernate 内核以及分布式事务管理器：

```xml
<!-- Spring Data JPA 与 Hibernate 起步依赖 -->
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>
```

该 Starter 不仅激活了自动仓储机制，还将 Hibernate 作为默认的 JPA 规范提供者进行装配，构成了使用 `@Entity`、`@Table` 以及 `JpaRepository` 的基石。

4. 依赖就绪后，在 `src/main/resources/application.yml` 中配置数据源与 JPA 参数，将环境配置外部化：

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/inventory
    username: bookstore
    password: bookstore123
    driver-class-name: org.postgresql.Driver

  jpa:
    hibernate:
      ddl-auto: update
    show-sql: true
    open-in-view: false

  sql:
    init:
      mode: always

logging:
  level:
    "[org.hibernate.SQL]": DEBUG
    "[org.hibernate.type.descriptor.sql]": TRACE
```

上述配置精确定义了库存微服务连接与操作 PostgreSQL 的运行时行为。`spring.datasource.url` 指向本地 5432 端口的 `inventory` 库，账号密码与 Docker 容器一致。在 JPA 部分，`ddl-auto: update` 命令 Hibernate 在应用启动时自动比对实体类与物理表结构并自动增量同步，加速本地研发迭代。将 `open-in-view` 显式设为 `false` 是面向企业级 RESTful API 的推荐实践，能够禁用贯穿 Web 表现层的延迟 Session 绑定，彻底避免 Controller 层的隐式 N+1 懒加载异常，强约束数据访问必须在显式的 `@Transactional` 服务边界内闭环完成。`sql.init.mode: always` 保证初始化脚本的自动触发，而 DEBUG/TRACE 级别的日志输出则让每次 SQL 执行与参数绑定在终端一览无余，极大降低了排错成本。

> **注意**
>
> **生产最佳实践**
> 在生产或预发环境中，务必将 `ddl-auto` 调整为 `validate` 或 `none`，杜绝 Hibernate 擅自变更线上表结构，统一交由 Flyway 或 Liquibase 进行版本化 SQL 迁移演进。

#### 验证数据库连接配置

完成上述配置后，按照下列步骤验证应用与数据库的联通性：

1. 启动微服务：可在 VS Code 中点击启动按钮，或在终端中使用 Maven Wrapper 运行：

```bash
./mvnw spring-boot:run
```

2. 仔细观察控制台输出日志。当看到类似 `Started InventoryMsApplication` 伴随 `Bootstrapping Spring Data JPA repositories` 以及 `HikariDataSource ... connected to jdbc:postgresql://...` 时，表明连接池初始化完毕，微服务已成功接通 PostgreSQL。

![图 4.3：展示库存微服务成功启动并连接数据库](/media/posts/spring-boot-angular/img-08937.png)

*图 4.3：展示库存微服务成功启动并连接数据库*

如果遭遇 `Connection Refused` 或 `No dialect configured` 等异常，请重点排查：
- `application.yml` 中的连接地址、端口与账密是否准确；
- PostgreSQL Docker 容器是否保持处于运行状态（`docker ps`）；
- 宿主机 5432 端口是否被本地其他 PostgreSQL 实例意外占用。

你也可以追加调试参数重新运行，以打印详细的自动装配分析日志：

```bash
./mvnw spring-boot:run -Dspring-boot.run.arguments="--debug"
```

### 为库存微服务声明 JPA 实体

在图书领域中，我们习惯于直接思考图书（Book）、作者（Author）、图书分类以及出版社等业务模型。将这些领域概念无缝映射为结构清晰的 Java 类是后端开发的核心职责。在 Spring Boot 中，这一映射过程通过标准的 **Java Persistence API (JPA)** 规范实现。

通过 Spring Data JPA，实体建模将变得极为敏捷优雅。它不仅能根据实体注解推导建表，还提供了丰富的元数据声明能力。

在库存微服务中，我们重点构建两个核心实体：
- `Book`：代表书店商品目录中的核心图书实体；
- `Author`：代表图书的创作者实体。

在设计 JPA 实体时，合理挑选数据类型与施加校验约束能够确保：
- 底层数据库物理模式具备极高的数据完整性；
- Java 领域对象模型具备精准的业务自解释能力；
- 业务代码保持高度的整洁与可测试性。

针对主键生成策略，JPA 通过 `@GeneratedValue(strategy = ...)` 提供了若干典型机制：
- **AUTO**：由 JPA 提供者根据底层方言自动挑选；
- **IDENTITY**：直接利用数据库自带的主键自增特性（Auto-increment）；
- **SEQUENCE**：依赖底层数据库的 Sequence 序列对象；
- **TABLE**：通过维护单独的序列计数表来生成主键。

由于 PostgreSQL 原生对自增列有着完善支持，因此在大多数场景下，`GenerationType.IDENTITY` 是最为推荐且直观的默认选型。

![图 4.4：库存应用中 Author、Book 与 Auditable 实体的类图关系](/media/posts/spring-boot-angular/img-08939.png)

*图 4.4：库存应用中 Author、Book 与 Auditable 实体的类图关系*

由 `Book`、`Author` 与基础抽象类 `Auditable` 构成的类结构，生动践行了面向对象编程（OOP）中的**继承**、**封装**与**关联**三大支柱。每个实体类精确对应底层的数据库表，其属性字段与表字段一一映射。`Book` 实体与 `Author` 之间维持着天然的“多对一（Many-to-One）”关系，而 `Author` 则维护着指向图书集合的“一对多（One-to-Many）”关联。这些关联通过 JPA 的 `@ManyToOne`、`@OneToMany` 以及 `@JoinColumn(name = "author_id")` 显式锚定外键。`Auditable` 基类被标记为 `@MappedSuperclass`，声明了通用的审计字段（`createdAt`、`updatedAt`），使各子类免于重复冗余编码，实现了代码复用与领域一致性的完美平衡。

#### 图书实体（Book Entity）

`Book` 实体封装了图书在现实世界中的核心属性：定价、库存数量以及归属作者信息：

```java
@Entity
@Table(name = "books")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = false)
public class Book extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;

    private String isbn;

    private BigDecimal price;

    private int quantity;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id")
    private Author author;

    private String genre;

    private LocalDate published;

    private String description;

    private Integer pageCount;

    private String coverImageUrl;
}
```

该 `Book` 类构成了库存微服务的核心聚合根。`@Entity` 告知容器该类为受管实体，`@Table(name = "books")` 显式将其绑定到物理表，避免命名不一致歧义。`@Id` 与 `@GeneratedValue(strategy = GenerationType.IDENTITY)` 将 `id` 字段声明为数据库自增主键。在与作者的关联上，`@ManyToOne(fetch = FetchType.LAZY)` 声明了多对一关系，`@JoinColumn(name = "author_id")` 则在表层显式指定了外键列名。显式采用 `FetchType.LAZY`（懒加载）极为关键，它能避免在单查图书时不假思索地级联拖出作者数据，为 RESTful API 提供了极大的性能保障。配合 Lombok 的注解矩阵，样板代码被压缩至极致。

#### 关键性能隐患：N+1 查询问题

尽管 `@ManyToOne(fetch = FetchType.LAZY)` 是杜绝盲目全量加载的正确默认选型，但它在处理集合检索时会引出一个极度经典的性能陷阱——**N+1 查询问题**。

简而言之，当你需要查询图书列表时（执行 1 次查询），若在业务循环遍历中调用了 `book.getAuthor().getName()`，Hibernate 就会为每一本图书单独发起一条 SQL 去捞取对应的作者信息（追加执行 N 次查询）。

因此，原本一条 SQL 就能解决的场景，在应用层被放大为 1 + N 条网络往返，当数据量达到成百上千条时，将导致极其致命的性能雪崩：

```java
List<Book> books = bookRepository.findAll();
// 循环中每读一次 author，都将触发一次额外的 SQL 查询！
```

#### 使用 JOIN FETCH 终结 N+1 隐患

要在保留懒加载优势的同时彻底规避 N+1 陷阱，最佳实践是在需要同时展示图书与作者详情的特定查询契约上，使用 `JOIN FETCH` 显式通知 Hibernate 在单次 SQL 查询中通过连接（JOIN）一次性取出关联实体：

```java
@Query("SELECT b FROM Book b JOIN FETCH b.author")
List<Book> findAllWithAuthors();
```

通过这一条定制查询，Hibernate 会在底层生成一条优雅的内连接查询，图书与其关联的作者数据被一并装载进持久化上下文。后续访问 `book.getAuthor()` 时直接从内存缓存中获取，不会触发任何隐式网络往返。

#### 作者实体（Author Entity）

`Author` 实体维护了作者的基本信息以及该作者旗下出版的所有图书列表，这在统计分析与作者专栏展示中非常常用：

```java
@Entity
@Table(name = "authors")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = false)
public class Author extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    private String nationality;

    // 声明懒加载，并严格在服务层事务中处理
    @OneToMany(mappedBy = "author", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    private List<Book> books;
}
```

在 `Author` 实体中，`@OneToMany(mappedBy = "author", ...)` 代表了双向关联的反向端点。`mappedBy = "author"` 关键属性明确告知 JPA：外键关系的维护端属于 `Book.author`，从而避免重复创建无谓的中间关联表。`cascade = CascadeType.ALL` 声明了级联操作，当对作者进行持久化或删除操作时，自动将状态变更同步传导给其所属的全部图书集合。

#### 开启审计支持（Auditing Support）

追踪每条业务记录的创建时间与最后更新时间是现代企业级系统的标配需求。Spring Data JPA 提供了极佳的声明式审计支持，让开发者无需在业务代码中手动书写时间戳赋值。具体开启步骤如下：

1. **在主启动类上开启 JPA 审计开关**：

```java
@SpringBootApplication
@EnableJpaAuditing
public class InventoryMsApplication {
    public static void main(String[] args) {
        SpringApplication.run(InventoryMsApplication.class, args);
    }
}
```

添加 `@EnableJpaAuditing` 是激活底层拦截器的总阀门。

2. **抽象出公共的 Auditable 基础基类**：将时间戳元数据统一定义在抽象父类中：

```java
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
@Data
public class Auditable {

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;
}
```

`@MappedSuperclass` 确保父类字段直接映射到继承它的各个子实体的数据表中，而不会单独生成一张孤立的实体表。`@EntityListeners(AuditingEntityListener.class)` 则注册了 Spring Data 的生命周期监听器。当实体首次保存时，`@CreatedDate` 自动写入当前系统时间且后续不可更改（`updatable = false`）；当实体发生任何持久化变更时，`@LastModifiedDate` 自动刷新为最新时间戳。

3. **子实体直接继承基础类**：

```java
@Entity
public class Book extends Auditable {
    // 自身业务字段保持不变
}
```

继承后，所有实体将天然具备自动化审计能力，这不仅大幅简化了 Service 层的代码纯粹度，还为系统的可追溯性与运维诊断提供了透明的元数据支撑。

#### JPA 实体设计黄金准则

在迈向仓储层之前，让我们梳理实体设计的核心最佳实践：

| 最佳实践准则 | 核心价值与依据 |
| :--- | :--- |
| **采用 @Builder 与 Lombok 辅助构造** | 大幅提升测试用例与业务代码的构建表达力 |
| **严密避免无谓的双向关系强绑定** | 随意滥用双向引用极易引发序列化死循环与栈溢出崩溃 |
| **精确重写 equals() 与 hashCode()** | 保证实体被置入 Set、Map 或二级缓存时标识判定准确无误 |
| **关联映射一律优先采用 FetchType.LAZY** | 从源头上扼杀意料之外的大批量贪婪加载，按需通过 JOIN FETCH 精准抓取 |

*表 4.2：JPA 实体设计最佳实践对照表*

至此，库存微服务的持久化领域模型已全副武装。接下来我们将正式进入让 Spring Data JPA 名声大噪的核心层级——**仓储层（Repository Layer）**。

### 为库存微服务构建仓储数据访问层

在传统架构中，访问数据库需要手写繁琐的 DAO 实现类、配置 SQL 并手工解析 ResultSet。Spring Data 仓储体系则是一项颠覆性的抽象，它彻底终结了死板的样板代码，提供了开箱即用的方法名动态推导、声明式分页以及可插拔查询能力。

Spring Data JPA 构筑了严密清晰的接口继承树，开发者可按需选取：

| 核心接口 | 核心特性与能力 |
| :--- | :--- |
| `CrudRepository<T, ID>` | 提供最基础的增删改查方法（如 `save`、`findById`、`findAll`、`delete`），适合轻量数据访问。 |
| `PagingAndSortingRepository<T, ID>` | 在 CRUD 基础上追加标准分页与动态排序能力，通过传入 `Pageable` 与 `Sort` 参数实现低开销检索。 |
| `JpaRepository<T, ID>` | 全面继承上述接口，进一步解锁批量持久化（Batch Operations）、强制持久化上下文刷新（`flush`）以及全套 JPQL/原生查询特性，是企业级应用中使用频次最高、功能最全的旗舰接口。 |

*表 4.3：Spring Data 核心仓储接口演进矩阵*

#### 声明 AuthorRepository 仓储接口

得益于 Spring Data 的方法名查询派生机制，你可以用宛如自然语言的 Java 方法签名表达查询诉求。框架会在运行时动态拦截并生成对应的 SQL：

```java
@Repository
public interface AuthorRepository extends JpaRepository<Author, Long> {
    Author findByName(String name);
}
```

仅仅继承 `JpaRepository<Author, Long>`，就意味着你无需手写一行实现代码，便已坐拥了包括主键查询、全量保存与批量删除在内的几十个成熟方法。声明 `findByName(String name)` 时，框架底层会自动解析 `find...By...Name` 语义，动态合成带有参数绑定的 `WHERE name = ?` 查询语句。

#### 声明 BookRepository 仓储接口

`BookRepository` 是库存微服务的核心数据访问枢纽。我们通过声明若干直观的方法签名，满足基于书名模糊查询、关联作者姓名查询及价格区间过滤的业务需求：

```java
@Repository
public interface BookRepository extends JpaRepository<Book, Long> {

    // 自定义派生查询方法
    List<Book> findByTitleContainingIgnoreCase(String keyword);

    List<Book> findByAuthor_Name(String authorName);

    List<Book> findByPriceBetween(BigDecimal min, BigDecimal max);
}
```

- `findByTitleContainingIgnoreCase`：执行书名忽略大小写的模糊匹配（对应 SQL 中的 `LIKE %keyword%`）；
- `findByAuthor_Name`：通过下划线语法显式指示框架跨越实体属性路径，直接导航至关联作者的 `name` 字段；
- `findByPriceBetween`：执行价格区间的闭区间查询（对应 SQL 中的 `BETWEEN ? AND ?`）。

> **提示**
>
> 你可以通过链式语义将多个过滤条件组合起来，例如声明 `findByAuthor_NameAndPriceBetween(...)`，框架会自动生成复合 `AND` 条件。

#### 使用 @Query 注解编写定制查询

尽管方法名推导非常直观，但面对复杂的多表过滤、聚合函数或定制报表时，方法名会变得冗长笨拙。此时 `@Query` 注解就派上了用场：

| 评估维度 | JPQL（Java 持久化查询语言） | Native SQL（原生 SQL 查询） |
| :--- | :--- | :--- |
| 语言特征 | 面向对象（针对实体类与实体属性编写） | 强依赖特定物理数据库方言与语法特性 |
| 可移植性 | 表现卓越（可跨 PostgreSQL、MySQL 无缝平移） | 较差（与目标数据库方言高度绑定） |
| 语法标识 | 引用 Java 实体名（如 `Book`）及字段名 | 引用物理数据表名（如 `books`）及物理列名 |
| 适用场景 | 绝大部分常规多条件过滤、定制连接查询 | 需要发挥特定数据库高阶特性或进行极限制优化 |

*表 4.4：JPQL 与 Native SQL 对比矩阵*

#### 编写定制 JPQL 查询

当需要结合模糊书名与最低价格门槛进行复合筛选时，JPQL 能够保持极高的面向对象表达力：

```java
@Query("SELECT b FROM Book b WHERE LOWER(b.title) LIKE LOWER(CONCAT('%', :keyword, '%')) AND b.price > :minPrice")
List<Book> searchBooks(@Param("keyword") String keyword, @Param("minPrice") BigDecimal minPrice);
```

查询语句中的 `Book b` 严格对应 Java 实体而非底层物理表。通过 `@Param` 显式绑定的命名参数避免了位置参数的脆弱性，同时杜绝了 SQL 注入隐患。

#### 编写 PostgreSQL 原生 SQL 查询

在极少数情况下，为了借助 PostgreSQL 专属的全文检索或高效的 `ILIKE` 忽略大小写正则操作符，可以开启 `nativeQuery = true`：

```java
@Query(value = "SELECT * FROM books WHERE title ILIKE CONCAT('%', :keyword, '%')", nativeQuery = true)
List<Book> nativeSearch(@Param("keyword") String keyword);
```

原生查询直接下推至 PostgreSQL 引擎执行。尽管能充分压榨底层能力，但建议仅在存在明确性能瓶颈或特定函数诉求时审慎采用。

#### JPA Specification 动态组合规约模式

在构建电商复杂的多维度多条件动态组合搜索时，传统的固定查询往往会导致接口膨胀。JPA 的 **Specification** 模式允许将单个查询条件封装为可复用的谓词，并在业务层自由拼接：

```java
public class BookSpecifications {

    public static Specification<Book> hasTitleLike(String keyword) {
        return (root, query, cb) ->
            cb.like(cb.lower(root.get("title")), "%" + keyword.toLowerCase() + "%");
    }

    public static Specification<Book> priceBetween(BigDecimal min, BigDecimal max) {
        return (root, query, cb) ->
            cb.between(root.get("price"), min, max);
    }
}
```

在 Service 业务逻辑中，通过流式 API 将规约动态组合在一起：

```java
List<Book> results = bookRepository.findAll(
    Specification.where(BookSpecifications.hasTitleLike("spring"))
                 .and(BookSpecifications.priceBetween(new BigDecimal("10"), new BigDecimal("50")))
);
```

#### JPA 仓储设计最佳实践清单

| 最佳实践准则 | 核心价值与依据 |
| :--- | :--- |
| **模糊查询使用 ContainingIgnoreCase** | 提供优雅的大小写不敏感匹配，大幅提升前端搜索体验 |
| **关联属性跨越使用下划线导航** | 如 `findByAuthor_Name`，清晰隔离属性名语义歧义 |
| **金额属性统一采用 BigDecimal 处理** | 坚决禁止使用 `Double`/`Float` 存储金额，彻底消除浮点舍入精度丢失 |
| **对查询入参实施前置非空校验** | 杜绝无效入参下推至数据库造成全表扫描或语法报错 |
| **定制查询规范** | 强制使用 `@Param` 参数绑定防止注入；坚决禁止在 SQL 字符串中动态拼接值；逻辑尽量内聚在仓储接口内部 |

*表 4.5：JPA 仓储设计实战避坑与最佳实践*

#### 基于 Spring Data JPA 的高效分页与动态排序

在真实的在线书店业务中，一次性将全库成千上万本图书拉取到内存中无异于灾难。必须对数据进行分页（Pagination）与排序（Sorting）治理。

Spring Data JPA 提供了优雅的 `Pageable` 与 `Sort` 抽象支持：

```java
Page<Book> findByAuthor_Name(String name, Pageable pageable);
```

返回的 `Page<Book>` 对象是一个内容丰富的结构体，不仅包含当前页的实体列表，还封装了总记录数、总页数、当前页码及是否有上一页/下一页等丰富的元数据。

客户端按需发起分页请求示例：

```java
Pageable pageable = PageRequest.of(0, 10, Sort.by("title").ascending());
Page<Book> page = bookRepository.findByAuthor_Name("Ahmad Gohar", pageable);
```

上述调用请求第 0 页（即第一页），每页取 10 条数据，且按 `title` 字典序正序排列。

> **最佳实践建议**
> 当客户端需要展示完整的分页条导航控件时，返回 `Page<T>`；而在移动端长列表无限滚动加载等仅需判断“是否还有下一页”的场景下，推荐返回更轻量的 `Slice<T>`（它不会发起额外的 `COUNT(*)` 聚合开销）。

至此，库存微服务不仅拥有了稳健的实体模型，更构建了一整套兼顾单条查询、关联检索、动态规约与高性能分页的仓储体系。在下一节中，我们将目光转向基于 NoSQL 文档型数据库的**用户管理微服务**。

## 构建由 NoSQL MongoDB 驱动的用户微服务

关系型数据库固然擅长处理具有刚性模式的库存与账目，但用户画像数据却完全是另一番景象。用户的属性演化极为敏捷，且包含复杂的层级结构（例如收货地址列表、系统偏好设置、多渠道登录凭证等）。此时，**MongoDB** 的文档型存储优势无可替代。

MongoDB 以类 JSON 的 BSON 文档形式组织数据，天然支持多级嵌套与无模式动态扩展。配合 Spring Data MongoDB，你可以沿用与 JPA 高度同构的开发范式，轻松掌控 NoSQL 文档。

### 本地使用 Docker 快速拉起 MongoDB 容器

在终端中执行下列命令，启动专属的 MongoDB 8 容器实例：

```bash
docker run -d   --name bookstore-mongo   -e MONGO_INITDB_ROOT_USERNAME=bookstore   -e MONGO_INITDB_ROOT_PASSWORD=bookstore123   -e MONGO_INITDB_DATABASE=userDB   -p 27017:27017   mongo:8
```

上述命令拉起了一个完全隔离的 `MongoDB 8` 实例。指定管理员用户名为 `bookstore`，密码为 `bookstore123`，并创建了专属的 `userDB` 数据库，映射宿主机标准端口 27017。这再次验证了每个微服务独立掌控专属数据库的架构原则。

通过下列命令验证 MongoDB 容器的运行状态：

```bash
docker ps --filter "name=bookstore-mongo"
```

探测 27017 端口确认监听建立：

```bash
lsof -i :27017
```

### 脚手架初始化与集成 Spring Data MongoDB

我们将遵循与第 2 章完全相同的工程分层规范，初始化全新的用户管理微服务（`user-ms`）。

1. 打开浏览器访问 `https://start.spring.io`；
2. 按照如下技术参数进行工程配置：
   - **Project**：Maven
   - **Language**：Java
   - **Spring Boot**：4.1.0
   - **Group**：`com.packt.bookstore`
   - **Artifact**：`user-ms`
   - **Dependencies**：勾选 **Spring Boot DevTools**、**Spring Web**、**Lombok** 以及 **Spring Data MongoDB**。

![图 4.5：使用 Spring Initializr 配置用户微服务项目](/media/posts/spring-boot-angular/img-08940.png)

*图 4.5：使用 Spring Initializr 配置用户微服务项目*

3. 点击 **Generate** 下载 ZIP 压缩包；
4. 解压并在 VS Code 中打开该微服务目录；
5. 在弹出的信任提示中选择 **Yes, I trust the authors** 并完成工作区初始化。
6. 将工程默认生成的 `application.properties` 重命名为统一的 `application.yml`。并在 `src/main/java/com/packt/bookstore/users/` 路径下建立标准的各分层子包（`controller`、`document`、`repository`、`service`、`config`、`dto`、`exception`）。

检查 `pom.xml` 中已包含 MongoDB 核心 Starter：

```xml
<!-- Spring Data MongoDB 起步依赖 -->
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-data-mongodb</artifactId>
</dependency>
```

在 `src/main/resources/application.yml` 中声明数据库连接串，并为该微服务分配独立端口 `8082`（避免与库存微服务的 `8080` 产生端口冲突）：

```yaml
spring:
  application:
    name: user-ms
  mongodb:
    uri: mongodb://bookstore:bookstore123@localhost:27017/userDB?authSource=admin

server:
  port: 8082
```

### 为用户微服务设计 MongoDB 领域文档模型

在关系型世界中，我们通过外键将用户表、档案表、地址表纵横拆分为多张实体表；而在 MongoDB 中，我们秉持**反范式化（Denormalization）**与**聚合内嵌（Embedding）**的文档设计哲学。

一个 `User` 聚合根文档自身便内嵌封装了完整的个人档案（`Profile`）、邮寄地址（`Address`）以及系统偏好（`Preferences`），在单次原子文档读取中即可获取该用户的全貌画像，彻底省去了跨表 JOIN 的复杂性与网络延迟。

核心领域对象结构划分：
- `User`：作为聚合根文档，承载全局账号核心数据；
- `Profile`：承载用户自然人身份属性；
- `Address`：通用的内嵌物理地址结构；
- `Preferences`：封装个性化定制与通知订阅开关。

![图 4.6：书店应用中 User、Profile、Preferences 与 Address 实体的类图关系](/media/posts/spring-boot-angular/img-08942.png)

*图 4.6：书店应用中 User、Profile、Preferences 与 Address 实体的类图关系*

#### 用户聚合根文档（User Document）

```java
@Document(collection = "users")
@Data
@Builder
public class User {

    @Id
    private String id;

    @Indexed(unique = true)
    private String email;

    @Indexed(unique = true)
    private String username;

    private LocalDateTime dateOfBirth;

    private String status;

    private Profile profile;

    private Preferences preferences;

    private LocalDateTime createdAt;

    private LocalDateTime lastLogin;
}
```

- `@Document(collection = "users")`：告知框架当前类持久化至 MongoDB 的 `users` 集合中；
- `@Id`：映射为 MongoDB 文档底层的 `_id` 键，在 Java 侧采用更通用的 `String` 承接其十六进制 ObjectId；
- `@Indexed(unique = true)`：关键注解！命令 MongoDB 在底层建立唯一索引，在数据库层面坚决防御账号重复注册。

#### 个人资料内嵌文档（Profile Document）

```java
@Data
@Builder
public class Profile {
    private String fullName;
    private String birthDate;
    private String phone;
    private Address address;
}
```

#### 地址内嵌文档（Address Document）

```java
@Data
@Builder
public class Address {
    private String street;
    private String city;
    private String state;
    private String postalCode;
    private String country;
}
```

#### 系统偏好内嵌文档（Preferences Document）

```java
@Data
@Builder
public class Preferences {
    private String language;
    private Boolean newsletter;
    private String currency;
    private String[] favoriteGenres;
}
```

这种文档内嵌设计展现出强大的表达力：数据在内存中的 Java 对象形态与 MongoDB 磁盘上的 JSON 存储结构实现了零损耗的一一对应，天然适配 Web 前端的 JSON 交互契约。

#### MongoDB 文档设计核心注解指南

- `@Id`：显式声明主键映射；
- `@Indexed`：在频繁查询的高基数字段上建立 B-Tree 索引，保障高并发下的毫秒级检索响应；
- `@Field("custom_name")`：为磁盘存储的字段重命名，便于兼容历史数据；
- 配合 `@NotBlank`、`@Email` 等 Bean Validation 注解，在数据落盘前完成运行时参数防御。

### 为用户微服务构建 MongoRepository 仓储层

在 Spring Data 统一抽象体系下，操作 MongoDB 的体验与 JPA 惊人一致。你无需手写复杂的 BSON 操作，只需定义接口即可。

#### 声明 UserRepository 仓储接口

```java
@Repository
public interface UserRepository extends MongoRepository<User, String> {

    Optional<User> findByEmail(String email);

    List<User> findByUsernameContainingIgnoreCase(String keyword);

    Page<User> findAllByStatus(String status, Pageable pageable);

    @Query("{ 'preferences.language': ?0 }")
    List<User> findByLanguagePreference(String language);
}
```

- `findByEmail`：返回 `Optional<User>`，在源头上消除空指针风险，强迫上层服务处理无此用户的情形；
- `findByUsernameContainingIgnoreCase`：直接为用户模糊检索与前台自动补全提供支持；
- `@Query("{ 'preferences.language': ?0 }")`：利用原生 JSON 语法深入嵌套子文档的点路径字段，执行高效的深层匹配。

#### 使用 Criteria API 实现动态文档查询

面对高度动态的文档复合检索场景，可以借助 `MongoTemplate` 与 `Criteria` 构造器编排查询：

```java
public List<User> searchUsers(String city, String lang) {
    Query query = new Query();
    query.addCriteria(Criteria.where("profile.address.city").is(city));
    query.addCriteria(Criteria.where("preferences.language").is(lang));
    return mongoTemplate.find(query, User.class);
}
```

上述方法精准定位所有居住在特定城市且首选语言匹配的用户群体。

#### MongoDB 仓储设计核心准则

- **单值结果强制返回 Optional<T>**：杜绝直接暴露 `null` 引用；
- **基础查询优先依赖方法名派生**：保持代码的极致精炼；
- **复杂条件果断采用 @Query 或 Criteria**：充分发挥 MongoDB 丰富的操作符（如 `$in`、`$gt`、`$regex`）威力；
- **高频过滤字段必须建立索引**：若在缺乏索引的字段上高频查询，MongoDB 将退化为全集合全表扫描（COLLSCAN），严重拖垮系统吞吐。

## 仓储最佳实践横向对比：MongoDB 与 JPA

尽管 Spring Data 抹平了关系型与 NoSQL 的底层 API 差异，但二者在设计哲学与数据模型上存在本质分野。

下表横向梳理了在两大技术栈下设计仓储层的工程差异：

| 架构维度 | JPA Repository（PostgreSQL） | MongoDB Repository | 选型背后的核心机理 |
| :--- | :--- | :--- | :--- |
| **主键设计** | 使用 `Long` 或 `UUID`，配合 `@GeneratedValue` 序列化生成 | 使用 `String` 承接 MongoDB 的 24 位 16 进制 `ObjectId` | 关系库依赖单调自增或序列；MongoDB 面向分布式无中心自生成。 |
| **单条结果查询** | 返回 `Optional<Book>` | 返回 `Optional<User>` | 统一推行防空指针的显式契约设计。 |
| **简单派生查询** | `findByTitleContainingIgnoreCase` | `findByUsernameContainingIgnoreCase` | 两者均享受方法名自动派生带来的零样板红利。 |
| **复杂逻辑过滤** | `@Query` 配合 JPQL/原生 SQL，或使用 Specifications API | `@Query` 配合原生 JSON 语法，或使用 Criteria API | 两者均提供了细粒度的定制查询掌控力。 |
| **嵌套数据访问** | 通过 `@ManyToOne`、`@OneToMany` 或 DTO Projection 关联查询 | 直接将对象内嵌在主文档内部，通过点路径语法检索 | MongoDB 追求高内聚免连接；JPA 追求范式化规范。 |
| **索引管控策略** | 在 DDL 或迁移脚本中显式创建 B-Tree 索引 | 实体字段显式声明 `@Indexed` 并开启自动索引构建 | 确保高频查询在底层命中索引。 |
| **分页与排序** | 统一接收 `Pageable` 与 `Sort`，返回 `Page<T>` 或 `Slice<T>` | 统一接收 `Pageable` 与 `Sort`，API 体验完全同构 | 统一的抽象极大简化了全栈研发人员的心智负担。 |
| **分层边界恪守** | 仓储层仅负责数据持久化交互，业务逻辑坚决沉淀在 Service 层 | 仓储层坚决不掺杂业务校验，领域规则由 UserService 统领 | 严格贯彻 DDD 限界上下文与关注点分离。 |
| **切片集成测试** | 使用 `@DataJpaTest` 配合真实 PostgreSQL 实例 | 使用 `@DataMongoTest` 配合独立 MongoDB 测试容器 | 保证测试环境与生产真实运行时精准同构。 |
| **数据建模思维** | 强范式化、外键约束、严密保证参照完整性 | 读优化导向、大文档聚合内嵌、适度反范式化冗余 | 充分释放两种不同形态引擎的物理特长。 |

*表 4.6：JPA 与 MongoDB 仓储最佳实践横向全貌对比*

现在我们已经清晰掌握了两类仓储的构造机理与分层边界。但编写出优雅的代码只是万里长征的第一步——**如何确保这些持久化逻辑在严苛的生产环境中万无一失？** 这便引出了本章最后的关键技术：持久化层测试实战。

## 仓储层测试实战指南（Testing your repository layer）

在软件工程中，任何缺乏自动化测试保护的代码都是负债。对于持久化层而言，由于涉及复杂的 SQL/JPQL 语法解析、动态方法推导、多实体映射关系以及事务边界回滚，仅仅在本地跑通一次绝不代表安全。

编写严密的仓储层测试能够确保：
- 所有方法名派生查询、定制 JPQL 与 Native SQL 在真实的数据库方言下执行无误；
- 多对一、一对多及级联更新关系如预期运转，无隐式断链；
- 实体与数据库表字段类型严密对齐，提前在编译与 CI 阶段暴露潜在的模式不匹配问题。

### 本地透视与手动校验数据表与文档结构

在编写自动化测试脚本之前，我们通常需要先直观地查看数据是否真正落入了数据库中。

#### 借助 VS Code 插件透视 PostgreSQL

1. 打开 VS Code 插件面板（快捷键 *Ctrl* + *Shift* + *X*）；
2. 搜索并安装微软官方的 **PostgreSQL** 扩展；

![图 4.7：在 VS Code 中安装 PostgreSQL 扩展插件](/media/posts/spring-boot-angular/img-08943.png)

*图 4.7：在 VS Code 中安装 PostgreSQL 扩展插件*

3. 按快捷键 *Ctrl* + *Shift* + *P* 打开命令面板，选择 **PostgreSQL: Add Connection**；
4. 填入前文配置的连接信息：`postgresql://bookstore:bookstore123@localhost:5432/inventory`；

![图 4.8：PostgreSQL 数据库连接配置向导](/media/posts/spring-boot-angular/img-08945.png)

*图 4.8：PostgreSQL 数据库连接配置向导*

5. 连接成功后，在左侧侧边栏中展开 `inventory` 数据库节点，右键新建 SQL 查询窗口并执行：

```sql
SELECT * FROM books;
SELECT * FROM authors;
```

你将清晰看到已被持久化的图书与作者记录，直观验证实体表结构的建立：

![图 4.9：在 VS Code 中验证 PostgreSQL 数据表结构与数据记录](/media/posts/spring-boot-angular/img-08947.png)

*图 4.9：在 VS Code 中验证 PostgreSQL 数据表结构与数据记录*

#### 借助 VS Code 插件透视 MongoDB

1. 在 VS Code 插件市场搜索并安装官方的 **MongoDB for VS Code** 扩展；

![图 4.10：在 VS Code 中安装 MongoDB 扩展插件](/media/posts/spring-boot-angular/img-08949.png)

*图 4.10：在 VS Code 中安装 MongoDB 扩展插件*

2. 点击左侧工具栏新出现的 MongoDB 叶子图标，点击 **Add MongoDB Connection**；

![图 4.11：在 VS Code 中新建 MongoDB 连接](/media/posts/spring-boot-angular/img-08951.png)

*图 4.11：在 VS Code 中新建 MongoDB 连接*

3. 输入连接串 `mongodb://bookstore:bookstore123@localhost:27017/userDB?authSource=admin` 并点击保存连接；

![图 4.12：MongoDB 数据库连接配置向导](/media/posts/spring-boot-angular/img-08953.png)

*图 4.12：MongoDB 数据库连接配置向导*

4. 展开 `userDB` 下的 `users` 集合，即可直观查阅带有嵌套结构的 JSON 文档：

```json
{
  "_id": "1",
  "email": "info@agohar.me",
  "username": "agohar",
  "dateOfBirth": {
    "$date": "1993-09-05T08:00:00Z"
  },
  "status": "ACTIVE",
  "profile": {
    "fullName": "Ahmad Gohar"
  },
  "preferences": {
    "language": "en"
  },
  "createdAt": {
    "$date": "2025-08-04T03:30:37.648Z"
  },
  "lastLogin": {
    "$date": "2025-08-04T03:30:37.648Z"
  },
  "_class": "com.packt.bookstore.users.entity.User"
}
```

可视化透视确认了嵌套文档完全按照领域模型精确落盘。

### 审慎选择 Spring Boot 专属测试注解

在 Spring Boot 测试生态中，切忌盲目使用单一测试方案。针对不同的验证诉求，框架提供了层级清晰的测试切片：

- **切片隔离测试**（仅加载仓储与 ORM 上下文，执行毫秒级响应）：`@DataJpaTest` 或 `@DataMongoTest`；
- **全链路集成测试**（启动完整容器，校验各层协同）：`@SpringBootTest`。

#### 使用 @DataJpaTest 与 @DataMongoTest 进行快速切片测试

`@DataJpaTest` 仅加载与 JPA 相关的核心 Bean（如 `EntityManager`、Repository 接口等），自动忽略 Web 层与外部配置。默认情况下它会尝试挂载内存数据库（如 H2）并自动在每个测试方法结束后执行**事务回滚**，保证测试环境无污染。若需针对真实 PostgreSQL 进行验证，可以通过指定配置文件或接入 Testcontainers 来覆盖默认数据源。

```java
@DataJpaTest
class BookRepositorySliceTest {
    // 快速轻量测试用例
}
```

同理，`@DataMongoTest` 专用于极速测试 MongoDB 仓储与 `MongoTemplate` 行为：

```java
@DataMongoTest
class UserRepositorySliceTest {
    // 专注于文档仓储的轻量测试
}
```

#### 使用 @SpringBootTest 进行生产级全链路持久化集成测试

当需要验证仓储在包含完整配置、数据源注入以及事务传播的真实运行环境下是否万无一失时，`@SpringBootTest` 是最权威的试金石。

配合 `@Transactional` 注解，测试框架会在每个测试用例执行完毕后自动执行全局回滚，杜绝测试脏数据落盘污染：

```java
@SpringBootTest
@Transactional
class BookRepositoryTest {

    @Autowired
    private BookRepository bookRepository;

    @Autowired
    private AuthorRepository authorRepository;

    private Author author;

    @BeforeEach
    void setUp() {
        bookRepository.deleteAll();
        authorRepository.deleteAll();

        author = new Author();
        author.setName("Ahmad Gohar");
        author.setNationality("Egyptian");
        author = authorRepository.save(author);

        Book book = new Book();
        book.setTitle("Spring Boot and Angular - 2nd Edition");
        book.setIsbn("1234567890");
        book.setPrice(new BigDecimal("19.99"));
        book.setQuantity(10);
        book.setAuthor(author);
        bookRepository.save(book);
    }
}
```

在 `@BeforeEach` 生命周期中先行清理既有数据，并初始化一套确定性的作者与图书基线数据，为后续所有针对性断言提供统一上下文。

#### 核心测试用例集实战演习

以下我们在库存微服务中落地一套严密的测试用例集：

- **测试基础 CRUD 行为（烟雾测试）**：

```java
@Test
void testFindAll() {
    List<Book> books = bookRepository.findAll();
    assertThat(books).hasSize(1);
    assertThat(books.get(0).getTitle()).isEqualTo("Spring Boot and Angular - 2nd Edition");
}
```

- **测试实体关联导航完整性**：

```java
@Test
void testBookAuthorRelationship() {
    List<Book> books = bookRepository.findAll();
    assertThat(books.get(0).getAuthor().getName()).isEqualTo("Ahmad Gohar");
}
```

- **测试大小写不敏感的派生查询**：

```java
@Test
void testFindByTitleContainingIgnoreCase() {
    List<Book> books = bookRepository.findByTitleContainingIgnoreCase("spring");
    assertThat(books).hasSize(1);
}
```

- **测试跨实体属性导航查询**：

```java
@Test
void testFindByAuthorName() {
    List<Book> books = bookRepository.findByAuthor_Name("Ahmad Gohar");
    assertThat(books).hasSize(1);
}
```

- **测试数值区间查询**：

```java
@Test
void testFindByPriceBetween() {
    List<Book> books = bookRepository.findByPriceBetween(new BigDecimal("10.00"), new BigDecimal("20.00"));
    assertThat(books).hasSize(1);
}
```

- **测试定制 JPQL 复杂查询**：

```java
@Test
void testSearchBooks() {
    List<Book> books = bookRepository.searchBooks("Spring", new BigDecimal("10.00"));
    assertThat(books).hasSize(1);
}
```

- **测试 JOIN FETCH 高性能批量抓取**：

```java
@Test
void testFindAllWithAuthors() {
    List<Book> books = bookRepository.findAllWithAuthors();
    assertThat(books.get(0).getAuthor().getName()).isEqualTo("Ahmad Gohar");
}
```

- **测试 PostgreSQL 原生 SQL 查询**：

```java
@Test
void testNativeSearch() {
    List<Book> books = bookRepository.nativeSearch("Spring");
    assertThat(books).hasSize(1);
}
```

- **测试物理分页契约与元数据**：

```java
@Test
void testFindByAuthorNameWithPagination() {
    Pageable pageable = PageRequest.of(0, 10);
    Page<Book> bookPage = bookRepository.findByAuthor_Name("Ahmad Gohar", pageable);
    assertThat(bookPage.getContent()).hasSize(1);
    assertThat(bookPage.getTotalPages()).isEqualTo(1);
}
```

- **测试动态组合规约（Specifications）**：

```java
@Test
void testBookSpecificationsWithPrice() {
    Specification<Book> spec = BookSpecifications.hasTitleLike("spring")
            .and(BookSpecifications.priceBetween(new BigDecimal("10"), new BigDecimal("50")));

    List<Book> results = bookRepository.findAll(spec);
    assertThat(results).hasSize(1);
}
```

全方位的测试矩阵为持久层铸就了坚固的安全护城河。无论未来底层数据库驱动升级、实体属性拓展还是复杂查询重构，这套自动化测试都将成为系统稳健运转的最强凭证。

## 本章小结（Summary）

在本章中，我们全面且系统地探索了如何在微服务体系中依托 Spring Data 高效治理持久化数据。我们横跨了关系型（PostgreSQL 与 JPA）与 NoSQL（MongoDB）两大存储范式，深入落地了多范式持久化架构。我们不仅完成了实体与文档模型的精细化注解映射，更基于领域驱动设计（DDD）与关注点隔离原则，构建了兼具高表达力与扩展性的仓储体系，深度掌握了方法名派生、定制 JPQL/JSON 查询、JOIN FETCH 优化、分页排序以及动态 Specification 规约。最后，我们梳理了可视化数据库调试流程，并搭建起涵盖 `@DataJpaTest`、`@DataMongoTest` 与 `@SpringBootTest` 的全方位持久化自动化测试矩阵。

本章为你构筑了工业级微服务开发中极其坚固、纯粹的数据持久化地基。

在接下来的第 5 章中，我们将把研发重心全面上移至**业务服务层（Service Layer）与表现层 API**——学习如何编排领域业务规则、安全管控事务边界，并借助 Spring Boot 构建优雅、高可用且符合工业标准的 RESTful API 接口。
