package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestChain_ExecutionOrder(t *testing.T) {
	var order []string

	m1 := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			order = append(order, "m1_in")
			next.ServeHTTP(w, r)
			order = append(order, "m1_out")
		})
	}

	m2 := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			order = append(order, "m2_in")
			next.ServeHTTP(w, r)
			order = append(order, "m2_out")
		})
	}

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		order = append(order, "handler")
		w.WriteHeader(http.StatusOK)
	})

	chained := Chain(handler, m1, m2)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	chained.ServeHTTP(rec, req)

	expected := []string{"m1_in", "m2_in", "handler", "m2_out", "m1_out"}
	if len(order) != len(expected) {
		t.Fatalf("unexpected order length: got %v, expected %v", order, expected)
	}
	for i := range expected {
		if order[i] != expected[i] {
			t.Fatalf("at index %d: got %s, expected %s", i, order[i], expected[i])
		}
	}
}

func TestRecover_CatchesPanic(t *testing.T) {
	panickingHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("database connection blew up")
	})

	chained := Chain(panickingHandler, Recover())

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/panic", nil)
	chained.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 status, got %d", rec.Code)
	}

	var apiErr APIError
	if err := json.Unmarshal(rec.Body.Bytes(), &apiErr); err != nil {
		t.Fatalf("expected valid JSON error response: %v", err)
	}
	if apiErr.Code != "INTERNAL_ERROR" {
		t.Fatalf("expected INTERNAL_ERROR code, got %s", apiErr.Code)
	}
}

func TestRequestID_GeneratesAndPropagates(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := RequestIDFromContext(r.Context())
		if id == "" {
			t.Error("expected request id in context")
		}
		w.WriteHeader(http.StatusOK)
	})

	chained := Chain(handler, RequestID())

	// Case 1: auto-generate UUID
	rec1 := httptest.NewRecorder()
	req1 := httptest.NewRequest(http.MethodGet, "/id", nil)
	chained.ServeHTTP(rec1, req1)
	if rec1.Header().Get("X-Request-ID") == "" {
		t.Fatal("expected X-Request-ID header in response")
	}

	// Case 2: preserve incoming ID
	rec2 := httptest.NewRecorder()
	req2 := httptest.NewRequest(http.MethodGet, "/id", nil)
	req2.Header.Set("X-Request-ID", "upstream-trace-999")
	chained.ServeHTTP(rec2, req2)
	if rec2.Header().Get("X-Request-ID") != "upstream-trace-999" {
		t.Fatalf("expected upstream id preserved, got %s", rec2.Header().Get("X-Request-ID"))
	}
}

func TestTimeout_CancelsSlowHandler(t *testing.T) {
	slowHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-r.Context().Done():
			return
		case <-time.After(100 * time.Millisecond):
			w.WriteHeader(http.StatusOK)
		}
	})

	chained := Chain(slowHandler, Recover(), Timeout(20*time.Millisecond))

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/slow", nil)
	chained.ServeHTTP(rec, req)

	if rec.Code != http.StatusGatewayTimeout {
		t.Fatalf("expected 504 Gateway Timeout, got %d", rec.Code)
	}
}

func TestDecodeJSON_Validation(t *testing.T) {
	type RequestData struct {
		Name string `json:"name"`
		Age  int    `json:"age"`
	}

	// Case 1: valid payload
	validBody := bytes.NewBufferString(`{"name":"Alice","age":30}`)
	req1 := httptest.NewRequest(http.MethodPost, "/users", validBody)
	req1.Header.Set("Content-Type", "application/json")
	var data1 RequestData
	if err := DecodeJSON(req1, &data1); err != nil {
		t.Fatalf("failed to decode valid json: %v", err)
	}
	if data1.Name != "Alice" || data1.Age != 30 {
		t.Fatalf("unexpected decoded values: %+v", data1)
	}

	// Case 2: unknown field rejected
	unknownFieldBody := bytes.NewBufferString(`{"name":"Bob","age":25,"extra":"forbidden"}`)
	req2 := httptest.NewRequest(http.MethodPost, "/users", unknownFieldBody)
	req2.Header.Set("Content-Type", "application/json")
	var data2 RequestData
	if err := DecodeJSON(req2, &data2); err == nil {
		t.Fatal("expected error on unknown field, got nil")
	}

	// Case 3: wrong content-type
	req3 := httptest.NewRequest(http.MethodPost, "/users", validBody)
	var data3 RequestData
	if err := DecodeJSON(req3, &data3); err == nil {
		t.Fatal("expected error on missing Content-Type application/json")
	}
}

func TestHealthHandlers(t *testing.T) {
	// Liveness
	liveRec := httptest.NewRecorder()
	liveReq := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	LivenessHandler().ServeHTTP(liveRec, liveReq)
	if liveRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for liveness, got %d", liveRec.Code)
	}

	// Readiness healthy
	readyRec := httptest.NewRecorder()
	readyReq := httptest.NewRequest(http.MethodGet, "/ready", nil)
	checkPass := func(ctx context.Context) error { return nil }
	ReadinessHandler(checkPass).ServeHTTP(readyRec, readyReq)
	if readyRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for readiness, got %d", readyRec.Code)
	}

	// Readiness failing dependency
	failRec := httptest.NewRecorder()
	failReq := httptest.NewRequest(http.MethodGet, "/ready", nil)
	checkFail := func(ctx context.Context) error { return errors.New("database down") }
	ReadinessHandler(checkFail).ServeHTTP(failRec, failReq)
	if failRec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 for unhealthy dependency, got %d", failRec.Code)
	}
}
