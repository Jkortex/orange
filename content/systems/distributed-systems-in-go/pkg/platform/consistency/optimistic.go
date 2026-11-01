package consistency

import (
	"context"
	"fmt"
	"time"

	"distributed-systems-in-go/pkg/platform/database"
)

// WithOptimisticRetry executes an update function repeatedly if an optimistic lock conflict occurs.
func WithOptimisticRetry(ctx context.Context, maxRetries int, fn func(ctx context.Context) error) error {
	if maxRetries <= 0 {
		maxRetries = 3
	}

	backoff := 10 * time.Millisecond
	for attempt := 1; attempt <= maxRetries; attempt++ {
		err := fn(ctx)
		if err == nil {
			return nil
		}

		if !database.IsConflict(err) {
			return err
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(backoff):
			backoff *= 2
		}
	}

	return fmt.Errorf("optimistic locking failed after %d attempts: %w", maxRetries, database.ErrConflict)
}
