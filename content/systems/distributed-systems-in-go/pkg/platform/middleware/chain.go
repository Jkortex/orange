package middleware

import "net/http"

// Middleware represents an HTTP middleware function wrapping an http.Handler.
type Middleware func(http.Handler) http.Handler

// Chain composes multiple middlewares into a single handler.
// Middlewares are executed in the order they are passed (the first argument is outermost).
func Chain(h http.Handler, m ...Middleware) http.Handler {
	for i := len(m) - 1; i >= 0; i-- {
		h = m[i](h)
	}
	return h
}
