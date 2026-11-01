package auth

import (
	"crypto/ecdsa"
	"net/http"
	"strings"

	"distributed-systems-in-go/pkg/platform/middleware"
)

// AuthMiddleware validates Authorization Bearer tokens against an ECDSA public key.
// On success, parsed Claims are injected into request.Context().
func AuthMiddleware(pub *ecdsa.PublicKey) middleware.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				middleware.WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "missing authorization header")
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				middleware.WriteError(w, http.StatusUnauthorized, "INVALID_TOKEN", "bearer token format required")
				return
			}

			claims, err := ValidateToken(parts[1], pub)
			if err != nil {
				middleware.WriteError(w, http.StatusUnauthorized, "INVALID_TOKEN", err.Error())
				return
			}

			ctx := ContextWithClaims(r.Context(), claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireScope returns a middleware enforcing that the caller holds the specified scope.
func RequireScope(scope string) middleware.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := ClaimsFromContext(r.Context())
			if !ok || claims == nil {
				middleware.WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "authentication required")
				return
			}

			if !claims.HasScope(scope) {
				middleware.WriteError(w, http.StatusForbidden, "INSUFFICIENT_SCOPE", "required scope missing: "+scope)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequireRole returns a middleware enforcing that the caller has a required role.
func RequireRole(role string) middleware.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := ClaimsFromContext(r.Context())
			if !ok || claims == nil {
				middleware.WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "authentication required")
				return
			}

			if !claims.HasRole(role) {
				middleware.WriteError(w, http.StatusForbidden, "FORBIDDEN", "required role missing: "+role)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
