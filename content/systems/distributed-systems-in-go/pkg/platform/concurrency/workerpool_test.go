package concurrency

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"
)

func TestWorkerPool_BasicExecution(t *testing.T) {
	ctx := context.Background()
	wp := NewWorkerPool(ctx, 4)

	var count atomic.Int32
	totalJobs := 50

	for i := 0; i < totalJobs; i++ {
		ok := wp.Submit(func() error {
			time.Sleep(2 * time.Millisecond)
			count.Add(1)
			return nil
		})
		if !ok {
			t.Fatal("expected submit to succeed")
		}
	}

	errs := wp.Close()
	if len(errs) != 0 {
		t.Fatalf("expected no errors, got %d", len(errs))
	}
	if count.Load() != int32(totalJobs) {
		t.Fatalf("expected %d jobs completed, got %d", totalJobs, count.Load())
	}
}

func TestWorkerPool_ErrorCollection(t *testing.T) {
	ctx := context.Background()
	wp := NewWorkerPool(ctx, 3)

	failErr := errors.New("job failed")

	for i := 0; i < 20; i++ {
		i := i
		wp.Submit(func() error {
			if i%2 == 0 {
				return failErr
			}
			return nil
		})
	}

	errs := wp.Close()
	if len(errs) != 10 {
		t.Fatalf("expected 10 errors, got %d", len(errs))
	}
}
