package auth

import (
	"context"
	"time"
)

type contextKey string

const claimsContextKey contextKey = "auth_claims"

// Claims represents the identity and authorization payload of a JWT token.
type Claims struct {
	Subject   string    `json:"sub"`                 // User / Subject ID
	Issuer    string    `json:"iss,omitempty"`       // Token Issuer
	Audience  string    `json:"aud,omitempty"`       // Target Audience
	ExpiresAt time.Time `json:"exp"`                 // Expiration timestamp
	IssuedAt  time.Time `json:"iat"`                 // Issuance timestamp
	ID        string    `json:"jti,omitempty"`       // Unique Token ID
	TenantID  string    `json:"tenant_id,omitempty"` // Multi-tenant isolation
	Roles     []string  `json:"roles,omitempty"`     // Role-Based Access Control
	Scopes    []string  `json:"scopes,omitempty"`    // OAuth-style fine-grained scopes
}

// Valid verifies standard claims like expiration time.
func (c *Claims) Valid() bool {
	if !c.ExpiresAt.IsZero() && time.Now().After(c.ExpiresAt) {
		return false
	}
	return c.Subject != ""
}

// HasScope checks if the token grants the required permission scope.
func (c *Claims) HasScope(required string) bool {
	for _, s := range c.Scopes {
		if s == required || s == "*" {
			return true
		}
	}
	return false
}

// HasRole checks if the claims contain the specified role.
func (c *Claims) HasRole(required string) bool {
	for _, r := range c.Roles {
		if r == required || r == "admin" {
			return true
		}
	}
	return false
}

// ContextWithClaims attaches Claims to the context.
func ContextWithClaims(ctx context.Context, claims *Claims) context.Context {
	return context.WithValue(ctx, claimsContextKey, claims)
}

// ClaimsFromContext retrieves Claims from the context.
func ClaimsFromContext(ctx context.Context) (*Claims, bool) {
	if ctx == nil {
		return nil, false
	}
	c, ok := ctx.Value(claimsContextKey).(*Claims)
	return c, ok
}
