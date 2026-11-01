# Distributed Systems in Go

Practical implementation of distributed systems patterns and infrastructure in Go, based on *Distributed Systems in Go* by Joel Bryan Juliano (2026).

## Architecture

This project adopts the **Company Platform SDK** + **Monorepo Microservices** architecture:

- **`pkg/platform/`**: Shared infrastructure SDK built progressively across chapters.
  - [`concurrency/`](pkg/platform/concurrency/): Bounded worker pool, graceful shutdown, context detach (Ch 2)
  - [`messaging/`](pkg/platform/messaging/): Pub/Sub abstractions, in-memory fake broker, NATS & Kafka adapters (Ch 3, 8)
  - [`middleware/`](pkg/platform/middleware/): Production HTTP middleware chain (Recover, RequestID, Logging, Timeout, CORS, Errors, Health) (Ch 4)
  - [`auth/`](pkg/platform/auth/): ECDSA (ES256) JWT tokens, JWKS, scopes/roles authorization, bcrypt (Ch 5)
  - [`database/`](pkg/platform/database/): pgxpool connection management, transactions, migrations runner, error mappers (Ch 6)
  - [`ctxutil/`](pkg/platform/ctxutil/): Generic type-safe context values, typed keys, deadline narrowing (Ch 7)
  - [`resilience/`](pkg/platform/resilience/): Circuit breaker, exponential backoff with full jitter (Ch 9)
  - [`orchestration/`](pkg/platform/orchestration/): Parallel fan-out with errgroup, scatter-gather, best-effort degradation, timeout budgets (Ch 10)
  - [`consistency/`](pkg/platform/consistency/): Idempotency store, distributed Saga orchestrator with reverse compensation, optimistic locking retry (Ch 11)
  - [`observability/`](pkg/platform/observability/): slog structured logger with contextual attribute injection, Prometheus metrics exposition, W3C tracing (Ch 12)
  - [`config/`](pkg/platform/config/): Struct-tag-driven 12-Factor env config loader, .env parser, validation (Ch 14)
  - [`cli/`](pkg/platform/cli/): Service health checker and operational CLI helpers (App C)
- **`cmd/`**: Runnable services (API Gateway, Orders, Inventory, Payment, Notifications) (Ch 15 Capstone).
- **`book/`**: Extracted chapter-by-chapter Markdown reference docs.

## Deployment & Infrastructure

### 1. Using Podman (Native `play kube`)

The infrastructure can be launched directly using Podman with standard Kubernetes Pod manifests:

```bash
# Launch Postgres, NATS, and Kafka as a unified local Pod
podman play kube deploy/kube/orderflow-infra.yaml

# Check running pod and containers
podman pod ps
podman ps

# Stop and tear down the infrastructure
podman play kube --down deploy/kube/orderflow-infra.yaml
```

### 2. Using Docker Compose

```bash
docker compose up -d
```

## Running Tests

### 1. Platform SDK & Domain Unit Tests

Run all unit tests and Saga integration tests with race detection:

```bash
go test -v -race ./pkg/...
go test -v -race ./tests/orderflow_integration_test.go
```

### 2. Live Infrastructure Tests (Podman)

With `podman play kube deploy/kube/orderflow-infra.yaml` running:

```bash
go test -v ./tests/live_infra_test.go
```

This verifies:
- PostgreSQL database connectivity and connection pool retry.
- Automatic schema migration runner (`pkg/platform/database.MigrationRunner`) executing `migrations/*.up.sql`.
- High-throughput pub/sub over NATS.
- Producer & Consumer Group pub/sub with automatic topic provisioning & resilience backoff over Apache Kafka (KRaft).
