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

> 💡 **专栏导读**：本文收录于专栏 [《Spring Boot 4 & Angular 22 全栈微服务实战》](/columns/spring-boot-angular)。全专栏共 22 篇，深度覆盖 Java 26 微服务拆分、Spring Cloud 网关与安全鉴权、Angular 22 Signals 状态治理以及端到端容器化交付的全链路工程实践。

---

在前几篇的实战演练中，我们完成了微服务工程的工程脚手架搭建与核心架构规划。在现代全栈系统的微服务落地过程中，数据持久化（Persistence Layer）往往是决定系统伸缩性、事务边界和演进效率的关键地基。

单一的“万能数据库”时代早已过去。在分布式微服务架构中，**多范式持久化（Polyglot Persistence）** 是最核心的设计哲学——根据不同微服务内聚的业务上下文（Bounded Context），挑选最适合其访问模式与数据特征的存储引擎。

本篇我们将通过书店系统的两个核心微服务，完整落地多范式持久化方案：
1. **库存微服务（Inventory Service）**：面对图书、作者、库存、分类之间严苛的实体关联与强事务约束，选择 **PostgreSQL 17** 搭配 **Spring Data JPA**。
2. **用户管理微服务（User Service）**：面对快速演进、高频读取、包含复杂内嵌结构（如用户画像、多地址、偏好配置）的用户数据，选用文档型数据库 **MongoDB 8** 搭配 **Spring Data MongoDB**。

通过本篇，我们将从容器化环境编排、领域实体建模、Spring Data 衍生与自定义查询、分页与排序，再到企业级 Repository 自动化测试，全面构建高质量的微服务持久化底座。

---

## 1. 为什么选择多范式持久化（Polyglot Persistence）？

微服务自治原则强调不仅要实现**代码逻辑的解耦**，更要实现**数据所有权的自治（Database-per-Service）**。不同业务领域的数据访问模式天差地别：

- **关系型数据库（RDBMS - PostgreSQL）**：
  - 数据模型严格标准化为表、行与列，外键约束天然守护业务完整性（如“不允许存在没有作者孤立图书”）。
  - 支持多表 JOIN、复杂的聚合统计和严格的 ACID 事务。在库存微服务中，我们需要保证每笔库存扣减与图书元数据的绝对一致。
- **文档型 NoSQL 数据库（MongoDB）**：
  - 数据以类似 JSON 的 BSON 文档组织，无需预先固化严格的 Schema。
  - 用户配置、收货地址、阅读偏好等字段会随系统演进而快速迭代。文档天然支持嵌套层级结构，单次查询即可直接返回完整聚合根，极大地降低了多次 JOIN 带来的查询开销与锁冲突。

下表总结了在微服务实践中两者的技术特征对比：

| 架构维度 | PostgreSQL (关系型) | MongoDB (文档型 NoSQL) |
| :--- | :--- | :--- |
| **数据模型** | 表 (Tables)、行 (Rows)、列 (Columns) | 集合 (Collections)、BSON 文档 (Documents) |
| **Schema 约束** | 强 Schema，修改字段需 DDL 迁移 | 动态无模式（Schema-less），灵活演进 |
| **查询方式** | SQL / JPQL | 声明式 BSON / JSON 查询、聚合管道 |
| **关联处理** | 原生高效的外键与多表 JOIN | 倾向内嵌文档（Embedding），谨慎使用 `$lookup` |
| **事务支持** | 完整的跨表 ACID 事务 | 支持单文档原子性与跨文档分布式事务 |
| **业务适配** | 强关联、高一致性、结构稳定的库存/订单/账务 | 模式灵活、深层嵌套、高频读取的用户画像/偏好/日志 |
| **在全栈实战中的归属** | **库存微服务（Inventory Service）** | **用户微服务（User Service）** |

---

## 2. 基于 PostgreSQL + Spring Data JPA 构建库存微服务

我们首先落地库存微服务的数据持久层。

### 2.1 本地 Docker 容器化编排

通过容器化基础设施，我们可以摆脱本地环境脏依赖的困扰，保证开发、CI/CD 与生产环境的高度一致：

```bash
docker run -d \
  --name bookstore-postgres \
  -e POSTGRES_USER=bookstore \
  -e POSTGRES_PASSWORD=bookstore123 \
  -e POSTGRES_DB=inventory \
  -p 5432:5432 \
  postgres:17
```

参数解释：
- `-e POSTGRES_USER=bookstore` / `POSTGRES_PASSWORD=bookstore123`：设置数据库超级用户与鉴权口令。
- `-e POSTGRES_DB=inventory`：在容器启动时自动初始化名为 `inventory` 的数据库，作为库存微服务的专属数据库边界。
- `-p 5432:5432`：将容器内 PostgreSQL 标准端口映射到宿主机。

启动后通过以下指令验证容器运行状态与端口占用：

```bash
docker ps --filter "name=bookstore-postgres"
```

![验证 PostgreSQL 容器运行状态](/media/posts/spring-boot-angular/img-08933.png)

同时可通过系统指令确认 5432 端口正被监听：

```bash
lsof -i :5432
```

![验证 5432 端口监听状态](/media/posts/spring-boot-angular/img-08935.png)

---

### 2.2 Maven 核心依赖声明

在库存微服务（`inventory-ms`）的 `pom.xml` 中引入 Spring Data JPA 核心依赖与 PostgreSQL 官方 JDBC 驱动：

```xml
<!-- Lombok：大幅精简 Getter/Setter 与 Builder 样板代码 -->
<dependency>
  <groupId>org.projectlombok</groupId>
  <artifactId>lombok</artifactId>
  <optional>true</optional>
</dependency>

<!-- PostgreSQL JDBC Driver -->
<dependency>
  <groupId>org.postgresql</groupId>
  <artifactId>postgresql</artifactId>
  <scope>runtime</scope>
</dependency>

<!-- Spring Data JPA 与 Hibernate ORM 启动器 -->
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>
```

---

### 2.3 数据源与 JPA 参数深度配置

在 `src/main/resources/application.yml` 中配置连接池与 Hibernate 运行时行为：

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

#### 关键生产参数深度解析：
1. **`hibernate.ddl-auto: update`**：
   在本地开发阶段，Hibernate 会比对实体定义并自动同步增量数据库表结构。
   > [!IMPORTANT]
   > 在生产或预发环境中，必须将其显式设置为 `validate` 或 `none`！绝不能依赖 Hibernate 自动修改生产表结构，应使用 **Flyway** 或 **Liquibase** 执行严格版本化的 SQL 迁移脚本。
2. **`open-in-view: false`**：
   Spring Boot 默认开启 OSIV（Open Session In View），会导致数据库连接一直保持到视图或 JSON 序列化阶段，容易造成连接池耗尽并引发隐蔽的延迟加载异常。将其设为 `false`，强迫所有懒加载和数据访问必须发生在明确声明的 `@Transactional` 服务层边界之内。
3. **Hibernate SQL 追踪**：
   将 `org.hibernate.SQL` 设为 `DEBUG`，`org.hibernate.type.descriptor.sql` 设为 `TRACE`，可在控制台清晰观察到生成的参数化 SQL 语句及实际入参绑定，极大方便调优。

执行启动命令验证数据源与 JPA 初始化：

```bash
./mvnw spring-boot:run
```

![库存微服务启动日志](/media/posts/spring-boot-angular/img-08937.png)

日志中出现 `Bootstrapping Spring Data JPA repositories` 以及 `HikariDataSource ... connected to jdbc:postgresql://...`，即代表数据源与 ORM 引擎装载完毕。

---

### 2.4 JPA 领域实体建模

在书店库存领域中，核心领域模型由图书（`Book`）、作者（`Author`）以及通用审计元数据（`Auditable`）构成，其类图设计如下：

![库存微服务实体类图关联](/media/posts/spring-boot-angular/img-08939.png)

#### 1. 抽取基础审计类（`Auditable`）
所有实体都应具备基础的创建与最后修改时间。借助 Spring Data JPA 提供的 `@EntityListeners(AuditingEntityListener.class)`，我们无需手动干预时间戳：

```java
package com.packt.bookstore.inventory.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.MappedSuperclass;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
@Data
public abstract class Auditable {

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
```

别忘了在微服务主启动类上开启审计扫描：

```java
@SpringBootApplication
@EnableJpaAuditing
public class InventoryMsApplication {
    public static void main(String[] args) {
        SpringApplication.run(InventoryMsApplication.class, args);
    }
}
```

#### 2. 图书实体（`Book`）
`Book` 是库存领域的聚合根，负责维护与 `Author` 的多对一关联：

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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id", nullable = false)
    private Author author;

    private String genre;
    private LocalDate published;

    @Column(length = 2000)
    private String description;

    private Integer pageCount;
    private String coverImageUrl;
}
```

> [!NOTE]
> 主键生成策略选用 `GenerationType.IDENTITY`，由底层 PostgreSQL 的 `SERIAL` / `BIGIDENTITY` 序列负责自动递增。关联关系必须显式声明 `FetchType.LAZY`（懒加载），严禁使用默认的 EAGER，以防意外的全表级联拉取。

#### 3. 避免 N+1 查询隐患与 `JOIN FETCH` 优化
懒加载能避免非必要的关联拉取，但在列表场景（例如 `bookRepository.findAll()` 并遍历输出作者名字时），ORM 会先执行 1 次查询查出所有图书，然后对每本图书单独触发 1 次 `author` 的 SQL 查询。如果有 100 本图书，就会产生 $1 + 100$ 次查询，带来严重的数据库 IO 瓶颈。

应对方案是通过自定义 JPQL 显式使用 `JOIN FETCH`，实现单次 SQL 完成双表内联：

```java
@Query("SELECT b FROM Book b JOIN FETCH b.author")
List<Book> findAllWithAuthors();
```

#### 4. 作者实体（`Author`）
`Author` 作为反向一对多关系持有方：

```java
package com.packt.bookstore.inventory.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.List;

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

    @Column(nullable = false)
    private String name;

    private String nationality;

    @OneToMany(mappedBy = "author", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    private List<Book> books;
}
```

---

### 2.5 Spring Data JPA 核心 Repository 层设计

Spring Data 采用声明式接口替代了繁重的 DAO 实现类。在框架继承体系中：
- `CrudRepository`：提供保存、单条查询、删除等基础持久能力。
- `PagingAndSortingRepository`：引入物理分页（`Pageable`）与动态排序（`Sort`）。
- `JpaRepository`：继承上述所有接口，并追加批量操作（`saveAllAndFlush`）、持久化上下文刷新（`flush`）以及更丰富的泛型支持。

#### 1. `AuthorRepository`
利用方法命名约定（Method Name Derivation），Spring 会在启动期自动解析语义并翻译为底层 SQL：

```java
package com.packt.bookstore.inventory.repository;

import com.packt.bookstore.inventory.entity.Author;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AuthorRepository extends JpaRepository<Author, Long> {
    Optional<Author> findByName(String name);
}
```

#### 2. `BookRepository`（丰富查询与多维检索）

```java
package com.packt.bookstore.inventory.repository;

import com.packt.bookstore.inventory.entity.Book;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface BookRepository extends JpaRepository<Book, Long>, JpaSpecificationExecutor<Book> {

    // 1. 衍生查询：忽略大小写模糊匹配书名
    List<Book> findByTitleContainingIgnoreCase(String keyword);

    // 2. 跨实体属性穿透：根据关联作者姓名过滤
    List<Book> findByAuthor_Name(String authorName);

    // 3. 数值闭区间检索
    List<Book> findByPriceBetween(BigDecimal min, BigDecimal max);

    // 4. 自定义 JPQL：多条件安全绑定
    @Query("SELECT b FROM Book b WHERE LOWER(b.title) LIKE LOWER(CONCAT('%', :keyword, '%')) AND b.price > :minPrice")
    List<Book> searchBooks(@Param("keyword") String keyword, @Param("minPrice") BigDecimal minPrice);

    // 5. 抓取作者信息以杜绝 N+1 查询
    @Query("SELECT b FROM Book b JOIN FETCH b.author")
    List<Book> findAllWithAuthors();

    // 6. 原生 SQL 优化：利用 PostgreSQL 专属 ILIKE 操作符加速不区分大小写匹配
    @Query(value = "SELECT * FROM books WHERE title ILIKE CONCAT('%', :keyword, '%')", nativeQuery = true)
    List<Book> nativeSearch(@Param("keyword") String keyword);

    // 7. 分页与关系穿透结合
    Page<Book> findByAuthor_Name(String name, Pageable pageable);

    // 8. 唯一性校验辅助查询
    Optional<Book> findByIsbnIgnoreCase(String isbn);
    boolean existsByIsbnIgnoreCase(String isbn);
}
```

#### 3. 动态组合查询：JPA Specification 模式
在电商类系统的后台管理中，常常需要支持组合多选筛选（如“标题包含关键字 AND 价格在区间内 AND 分类属于 X”）。Spring Data JPA 提供的 `Specification` 结合了 Criteria API 的动态构建能力：

```java
package com.packt.bookstore.inventory.repository.spec;

import com.packt.bookstore.inventory.entity.Book;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;

public final class BookSpecifications {

    private BookSpecifications() {}

    public static Specification<Book> hasTitleLike(String keyword) {
        return (root, query, cb) -> {
            if (keyword == null || keyword.isBlank()) return cb.conjunction();
            return cb.like(cb.lower(root.get("title")), "%" + keyword.toLowerCase() + "%");
        };
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

在服务层可极其优雅地链式组装：

```java
List<Book> results = bookRepository.findAll(
    Specification.where(BookSpecifications.hasTitleLike("Spring"))
                 .and(BookSpecifications.priceBetween(new BigDecimal("10.00"), new BigDecimal("50.00")))
);
```

---

## 3. 基于 MongoDB + Spring Data 构建用户微服务

关系型模型处理强一致结构十分优秀，但在用户中心，用户的偏好配置（如多语言、主题、通知选项）、多套收货地址与身份信息可能频繁扩展。在关系型数据库中，要么建立大量关联表，要么频繁产生 NULL 字段。

我们转向文档型设计，让一个 `User` 聚合根直接包裹其所有从属数据。

### 3.1 本地 Docker 容器化编排 MongoDB 8

```bash
docker run -d \
  --name bookstore-mongo \
  -e MONGO_INITDB_ROOT_USERNAME=bookstore \
  -e MONGO_INITDB_ROOT_PASSWORD=bookstore123 \
  -e MONGO_INITDB_DATABASE=userDB \
  -p 27017:27017 \
  mongo:8
```

启动后验证容器状态与 27017 端口占用：

```bash
docker ps --filter "name=bookstore-mongo"
lsof -i :27017
```

---

### 3.2 用户微服务脚手架与依赖装配

在 `user-ms` 的 `pom.xml` 中引入 Spring Data MongoDB 官方 Starter：

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-data-mongodb</artifactId>
</dependency>
<dependency>
  <groupId>org.projectlombok</groupId>
  <artifactId>lombok</artifactId>
  <optional>true</optional>
</dependency>
```

配置 `application.yml`（独立指定运行端口为 `8082`，与库存微服务的 `8081` 区分）：

```yaml
spring:
  application:
    name: user-ms
  mongodb:
    uri: mongodb://bookstore:bookstore123@localhost:27017/userDB?authSource=admin

server:
  port: 8082
```

---

### 3.3 文档实体领域建模（内嵌文档实践）

在 MongoDB 中，我们将相关联的 `Profile`、`Address` 和 `Preferences` 直接内嵌到 `User` 主文档内，其聚合类图如下：

![用户微服务文档实体类图](/media/posts/spring-boot-angular/img-08942.png)

#### 1. 聚合根文档：`User`
使用 `@Document(collection = "users")` 映射集合，并通过 `@Indexed(unique = true)` 让数据库层面保障邮箱与用户名的全局唯一性：

```java
package com.packt.bookstore.usermanagement.document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

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

    private LocalDateTime dateOfBirth;
    private String status;

    private Profile profile;       // 内嵌实体
    private Preferences preferences; // 内嵌配置

    private LocalDateTime createdAt;
    private LocalDateTime lastLogin;
}
```

#### 2. 内嵌对象：`Profile`、`Address` 与 `Preferences`
这些类不需要添加 `@Document` 注解，仅作为主文档内部的 BSON 子文档被序列化与持久化：

```java
package com.packt.bookstore.usermanagement.document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Profile {
    private String fullName;
    private String birthDate;
    private String phone;
    private Address address; // 嵌套深层地址对象
}

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Address {
    private String street;
    private String city;
    private String state;
    private String postalCode;
    private String country;
}

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Preferences {
    private String language;
    private Boolean newsletter;
    private String currency;
    private String[] favoriteGenres;
}
```

这种组合模式使得查询单个用户时，无需跨表 JOIN，一条单文档读取即可获取其全量档案，大幅降低了查询延迟。

---

### 3.4 `UserRepository` 声明式数据访问

```java
package com.packt.bookstore.usermanagement.repository;

import com.packt.bookstore.usermanagement.document.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends MongoRepository<User, String> {

    // 1. 基于唯一索引查询，使用 Optional 防御 NPE
    Optional<User> findByEmail(String email);

    // 2. 用户名模糊检索
    List<User> findByUsernameContainingIgnoreCase(String keyword);

    // 3. 状态分页查询
    Page<User> findAllByStatus(String status, Pageable pageable);

    // 4. 点路径穿透查询内嵌字段：JSON 语法原生匹配
    @Query("{ 'preferences.language': ?0 }")
    List<User> findByLanguagePreference(String language);
}
```

若遇到高度动态的复杂条件检索，还可以利用 `MongoTemplate` 结合 `Criteria` API 实现灵活拼装：

```java
@Autowired
private MongoTemplate mongoTemplate;

public List<User> searchUsers(String city, String lang) {
    Query query = new Query();
    if (city != null) {
        query.addCriteria(Criteria.where("profile.address.city").is(city));
    }
    if (lang != null) {
        query.addCriteria(Criteria.where("preferences.language").is(lang));
    }
    return mongoTemplate.find(query, User.class);
}
```

---

## 4. 架构对照复盘：Spring Data JPA vs MongoDB Repository

在多范式持久化架构中，尽管统一了以 `Repository` 为核心的编程模型，两者的内部实现机制与设计哲学仍存在本质差异：

| 关注维度 | Spring Data JPA (PostgreSQL) | Spring Data MongoDB (MongoDB) | 工程实践与架构考量 |
| :--- | :--- | :--- | :--- |
| **主键标识** | `Long` / `UUID`，依赖 `@GeneratedValue` 自增或序列 | `String`（映射 `ObjectId`）或 `UUID` 映射 `_id` | JPA 强依赖底层 DB 序列；MongoDB 默认在应用端生成全局唯一 ObjectId |
| **单一结果返回** | 推荐显式返回 `Optional<T>` | 推荐显式返回 `Optional<T>` | 杜绝隐式返回 `null`，强迫调用方在服务层处理资源不存在的边界 |
| **嵌套数据访问** | `@OneToMany` / `@ManyToOne`，严格外键约束 | 点路径语法（Dot notation），如 `'profile.address.city'` | JPA 优先考虑三范式规范；MongoDB 优先考虑读性能与内嵌聚合 |
| **复杂查询手段** | JPQL (`@Query`)、本地 SQL、`Specification` API | JSON 表达式 (`@Query`)、`MongoTemplate` + `Criteria` | 分别运用对应存储引擎的最强表现力 |
| **索引治理** | 数据库级别建索引，实体端保持对齐 | 实体声明 `@Indexed(unique = true)` 辅助生成 | 无论是关系型还是文档型，被高频检索的字段必须建立索引 |
| **测试切片工具** | `@DataJpaTest`（默认配合 H2 或 Testcontainers） | `@DataMongoTest`（配合 Testcontainers） | 提供微秒级的持久层切片单元测试 |

---

## 5. 数据源直连检查与持久层切片测试

### 5.1 本地 IDE 可视化数据校验

在编写测试代码前，我们建议先使用数据库工具直接窥探底层存储，确保表结构与文档形态符合预期。

#### 1. PostgreSQL 校验
在 VS Code 中安装 PostgreSQL 官方扩展，连接 `postgresql://bookstore:bookstore123@localhost:5432/inventory`：

![配置 PostgreSQL 数据库连接](/media/posts/spring-boot-angular/img-08945.png)

展开数据库节点，在 SQL 编辑器中运行：

```sql
SELECT * FROM books;
SELECT * FROM authors;
```

![PostgreSQL 表数据查询确认](/media/posts/spring-boot-angular/img-08947.png)

#### 2. MongoDB 校验
安装 MongoDB 官方扩展并连接 `mongodb://bookstore:bookstore123@localhost:27017/userDB?authSource=admin`：

![MongoDB 扩展连接配置](/media/posts/spring-boot-angular/img-08953.png)

打开 `users` 集合，即可看到保存的 BSON 文档，所有内嵌类均以标准 JSON 结构完整内聚：

```json
{
  "_id": "66af4d...",
  "email": "user@example.com",
  "username": "agohar",
  "status": "ACTIVE",
  "profile": {
    "fullName": "Ahmad Gohar",
    "address": {
      "city": "Cairo",
      "country": "Egypt"
    }
  },
  "preferences": {
    "language": "zh",
    "newsletter": true
  },
  "_class": "com.packt.bookstore.usermanagement.document.User"
}
```

---

### 5.2 核心自动化测试实战

持久层测试的核心目标是验证：**SQL/JPQL 语法合法性、主外键级联映射是否生效、方法名衍生查询与分页是否返回准确子集**。

Spring Boot 提供了精细化的测试切片：
- `@DataJpaTest` / `@DataMongoTest`：极速测试，只初始化 Repository 和数据源，不启动 Web 容器。
- `@SpringBootTest` + `@Transactional`：启动全量容器，用于验证真实数据库环境下的完整持久链路。测试执行完毕后事务自动回滚，确保环境幂等。

我们编写针对 `BookRepository` 的全场景集成测试类：

```java
package com.packt.bookstore.inventory.repository;

import com.packt.bookstore.inventory.entity.Author;
import com.packt.bookstore.inventory.entity.Book;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static com.packt.bookstore.inventory.repository.spec.BookSpecifications.hasTitleLike;
import static com.packt.bookstore.inventory.repository.spec.BookSpecifications.priceBetween;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional // 每个用例结束后自动回滚，保持数据纯净
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

        author = Author.builder()
                .name("Ahmad Gohar")
                .nationality("Egyptian")
                .build();
        author = authorRepository.save(author);

        Book book = Book.builder()
                .title("Spring Boot and Angular - 2nd Edition")
                .isbn("978-1805123456")
                .price(new BigDecimal("49.99"))
                .quantity(100)
                .author(author)
                .genre("Technology")
                .published(LocalDate.of(2026, 1, 1))
                .build();
        bookRepository.save(book);
    }

    @Test
    @DisplayName("测试基础查询与关联映射：验证图书能够正确级联加载作者")
    void testFindAllAndRelationship() {
        List<Book> books = bookRepository.findAll();
        assertThat(books).hasSize(1);
        assertThat(books.get(0).getTitle()).isEqualTo("Spring Boot and Angular - 2nd Edition");
        assertThat(books.get(0).getAuthor().getName()).isEqualTo("Ahmad Gohar");
    }

    @Test
    @DisplayName("测试方法名衍生查询：不区分大小写模糊匹配")
    void testFindByTitleContainingIgnoreCase() {
        List<Book> books = bookRepository.findByTitleContainingIgnoreCase("spring");
        assertThat(books).hasSize(1);
        assertThat(books.get(0).getIsbn()).isEqualTo("978-1805123456");
    }

    @Test
    @DisplayName("测试属性路径穿透：通过关联 Author.name 查询图书")
    void testFindByAuthorName() {
        List<Book> books = bookRepository.findByAuthor_Name("Ahmad Gohar");
        assertThat(books).hasSize(1);
    }

    @Test
    @DisplayName("测试价格区间检索：边界值验证")
    void testFindByPriceBetween() {
        List<Book> books = bookRepository.findByPriceBetween(new BigDecimal("40.00"), new BigDecimal("60.00"));
        assertThat(books).hasSize(1);

        List<Book> emptyResult = bookRepository.findByPriceBetween(new BigDecimal("10.00"), new BigDecimal("20.00"));
        assertThat(emptyResult).isEmpty();
    }

    @Test
    @DisplayName("测试 JOIN FETCH 解决 N+1 查询")
    void testFindAllWithAuthors() {
        List<Book> books = bookRepository.findAllWithAuthors();
        assertThat(books).isNotEmpty();
        assertThat(books.get(0).getAuthor().getNationality()).isEqualTo("Egyptian");
    }

    @Test
    @DisplayName("测试物理分页与排序：验证 Page 元数据及切片容量")
    void testFindByAuthorNameWithPagination() {
        Pageable pageable = PageRequest.of(0, 10, Sort.by("title").ascending());
        Page<Book> bookPage = bookRepository.findByAuthor_Name("Ahmad Gohar", pageable);

        assertThat(bookPage.getContent()).hasSize(1);
        assertThat(bookPage.getTotalPages()).isEqualTo(1);
        assertThat(bookPage.getTotalElements()).isEqualTo(1);
    }

    @Test
    @DisplayName("测试 Specification 动态组合规约查询")
    void testBookSpecifications() {
        var spec = hasTitleLike("Angular")
                .and(priceBetween(new BigDecimal("30.00"), new BigDecimal("70.00")));

        List<Book> results = bookRepository.findAll(spec);
        assertThat(results).hasSize(1);
    }
}
```

---

## 6. 本篇小结与下篇展望

在本篇中，我们通过书店系统完整构建了微服务的多范式持久层架构：
1. **持久化选型与边界划分**：掌握了关系型数据库（PostgreSQL）与文档型数据库（MongoDB）的技术适用场景，坚守了 Database-per-Service 的自治原则；
2. **Spring Data JPA 实战**：在库存微服务中完成了实体建模、主键策略、自动审计配置、N+1 查询治理，并落地了衍生查询、JPQL、原生 SQL 及 Specification 动态筛选；
3. **Spring Data MongoDB 实战**：在用户微服务中实践了内嵌文档（Embedded Document）设计模式，体验了灵活演进且免去复杂 JOIN 的文档查询；
4. **测试与质量守护**：通过本地 Docker 容器与 `@SpringBootTest` 自动化测试用例，确保了持久层在真实环境下的健壮性。

持久层仅仅是整个架构的基石。在下一篇 **《Spring Boot & Angular 全栈实战（五）：应用服务层与企业级 RESTful API 实战》** 中，我们将在持久层之上构建企业级的应用服务层（Service Layer），完成 DTO 映射、参数校验、全局异常治理与生产级 RESTful API 的设计与实现。敬请期待！
