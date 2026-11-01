package ctxutil

import (
	"context"
	"time"
)

// WithValue returns a new context binding the typed key and value.
func WithValue[T any](ctx context.Context, key ContextKey, val T) context.Context {
	return context.WithValue(ctx, key, val)
}

// Value extracts a typed value from the context, returning false if not present or type mismatches.
func Value[T any](ctx context.Context, key ContextKey) (T, bool) {
	if ctx == nil {
		var zero T
		return zero, false
	}
	v, ok := ctx.Value(key).(T)
	return v, ok
}

// IsCancelled checks whether the context has already expired or been canceled.
func IsCancelled(ctx context.Context) bool {
	if ctx == nil {
		return false
	}
	return ctx.Err() != nil
}

// RemainingDeadline returns the remaining duration before the context reaches its deadline.
// Returns (0, false) if no deadline is set.
func RemainingDeadline(ctx context.Context) (time.Duration, bool) {
	if ctx == nil {
		return 0, false
	}
	deadline, ok := ctx.Deadline()
	if !ok {
		return 0, false
	}
	remaining := time.Until(deadline)
	if remaining < 0 {
		remaining = 0
	}
	return remaining, true
}
