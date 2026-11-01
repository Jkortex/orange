package messaging

import "context"

// Message represents a generic message received from a message broker (e.g., NATS or Kafka).
type Message struct {
	Subject string
	Data    []byte
	Reply   string
	Ack     func() error // no-op in NATS Core; commits offset in Kafka
}

// Publisher is the abstract contract for publishing messages to subjects or topics.
type Publisher interface {
	Publish(ctx context.Context, subject string, data []byte) error
	Close() error
}

// Subscriber is the abstract contract for subscribing to messages from subjects or topics.
type Subscriber interface {
	Subscribe(ctx context.Context, subject string) (<-chan Message, error)
	Close() error
}
