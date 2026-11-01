package resilience

import (
	"context"
	"math/rand"
	"time"
)

// RetryConfig controls retry counts and backoff progression.
type RetryConfig struct {
	MaxAttempts int
	BaseDelay   time.Duration
	MaxDelay    time.Duration
}

// DefaultRetryConfig returns recommended defaults for remote service calls.
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxAttempts: 3,
		BaseDelay:   100 * time.Millisecond,
		MaxDelay:    2 * time.Second,
	}
}

// Retry executes an operation with exponential backoff and randomized full jitter.
func Retry(ctx context.Context, cfg RetryConfig, isRetryable func(error) bool, fn func() error) error {
	if cfg.MaxAttempts <= 1 {
		return fn()
	}

	var err error
	for attempt := 1; attempt <= cfg.MaxAttempts; attempt++ {
		err = fn()
		if err == nil {
			return nil
		}

		if attempt == cfg.MaxAttempts || (isRetryable != nil && !isRetryable(err)) {
			return err
		}

		// Full Jitter: Sleep between 0 and min(MaxDelay, BaseDelay * 2^(attempt-1))
		maxBackoff := cfg.BaseDelay * (1 << (attempt - 1))
		if cfg.MaxDelay > 0 && maxBackoff > cfg.MaxDelay {
			maxBackoff = cfg.MaxDelay
		}

		jitter := time.Duration(rand.Int63n(int64(maxBackoff) + 1))

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(jitter):
		}
	}

	return err
}
