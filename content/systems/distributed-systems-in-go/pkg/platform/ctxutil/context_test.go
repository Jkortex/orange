package ctxutil

import (
	"context"
	"testing"
	"time"
)

func TestCtxUtil_GenericsAndDeadlines(t *testing.T) {
	ctx := context.Background()

	ctx = WithValue(ctx, RequestIDKey, "req-xyz-789")
	val, ok := Value[string](ctx, RequestIDKey)
	if !ok || val != "req-xyz-789" {
		t.Fatalf("expected req-xyz-789, got %v (ok=%v)", val, ok)
	}

	_, ok = Value[int](ctx, RequestIDKey)
	if ok {
		t.Fatal("expected type mismatch to return false")
	}

	// Deadline test
	ctxWithTimeout, cancel := context.WithTimeout(ctx, 50*time.Millisecond)
	defer cancel()

	rem, ok := RemainingDeadline(ctxWithTimeout)
	if !ok || rem <= 0 || rem > 50*time.Millisecond {
		t.Fatalf("unexpected remaining deadline: %v (ok=%v)", rem, ok)
	}

	if IsCancelled(ctxWithTimeout) {
		t.Fatal("did not expect context to be cancelled yet")
	}

	time.Sleep(60 * time.Millisecond)
	if !IsCancelled(ctxWithTimeout) {
		t.Fatal("expected context to be cancelled after timeout")
	}
}
