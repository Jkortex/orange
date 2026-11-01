package middleware

import (
	"context"
	"net/http"
	"time"
)

// Timeout enforces a server-side processing deadline on the request context.
func Timeout(timeout time.Duration) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx, cancel := context.WithTimeout(r.Context(), timeout)
			defer cancel()

			done := make(chan struct{})
			panicChan := make(chan any, 1)

			go func() {
				defer func() {
					if p := recover(); p != nil {
						panicChan <- p
					}
				}()
				next.ServeHTTP(w, r.WithContext(ctx))
				close(done)
			}()

			select {
			case p := <-panicChan:
				panic(p) // re-panic to be caught by outer RecoverMiddleware
			case <-done:
				return
			case <-ctx.Done():
				WriteError(w, http.StatusGatewayTimeout, "TIMEOUT", "request processing timed out")
			}
		})
	}
}
