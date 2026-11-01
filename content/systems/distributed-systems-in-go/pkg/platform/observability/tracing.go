package observability

import (
	"context"
	"crypto/rand"
	"encoding/hex"

	"distributed-systems-in-go/pkg/platform/ctxutil"
)

// Span represents a distributed tracing span.
type Span struct {
	TraceID string
	SpanID  string
	Name    string
}

// StartSpan creates a new child span and injects its TraceID into the returned context.
func StartSpan(ctx context.Context, name string) (context.Context, *Span) {
	traceID, ok := ctxutil.Value[string](ctx, ctxutil.TraceIDKey)
	if !ok || traceID == "" {
		traceID = randomHex(16) // 128-bit W3C TraceID
		ctx = ctxutil.WithValue(ctx, ctxutil.TraceIDKey, traceID)
	}

	spanID := randomHex(8) // 64-bit SpanID
	span := &Span{
		TraceID: traceID,
		SpanID:  spanID,
		Name:    name,
	}

	return ctx, span
}

func randomHex(bytesLen int) string {
	b := make([]byte, bytesLen)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
