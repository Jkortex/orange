---
title: Spring Boot & Angular 全栈实战（八）：基于 Spring Security 与 JWT 的微服务安全鉴权
date: 2026-10-23T00:08:00Z
description: 深入微服务安全边界，落地 OAuth2 与 Keycloak 集成、无状态 JWT 签发与跨微服务 Token 传播验证体系。
category: fullstack
column: spring-boot-angular
tags:
  - Spring Security
  - JWT
  - Keycloak
  - 微服务安全
  - OAuth2
---

> 💡 **专栏导读**：本文收录于专栏 [《Spring Boot 4 & Angular 22 全栈微服务实战》](/columns/spring-boot-angular)。全专栏共 22 篇，深度覆盖 Java 26 微服务拆分、Spring Cloud 网关与安全鉴权、Angular 22 Signals 状态治理以及端到端容器化交付的全链路工程实践。

在前几章中，我们构建了现代微服务架构的基础骨架：将单体业务拆分为自治服务、引入 Consul 实现了动态服务注册与发现，并搭建了 Spring Cloud Gateway 作为微服务集群的统一接入入口。各服务能够高效路由与通信，但当业务端点暴露于外部网络时，**安全鉴权便成为系统架构的核心头等公民（First-Class Concern）**。

在分布式环境下，每一次网络跳转都是潜在的攻击面，默认情况下任何内外部交互都必须视为“不可信”。如果缺乏健壮且标准化的安全模型，分布式系统将迅速陷入配置碎片化与漏洞频发的窘境。

本文我们将为网上书店（Bookstore）系统落地基于工业标准的集中式安全架构：引入独立身份提供商（IdP）**Keycloak**，结合 **Spring Boot Security** 与 **JSON Web Tokens (JWT)**，在 **Spring Cloud Gateway** 边缘入口筑起统一认证与鉴权屏障，并建立可靠的跨服务身份传播机制。

---

## 一、微服务安全架构演进与边界设计

### 1. 单体架构 vs 分布式微服务安全痛点

在传统的单体架构中，安全控制通常驻留在单一入口点，利用内存 Session 或本地数据库表即可轻松校验用户状态。但在微服务体系下：
- **服务高度分散**：每个微服务都可能需要鉴权，若各自独立维护用户数据库，将导致用户体验割裂、数据同步复杂以及大量安全代码重复；
- **网络边界开放**：内部 RPC/HTTP 流量激增，单点失守易导致横向渗透；
- **状态维护困难**：微服务要求无状态水平扩容，基于 Cookie-Session 的会话粘性方案完全违背了云原生设计理念。

为此，**网关中心化安全模型（Gateway-Centric Security Model）**成为了微服务治理的事实标准。我们将安全边界整体前移至 API Gateway：网关负责解析并校验认证令牌、执行粗粒度权限拦截，验证通过后向内部下游微服务透明传播经过清洗的身份上下文。下游业务微服务无需引入厚重的 Spring Security 依赖，专注处理领域逻辑，从而实现“零信任架构（Zero-Trust Architecture）”的基础设施分层。

### 2. 职责分层设计

在 Bookstore 架构中，安全职责被清晰划分为三层：

![安全职责分层设计](/media/posts/spring-boot-angular/img-08996.png)

1. **Identity Provider (Keycloak)**：核心身份控制中心，统管用户生命周期、凭证校验、用户角色与多租户域（Realm），签发经过非对称加密签名的标准化 JWT。
2. **API Gateway (Spring Cloud Gateway)**：外部安全屏障，负责 TLS 终止、CORS 控制、JWT 验签、粗粒度 RBAC 权限过滤、剥离伪造报头，并注入安全受信任的内部身份头（如 `X-User-Id`）。
3. **Downstream Microservices (User / Inventory)**：业务执行域，完全假定入站请求已通过网关安全校验，依托网关传递的身份上下文直接进行数据持久化与细粒度业务规则运算。

### 3. 核心标准：JWT、OAuth 2.0 与 OIDC

为了彻底解耦业务应用与用户凭证，系统底层依赖三项核心工业标准：

- **JWT (JSON Web Token)**：自包含、无状态的令牌格式，由 Header、Payload 和 Signature 组成。微服务接收到 JWT 后，可基于身份中心公布的公钥对签名进行本地离线验签，无需针对每个请求反向查询认证服务器，极大提升了吞吐性能。
- **OAuth 2.0**：行业通用的授权协议。在生产环境中，SPA 与移动端推荐使用结合了 **PKCE (Proof Key for Code Exchange, RFC 7636)** 的授权码模式（Authorization Code Flow），以杜绝授权码拦截劫持攻击。
- **OpenID Connect (OIDC)**：构建于 OAuth 2.0 之上的身份认证扩展层，引入了包含用户 Profile 信息的 ID Token 与标准化发现端点（`/.well-known/openid-configuration`），支持微服务自动拉取公钥集（JWKS）并动态自愈。

### 4. 响应式 Spring Security 过滤器链机制

Spring Cloud Gateway 运行于非阻塞的 **Spring WebFlux** 响应式运行时之上。其安全体系使用 `ServerHttpSecurity` 构建 `SecurityWebFilterChain`，替代了传统 Servlet 的阻塞 Filter。

![Spring Security 上下文流转](/media/posts/spring-boot-angular/img-08997.png)

当客户端发起携带 `Authorization: Bearer <JWT>` 的 HTTP 请求时：
1. `AuthenticationWebFilter` 截获请求，提取 Bearer Token；
2. 委托 `ReactiveJwtDecoder` 获取 Keycloak 的公钥证书集合（JWKS），验签令牌的数字签名并校验 `exp`（过期时间）与 `iss`（签发者）；
3. 自定义 `ReactiveJwtAuthenticationConverter` 将 JWT 中的 Payload 角色声明转换为 Spring Security 权威对象 `GrantedAuthority`（带 `ROLE_` 前缀）；
4. 鉴权管理器判断当前用户是否具备目标路由所需的 Authority，放行或拦截。

---

## 二、部署与配置 Keycloak 身份认证中心

为了保障本地环境快速搭建及生产环境的可复制性，我们使用 Docker 容器化运行 Keycloak。

### 1. 启动 Keycloak 容器

在开发阶段，我们采用 `start-dev` 模式启动 Keycloak 26.0.0，映射 HTTP 端口 `8090`：

```bash
docker run -d \
  --name bookstore-keycloak \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=admin \
  -e KC_HTTP_PORT=8090 \
  -p 8090:8090 \
  quay.io/keycloak/keycloak:26.0.0 \
  start-dev
```

> [!NOTE]
> `start-dev` 模式会关闭强制 TLS 并使用内存数据库（容器销毁数据重置），仅限本地开发联调。在生产环境中，应通过配置 TLS 证书、外部 PostgreSQL 实例以及持久化存储卷部署：
> ```bash
> docker run -d \
>   --name bookstore-keycloak \
>   -e KEYCLOAK_ADMIN=admin \
>   -e KEYCLOAK_ADMIN_PASSWORD=admin \
>   -e KC_HTTP_PORT=8090 \
>   -p 8090:8090 \
>   quay.io/keycloak/keycloak:26.0.0 \
>   --https-certificate-file=/certs/cert.pem \
>   --https-certificate-key-file=/certs/key.pem
> ```

容器就绪后，访问 `http://localhost:8090/admin` 进入 Keycloak 管理后台：

![Keycloak 登录控制台](/media/posts/spring-boot-angular/img-08998.png)

输入预设的初始管理员账号 `admin / admin` 登录主控制台：

![Keycloak 主界面](/media/posts/spring-boot-angular/img-09000.png)

### 2. 创建 Bookstore 业务 Realm

在 Keycloak 中，**Realm（领域）**代表独立的租户隔离边界，拥有专属的用户、角色、客户端及安全配置。为避免污染主管理域（master realm），我们为书店平台建立独立的 `bookstore` 域。

点击左上角 Realm 下拉菜单，选择 **Create Realm**，输入 `bookstore` 并启用（Enabled），点击保存：

![创建 bookstore Realm](/media/posts/spring-boot-angular/img-09002.png)

URL 路径随之切换为 `/admin/master/console/#/bookstore`，后续所有配置均在该 Realm 下进行。

### 3. 配置领域角色（Realm Roles）

在左侧导航栏中点击 **Realm roles** -> **Create role**，根据书店业务需求创建三级角色模型：

![创建角色](/media/posts/spring-boot-angular/img-09004.png)

- `admin`：系统管理员，具备书籍全量删改、库存核销与用户管理最高权限；
- `author`：图书作者，具备书籍发布、库存补充与作品修改权限；
- `user`：注册买家，具备浏览书籍详情、下单采购等基础交互权限。

### 4. 初始化测试用户与角色映射

进入 **Users** -> **Add user**，分别创建三个典型场景的演示账号：

![创建测试用户](/media/posts/spring-boot-angular/img-09006.png)

1. **管理员用户**：
   - 用户名：`admin-user`，邮箱：`admin@bookstore.com`，设置 **Email verified** 为开启。
   - 打开 **Credentials** 选项卡，设置密码为 `Password123!`，将 **Temporary** 设为关闭以跳过初次修改密码提示。
   - 打开 **Role mapping** 选项卡，为其分配 `admin` 角色。

![配置用户凭证](/media/posts/spring-boot-angular/img-09008.png)

![分配 admin 角色](/media/posts/spring-boot-angular/img-09010.png)

2. **作者用户**：
   - 用户名：`author-user`，邮箱：`author@bookstore.com`。
   - 密码同样设为 `Password123!`，角色分配 `author` 与 `user`（作者兼具普通买家权限）。

![分配 author 与 user 角色](/media/posts/spring-boot-angular/img-09012.png)

3. **普通用户**：
   - 用户名：`regular-user`，邮箱：`user@bookstore.com`，密码 `Password123!`，分配单个 `user` 角色。

### 5. 注册 API Gateway 客户端（Client）

进入 **Clients** -> **Create client**，为网关注册 OIDC 接入凭据：

- **Client type**：`OpenID Connect`
- **Client ID**：`bookstore-gateway`
- **Client name**：`Bookstore API Gateway`

![网关客户端基础设置](/media/posts/spring-boot-angular/img-09014.png)

在 **Capability config** 界面：
- 关闭 **Client authentication**（作为 Public/Resource Server 使用）；
- 关闭 **Standard flow** 与 **Implicit flow**；
- 勾选开启 **Direct access grants**（允许通过账号密码直接向 Token 端点发起凭据置换，便于开发测试）。

![能力设置配置](/media/posts/spring-boot-angular/img-09016.png)

在 **Login settings** 中，配置跨域与重定向白名单：
- **Valid redirect URIs**：`http://localhost:8080/*`
- **Web origins**：`http://localhost:8080`

![登录回调与跨域配置](/media/posts/spring-boot-angular/img-09018.png)

### 6. 开启用户自助注册与密码强度策略

在生产系统中，买家需要自主注册并设置强密码。进入 **Realm settings** -> **Login**，开启 **User registration**、**Forgot password** 与 **Remember me**。

![Realm 登录配置更新](/media/posts/spring-boot-angular/img-09020.png)

切换至 **Authentication** -> **Policies**，配置强密码策略：最小长度 8 位、必须包含大写字母、小写字母、数字及特殊符号各至少 1 位。

![密码合规策略](/media/posts/spring-boot-angular/img-09022.png)

---

## 三、用户微服务（User Service）的轻量化设计

在传统的安全改造中，开发者习惯于在每个微服务里引入 `spring-boot-starter-security`。而在网关中心化架构中，**User 微服务被定位为纯粹的领域组件**：

![微服务安全调用流](/media/posts/spring-boot-angular/img-09024.png)

User 微服务不配置任何 Spring Security Filter，不进行 JWT 本地签名校验，也不使用 `@PreAuthorize`。它只通过声明式 API 接收网关清洗并注入的 `X-User-Id` 头，专注于用户资料（Profile）治理以及对接 Keycloak 管理接口。

### 1. 依赖管理与配置

在 User 微服务 `pom.xml` 中，我们仅引入 Keycloak 官方提供的管理客户端与 WebFlux（用于 WebClient 调用 Token 端点），坚决剔除任何 Spring Security 依赖：

```xml
<!-- Keycloak Admin Client：仅用于用户账户的远程创建与生命周期管理 -->
<dependency>
  <groupId>org.keycloak</groupId>
  <artifactId>keycloak-admin-client</artifactId>
  <version>26.0.11</version>
</dependency>
<!-- WebClient：用于非阻塞调用 Keycloak OAuth2 Token 端点 -->
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-webflux</artifactId>
</dependency>
```

在 `application.yml` 中配置 Keycloak 交互凭证：

```yaml
keycloak:
  auth-server-url: http://localhost:8090
  realm: bookstore
  admin-username: admin
  admin-password: admin
  admin-realm: master
  client-id: bookstore-gateway
```

### 2. 领域模型与 DTO 设计

为实现领域数据与身份中心解耦，持久层采用 MongoDB 存储用户扩展画像，并将 Keycloak 内部的 UUID 记录为 `keycloakId`：

```java
@Document(collection = "users")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {
    @Id
    private String id;
    
    @Indexed(unique = true)
    private String keycloakId;
    
    @Indexed(unique = true)
    private String email;
    
    private String firstName;
    private String lastName;
    private String phone;
    private String address;
    private String city;
    private String state;
    private String zipCode;
    private String country;
    private String profilePictureUrl;
}
```

配套的数据传输对象（DTO）严格区分对外交互边界：

```java
// 用户注册入参
@Data
public class SignUpRequest {
    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 8, max = 64)
    private String password;

    private String firstName;
    private String lastName;
}

// 登录换取凭据出参
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SignInResponse {
    private String accessToken;
    private String refreshToken;
    private String tokenType;
    private Long expiresIn;
    private UserProfileDTO user;
}
```

### 3. Keycloak Admin Client 初始化与业务逻辑

通过 Spring Bean 实例化 Keycloak Admin API Client，用于在用户注册流程中向 Keycloak 写入认证实体：

```java
@Configuration
public class KeycloakConfig {
    @Value("${keycloak.auth-server-url}")
    private String authServerUrl;
    @Value("${keycloak.admin-realm}")
    private String adminRealm;
    @Value("${keycloak.admin-username}")
    private String adminUsername;
    @Value("${keycloak.admin-password}")
    private String adminPassword;

    @Bean
    public Keycloak keycloak() {
        return KeycloakBuilder.builder()
                .serverUrl(authServerUrl)
                .realm(adminRealm)
                .username(adminUsername)
                .password(adminPassword)
                .clientId("admin-cli")
                .build();
    }
}
```

在 `UserService` 中实现注册、登录与资料管理：

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {
    private final Keycloak keycloak;
    private final UserRepository userRepository;
    private final WebClient.Builder webClientBuilder;

    @Value("${keycloak.realm}")
    private String realm;
    @Value("${keycloak.auth-server-url}")
    private String authServerUrl;
    @Value("${keycloak.client-id}")
    private String clientId;

    public UserProfileDTO signUp(SignUpRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
        }

        // 1. 构建 Keycloak UserRepresentation
        UserRepresentation userRep = new UserRepresentation();
        userRep.setUsername(request.getEmail());
        userRep.setEmail(request.getEmail());
        userRep.setFirstName(request.getFirstName());
        userRep.setLastName(request.getLastName());
        userRep.setEnabled(true);
        userRep.setEmailVerified(true);

        // 设置凭证
        CredentialRepresentation cred = new CredentialRepresentation();
        cred.setType(CredentialRepresentation.PASSWORD);
        cred.setValue(request.getPassword());
        cred.setTemporary(false);
        userRep.setCredentials(List.of(cred));

        // 2. 调用 Keycloak Admin API 创建用户
        UsersResource usersResource = keycloak.realm(realm).users();
        Response response = usersResource.create(userRep);
        if (response.getStatus() != 201) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Failed to create user in Keycloak");
        }

        // 从 Location 响应头提取 Keycloak 分配的 UUID
        String path = response.getLocation().getPath();
        String keycloakId = path.substring(path.lastIndexOf('/') + 1);

        // 3. 赋予默认 user 角色
        RoleRepresentation defaultRole = keycloak.realm(realm).roles().get("user").toRepresentation();
        usersResource.get(keycloakId).roles().realmLevel().add(List.of(defaultRole));

        // 4. 持久化本地业务 Profile 实体
        User user = User.builder()
                .keycloakId(keycloakId)
                .email(request.getEmail())
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .build();
        userRepository.save(user);

        return toDto(user);
    }

    public SignInResponse signIn(SignInRequest request) {
        // 通过 WebClient 请求 Keycloak Token 端点（Resource Owner Password Credentials）
        MultiValueMap<String, String> formData = new LinkedMultiValueMap<>();
        formData.add("grant_type", "password");
        formData.add("client_id", clientId);
        formData.add("username", request.getEmail());
        formData.add("password", request.getPassword());

        String tokenUrl = String.format("%s/realms/%s/protocol/openid-connect/token", authServerUrl, realm);

        Map<?, ?> tokenResponse = webClientBuilder.build().post()
                .uri(tokenUrl)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(BodyInserters.fromFormData(formData))
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        String accessToken = (String) tokenResponse.get("access_token");
        String refreshToken = (String) tokenResponse.get("refresh_token");
        Long expiresIn = ((Number) tokenResponse.get("expires_in")).longValue();

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User profile not found"));

        return SignInResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(expiresIn)
                .user(toDto(user))
                .build();
    }

    public UserProfileDTO getProfile(String keycloakId) {
        User user = userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        return toDto(user);
    }
}
```

### 4. 约定安全的内部 HTTP Header 契约

在 `UserController` 中，公开与受保护接口界限分明：

```java
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;

    // 公开接口：无需 Authorization 报头
    @PostMapping("/signup")
    public ResponseEntity<UserProfileDTO> signUp(@Valid @RequestBody SignUpRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(userService.signUp(request));
    }

    @PostMapping("/signin")
    public ResponseEntity<SignInResponse> signIn(@Valid @RequestBody SignInRequest request) {
        return ResponseEntity.ok(userService.signIn(request));
    }

    // 受保护接口：必须由 API 网关校验 Token 并注入 X-User-Id
    @GetMapping("/profile")
    public ResponseEntity<UserProfileDTO> getProfile(
            @RequestHeader(value = "X-User-Id", required = true) String keycloakId) {
        return ResponseEntity.ok(userService.getProfile(keycloakId));
    }

    @PutMapping("/profile")
    public ResponseEntity<UserProfileDTO> updateProfile(
            @RequestHeader(value = "X-User-Id", required = true) String keycloakId,
            @Valid @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(userService.updateProfile(keycloakId, request));
    }
}
```

> [!IMPORTANT]
> **防注入安全底线**：下游微服务仅信任来自内网的请求。API 网关必须在转发前强制剔除由外部客户端伪造的入站 `X-User-Id` 报头，并确保业务服务运行于封闭的私有网络（如 Kubernetes NetworkPolicy 或 VPC 内网子网），杜绝外网直连。

---

## 四、API Gateway 边缘安全防护与 Token 传播

API 网关是整套微服务架构的安全守门人。我们基于 Spring Cloud Gateway 结合 Spring Security 落地无状态拦截网。

### 1. 引入安全依赖

在网关工程 `pom.xml` 中引入响应式安全与 OAuth2 资源服务器核心构件：

```xml
<!-- Spring Security 响应式 WebFlux 支持 -->
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-security</artifactId>
</dependency>
<!-- OAuth2 资源服务器：JWT 验证核心 -->
<dependency>
  <groupId>org.springframework.security</groupId>
  <artifactId>spring-security-oauth2-resource-server</artifactId>
</dependency>
<!-- JOSE 规范依赖：用于 JWT 的非对称解码与验签 -->
<dependency>
  <groupId>org.springframework.security</groupId>
  <artifactId>spring-security-oauth2-jose</artifactId>
</dependency>
```

### 2. 网关资源服务器配置

在网关 `application.yml` 中声明 Keycloak 的发行者地址（`issuer-uri`）。Spring Security 会在服务启动时自动请求 Discovery 端点解析出 JWKS 验签公钥公钥集合：

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: http://localhost:8090/realms/bookstore
```

### 3. 配置 SecurityWebFilterChain 与自定义 JWT 角色适配器

Keycloak 签发的 JWT 中，角色声明通常嵌套在 `realm_access.roles` 节点中：
```json
{
  "realm_access": {
    "roles": ["admin", "default-roles-bookstore"]
  }
}
```
而 Spring Security 鉴权机制默认读取顶层权限或带有 `ROLE_` 前缀的 GrantedAuthority。我们需要通过自定义 `ReactiveJwtAuthenticationConverterAdapter` 抹平二者差异：

```java
@Configuration
@EnableWebFluxSecurity
public class SecurityConfig {

    @Bean
    public SecurityWebFilterChain securityWebFilterChain(ServerHttpSecurity http) {
        return http
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .authorizeExchange(exchanges -> exchanges
                        // 1. 公开端点放行
                        .pathMatchers("/actuator/**").permitAll()
                        .pathMatchers(HttpMethod.POST, "/packt/user/api/users/signup").permitAll()
                        .pathMatchers(HttpMethod.POST, "/packt/user/api/users/signin").permitAll()
                        .pathMatchers(HttpMethod.POST, "/packt/user/api/users/refresh-token").permitAll()
                        .pathMatchers(HttpMethod.GET, "/packt/inventory/api/books/**").permitAll()
                        // 2. 细粒度 RBAC 拦截
                        .pathMatchers(HttpMethod.DELETE, "/packt/inventory/api/books/**").hasRole("ADMIN")
                        .pathMatchers(HttpMethod.POST, "/packt/inventory/api/books/**").hasAnyRole("ADMIN", "AUTHOR")
                        .pathMatchers(HttpMethod.PUT, "/packt/inventory/api/books/**").hasAnyRole("ADMIN", "AUTHOR")
                        .pathMatchers(HttpMethod.PATCH, "/packt/inventory/api/books/**").hasAnyRole("ADMIN", "AUTHOR")
                        // 3. 用户资料保护
                        .pathMatchers("/packt/user/api/users/profile/**").authenticated()
                        .pathMatchers("/packt/user/api/users/logout").authenticated()
                        // 4. 其余请求默认全部要求认证
                        .anyExchange().authenticated()
                )
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter())))
                .build();
    }

    private ReactiveJwtAuthenticationConverterAdapter jwtAuthenticationConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(jwt -> {
            Map<String, Object> realmAccess = jwt.getClaim("realm_access");
            if (realmAccess == null || !realmAccess.containsKey("roles")) {
                return Collections.emptyList();
            }
            Collection<String> roles = (Collection<String>) realmAccess.get("roles");
            return roles.stream()
                    .map(role -> new SimpleGrantedAuthority("ROLE_" + role.toUpperCase()))
                    .collect(Collectors.toList());
        });
        return new ReactiveJwtAuthenticationConverterAdapter(converter);
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("http://localhost:4200", "http://localhost:8080"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
```

### 4. 自定义网关 Filter：安全注入身份报头

网关在验签通过后，需要将当前登录用户的元数据提取并向下游传递。编写 `AddUserIdHeaderGatewayFilter`：

```java
@Component
@Slf4j
public class AddUserIdHeaderGatewayFilter extends AbstractGatewayFilterFactory<Object> {

    @Override
    public GatewayFilter apply(Object config) {
        return (exchange, chain) -> exchange.getPrincipal()
                .filter(principal -> principal instanceof JwtAuthenticationToken)
                .cast(JwtAuthenticationToken.class)
                .map(JwtAuthenticationToken::getToken)
                .map(jwt -> {
                    String userId = jwt.getSubject(); // Keycloak 用户 UUID
                    String email = jwt.getClaimAsString("email");
                    String preferredUsername = jwt.getClaimAsString("preferred_username");

                    // 构建新的请求对象，注入安全上下文报头
                    ServerHttpRequest mutatedRequest = exchange.getRequest().mutate()
                            .headers(httpHeaders -> {
                                // 核心防御：首先移除客户端可能自行上送的伪造报头
                                httpHeaders.remove("X-User-Id");
                                httpHeaders.remove("X-User-Email");
                                httpHeaders.remove("X-User-Name");
                            })
                            .header("X-User-Id", userId)
                            .header("X-User-Email", email != null ? email : "")
                            .header("X-User-Name", preferredUsername != null ? preferredUsername : "")
                            .build();

                    return exchange.mutate().request(mutatedRequest).build();
                })
                .defaultIfEmpty(exchange)
                .flatMap(chain::filter);
    }
}
```

将该 Filter 挂载至需要身份传递的受保护路由上（例如 `/packt/user/api/users/**` 与 `/packt/inventory/api/books/**`）。至此，下游服务无需直接感知任何 JWT，即可通过 `@RequestHeader("X-User-Id")` 取得受信任的用户主键。

---

## 五、端到端安全联调与自动化验证

现在，整个安全拓扑已经闭环：Keycloak（8090）、API Gateway（8080）、User Service（8081）、Inventory Service（8082）。下面通过命令行 curl 进行端到端测试。

### 1. 服务健康状态与 OIDC 发现端点探查

```bash
# 验证网关连通性
curl -sS http://localhost:8080/actuator/health

# 验证 Keycloak OIDC 发现端点，确认 JWKS 与 Token 端点正确暴露
curl -sS http://localhost:8090/realms/bookstore/.well-known/openid-configuration
```

### 2. 公开路由验证：用户注册与签发 Token

```bash
# 1. 注册新用户
curl -i -X POST http://localhost:8080/packt/user/api/users/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.security@example.com",
    "password": "Password123!",
    "firstName": "Test",
    "lastName": "Security"
  }'
# 期望响应：HTTP 201 Created，返回包含 keycloakId 的 UserProfileDTO
```

```bash
# 2. 登录换取 JWT
curl -i -X POST http://localhost:8080/packt/user/api/users/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.security@example.com",
    "password": "Password123!"
  }'
# 期望响应：HTTP 200 OK，返回 JSON 对象包含 accessToken 与 refreshToken
```

### 3. 受保护路由验证：身份令牌访问与越权防御

保存登录成功后获取到的 `accessToken`：

```bash
export TOKEN="<paste-your-access-token-here>"

# 携带合法 JWT 访问个人资料端点
curl -i -X GET http://localhost:8080/packt/user/api/users/profile \
  -H "Authorization: Bearer ${TOKEN}"
# 期望响应：HTTP 200 OK，下游 User 微服务成功打印由网关注入的 X-User-Id 并返回资料

# 模拟未授权请求（不带 Token）
curl -i -X GET http://localhost:8080/packt/user/api/users/profile
# 期望响应：HTTP 401 Unauthorized，网关直接拦截，流量根本不会下发到 User 微服务
```

### 4. 基于 RBAC 权限矩阵的库存接口验证

使用不同的预置账号登录，检验 API 网关对 Inventory 微服务不同 HTTP 方法的 RBAC 拦截效果。

#### 场景 1：普通买家（`ROLE_USER`）

```bash
# 获取 regular-user 的 Token
USER_TOKEN=$(curl -s -X POST http://localhost:8080/packt/user/api/users/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"user@bookstore.com","password":"Password123!"}' | jq -r .accessToken)

# 允许操作：GET 查询书籍列表（放行）
curl -i -X GET http://localhost:8080/packt/inventory/api/books \
  -H "Authorization: Bearer ${USER_TOKEN}"
# 响应：HTTP 200 OK

# 越权操作：尝试 POST 新增书籍（拦截）
curl -i -X POST http://localhost:8080/packt/inventory/api/books \
  -H "Authorization: Bearer ${USER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"title":"Hacker Book","isbn":"978-0000000001","price":9.99}'
# 响应：HTTP 403 Forbidden（无权限）
```

#### 场景 2：图书作者（`ROLE_AUTHOR`）

```bash
# 获取 author-user 的 Token
AUTHOR_TOKEN=$(curl -s -X POST http://localhost:8080/packt/user/api/users/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"author@bookstore.com","password":"Password123!"}' | jq -r .accessToken)

# 允许操作：POST 创建书籍
curl -i -X POST http://localhost:8080/packt/inventory/api/books \
  -H "Authorization: Bearer ${AUTHOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"title":"Spring Security in Action","isbn":"978-7-121-39999-1","authorId":1,"price":79.00}'
# 响应：HTTP 201 Created

# 越权操作：DELETE 删除书籍（拦截，仅限 ADMIN）
curl -i -X DELETE http://localhost:8080/packt/inventory/api/books/1 \
  -H "Authorization: Bearer ${AUTHOR_TOKEN}"
# 响应：HTTP 403 Forbidden
```

#### 场景 3：超级管理员（`ROLE_ADMIN`）

```bash
# 获取 admin-user 的 Token
ADMIN_TOKEN=$(curl -s -X POST http://localhost:8080/packt/user/api/users/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@bookstore.com","password":"Password123!"}' | jq -r .accessToken)

# 允许操作：DELETE 删除图书
curl -i -X DELETE http://localhost:8080/packt/inventory/api/books/1 \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"
# 响应：HTTP 200 OK 或 204 No Content
```

---

## 六、总结与工程反思

在微服务架构的演进道路上，安全体系绝不能是各个服务“各扫门前雪”的堆砌。通过本文的实践，我们建立了严密的集中式安全体系：

1. **职责彻底清晰化**：Keycloak 专注账号安全与凭据管理；API Gateway 统揽边缘防御、JWT 解码与路由级粗粒度鉴权；下游业务服务通过内部 HTTP Header 轻量消费身份上下文，免去了引入复杂安全框架带来的版本冲突与性能开销。
2. **零信任内网屏障**：网关主动清洗并覆盖 `X-User-Id` 等请求头，结合内网网络隔离，有效防御了伪造身份头穿透的“中间人冒充”安全漏洞。
3. **性能与解耦兼备**：利用 JWT 非对称加密和公钥集（JWKS）离线验签，网关在具备毫秒级验签性能的同时，彻底消除了每次请求均需远程 RPC 查询认证中心的性能瓶颈。

在下一篇中，我们将进一步释放系统性能潜能——深入探讨 **Spring WebFlux 响应式非阻塞编程** 与 **Server-Sent Events (SSE)**，探索如何突破传统“每请求一线程”模型的资源天花板，构建实时流式数据通道。
