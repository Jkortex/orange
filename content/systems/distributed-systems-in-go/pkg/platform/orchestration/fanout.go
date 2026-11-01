package orchestration

import (
	"context"

	"golang.org/x/sync/errgroup"
)

// CallResult contains the output value and any error from an individual fan-out branch.
type CallResult[T any] struct {
	Value T
	Err   error
}

// FanOut calls fn concurrently for each item, bounded by maxConcurrency.
// Returns results in the same order as input items. Returns the first error if any fail.
func FanOut[T, R any](ctx context.Context, items []T, limit int, fn func(context.Context, T) (R, error)) ([]CallResult[R], error) {
	g, gCtx := errgroup.WithContext(ctx)
	if limit > 0 {
		g.SetLimit(limit)
	}

	results := make([]CallResult[R], len(items))

	for i, item := range items {
		i, item := i, item
		g.Go(func() error {
			val, err := fn(gCtx, item)
			results[i] = CallResult[R]{Value: val, Err: err}
			return err
		})
	}

	err := g.Wait()
	return results, err
}

// ScatterGather calls fn concurrently for all items without short-circuiting on failure,
// collecting all successes and errors separately.
func ScatterGather[T, R any](ctx context.Context, items []T, limit int, fn func(context.Context, T) (R, error)) ([]R, []error) {
	g, gCtx := errgroup.WithContext(ctx)
	if limit > 0 {
		g.SetLimit(limit)
	}

	type indexedResult struct {
		val R
		err error
	}
	results := make([]indexedResult, len(items))

	for i, item := range items {
		i, item := i, item
		g.Go(func() error {
			val, err := fn(gCtx, item)
			results[i] = indexedResult{val: val, err: err}
			return nil // do not cancel siblings on partial failure
		})
	}

	_ = g.Wait()

	var successes []R
	var errs []error
	for _, res := range results {
		if res.err != nil {
			errs = append(errs, res.err)
		} else {
			successes = append(successes, res.val)
		}
	}
	return successes, errs
}
