package concurrency

import (
	"context"
	"errors"
	"testing"
	"time"
)

type mockServer struct {
	shutdownCalled bool
	returnErr      error
}

func (m *mockServer) Shutdown(ctx context.Context) error {
	m.shutdownCalled = true
	return m.returnErr
}

func TestGracefulShutdown_Success(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	s1 := &mockServer{}
	s2 := &mockServer{}

	done := make(chan error, 1)
	go func() {
		done <- GracefulShutdown(ctx, 100*time.Millisecond, s1, s2)
	}()

	cancel()

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !s1.shutdownCalled || !s2.shutdownCalled {
			t.Fatal("expected all servers to have Shutdown called")
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("timed out waiting for shutdown")
	}
}

func TestGracefulShutdown_ErrorAggregation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	errA := errors.New("error A")
	s1 := &mockServer{returnErr: errA}

	done := make(chan error, 1)
	go func() {
		done <- GracefulShutdown(ctx, 100*time.Millisecond, s1)
	}()

	cancel()
	err := <-done
	if !errors.Is(err, errA) {
		t.Fatalf("expected error A, got %v", err)
	}
}

func TestDetach_InheritsValuesAndIgnoresParentCancel(t *testing.T) {
	type keyType string
	const testKey keyType = "trace-id"

	parentCtx, parentCancel := context.WithCancel(context.Background())
	ctxWithVal := context.WithValue(parentCtx, testKey, "12345")

	detachedCtx, cancel := Detach(ctxWithVal, 50*time.Millisecond)
	defer cancel()

	// Cancel parent immediately
	parentCancel()

	// Value must be retained
	if val, ok := detachedCtx.Value(testKey).(string); !ok || val != "12345" {
		t.Fatalf("expected trace-id 12345, got %v", val)
	}

	// Detached context should still be active
	select {
	case <-detachedCtx.Done():
		t.Fatal("detached context was canceled by parent!")
	case <-time.After(10 * time.Millisecond):
		// OK
	}

	// But it should expire on its own deadline
	select {
	case <-detachedCtx.Done():
		// OK
	case <-time.After(100 * time.Millisecond):
		t.Fatal("detached context did not time out on its own deadline")
	}
}
