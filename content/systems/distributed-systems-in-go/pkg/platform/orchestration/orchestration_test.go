package orchestration

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestFanOut_OrderedResults(t *testing.T) {
	ctx := context.Background()
	inputs := []int{10, 20, 30, 40}

	results, err := FanOut(ctx, inputs, 2, func(ctx context.Context, item int) (int, error) {
		time.Sleep(5 * time.Millisecond)
		return item * 2, nil
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != len(inputs) {
		t.Fatalf("expected %d results, got %d", len(inputs), len(results))
	}
	for i, in := range inputs {
		if results[i].Value != in*2 {
			t.Fatalf("at index %d: expected %d, got %d", i, in*2, results[i].Value)
		}
	}
}

func TestScatterGather_PartialFailure(t *testing.T) {
	ctx := context.Background()
	inputs := []int{1, 2, 3, 4, 5}

	failErr := errors.New("odd numbers fail")
	successes, errs := ScatterGather(ctx, inputs, 4, func(ctx context.Context, item int) (int, error) {
		if item%2 != 0 {
			return 0, failErr
		}
		return item * 10, nil
	})

	if len(successes) != 2 {
		t.Fatalf("expected 2 successes, got %d", len(successes))
	}
	if len(errs) != 3 {
		t.Fatalf("expected 3 errors, got %d", len(errs))
	}
}

func TestBestEffort_Degradation(t *testing.T) {
	failingOp := func(ctx context.Context) (string, error) {
		return "", errors.New("network failure")
	}

	degradedOp := BestEffort(failingOp)
	val, err := degradedOp(context.Background())
	if err != nil {
		t.Fatalf("expected error to be swallowed in degraded mode, got %v", err)
	}
	if val != "" {
		t.Fatalf("expected zero value, got %s", val)
	}
}
