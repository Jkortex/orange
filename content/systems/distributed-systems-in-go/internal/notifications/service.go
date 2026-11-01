package notifications

import (
	"context"
	"log/slog"

	"distributed-systems-in-go/internal/domain"
)

type Service struct{}

func NewService() *Service {
	return &Service{}
}

func (s *Service) HandlePaymentSucceeded(ctx context.Context, e domain.PaymentSucceeded) error {
	slog.InfoContext(ctx, "confirmation email sent to customer",
		"order_id", e.OrderID,
		"user_id", e.UserID,
		"payment_id", e.PaymentID,
		"amount", e.Amount,
	)
	return nil
}

func (s *Service) HandleOrderCancelled(ctx context.Context, e domain.OrderCancelled) error {
	slog.InfoContext(ctx, "cancellation email sent to customer",
		"order_id", e.OrderID,
		"user_id", e.UserID,
		"reason", e.Reason,
	)
	return nil
}
