package resilience

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestCircuitBreaker_StateTransitions(t *testing.T) {
	cb := NewCircuitBreaker(3, 50*time.Millisecond)

	failErr := errors.New("upstream timeout")

	// Trigger 3 failures to open the circuit
	for i := 0; i < 3; i++ {
		_ = cb.Execute(func() error { return failErr })
	}

	if cb.State() != StateOpen {
		t.Fatalf("expected state OPEN, got %v", cb.State())
	}

	// Immediate next call must be fast-failed
	err := cb.Execute(func() error { return nil })
	if !errors.Is(err, ErrCircuitOpen) {
		t.Fatalf("expected ErrCircuitOpen, got %v", err)
	}

	// Wait for cooldown
	time.Sleep(60 * time.Millisecond)

	// In half-open, 2 successes should close it
	_ = cb.Execute(func() error { return nil })
	_ = cb.Execute(func() error { return nil })

	if cb.State() != StateClosed {
		t.Fatalf("expected state CLOSED after recovery, got %v", cb.State())
	}
}

func TestRetry_SuccessAfterFailures(t *testing.T) {
	attempts := 0
	err := Retry(context.Background(), DefaultRetryConfig(), nil, func() error {
		attempts++
		if attempts < 3 {
			return errors.New("temporary glitch")
		}
		return nil
	})

	if err != nil {
		t.Fatalf("expected retry to succeed eventually, got %v", err)
	}
	if attempts != 3 {
		t.Fatalf("expected 3 attempts, got %d", attempts)
	}
}
