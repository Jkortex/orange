package database

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ConnectWithRetry attempts to connect to PostgreSQL with exponential backoff.
// Useful during service startup when databases in Docker Compose/K8s take seconds to be ready.
func ConnectWithRetry(ctx context.Context, connString string, maxAttempts int, opts ...PoolOption) (*pgxpool.Pool, error) {
	if maxAttempts <= 0 {
		maxAttempts = 5
	}

	backoff := 100 * time.Millisecond
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		pool, err := NewDB(ctx, connString, opts...)
		if err == nil {
			return pool, nil
		}

		slog.WarnContext(ctx, "database connection failed, retrying",
			"attempt", attempt,
			"max_attempts", maxAttempts,
			"backoff", backoff,
			"error", err,
		)

		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(backoff):
			backoff *= 2
		}
	}

	return nil, errors.New("database connection failed after max retry attempts")
}
