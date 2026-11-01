package kafka

import (
	"context"
	"sync"

	"distributed-systems-in-go/pkg/platform/messaging"
	"github.com/segmentio/kafka-go"
)

// Consumer implements messaging.Subscriber for Apache Kafka using consumer groups.
type Consumer struct {
	brokers []string
	groupID string
	readers []*kafka.Reader
	mu      sync.Mutex
}

// NewConsumer creates a Kafka consumer associated with a consumer group.
func NewConsumer(brokers []string, groupID string) *Consumer {
	return &Consumer{
		brokers: brokers,
		groupID: groupID,
	}
}

// Subscribe opens a Reader for the topic and stream messages through a channel.
func (c *Consumer) Subscribe(ctx context.Context, topic string) (<-chan messaging.Message, error) {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:  c.brokers,
		GroupID:  c.groupID,
		Topic:    topic,
		MinBytes: 10e3, // 10KB
		MaxBytes: 10e6, // 10MB
	})

	c.mu.Lock()
	c.readers = append(c.readers, reader)
	c.mu.Unlock()

	msgChan := make(chan messaging.Message, 100)

	go func() {
		defer close(msgChan)
		defer reader.Close()

		for {
			m, err := reader.FetchMessage(ctx)
			if err != nil {
				return // ctx done or reader closed
			}

			outMsg := messaging.Message{
				Subject: m.Topic,
				Data:    m.Value,
				Ack: func() error {
					return reader.CommitMessages(context.Background(), m)
				},
			}

			select {
			case msgChan <- outMsg:
			case <-ctx.Done():
				return
			}
		}
	}()

	return msgChan, nil
}

// Close closes all active readers.
func (c *Consumer) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	var firstErr error
	for _, r := range c.readers {
		if err := r.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	c.readers = nil
	return firstErr
}

var _ messaging.Subscriber = (*Consumer)(nil)
