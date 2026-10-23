---
title: Spring Boot & Angular 全栈实战（十）：后端多微服务容器化构建与 Docker Compose 统一编排
date: 2026-10-23T00:10:00Z
description: 基于分层 JAR 与多阶段 Dockerfile 构建轻量化后端微服务容器镜像，利用 Docker Compose 编排数据库、网关与微服务全栈集群。
category: fullstack
column: spring-boot-angular
tags:
  - Docker
  - Docker Compose
  - 容器化
  - Spring Boot
  - 生产部署
---

> 💡 **专栏导读**：本文收录于专栏 [《Spring Boot 4 & Angular 22 全栈微服务实战》](/columns/spring-boot-angular)。全专栏共 22 篇，深度覆盖 Java 26 微服务拆分、Spring Cloud 网关与安全鉴权、Angular 22 Signals 状态治理以及端到端容器化交付的全链路工程实践。

---

在前几章中，我们使用现代 Java 技术栈（Java 26、Spring Boot、Spring Data、Spring Security 与 Spring WebFlux）逐步构建起了 Bookstore（书店系统）微服务后端体系。我们先后落地了库存微服务（Inventory Service）、用户微服务（User Service）以及 API 网关与分布式可观测性设施。

然而，软件工程的生命周期绝不会终止于“代码在本地能成功编译”。在由多个甚至几十个微服务组成的现代化分布式架构中，如何将异构服务可靠、可预测、自包含地打包并发布到各类运行时环境，是贯穿 CI/CD 与 DevOps 交付链条的核心基石。

本文将带领大家系统化走通后端微服务从代码到容器交付的全流程：从 Java 后端打包演化史切入，深入容器化底层的 Linux 隔离机制与镜像分层哲学；接着运行 PostgreSQL、MongoDB 与 Zipkin 等支撑基础设施容器；随后为 Spring Boot 微服务编写生产级多阶段 Dockerfile，并深入探讨 Spring Boot Cloud Native Buildpacks 与 Google Jib 自动化镜像构建工具；最后，通过 Docker Compose 声明式编排整个微服务拓扑，实现一键拉起全栈微服务后端。

---

## 1. 后端打包策略的演进脉络

在 Java 企业级架构演进的数十年历程中，应用的打包交付模式经历了三次标志性跃迁。理解这一技术变迁，有助于我们看清现代云原生标准背后的本质诉求。

### 1.1 传统企业级 WAR 包时代

在传统单体架构时期，Java 应用通常被打包为 **WAR**（Web Application ARchive）包，并部署到外部应用服务器（如 Apache Tomcat、JBoss、WebLogic、WebSphere）中：

```xml
<packaging>war</packaging>
```

在这种模式下，应用服务器充当基础运行容器并管理连接池、线程池与 JVM 参数，WAR 包内仅包含业务类与静态资源。当面向微服务架构时，WAR 模型的弊端暴露无遗：
- **强耦合应用服务器**：部署行为严重依赖宿主服务器的版本、类加载器配置及全局全局类库，容易发生环境漂移；
- **扩缩容颗粒度过大**：弹性伸缩往往需要整体复制应用服务器实例，资源开销沉重；
- **依赖升级协同困难**：共享应用服务器难以支持多个子模块采用不同版本的底层组件。

### 1.2 Spring Boot 可执行 Fat JAR 革命

Spring Boot 彻底颠覆了上述交付形态。它倡导 **“嵌入式容器”** 理念，将应用所需的 Servlet 引擎（如 Tomcat）或反应式容器（如 Netty）直接内嵌到应用自身中。

当通过 Maven 打包时：

```bash
mvn clean package
```

构建结果是在 `target/` 目录下生成一个独立的 Fat/Uber JAR：

```text
target/inventory-ms-0.0.1-SNAPSHOT.jar
```

该可执行 JAR 包含了编译后的业务代码、所有第三方依赖库、内嵌 Web 容器以及应用配置，只需一行命令即可启动：

```bash
java -jar inventory-ms-0.0.1-SNAPSHOT.jar
```

这种自包含交付模式极大降低了部署复杂性，使得每个微服务能够独立运行、独立演进与独立扩缩。然而，Fat JAR 依然未能彻底摆脱对宿主机运行环境的依赖：目标服务器必须预装匹配的 JVM 版本、C 标准库以及系统级工具链。

### 1.3 面向微服务的容器化交付

容器化技术将“自包含”的理念推向了极致：**容器不仅打包了应用程序本身，还将操作系统最小文件系统、特定版本的 JRE 运行时、动态链接库、应用配置与启动脚本全部打包进一个只读且不可变的镜像文件中**。

容器镜像具备天然的不可变性（Immutability）：在本地构建并验证通过的镜像，可以在集成测试、预发布环境和生产 Kubernetes 集群中实现毫无偏差的同构运行，彻底解决了“在我机器上好好的，为什么上线就崩”的配置漂移顽疾。

---

## 2. 容器化底层核心原理与生命周期

在动手编写 Docker 命令前，我们必须从系统层面厘清容器的工作方式。

### 2.1 容器与虚拟机的架构对比

传统虚拟机（VM）采用 Hypervisor 硬件虚拟化技术，每个虚拟机内都需要运行完整的 Guest OS（客户操作系统内核、系统服务），这导致 VM 启动需要数分钟，内存与磁盘占用通常高达数吉字节。

相比之下，容器并非硬件虚拟化，而是**基于 Linux 内核的原生进程级隔离技术**：
- **Namespaces（命名空间）**：实现进程视图的六重隔离，包括 PID（进程树）、NET（网络栈与端口）、MNT（挂载点/文件系统）、IPC（进程间通信）、UTS（主机名）与 USER（用户映射）；
- **Control Groups（cgroups）**：实现物理资源的硬性配额与度量，包括 CPU 核心数、内存使用上限、磁盘 I/O 带宽与进程数控制；
- **共享宿主内核**：所有容器直接复用宿主机的 Linux 内核，没有客体操作系统的损耗，启动时间以毫秒级计，单机可高密度运行数百个微服务实例。

### 2.2 镜像分层与联合文件系统（Layered Filesystem）

容器镜像由多层只读层堆叠而成，底层由联合文件系统（如 OverlayFS）支撑：
- Dockerfile 中的每一条指令（`FROM`、`RUN`、`COPY` 等）都会生成一个新的只读镜像层；
- 当镜像启动为容器时，存储驱动会在所有只读层之上附加一个薄薄的**可写容器层**（Container Layer）；
- 所有读写操作均通过写时复制（Copy-on-Write）机制进行：修改文件时仅在可写层生成副本，绝不破坏底层镜像。

分层存储带来了极高的分发与构建性能：
1. **构建缓存**：若前几层未发生变动，构建时会直接命中本地缓存，仅需重新编译变动层；
2. **跨镜像共享**：Inventory Service 与 User Service 可以共用完全相同的基础 Java 运行时镜像层，宿主机只需拉取与存储一次基础镜像。

### 2.3 容器生命周期全景

容器化标准工作流涵盖了构建、发布、运行与治理全流程：

![容器全生命周期工作流](/media/posts/spring-boot-angular/img-09037.png)

1. **Build（构建）**：开发者基于 Dockerfile 或构建插件将源码编译并组装为镜像；
2. **Push（发布）**：将携带规范版本标签（Tag）的镜像推送到中央镜像仓库（Container Registry）；
3. **Pull（拉取）**：目标节点按需从仓库拉取镜像层；
4. **Run（运行）**：容器运行时（Docker、Podman、containerd 等）解析镜像并创建隔离沙箱实例；
5. **Monitor & Terminate（监控与回收）**：采集健康指标，完成停止或销毁。

---

## 3. 本地支撑基础设施容器化部署

在 Bookstore 系统中，微服务依赖于数个后端支撑组件：
- **PostgreSQL 17**：作为 Inventory Service 的关系型数据持久层（Spring Data JPA）；
- **MongoDB 7**：作为 User Service 的文档型持久层（Spring Data MongoDB）；
- **Zipkin**：作为分布式可观测性组件，采集全链路请求 Tracing 跨服务追踪数据。

我们无需在本地安装繁重且容易冲突的独立软件包，直接拉取官方就绪镜像并运行容器。

### 3.1 拉取并验证官方镜像

通过 `docker pull` 从 Docker Hub 获取基础软件镜像：

```bash
docker pull postgres:17
docker pull mongo:7
docker pull openzipkin/zipkin
```

镜像下载后，可通过 `docker images` 检查本地镜像缓存：

```bash
docker images postgres
```

输出显示仓库名、Tag、镜像 ID、创建时间及物理占用大小：

![查看本地 PostgreSQL 镜像](/media/posts/spring-boot-angular/img-09038.png)

### 3.2 启动 PostgreSQL 数据库容器

启动支撑库存服务的关系型数据库实例：

```bash
docker run -d \
  --name bookstore-postgres \
  -e POSTGRES_DB=inventory \
  -e POSTGRES_USER=bookstore \
  -e POSTGRES_PASSWORD=bookstore123 \
  -p 5432:5432 \
  postgres:17
```

**参数技术解析**：
- `-d`（Detached mode）：后台守护进程模式运行，释放终端控制台；
- `--name bookstore-postgres`：显式指定易读容器名称，便于后续状态追踪与管理；
- `-e`：注入环境变量，配置默认数据库名、账密凭据；
- `-p 5432:5432`：宿主机端口与容器内部端口映射（`host_port:container_port`），使得宿主机上的 Spring Boot 应用能够通过 `localhost:5432` 正常连接。

### 3.3 启动 MongoDB 与 Zipkin 容器

启动用户服务的文档数据库：

```bash
docker run -d \
  --name bookstore-mongo \
  -p 27017:27017 \
  mongo:7
```

启动分布式追踪可视化服务端 Zipkin：

```bash
docker run -d \
  --name bookstore-zipkin \
  -p 9411:9411 \
  openzipkin/zipkin
```

容器启动后，在浏览器直接访问 `http://localhost:9411`，即可进入 Zipkin UI 监控看板。

### 3.4 容器巡检、排错与资源管理

执行 `docker ps` 查看所有活跃容器状态：

```bash
docker ps
```

控制台将输出容器 ID、镜像、启动命令、运行时长、端口映射及容器名：

![查看活跃容器清单](/media/posts/spring-boot-angular/img-09040.png)

常用管理排错命令：
- **查看停止与异常容器**：`docker ps -a`
- **查看实时输出日志**：`docker logs bookstore-postgres`（可加 `-f` 实时跟踪）
- **优雅停止容器**：`docker stop bookstore-postgres`（向容器 PID 1 进程发送 `SIGTERM`，超时后再发送 `SIGKILL`）
- **销毁已停止容器**：`docker rm bookstore-postgres`
- **清理本地无用镜像**：`docker rmi postgres:17`

---

## 4. Spring Boot 微服务自定义容器镜像构建

基础中间件准备就绪后，核心任务是为我们编写的 Spring Boot 微服务打造生产级自定义容器镜像。

### 4.1 基础单阶段 Dockerfile

在库存服务根目录下，最基础的 Dockerfile 编写方式如下：

```dockerfile
FROM eclipse-temurin:26-jdk
LABEL maintainer="bookstore-platform"
WORKDIR /opt/bookstore
COPY target/inventory-service-v0.0.1.jar inventory-service.jar
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "inventory-service.jar"]
```

**指令拆解说明**：
- `FROM eclipse-temurin:26-jdk`：采用 Adoptium 官方维护的 Eclipse Temurin Java 26 镜像，保证安全补丁与现代 JVM 兼容性；
- `LABEL`：写入镜像元数据（作者、版本、维护者等）；
- `WORKDIR /opt/bookstore`：指定工作目录，后续的 `COPY`、`RUN`、`ENTRYPOINT` 均以此目录为相对路径；
- `COPY`：将宿主机 Maven 打包好的 JAR 拷贝至镜像文件系统中；
- `EXPOSE 8081`：声明容器对外暴露的网络端口（元数据声明，便于运维排查）；
- `ENTRYPOINT`：容器启动的默认可执行程序（采用 Exec 格式 `["java", "-jar", "..."]`，保证 Java 进程作为 PID 1 接收操作系统系统信号）。

构建该镜像：

```bash
# 1. 宿主机 Maven 编译
mvn clean package

# 2. 构建 Docker 镜像
docker build -t bookstore/inventory-service:v0.0.1 .
```

启动并验证：

```bash
docker run -d -p 8081:8081 --name inventory-service bookstore/inventory-service:v0.0.1
```

### 4.2 生产级多阶段构建（Multi-Stage Builds）

基础 Dockerfile 存在明显的工程隐患：
1. 依赖宿主机环境预装特定版本的 Maven 与 JDK；
2. 若在镜像内部包含构建工具（如同时装有 Maven、源码、编译器），会导致最终产物镜像极其臃肿（动辄数百 MB 乃至 1GB 以上），并引入不必要的攻击面。

**多阶段构建**（Multi-Stage Builds）能够将**编译构建环境**与**极简生产运行时**彻底解耦：

```dockerfile
# ==========================================
# 第一阶段：编译构建阶段（Builder Stage）
# ==========================================
FROM maven:3.9-eclipse-temurin-26 AS builder
WORKDIR /app

# 优先拷贝 POM 文件并下载依赖，充分利用 Docker 缓存层
COPY pom.xml .
RUN mvn dependency:go-offline -B

# 拷贝源码并打包，跳过单元测试
COPY src ./src
RUN mvn clean package -DskipTests

# ==========================================
# 第二阶段：生产运行阶段（Runtime Stage）
# ==========================================
FROM eclipse-temurin:26-jre
WORKDIR /app

# 仅从第一阶段产物中拷贝最终的可执行 JAR
COPY --from=builder /app/target/inventory-ms-*.jar app.jar

EXPOSE 8081

# 采用非 root 用户与精细化 JVM 容器参数（可选进阶）
ENTRYPOINT ["java", "-jar", "app.jar"]
```

**多阶段构建的核心收益**：
- **极致体积裁剪**：最终镜像基于极简的 `eclipse-temurin:26-jre`（或 Alpine 衍生版），剔除了 Maven 编译器、源码、本地依赖缓存仓库（`~/.m2`），镜像体积通常缩减 60% 以上；
- **环境绝对一致**：宿主机无需安装任何 Maven 或 Java 环境，仅需 Docker 即可完成从源码到镜像的全部流水线；
- **攻击面降到最低**：生产环境中不存在编译构建工具，防范远程代码注入或提权攻击。

### 4.3 自动化镜像构建工具：Buildpacks 与 Google Jib

在大型微服务研发团队中，如果让每位开发者都手工维护十几个服务的 Dockerfile，容易发生语法不规范、基础镜像不统一的问题。现代 Java 生态提供了两种高效的自动化镜像生成技术。

#### 方案一：Spring Boot 官方 Cloud Native Buildpacks

Spring Boot 原生集成了 CNCF Cloud Native Buildpacks。无需编写任何 Dockerfile，仅需执行：

```bash
mvn spring-boot:build-image
```

**工作机制**：
- 自动探测 Spring Boot 项目特征与 Java 版本；
- 运用分层技术，将应用拆解为：第三方依赖层、Spring Boot Loader 引导层、应用代码层；
- 自动根据容器内存资源限制计算 JVM 最佳参数（`-XX:MaxRAMPercentage`、元空间限制等）；
- 当代码微调时，仅重建体积最小的应用代码层，极大加速构建与推送。

#### 方案二：Google Jib 纯 Java 构建器

Google Jib 是专门面向 Java 优化的容器镜像构建利器。**其最大的杀手锏是：构建镜像完全不依赖宿主机的 Docker 守护进程（Docker Daemon）！**

在 `pom.xml` 中引入 Jib 插件：

```xml
<plugin>
  <groupId>com.google.cloud.tools</groupId>
  <artifactId>jib-maven-plugin</artifactId>
  <version>3.4.0</version>
</plugin>
```

构建命令：

```bash
# 本地构建（若本地存在 Docker）
mvn compile jib:dockerBuild

# CI/CD 场景：直接编译并直推远程仓库（无需 Docker Daemon）
mvn compile jib:build -Dimage=your-registry.io/inventory-ms:v0.0.1
```

#### 构建方案横向对比矩阵

| 对比维度 | 手写 Dockerfile (含多阶段) | Spring Boot Buildpacks | Google Jib |
| :--- | :--- | :--- | :--- |
| **是否依赖本地 Docker** | 是 | 是 | **否（可在无 Docker 的 CI 执行）** |
| **可控与定制自由度** | **最高（完全控制系统包）** | 中等（依赖 Pack 规则） | 中等（针对 Java 深度优化） |
| **分层优化与增量速度** | 需人工精细化编写指令 | 自动分层，表现优秀 | **极致智能（字节码级分层）** |
| **典型适用场景** | 底层环境有特殊 OS 扩展需求 | 遵循标准 Spring Boot 的团队 | 强调极速构建的 CI/CD 自动化流水线 |

---

## 5. 镜像仓库发布与版本分发治理

构建好的镜像需要发布至中央镜像仓库（Container Registry），如 Docker Hub、GitHub Packages（GHCR）、Harbor、AWS ECR 或阿里云 ACR。

### 5.1 镜像打标（Tagging）与语义化版本

镜像标签并非生成副本，而是对底层镜像 Layer 建立新的引用指针。格式通常为 `[仓库地址/][命名空间/]仓库名:版本号`：

```bash
docker tag bookstore/inventory-service:v0.0.1 ansgohar/inventory-ms:v0.0.1
```

> [!TIP]
> 生产环境严禁仅依赖 `latest` 标签！必须采用**显式语义化版本**（如 `v1.0.0`、Git Commit SHA 或构建号），确保发布历史可溯源，且出现故障时能够精确回滚。

### 5.2 认证、推送与拉取

```bash
# 1. 登录认证
docker login

# 2. 推送镜像至远程仓库
docker push ansgohar/inventory-ms:v0.0.1

# 3. 在任何目标测试/生产节点拉取
docker pull ansgohar/inventory-ms:v0.0.1

# 4. 基于拉取的镜像启动服务
docker run -d -p 8081:8081 ansgohar/inventory-ms:v0.0.1
```

---

## 6. 容器运行时高级治理能力

运行在生产环境的容器，绝非仅靠一条 `docker run` 就能长期稳定工作。我们需要为容器注入可靠的运行时策略。

### 6.1 容器自动重启策略（Restart Policies）

当容器发生内存溢出（OOM）或应用闪退时，重启策略决定了运行时引擎的处理动作：

```bash
docker run -d \
  --restart=unless-stopped \
  -p 8081:8081 \
  --name inventory-service \
  ansgohar/inventory-ms:v0.0.1
```

- `no`：默认策略，容器退出后绝不重启；
- `on-failure[:max-retries]`：非正常退出（退出码非 0）时触发重启，可限制最大重试次数；
- `always`：只要容器处于停止状态便无条件自动重启；
- `unless-stopped`：生产推荐选项，只要容器不是被管理员显式执行 `docker stop`，在 Docker 守护进程重启或容器崩溃时均自动拉起。

### 6.2 容器持久化存储：Volumes

容器的文件系统本质是临时的（Ephemeral）。一旦容器被销毁，容器内部的数据将永久丢失。数据库容器必须挂载外部存储卷（Volume）：

```bash
docker run -d \
  --name bookstore-postgres \
  -v pgdata:/var/lib/postgresql/data \
  -p 5432:5432 \
  postgres:17
```

`-v pgdata:/var/lib/postgresql/data` 创建了名为 `pgdata` 的 Docker 托管卷，并将其挂载到 PostgreSQL 的数据存储目录。即使执行 `docker rm -f bookstore-postgres`，数据卷依然完整保留，重新创建的新容器再次挂载该卷即可无缝恢复所有业务数据。

### 6.3 健康检查机制（Health Checks）

“进程存活”并不等同于“服务健康”。应用可能发生线程死锁或无法连接数据库。在 Dockerfile 中集成针对 Spring Boot Actuator 的健康检查探针：

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8081/inventory/actuator/health || exit 1
```

- `--interval=30s`：每 30 秒执行一次探针检测；
- `--timeout=3s`：超时阈值；
- `--start-period=40s`：应用启动宽限期（在此期间检测失败不计入错误计数）；
- `--retries=3`：连续失败 3 次后将容器置为 `unhealthy` 状态，触发编排平台告警或重启。

### 6.4 容器网络互通（Bridge Network）

容器默认处于独立的网络命名空间。为了让各微服务与数据库能够通过**服务名称**直接寻址互通，必须建立专属的自定义桥接网络（User-defined Bridge Network）：

```bash
# 1. 创建网络
docker network create bookstore-network

# 2. 将容器接入该网络
docker run -d --network bookstore-network --name bookstore-postgres postgres:17
docker run -d --network bookstore-network --name inventory-service ansgohar/inventory-ms:v0.0.1
```

接入同一网络后，Inventory Service 可以直接使用 `jdbc:postgresql://bookstore-postgres:5432/inventory` 作为连接字符串，Docker 内置 DNS 服务器会自动完成容器名到内部 IP 的动态解析。

---

## 7. 基于 Docker Compose 统一编排微服务集群

至此，我们已经掌握了单个容器的构建与运行。但面对 Bookstore 全栈体系（API Gateway、Inventory、User、Eureka、Zipkin、Keycloak、Postgres、Mongo），手动执行数十条 `docker run` 命令不仅繁琐，且无法保障启动依赖顺序。

**Docker Compose** 提供了声明式的统一多容器编排规范。

### 7.1 全栈拓扑架构图

通过 Docker Compose，全栈服务在统一网络中紧密协同：

![Docker Compose 运行时微服务集群架构](/media/posts/spring-boot-angular/img-09042.png)

- **API Gateway (8080)**：系统外部唯一统一流量入口；
- **Eureka Server (8761)**：提供微服务实例注册与发现；
- **Keycloak**：统一身份鉴权与 OAuth2/OIDC 认证服务；
- **Inventory & User Services**：无状态后端业务微服务；
- **PostgreSQL & MongoDB**：持久化数据存储；
- **Zipkin (9411)**：全链路链路追踪遥测汇总看板。

### 7.2 一键就绪开发环境工作流

在团队协作中，开发上手体验（Onboarding Experience）至关重要。一个现代工程项目应该做到让新成员拉取代码后“一行命令启动全套依赖环境”：

```bash
# 1. 获取后端工程及编排配置
git clone https://github.com/PacktPublishing/Spring-Boot-and-Angular-2E_Backend.git
cd Spring-Boot-and-Angular-2E_Backend/containerization

# 2. 提前拉取所有声明的容器镜像
docker compose pull

# 3. 后台一键编排启动整个全栈集群
docker compose up -d

# 4. 实时观察集群启动健康状态
docker compose ps
```

所有服务就绪后，核心服务控制台入口：
- **API 网关入口**：`http://localhost:8080`
- **Eureka 注册中心**：`http://localhost:8761`
- **Zipkin 链路监控看板**：`http://localhost:9411`
- **库存微服务直连端口**：`http://localhost:8081`

---

## 8. 本章总结与后续演进

本文系统梳理了现代化 Spring Boot 后端微服务的交付与编排体系：
1. **交付模型演化**：深刻理解了从传统应用服务器 WAR 包、到自包含可执行 Fat JAR、再到云原生不可变容器镜像的技术必然性；
2. **底层核心与多阶段构建**：掌握了 Linux 命名空间、cgroups、联合文件系统分层机制，并落地了兼具极简体积与安全性的多阶段 Dockerfile；
3. **自动化构建矩阵**：剖析了 Spring Boot Buildpacks 与 Google Jib 的技术特性与适用场景；
4. **运行时进阶与 Compose 编排**：利用 Volume 数据持久化、Actuator 健康检查探针、自定义网桥服务发现，并最终借助 Docker Compose 实现多服务拓扑的一键声明式拉起。

后端容器化基础设施现已完备且稳固运行，为前端系统提供了标准统一的网关与 API 接口。

在接下来的 **第十一篇** 中，我们将全方位转向前端工程，基于最新的 **Angular 22** 构建现代化单页应用架构：拥抱纯 Standalone 独立组件体系、基于 Signals 的细粒度响应式输入输出、Smart/Dumb 分层设计，并接入基于 Vite 的极速 Vitest 单元测试框架！
