package tests

import (
	"context"
	"fmt"
	"testing"
	"time"

	"distributed-systems-in-go/pkg/platform/database"
	"distributed-systems-in-go/pkg/platform/messaging/kafka"
	"distributed-systems-in-go/pkg/platform/messaging/nats"
	natsClient "github.com/nats-io/nats.go"
)

func TestLiveInfra_PostgresConnection(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	connStr := "postgres://dev:dev@localhost:5432/orderflow?sslmode=disable"
	pool, err := database.ConnectWithRetry(ctx, connStr, 5)
	if err != nil {
		t.Fatalf("failed to connect to real postgres in podman: %v", err)
	}
	defer pool.Close()

	var result int
	if err := pool.QueryRow(ctx, "SELECT 1+1").Scan(&result); err != nil {
		t.Fatalf("query failed: %v", err)
	}
	if result != 2 {
		t.Fatalf("expected 2, got %d", result)
	}
}

func TestLiveInfra_PostgresMigration(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	connStr := "postgres://dev:dev@localhost:5432/orderflow?sslmode=disable"
	pool, err := database.ConnectWithRetry(ctx, connStr, 5)
	if err != nil {
		t.Fatalf("failed to connect to real postgres in podman: %v", err)
	}
	defer pool.Close()

	runner := database.NewMigrationRunner(pool)
	if err := runner.Run(ctx, "../migrations"); err != nil {
		t.Fatalf("failed to run migrations against live postgres: %v", err)
	}

	// Verify schema_migrations has recorded the version
	var count int
	err = pool.QueryRow(ctx, "SELECT COUNT(*) FROM schema_migrations WHERE version = '000001_init_schema'").Scan(&count)
	if err != nil {
		t.Fatalf("failed to query schema_migrations: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected migration to be recorded, got count: %d", count)
	}

	// Verify tables exist
	var exists bool
	err = pool.QueryRow(ctx, "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'orders')").Scan(&exists)
	if err != nil || !exists {
		t.Fatalf("table orders does not exist in live postgres")
	}
}

func TestLiveInfra_NATSConnection(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	nc, err := natsClient.Connect("nats://localhost:4222")
	if err != nil {
		t.Fatalf("failed to connect to real nats in podman: %v", err)
	}
	defer nc.Close()

	pub := nats.NewPublisher(nc)
	defer pub.Close()

	sub := nats.NewSubscriber(nc)
	defer sub.Close()

	subject := "test.live.orders"
	ch, err := sub.Subscribe(ctx, subject)
	if err != nil {
		t.Fatalf("subscribe failed: %v", err)
	}

	payload := []byte(`{"event":"order_created","id":"ord-999"}`)
	if err := pub.Publish(ctx, subject, payload); err != nil {
		t.Fatalf("publish failed: %v", err)
	}

	select {
	case msg := <-ch:
		if string(msg.Data) != string(payload) {
			t.Fatalf("payload mismatch: %s vs %s", string(msg.Data), string(payload))
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for nats message")
	}
}

func TestLiveInfra_KafkaPubSub(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	brokers := []string{"localhost:9092"}
	topic := fmt.Sprintf("live-topic-%d", time.Now().UnixNano())

	producer := kafka.NewProducer(brokers)
	defer producer.Close()

	consumer := kafka.NewConsumer(brokers, "test-group-1")
	defer consumer.Close()

	msgChan, err := consumer.Subscribe(ctx, topic)
	if err != nil {
		t.Fatalf("failed to subscribe to kafka: %v", err)
	}

	data := []byte(`{"event":"order_flow_verified"}`)

	// Allow kafka consumer group rebalance / partition assignment
	time.Sleep(1 * time.Second)

	if err := producer.Publish(ctx, topic, data); err != nil {
		t.Fatalf("failed to publish to kafka: %v", err)
	}

	select {
	case msg := <-msgChan:
		if string(msg.Data) != string(data) {
			t.Fatalf("data mismatch: %s vs %s", string(msg.Data), string(data))
		}
	case <-time.After(10 * time.Second):
		t.Fatal("timed out waiting for message from kafka")
	}
}
