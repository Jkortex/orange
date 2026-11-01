package middleware

import (
	"log/slog"
	"net/http"
	"runtime/debug"
)

// Recover catches panics occurring anywhere downstream in the chain,
// logs the stack trace with contextual request info, and returns a 500 error.
func Recover() Middleware {
	return RecoverMiddleware
}

// RecoverMiddleware is the canonical panic recovery middleware.
func RecoverMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				slog.ErrorContext(r.Context(), "panic recovered",
					"error", err,
					"stack", string(debug.Stack()),
					"method", r.Method,
					"path", r.URL.Path,
				)

				WriteError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}
