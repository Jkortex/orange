package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"syscall"
	"time"

	"distributed-systems-in-go/pkg/platform/concurrency"
	"distributed-systems-in-go/pkg/platform/config"
	"distributed-systems-in-go/pkg/platform/middleware"
	"distributed-systems-in-go/pkg/platform/observability"
)

type GatewayConfig struct {
	Port         int    `env:"PORT" envDefault:"8080"`
	AuthURL      string `env:"AUTH_SERVICE_URL" envDefault:"http://localhost:8081"`
	OrdersURL    string `env:"ORDERS_SERVICE_URL" envDefault:"http://localhost:8082"`
	InventoryURL string `env:"INVENTORY_SERVICE_URL" envDefault:"http://localhost:8083"`
	LogLevel     string `env:"LOG_LEVEL" envDefault:"info"`
	Env          string `env:"ENVIRONMENT" envDefault:"development"`
}

func main() {
	cfg, err := config.Load[GatewayConfig]()
	if err != nil {
		slog.Error("failed to load gateway config", "error", err)
		os.Exit(1)
	}

	logger := observability.NewLogger(observability.LogConfig{
		Level:       cfg.LogLevel,
		Environment: cfg.Env,
	})
	slog.SetDefault(logger)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	mux := http.NewServeMux()

	// Health and metrics
	mux.HandleFunc("GET /healthz/live", middleware.LivenessHandler())
	mux.HandleFunc("GET /healthz/ready", middleware.ReadinessHandler())
	mux.HandleFunc("GET /metrics", observability.DefaultRegistry.PrometheusHandler())

	// Downstream reverse proxies
	authProxy := proxyTo(cfg.AuthURL)
	ordersProxy := proxyTo(cfg.OrdersURL)
	inventoryProxy := proxyTo(cfg.InventoryURL)

	// Route mapping
	mux.Handle("/api/auth/", authProxy)
	mux.Handle("/.well-known/", authProxy)
	mux.Handle("/api/orders", ordersProxy)
	mux.Handle("/api/orders/", ordersProxy)
	mux.Handle("/api/inventory/", inventoryProxy)

	// Outer production middleware chain
	handler := middleware.Chain(
		mux,
		middleware.Recover(),
		middleware.RequestID(),
		observability.HTTPMetricsMiddleware(nil),
		middleware.Logging(),
		middleware.Timeout(10*time.Second),
		middleware.BodyClose(),
		middleware.CORS([]string{"*"}),
	)

	server := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.Port),
		Handler: handler,
	}

	go func() {
		slog.Info("api gateway started", "port", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server listen failed", "error", err)
		}
	}()

	_ = concurrency.GracefulShutdown(ctx, 10*time.Second, server)
	slog.Info("api gateway stopped")
}

func proxyTo(targetURL string) http.Handler {
	u, err := url.Parse(targetURL)
	if err != nil {
		panic(err)
	}
	return httputil.NewSingleHostReverseProxy(u)
}
