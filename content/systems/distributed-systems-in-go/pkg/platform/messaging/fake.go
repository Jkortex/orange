package messaging

import (
	"context"
	"sync"
)

// FakeBroker provides an in-memory pub/sub broker useful for unit tests.
type FakeBroker struct {
	mu          sync.RWMutex
	subscribers map[string][]chan Message
	published   []Message
	closed      bool
}

// NewFakeBroker initializes an in-memory broker.
func NewFakeBroker() *FakeBroker {
	return &FakeBroker{
		subscribers: make(map[string][]chan Message),
	}
}

// Publish broadcasts a message to in-memory subscribers.
func (b *FakeBroker) Publish(ctx context.Context, subject string, data []byte) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	msg := Message{
		Subject: subject,
		Data:    data,
		Ack:     func() error { return nil },
	}
	b.published = append(b.published, msg)

	if chs, ok := b.subscribers[subject]; ok {
		for _, ch := range chs {
			select {
			case ch <- msg:
			case <-ctx.Done():
				return ctx.Err()
			default:
				// Dropped if channel buffer is full in non-blocking test mode
			}
		}
	}
	return nil
}

// Subscribe listens to messages on the given subject.
func (b *FakeBroker) Subscribe(ctx context.Context, subject string) (<-chan Message, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	ch := make(chan Message, 100)
	b.subscribers[subject] = append(b.subscribers[subject], ch)

	go func() {
		<-ctx.Done()
		b.mu.Lock()
		defer b.mu.Unlock()
		close(ch)
	}()

	return ch, nil
}

// PublishedMessages returns a copy of all published messages.
func (b *FakeBroker) PublishedMessages() []Message {
	b.mu.RLock()
	defer b.mu.RUnlock()
	copied := make([]Message, len(b.published))
	copy(copied, b.published)
	return copied
}

// Close closes the fake broker and channels.
func (b *FakeBroker) Close() error {
	b.mu.Lock()
	defer b.mu.Unlock()
	if !b.closed {
		b.closed = true
		for _, chs := range b.subscribers {
			for _, ch := range chs {
				select {
				case <-ch:
				default:
				}
			}
		}
	}
	return nil
}
