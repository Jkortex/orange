package main

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	internalAuth "distributed-systems-in-go/internal/auth"
	"distributed-systems-in-go/pkg/platform/concurrency"
	"distributed-systems-in-go/pkg/platform/config"
	"distributed-systems-in-go/pkg/platform/middleware"
	"distributed-systems-in-go/pkg/platform/observability"
)

type AuthConfig struct {
	Port     int    `env:"PORT" envDefault:"8081"`
	LogLevel string `env:"LOG_LEVEL" envDefault:"info"`
	Env      string `env:"ENVIRONMENT" envDefault:"development"`
}

func main() {
	cfg, err := config.Load[AuthConfig]()
	if err != nil {
		slog.Error("failed to load auth config", "error", err)
		os.Exit(1)
	}

	logger := observability.NewLogger(observability.LogConfig{
		Level:       cfg.LogLevel,
		Environment: cfg.Env,
	})
	slog.SetDefault(logger)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	privKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		slog.Error("failed to generate ecdsa key", "error", err)
		os.Exit(1)
	}

	store := internalAuth.NewMemoryUserStore()
	svc := internalAuth.NewService(store, privKey, "auth-key-1")

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz/live", middleware.LivenessHandler())
	mux.HandleFunc("GET /healthz/ready", middleware.ReadinessHandler())
	mux.HandleFunc("GET /metrics", observability.DefaultRegistry.PrometheusHandler())

	internalAuth.RegisterRoutes(mux, svc)

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
		slog.Info("auth service started", "port", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("auth listen failed", "error", err)
		}
	}()

	_ = concurrency.GracefulShutdown(ctx, 10*time.Second, server)
	slog.Info("auth service stopped")
}
