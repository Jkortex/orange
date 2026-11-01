package observability

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"distributed-systems-in-go/pkg/platform/ctxutil"
)

func TestContextHandler_InjectsAttributes(t *testing.T) {
	buf := &bytes.Buffer{}
	logger := NewLogger(LogConfig{
		Level:       "info",
		Environment: "production",
		Output:      buf,
	})

	ctx := context.Background()
	ctx = ctxutil.WithValue(ctx, ctxutil.RequestIDKey, "req-555")
	ctx = ctxutil.WithValue(ctx, ctxutil.TraceIDKey, "trace-777")
	ctx = ctxutil.WithValue(ctx, ctxutil.TenantIDKey, "tenant-999")

	logger.InfoContext(ctx, "test event", "action", "create_order")

	out := buf.String()
	if !strings.Contains(out, `"request_id":"req-555"`) {
		t.Fatalf("expected request_id in log, got: %s", out)
	}
	if !strings.Contains(out, `"trace_id":"trace-777"`) {
		t.Fatalf("expected trace_id in log, got: %s", out)
	}
	if !strings.Contains(out, `"tenant_id":"tenant-999"`) {
		t.Fatalf("expected tenant_id in log, got: %s", out)
	}
}

func TestMetricsRegistry_PrometheusExposition(t *testing.T) {
	reg := NewMetricsRegistry()
	labels := map[string]string{"method": "GET", "path": "/healthz"}

	reg.IncCounter("http_requests_total", labels)
	reg.ObserveLatency("http_request_duration_ms", labels, 25*time.Millisecond)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	reg.PrometheusHandler().ServeHTTP(rec, req)

	body := rec.Body.String()
	if !strings.Contains(body, `http_requests_total{method="GET",path="/healthz"} 1`) {
		t.Fatalf("unexpected prometheus output: %s", body)
	}
	if !strings.Contains(body, `_count 1`) {
		t.Fatalf("unexpected prometheus latency count: %s", body)
	}
}

func TestTracing_StartSpan(t *testing.T) {
	ctx := context.Background()
	ctx1, span1 := StartSpan(ctx, "ParentSpan")
	if span1.TraceID == "" || len(span1.TraceID) != 32 {
		t.Fatalf("expected 32-char hex TraceID, got %s", span1.TraceID)
	}

	// Child span should inherit parent trace ID
	_, span2 := StartSpan(ctx1, "ChildSpan")
	if span2.TraceID != span1.TraceID {
		t.Fatalf("child span should inherit parent trace ID: %s vs %s", span2.TraceID, span1.TraceID)
	}
	if span2.SpanID == span1.SpanID {
		t.Fatal("child span must have unique SpanID")
	}
}
