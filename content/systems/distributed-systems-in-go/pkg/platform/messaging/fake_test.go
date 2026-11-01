package messaging

import (
	"context"
	"testing"
	"time"
)

func TestFakeBroker_PubSub(t *testing.T) {
	broker := NewFakeBroker()
	defer broker.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()

	subject := "orders.created"
	ch, err := broker.Subscribe(ctx, subject)
	if err != nil {
		t.Fatalf("failed to subscribe: %v", err)
	}

	payload := []byte(`{"id":"order-123","amount":99}`)
	if err := broker.Publish(ctx, subject, payload); err != nil {
		t.Fatalf("failed to publish: %v", err)
	}

	select {
	case msg := <-ch:
		if msg.Subject != subject {
			t.Fatalf("expected subject %s, got %s", subject, msg.Subject)
		}
		if string(msg.Data) != string(payload) {
			t.Fatalf("payload mismatch: %s vs %s", string(msg.Data), string(payload))
		}
	case <-time.After(200 * time.Millisecond):
		t.Fatal("timed out waiting for message")
	}

	all := broker.PublishedMessages()
	if len(all) != 1 {
		t.Fatalf("expected 1 published message recorded, got %d", len(all))
	}
}
