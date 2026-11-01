package middleware

import (
	"context"
	"net/http"

	"github.com/google/uuid"
)

type contextKey string

const requestIDKey contextKey = "request_id"

// RequestID sets or propagates a unique correlation ID for every request.
func RequestID() Middleware {
	return RequestIDMiddleware
}

// RequestIDMiddleware is the HTTP handler for request correlation ID propagation.
func RequestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-ID")
		if id == "" {
			id = uuid.NewString()
		}

		ctx := context.WithValue(r.Context(), requestIDKey, id)
		w.Header().Set("X-Request-ID", id)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequestIDFromContext extracts the request correlation ID from context.
func RequestIDFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	id, _ := ctx.Value(requestIDKey).(string)
	return id
}

// ContextWithRequestID binds a request ID into a context.
func ContextWithRequestID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, requestIDKey, id)
}
