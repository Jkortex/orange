package concurrency

import (
	"context"
	"errors"
	"time"
)

// Shutdowner is implemented by servers, pools, and message brokers that support graceful shutdown.
type Shutdowner interface {
	Shutdown(context.Context) error
}

// ShutdownFunc is an adapter to allow the use of ordinary functions as Shutdowners.
type ShutdownFunc func(context.Context) error

func (f ShutdownFunc) Shutdown(ctx context.Context) error {
	return f(ctx)
}

// GracefulShutdown waits for ctx.Done(), then calls Shutdown on each service in order with a timeout.
func GracefulShutdown(ctx context.Context, timeout time.Duration, servers ...Shutdowner) error {
	<-ctx.Done()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	var errs []error
	for _, srv := range servers {
		if err := srv.Shutdown(shutdownCtx); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}
