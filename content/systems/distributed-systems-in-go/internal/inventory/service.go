package inventory

import (
	"context"
	"errors"
	"fmt"
	"sync"
)

var (
	ErrProductNotFound       = errors.New("product not found")
	ErrInsufficientInventory = errors.New("insufficient inventory available")
)

type Item struct {
	ProductID string
	Available int
	Reserved  int
}

// InventoryStore defines operations on the inventory repository.
type InventoryStore interface {
	Get(ctx context.Context, productID string) (*Item, error)
	Reserve(ctx context.Context, productID string, quantity int) error
	Release(ctx context.Context, productID string, quantity int) error
	SetStock(ctx context.Context, productID string, available int) error
}

// MemoryStore provides thread-safe in-memory inventory management for local dev & testing.
type MemoryStore struct {
	mu    sync.Mutex
	items map[string]*Item
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		items: make(map[string]*Item),
	}
}

func (s *MemoryStore) SetStock(ctx context.Context, productID string, available int) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.items[productID] = &Item{
		ProductID: productID,
		Available: available,
		Reserved:  0,
	}
	return nil
}

func (s *MemoryStore) Get(ctx context.Context, productID string) (*Item, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	item, ok := s.items[productID]
	if !ok {
		return nil, ErrProductNotFound
	}
	return &Item{
		ProductID: item.ProductID,
		Available: item.Available,
		Reserved:  item.Reserved,
	}, nil
}

func (s *MemoryStore) Reserve(ctx context.Context, productID string, quantity int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	item, ok := s.items[productID]
	if !ok {
		return ErrProductNotFound
	}

	if (item.Available - item.Reserved) < quantity {
		return ErrInsufficientInventory
	}

	item.Reserved += quantity
	return nil
}

func (s *MemoryStore) Release(ctx context.Context, productID string, quantity int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	item, ok := s.items[productID]
	if !ok {
		return ErrProductNotFound
	}

	item.Reserved -= quantity
	if item.Reserved < 0 {
		item.Reserved = 0
	}
	return nil
}

// Service provides high-level domain operations for inventory.
type Service struct {
	store InventoryStore
}

func NewService(store InventoryStore) *Service {
	return &Service{store: store}
}

func (s *Service) ReserveInventory(ctx context.Context, productID string, quantity int) error {
	if quantity <= 0 {
		return fmt.Errorf("quantity must be > 0")
	}
	return s.store.Reserve(ctx, productID, quantity)
}

func (s *Service) ReleaseReservation(ctx context.Context, productID string, quantity int) error {
	if quantity <= 0 {
		return nil
	}
	return s.store.Release(ctx, productID, quantity)
}

func (s *Service) GetStock(ctx context.Context, productID string) (*Item, error) {
	return s.store.Get(ctx, productID)
}
