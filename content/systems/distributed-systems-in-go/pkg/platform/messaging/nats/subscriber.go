package nats

import (
	"context"
	"fmt"
	"sync"

	"distributed-systems-in-go/pkg/platform/messaging"
	"github.com/nats-io/nats.go"
)

// SubscriberOption configures a NATS Subscriber.
type SubscriberOption func(*Subscriber)

// WithQueueGroup sets a queue group for load-balanced message processing across service instances.
func WithQueueGroup(group string) SubscriberOption {
	return func(s *Subscriber) {
		s.queueGroup = group
	}
}

// Subscriber implements messaging.Subscriber using NATS.
type Subscriber struct {
	nc         *nats.Conn
	queueGroup string
	subs       []*nats.Subscription
	mu         sync.Mutex
}

// NewSubscriber creates a NATS Subscriber.
func NewSubscriber(nc *nats.Conn, opts ...SubscriberOption) *Subscriber {
	s := &Subscriber{nc: nc}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// Subscribe listens on a subject and returns a channel of Messages.
func (s *Subscriber) Subscribe(ctx context.Context, subject string) (<-chan messaging.Message, error) {
	if s.nc == nil || s.nc.IsClosed() {
		return nil, fmt.Errorf("nats subscriber connection is closed")
	}

	msgChan := make(chan messaging.Message, 128)

	handler := func(msg *nats.Msg) {
		m := messaging.Message{
			Subject: msg.Subject,
			Data:    msg.Data,
			Reply:   msg.Reply,
			Ack: func() error {
				return msg.Ack()
			},
		}
		select {
		case msgChan <- m:
		case <-ctx.Done():
		}
	}

	var sub *nats.Subscription
	var err error

	if s.queueGroup != "" {
		sub, err = s.nc.QueueSubscribe(subject, s.queueGroup, handler)
	} else {
		sub, err = s.nc.Subscribe(subject, handler)
	}

	if err != nil {
		return nil, fmt.Errorf("nats subscribe to %s: %w", subject, err)
	}

	s.mu.Lock()
	s.subs = append(s.subs, sub)
	s.mu.Unlock()

	// Manage lifecycle through context
	go func() {
		<-ctx.Done()
		_ = sub.Unsubscribe()
		close(msgChan)
	}()

	return msgChan, nil
}

// Close drains and unbinds all active subscriptions.
func (s *Subscriber) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var firstErr error
	for _, sub := range s.subs {
		if err := sub.Drain(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	s.subs = nil
	return firstErr
}

// Ensure interface compliance
var _ messaging.Subscriber = (*Subscriber)(nil)
