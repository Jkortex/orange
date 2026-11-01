package domain

import "time"

// Domain events flowing across Kafka / NATS.

type OrderCreated struct {
	OrderID   string    `json:"order_id"`
	UserID    string    `json:"user_id"`
	ProductID string    `json:"product_id"`
	Quantity  int       `json:"quantity"`
	Amount    float64   `json:"amount"`
	CreatedAt time.Time `json:"created_at"`
}

type PaymentSucceeded struct {
	OrderID   string    `json:"order_id"`
	UserID    string    `json:"user_id"`
	PaymentID string    `json:"payment_id"`
	Amount    float64   `json:"amount"`
	PaidAt    time.Time `json:"paid_at"`
}

type PaymentFailed struct {
	OrderID string `json:"order_id"`
	UserID  string `json:"user_id"`
	Reason  string `json:"reason"`
}

type OrderCancelled struct {
	OrderID   string    `json:"order_id"`
	UserID    string    `json:"user_id"`
	Reason    string    `json:"reason"`
	Cancelled time.Time `json:"cancelled_at"`
}
