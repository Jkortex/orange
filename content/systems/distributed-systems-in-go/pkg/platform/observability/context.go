package observability

import (
	"context"
	"log/slog"

	"distributed-systems-in-go/pkg/platform/ctxutil"
)

// ContextHandler wraps a base slog.Handler, automatically injecting
// request_id, trace_id, and user/tenant_id from the context into every log entry.
type ContextHandler struct {
	slog.Handler
}

// NewContextHandler wraps a base slog handler with context attribute extraction.
func NewContextHandler(h slog.Handler) *ContextHandler {
	return &ContextHandler{Handler: h}
}

// Handle extracts context values and appends them to the slog record before forwarding.
func (h *ContextHandler) Handle(ctx context.Context, r slog.Record) error {
	if ctx != nil {
		if reqID, ok := ctxutil.Value[string](ctx, ctxutil.RequestIDKey); ok && reqID != "" {
			r.AddAttrs(slog.String("request_id", reqID))
		}
		if traceID, ok := ctxutil.Value[string](ctx, ctxutil.TraceIDKey); ok && traceID != "" {
			r.AddAttrs(slog.String("trace_id", traceID))
		}
		if tenantID, ok := ctxutil.Value[string](ctx, ctxutil.TenantIDKey); ok && tenantID != "" {
			r.AddAttrs(slog.String("tenant_id", tenantID))
		}
	}
	return h.Handler.Handle(ctx, r)
}
