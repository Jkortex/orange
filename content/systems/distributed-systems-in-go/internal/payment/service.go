package payment

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"distributed-systems-in-go/internal/domain"
	"distributed-systems-in-go/pkg/platform/messaging"
	"github.com/google/uuid"
)

type Service struct {
	publisher messaging.Publisher
}

func NewService(pub messaging.Publisher) *Service {
	return &Service{publisher: pub}
}

// ProcessOrderCreated handles incoming orders.created events, simulates charging the user,
// and publishes payment.succeeded or payment.failed.
func (s *Service) ProcessOrderCreated(ctx context.Context, orderEvent domain.OrderCreated) error {
	slog.InfoContext(ctx, "processing payment for order", "order_id", orderEvent.OrderID, "amount", orderEvent.Amount)

	// Simulate business rule: orders over 10,000 fail payment for testing failure sagas
	if orderEvent.Amount > 10000 {
		failEvent := domain.PaymentFailed{
			OrderID: orderEvent.OrderID,
			UserID:  orderEvent.UserID,
			Reason:  "insufficient_funds_or_limit_exceeded",
		}
		data, _ := json.Marshal(failEvent)
		return s.publisher.Publish(ctx, "payment.failed", data)
	}

	successEvent := domain.PaymentSucceeded{
		OrderID:   orderEvent.OrderID,
		UserID:    orderEvent.UserID,
		PaymentID: uuid.NewString(),
		Amount:    orderEvent.Amount,
		PaidAt:    time.Now().UTC(),
	}
	data, _ := json.Marshal(successEvent)
	return s.publisher.Publish(ctx, "payment.succeeded", data)
}
