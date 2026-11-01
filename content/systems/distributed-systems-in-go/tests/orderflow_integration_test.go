package tests

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	internalAuth "distributed-systems-in-go/internal/auth"
	"distributed-systems-in-go/internal/domain"
	internalInventory "distributed-systems-in-go/internal/inventory"
	internalNotifications "distributed-systems-in-go/internal/notifications"
	internalOrders "distributed-systems-in-go/internal/orders"
	internalPayment "distributed-systems-in-go/internal/payment"
	"distributed-systems-in-go/pkg/platform/messaging"
)

func TestOrderFlow_HappyPath(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	broker := messaging.NewFakeBroker()
	defer broker.Close()

	// 1. Setup Auth
	privKey, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	authStore := internalAuth.NewMemoryUserStore()
	authService := internalAuth.NewService(authStore, privKey, "test-key-1")

	user, err := authService.Register(ctx, "customer@example.com", "password123")
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}
	token, _, err := authService.Login(ctx, "customer@example.com", "password123")
	if err != nil || token == "" {
		t.Fatalf("login failed: %v", err)
	}

	// 2. Setup Inventory
	invStore := internalInventory.NewMemoryStore()
	_ = invStore.SetStock(ctx, "prod-laptop", 10)
	invService := internalInventory.NewService(invStore)

	// 3. Setup Orders
	orderStore := internalOrders.NewMemoryOrderStore()
	orderService := internalOrders.NewService(orderStore, invService, broker)

	// 4. Setup Payment and Notifications
	paymentService := internalPayment.NewService(broker)
	notificationsService := internalNotifications.NewService()

	// Wire asynchronous pub/sub channels
	orderCreatedCh, _ := broker.Subscribe(ctx, "orders.created")
	paymentSucceededCh, _ := broker.Subscribe(ctx, "payment.succeeded")

	// 5. Customer creates order
	order, err := orderService.CreateOrder(ctx, internalOrders.CreateOrderRequest{
		UserID:    user.ID,
		ProductID: "prod-laptop",
		Quantity:  2,
		UnitPrice: 1500, // Amount = 3000
	})
	if err != nil {
		t.Fatalf("create order failed: %v", err)
	}
	if order.Status != "pending" {
		t.Fatalf("expected pending status, got %s", order.Status)
	}

	// Verify inventory was reserved (10 available - 2 reserved)
	stock, _ := invService.GetStock(ctx, "prod-laptop")
	if stock.Reserved != 2 {
		t.Fatalf("expected 2 items reserved, got %d", stock.Reserved)
	}

	// 6. Payment service receives order.created
	select {
	case msg := <-orderCreatedCh:
		var orderCreated domain.OrderCreated
		if err := json.Unmarshal(msg.Data, &orderCreated); err != nil {
			t.Fatalf("unmarshal order.created failed: %v", err)
		}
		if orderCreated.OrderID != order.ID {
			t.Fatalf("expected order ID %s, got %s", order.ID, orderCreated.OrderID)
		}
		// Process payment
		if err := paymentService.ProcessOrderCreated(ctx, orderCreated); err != nil {
			t.Fatalf("payment processing failed: %v", err)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("timed out waiting for orders.created event")
	}

	// 7. Notification service receives payment.succeeded
	select {
	case msg := <-paymentSucceededCh:
		var paymentSucceeded domain.PaymentSucceeded
		if err := json.Unmarshal(msg.Data, &paymentSucceeded); err != nil {
			t.Fatalf("unmarshal payment.succeeded failed: %v", err)
		}
		if err := notificationsService.HandlePaymentSucceeded(ctx, paymentSucceeded); err != nil {
			t.Fatalf("notification handling failed: %v", err)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("timed out waiting for payment.succeeded event")
	}
}

func TestOrderFlow_PaymentFailureCompensationSaga(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	broker := messaging.NewFakeBroker()
	defer broker.Close()

	// Inventory
	invStore := internalInventory.NewMemoryStore()
	_ = invStore.SetStock(ctx, "prod-supercomputer", 5)
	invService := internalInventory.NewService(invStore)

	// Orders & Payment
	orderStore := internalOrders.NewMemoryOrderStore()
	orderService := internalOrders.NewService(orderStore, invService, broker)
	paymentService := internalPayment.NewService(broker)
	notificationsService := internalNotifications.NewService()

	orderCreatedCh, _ := broker.Subscribe(ctx, "orders.created")
	paymentFailedCh, _ := broker.Subscribe(ctx, "payment.failed")
	orderCancelledCh, _ := broker.Subscribe(ctx, "orders.cancelled")

	// Order exceeding payment limit (Amount = 2 * 6000 = 12000 > 10000)
	order, err := orderService.CreateOrder(ctx, internalOrders.CreateOrderRequest{
		UserID:    "user-rich",
		ProductID: "prod-supercomputer",
		Quantity:  2,
		UnitPrice: 6000,
	})
	if err != nil {
		t.Fatalf("expected initial order creation to succeed, got %v", err)
	}

	stockBefore, _ := invService.GetStock(ctx, "prod-supercomputer")
	if stockBefore.Reserved != 2 {
		t.Fatalf("expected 2 items reserved, got %d", stockBefore.Reserved)
	}

	// Payment service processes order.created and triggers payment.failed
	msg := <-orderCreatedCh
	var orderCreated domain.OrderCreated
	_ = json.Unmarshal(msg.Data, &orderCreated)
	_ = paymentService.ProcessOrderCreated(ctx, orderCreated)

	// Order service handles payment.failed -> cancels order and releases reservation
	failMsg := <-paymentFailedCh
	var paymentFailed domain.PaymentFailed
	_ = json.Unmarshal(failMsg.Data, &paymentFailed)
	if err := orderService.HandlePaymentFailed(ctx, paymentFailed); err != nil {
		t.Fatalf("handling payment failed error: %v", err)
	}

	// Verify order status is cancelled
	cancelledOrder, _ := orderService.GetOrder(ctx, order.ID)
	if cancelledOrder.Status != "cancelled" {
		t.Fatalf("expected status 'cancelled', got %s", cancelledOrder.Status)
	}

	// Verify inventory reservation was released back to 0!
	stockAfter, _ := invService.GetStock(ctx, "prod-supercomputer")
	if stockAfter.Reserved != 0 {
		t.Fatalf("expected 0 reserved inventory after compensation, got %d", stockAfter.Reserved)
	}

	// Verify notification service consumes order.cancelled
	cancelMsg := <-orderCancelledCh
	var orderCancelled domain.OrderCancelled
	_ = json.Unmarshal(cancelMsg.Data, &orderCancelled)
	_ = notificationsService.HandleOrderCancelled(ctx, orderCancelled)
}

func TestOrderFlow_HTTPHandlers(t *testing.T) {
	invStore := internalInventory.NewMemoryStore()
	_ = invStore.SetStock(context.Background(), "item-1", 5)
	invService := internalInventory.NewService(invStore)

	mux := http.NewServeMux()
	internalInventory.RegisterRoutes(mux, invService)

	// Reserve stock via HTTP
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/inventory/reserve", strings.NewReader(`{"product_id":"item-1","quantity":2}`))
	req.Header.Set("Content-Type", "application/json")
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", rec.Code, rec.Body.String())
	}
}
