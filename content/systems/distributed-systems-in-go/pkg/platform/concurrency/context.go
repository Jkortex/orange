package concurrency

import (
	"context"
	"time"
)

// Detach returns a new context derived from context.WithoutCancel(parent),
// retaining context values (such as trace IDs, baggage, and user claims)
// while detaching from the parent's cancellation and deadline.
//
// If timeout > 0, the detached context is given a new timeout deadline.
// This is typically used for compensation logic, cleanups, or audit logging
// that must run even if the incoming request timed out or was canceled by the client.
func Detach(parent context.Context, timeout time.Duration) (context.Context, context.CancelFunc) {
	detached := context.WithoutCancel(parent)
	if timeout > 0 {
		return context.WithTimeout(detached, timeout)
	}
	return context.WithCancel(detached)
}
