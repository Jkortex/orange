package consistency

import (
	"context"
	"sync"
	"time"
)

// StoredResult caches the completed response of an idempotent request.
type StoredResult struct {
	StatusCode int
	Body       []byte
	CreatedAt  time.Time
	ExpiresAt  time.Time
}

// IdempotencyStore defines the contract for caching and retrieving idempotent request results.
type IdempotencyStore interface {
	Get(ctx context.Context, key string) (*StoredResult, error)
	Set(ctx context.Context, key string, result *StoredResult) error
}

// MemoryIdempotencyStore provides an in-memory implementation of IdempotencyStore with TTL.
type MemoryIdempotencyStore struct {
	mu    sync.RWMutex
	store map[string]*StoredResult
}

// NewMemoryIdempotencyStore creates an in-memory idempotency store.
func NewMemoryIdempotencyStore() *MemoryIdempotencyStore {
	return &MemoryIdempotencyStore{
		store: make(map[string]*StoredResult),
	}
}

// Get retrieves a stored result if it exists and has not expired.
func (s *MemoryIdempotencyStore) Get(ctx context.Context, key string) (*StoredResult, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	res, ok := s.store[key]
	if !ok {
		return nil, nil
	}
	if !res.ExpiresAt.IsZero() && time.Now().After(res.ExpiresAt) {
		return nil, nil // expired
	}
	return res, nil
}

// Set saves an idempotent result.
func (s *MemoryIdempotencyStore) Set(ctx context.Context, key string, result *StoredResult) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.store[key] = result
	return nil
}
