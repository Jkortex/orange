package cli

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestCheckHealth_SuccessAndFailure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthy" {
			w.WriteHeader(http.StatusOK)
		} else {
			w.WriteHeader(http.StatusServiceUnavailable)
		}
	}))
	defer server.Close()

	ctx := context.Background()

	// Healthy
	if err := CheckHealth(ctx, server.URL+"/healthy", 1*time.Second); err != nil {
		t.Fatalf("expected healthy check to succeed, got %v", err)
	}

	// Unhealthy
	if err := CheckHealth(ctx, server.URL+"/unhealthy", 1*time.Second); err == nil {
		t.Fatal("expected unhealthy check to return error")
	}
}
