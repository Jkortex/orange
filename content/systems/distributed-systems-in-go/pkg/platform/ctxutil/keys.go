package ctxutil

// ContextKey is an unexported string type to avoid key collisions across packages.
type ContextKey string

const (
	RequestIDKey ContextKey = "request_id"
	ClaimsKey    ContextKey = "claims"
	TraceIDKey   ContextKey = "trace_id"
	TenantIDKey  ContextKey = "tenant_id"
	ServiceIDKey ContextKey = "service_id"
)
