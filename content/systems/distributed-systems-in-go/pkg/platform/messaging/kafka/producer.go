package kafka

import (
	"context"
	"fmt"
	"time"

	"distributed-systems-in-go/pkg/platform/messaging"
	"distributed-systems-in-go/pkg/platform/resilience"
	"github.com/segmentio/kafka-go"
)

// Producer implements messaging.Publisher for Apache Kafka.
type Producer struct {
	writer *kafka.Writer
}

// NewProducer creates a Kafka producer targeting one or more broker addresses.
func NewProducer(brokers []string) *Producer {
	writer := &kafka.Writer{
		Addr:                   kafka.TCP(brokers...),
		Balancer:               &kafka.LeastBytes{},
		AllowAutoTopicCreation: true,
		Async:                  false,
	}
	return &Producer{writer: writer}
}

// Publish writes a message to the specified Kafka topic with resilience retries.
func (p *Producer) Publish(ctx context.Context, topic string, data []byte) error {
	msg := kafka.Message{
		Topic: topic,
		Value: data,
	}

	retryCfg := resilience.RetryConfig{
		MaxAttempts: 5,
		BaseDelay:   200 * time.Millisecond,
		MaxDelay:    2 * time.Second,
	}

	err := resilience.Retry(ctx, retryCfg, nil, func() error {
		return p.writer.WriteMessages(ctx, msg)
	})
	if err != nil {
		return fmt.Errorf("kafka publish to topic %s: %w", topic, err)
	}
	return nil
}

// Close closes the underlying Kafka writer.
func (p *Producer) Close() error {
	return p.writer.Close()
}

var _ messaging.Publisher = (*Producer)(nil)
