package nats

import (
	"context"
	"fmt"

	"distributed-systems-in-go/pkg/platform/messaging"
	"github.com/nats-io/nats.go"
)

// Publisher implements messaging.Publisher using a NATS connection.
type Publisher struct {
	nc *nats.Conn
}

// NewPublisher wraps a NATS connection into a messaging.Publisher.
func NewPublisher(nc *nats.Conn) *Publisher {
	return &Publisher{nc: nc}
}

// Publish sends data to the given subject.
func (p *Publisher) Publish(ctx context.Context, subject string, data []byte) error {
	if p.nc == nil || p.nc.IsClosed() {
		return fmt.Errorf("nats publisher connection is closed")
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	return p.nc.Publish(subject, data)
}

// Close closes the underlying NATS connection or drains it.
func (p *Publisher) Close() error {
	if p.nc != nil && !p.nc.IsClosed() {
		return p.nc.Drain()
	}
	return nil
}

// Ensure interface compliance
var _ messaging.Publisher = (*Publisher)(nil)
