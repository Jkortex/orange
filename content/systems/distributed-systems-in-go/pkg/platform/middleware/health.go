package middleware

import (
	"context"
	"net/http"
	"time"
)

// DependencyChecker checks the health of an external dependency (e.g. database ping, queue connection).
type DependencyChecker func(ctx context.Context) error

// LivenessHandler returns a handler that indicates if the service container is alive.
// It always returns 200 OK without checking dependencies to avoid cascading restarts.
func LivenessHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"UP"}`))
	}
}

// ReadinessHandler verifies that the service and its critical dependencies are healthy.
// If any checker fails, it returns 503 Service Unavailable so the load balancer stops routing traffic.
func ReadinessHandler(checkers ...DependencyChecker) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()

		for _, check := range checkers {
			if err := check(ctx); err != nil {
				WriteError(w, http.StatusServiceUnavailable, "DEPENDENCY_UNHEALTHY", err.Error())
				return
			}
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"READY"}`))
	}
}
