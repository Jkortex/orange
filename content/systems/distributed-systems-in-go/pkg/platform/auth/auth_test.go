package auth

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"distributed-systems-in-go/pkg/platform/middleware"
)

func TestAuth_TokenGenerationAndValidation(t *testing.T) {
	privKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("failed to generate key: %v", err)
	}

	claims := &Claims{
		Subject:   "user-1001",
		TenantID:  "tenant-alpha",
		Roles:     []string{"editor"},
		Scopes:    []string{"orders:read", "orders:write"},
		ExpiresAt: time.Now().Add(1 * time.Hour),
	}

	token, err := GenerateToken(claims, privKey, "key-1")
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	parsed, err := ValidateToken(token, &privKey.PublicKey)
	if err != nil {
		t.Fatalf("failed to validate token: %v", err)
	}

	if parsed.Subject != "user-1001" {
		t.Fatalf("expected subject user-1001, got %s", parsed.Subject)
	}
	if !parsed.HasScope("orders:read") || !parsed.HasScope("orders:write") {
		t.Fatal("expected scopes to match")
	}
	if parsed.HasScope("orders:delete") {
		t.Fatal("did not expect orders:delete scope")
	}
}

func TestAuth_MiddlewareAndScopes(t *testing.T) {
	privKey, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)

	protectedHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := ClaimsFromContext(r.Context())
		if !ok {
			t.Fatal("expected claims in context")
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(claims.Subject))
	})

	chained := middleware.Chain(
		protectedHandler,
		AuthMiddleware(&privKey.PublicKey),
		RequireScope("orders:write"),
	)

	// Valid token
	validClaims := &Claims{
		Subject:   "user-ok",
		Scopes:    []string{"orders:write"},
		ExpiresAt: time.Now().Add(1 * time.Hour),
	}
	validToken, _ := GenerateToken(validClaims, privKey, "k1")

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/orders", nil)
	req.Header.Set("Authorization", "Bearer "+validToken)
	chained.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	// Missing scope
	noScopeClaims := &Claims{
		Subject:   "user-readonly",
		Scopes:    []string{"orders:read"},
		ExpiresAt: time.Now().Add(1 * time.Hour),
	}
	noScopeToken, _ := GenerateToken(noScopeClaims, privKey, "k1")

	rec2 := httptest.NewRecorder()
	req2 := httptest.NewRequest(http.MethodGet, "/orders", nil)
	req2.Header.Set("Authorization", "Bearer "+noScopeToken)
	chained.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for missing scope, got %d", rec2.Code)
	}
}

func TestPassword_Bcrypt(t *testing.T) {
	pwd := "super-secure-pass123"
	hashed, err := HashPassword(pwd)
	if err != nil {
		t.Fatalf("hash password failed: %v", err)
	}

	if !VerifyPassword(hashed, pwd) {
		t.Fatal("expected password verification to succeed")
	}
	if VerifyPassword(hashed, "wrong-pass") {
		t.Fatal("expected wrong password to fail")
	}
}
