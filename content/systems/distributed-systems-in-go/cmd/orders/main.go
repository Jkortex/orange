package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"distributed-systems-in-go/internal/inventory"
	internalOrders "distributed-systems-in-go/internal/orders"
	"distributed-systems-in-go/pkg/platform/concurrency"
	"distributed-systems-in-go/pkg/platform/config"
	"distributed-systems-in-go/pkg/platform/messaging"
	"distributed-systems-in-go/pkg/platform/middleware"
	"distributed-systems-in-go/pkg/platform/observability"
)

type OrdersConfig struct {
	Port     int    `env:"PORT" envDefault:"8082"`
	LogLevel string `env:"LOG_LEVEL" envDefault:"info"`
	Env      string `env:"ENVIRONMENT" envDefault:"development"`
}

func main() {
	cfg, err := config.Load[OrdersConfig]()
	if err != nil {
		slog.Error("failed to load orders config", "error", err)
		os.Exit(1)
	}

	logger := observability.NewLogger(observability.LogConfig{
		Level:       cfg.LogLevel,
		Environment: cfg.Env,
	})
	slog.SetDefault(logger)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	store := internalOrders.NewMemoryOrderStore()
	invStore := inventory.NewMemoryStore()
	_ = invStore.SetStock(ctx, "prod-1", 100)
	invService := inventory.NewService(invStore)

	broker := messaging.NewFakeBroker()
	defer broker.Close()

	svc := internalOrders.NewService(store, invService, broker)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz/live", middleware.LivenessHandler())
	mux.HandleFunc("GET /healthz/ready", middleware.ReadinessHandler())
	mux.HandleFunc("GET /metrics", observability.DefaultRegistry.PrometheusHandler())

	internalOrders.RegisterRoutes(mux, svc)

	handler := middleware.Chain(
		mux,
		middleware.Recover(),
		middleware.RequestID(),
		observability.HTTPMetricsMiddleware(nil),
		middleware.Logging(),
	)

	server := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.Port),
		Handler: handler,
	}

	go func() {
		slog.Info("orders service started", "port", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("orders listen failed", "error", err)
		}
	}()

	_ = concurrency.GracefulShutdown(ctx, 10*time.Second, server)
	slog.Info("orders service stopped")
}
