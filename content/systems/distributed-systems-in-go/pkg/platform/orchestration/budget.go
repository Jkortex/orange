package orchestration

import (
	"context"
	"time"
)

// StageContext derives a child context whose deadline is bounded by stageBudget,
// while never exceeding the parent context's remaining deadline.
func StageContext(parent context.Context, stageBudget time.Duration) (context.Context, context.CancelFunc) {
	if parentDeadline, ok := parent.Deadline(); ok {
		remaining := time.Until(parentDeadline)
		if remaining < stageBudget {
			stageBudget = remaining
		}
	}
	return context.WithTimeout(parent, stageBudget)
}
