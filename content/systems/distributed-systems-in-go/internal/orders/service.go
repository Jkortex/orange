package orders

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"distributed-systems-in-go/internal/domain"
	"distributed-systems-in-go/pkg/platform/concurrency"
	"distributed-systems-in-go/pkg/platform/database"
	"distributed-systems-in-go/pkg/platform/messaging"
	"github.com/google/uuid"
)

var (
	ErrOrderNotFound = errors.New("order not found")
)

type Order struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	ProductID string    `json:"product_id"`
	Quantity  int       `json:"quantity"`
	Amount    float64   `json:"amount"`
	Status    string    `json:"status"` // "pending", "paid", "cancelled"
	Version   int       `json:"version"`
	CreatedAt time.Time `json:"created_at"`
}

type OrderStore interface {
	Create(ctx context.Context, o *Order) error
	GetByID(ctx context.Context, id string) (*Order, error)
	UpdateStatus(ctx context.Context, id, status string, expectedVersion int) error
}

type MemoryOrderStore struct {
	mu     sync.RWMutex
	orders map[string]*Order
}

func NewMemoryOrderStore() *MemoryOrderStore {
	return &MemoryOrderStore{orders: make(map[string]*Order)}
}

func (s *MemoryOrderStore) Create(ctx context.Context, o *Order) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	copied := *o
	s.orders[o.ID] = &copied
	return nil
}

func (s *MemoryOrderStore) GetByID(ctx context.Context, id string) (*Order, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	o, ok := s.orders[id]
	if !ok {
		return nil, ErrOrderNotFound
	}
	copied := *o
	return &copied, nil
}

func (s *MemoryOrderStore) UpdateStatus(ctx context.Context, id, status string, expectedVersion int) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	o, ok := s.orders[id]
	if !ok {
		return ErrOrderNotFound
	}
	if o.Version != expectedVersion {
		return database.ErrConflict
	}
	o.Status = status
	o.Version++
	return nil
}

// InventoryClient defines inventory interactions required by orders.
type InventoryClient interface {
	ReserveInventory(ctx context.Context, productID string, quantity int) error
	ReleaseReservation(ctx context.Context, productID string, quantity int) error
}

type CreateOrderRequest struct {
	UserID    string  `json:"user_id"`
	ProductID string  `json:"product_id"`
	Quantity  int     `json:"quantity"`
	UnitPrice float64 `json:"unit_price"`
}

type Service struct {
	orders    OrderStore
	inventory InventoryClient
	publisher messaging.Publisher
}

func NewService(orders OrderStore, inv InventoryClient, pub messaging.Publisher) *Service {
	return &Service{
		orders:    orders,
		inventory: inv,
		publisher: pub,
	}
}

func (s *Service) CreateOrder(ctx context.Context, req CreateOrderRequest) (*Order, error) {
	if req.Quantity < 1 {
		return nil, fmt.Errorf("quantity must be >= 1")
	}
	if req.ProductID == "" {
		return nil, fmt.Errorf("product_id is required")
	}

	// Step 1: Synchronous inventory reservation
	if err := s.inventory.ReserveInventory(ctx, req.ProductID, req.Quantity); err != nil {
		return nil, fmt.Errorf("reserve inventory: %w", err)
	}

	order := &Order{
		ID:        uuid.NewString(),
		UserID:    req.UserID,
		ProductID: req.ProductID,
		Quantity:  req.Quantity,
		Amount:    float64(req.Quantity) * req.UnitPrice,
		Status:    "pending",
		Version:   1,
		CreatedAt: time.Now().UTC(),
	}

	// Step 2: Write order to repository
	if err := s.orders.Create(ctx, order); err != nil {
		// Mini-Saga compensation: release reserved inventory with detached timeout context
		releaseCtx, cancel := concurrency.Detach(ctx, 5*time.Second)
		defer cancel()
		_ = s.inventory.ReleaseReservation(releaseCtx, req.ProductID, req.Quantity)
		return nil, fmt.Errorf("create order: %w", err)
	}

	// Step 3: Publish domain event to broker
	event := domain.OrderCreated{
		OrderID:   order.ID,
		UserID:    order.UserID,
		ProductID: order.ProductID,
		Quantity:  order.Quantity,
		Amount:    order.Amount,
		CreatedAt: order.CreatedAt,
	}

	data, err := json.Marshal(event)
	if err == nil && s.publisher != nil {
		_ = s.publisher.Publish(ctx, "orders.created", data)
	}

	return order, nil
}

func (s *Service) HandlePaymentFailed(ctx context.Context, event domain.PaymentFailed) error {
	order, err := s.orders.GetByID(ctx, event.OrderID)
	if err != nil {
		return fmt.Errorf("get order: %w", err)
	}

	// Idempotency check: if not pending, already handled
	if order.Status != "pending" {
		return nil
	}

	// 1. Cancel order
	if err := s.orders.UpdateStatus(ctx, order.ID, "cancelled", order.Version); err != nil {
		return fmt.Errorf("cancel order: %w", err)
	}

	// 2. Compensate inventory
	if err := s.inventory.ReleaseReservation(ctx, order.ProductID, order.Quantity); err != nil {
		slog.ErrorContext(ctx, "failed to release inventory on payment failure", "error", err, "order_id", order.ID)
	}

	// 3. Emit orders.cancelled event
	cancelEvent := domain.OrderCancelled{
		OrderID:   order.ID,
		UserID:    order.UserID,
		Reason:    event.Reason,
		Cancelled: time.Now().UTC(),
	}
	data, _ := json.Marshal(cancelEvent)
	if s.publisher != nil {
		_ = s.publisher.Publish(ctx, "orders.cancelled", data)
	}

	return nil
}

func (s *Service) GetOrder(ctx context.Context, id string) (*Order, error) {
	return s.orders.GetByID(ctx, id)
}
