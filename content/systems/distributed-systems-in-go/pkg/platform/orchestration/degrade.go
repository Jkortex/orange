package orchestration

import "context"

// BestEffort wraps a non-critical downstream operation so failures are gracefully degraded
// rather than aborting the parent pipeline or request.
func BestEffort[T any](fn func(context.Context) (T, error)) func(context.Context) (T, error) {
	return func(ctx context.Context) (T, error) {
		val, err := fn(ctx)
		if err != nil {
			var zero T
			return zero, nil // silently drop error; caller treats zero value as degraded
		}
		return val, nil
	}
}
