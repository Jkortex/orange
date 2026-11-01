package consistency

import (
	"context"
	"errors"
	"testing"
	"time"

	"distributed-systems-in-go/pkg/platform/database"
)

func TestRunSaga_Success(t *testing.T) {
	var step1Done, step2Done bool
	steps := []SagaStep{
		{
			Name: "ReserveInventory",
			Action: func(ctx context.Context) error {
				step1Done = true
				return nil
			},
			Compensate: func(ctx context.Context) error {
				step1Done = false
				return nil
			},
		},
		{
			Name: "ChargePayment",
			Action: func(ctx context.Context) error {
				step2Done = true
				return nil
			},
			Compensate: func(ctx context.Context) error {
				step2Done = false
				return nil
			},
		},
	}

	err := RunSaga(context.Background(), steps)
	if err != nil {
		t.Fatalf("expected saga to succeed, got %v", err)
	}
	if !step1Done || !step2Done {
		t.Fatal("expected all steps to have executed")
	}
}

func TestRunSaga_CompensationOnFailure(t *testing.T) {
	var inventoryReserved bool

	steps := []SagaStep{
		{
			Name: "ReserveInventory",
			Action: func(ctx context.Context) error {
				inventoryReserved = true
				return nil
			},
			Compensate: func(ctx context.Context) error {
				inventoryReserved = false
				return nil
			},
		},
		{
			Name: "ChargePayment",
			Action: func(ctx context.Context) error {
				return errors.New("card declined")
			},
			Compensate: func(ctx context.Context) error {
				return nil
			},
		},
	}

	err := RunSaga(context.Background(), steps)
	if err == nil {
		t.Fatal("expected saga to fail")
	}

	// Inventory must be compensated (released)
	if inventoryReserved {
		t.Fatal("expected inventory reservation to be undone by compensation")
	}
}

func TestIdempotencyStore_CacheAndExpiry(t *testing.T) {
	store := NewMemoryIdempotencyStore()
	ctx := context.Background()

	key := "idemp-key-1"
	res := &StoredResult{
		StatusCode: 201,
		Body:       []byte(`{"order_id":"123"}`),
		ExpiresAt:  time.Now().Add(50 * time.Millisecond),
	}

	_ = store.Set(ctx, key, res)

	got, err := store.Get(ctx, key)
	if err != nil || got == nil {
		t.Fatalf("expected stored result, got %v (err=%v)", got, err)
	}
	if got.StatusCode != 201 {
		t.Fatalf("expected 201 status, got %d", got.StatusCode)
	}

	// After expiry
	time.Sleep(60 * time.Millisecond)
	expired, err := store.Get(ctx, key)
	if err != nil || expired != nil {
		t.Fatalf("expected nil after expiration, got %v", expired)
	}
}

func TestOptimisticLock_Retry(t *testing.T) {
	attempts := 0
	err := WithOptimisticRetry(context.Background(), 3, func(ctx context.Context) error {
		attempts++
		if attempts < 2 {
			return database.ErrConflict
		}
		return nil
	})

	if err != nil {
		t.Fatalf("expected optimistic retry to succeed, got %v", err)
	}
	if attempts != 2 {
		t.Fatalf("expected 2 attempts, got %d", attempts)
	}
}
