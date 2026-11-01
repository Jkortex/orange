package middleware

import (
	"io"
	"net/http"
)

// BodyClose ensures request bodies are drained and closed to enable TCP connection reuse.
func BodyClose() Middleware {
	return BodyCloseMiddleware
}

// BodyCloseMiddleware drains and closes the HTTP request body.
func BodyCloseMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if r.Body != nil {
				_, _ = io.Copy(io.Discard, r.Body)
				_ = r.Body.Close()
			}
		}()
		next.ServeHTTP(w, r)
	})
}
