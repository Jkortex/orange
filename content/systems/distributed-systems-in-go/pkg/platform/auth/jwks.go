package auth

import (
	"crypto/ecdsa"
	"encoding/base64"
	"encoding/json"
	"net/http"
)

// JWK represents a JSON Web Key for public key distribution.
type JWK struct {
	Kty string `json:"kty"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
	Use string `json:"use"`
	Kid string `json:"kid"`
	Alg string `json:"alg"`
}

// JWKS is a set of JSON Web Keys.
type JWKS struct {
	Keys []JWK `json:"keys"`
}

// PublicKeyToJWK converts an ECDSA P-256 public key into a JWK structure.
func PublicKeyToJWK(pub *ecdsa.PublicKey, kid string) JWK {
	// P-256 is 32 bytes
	xBytes := pub.X.Bytes()
	yBytes := pub.Y.Bytes()

	padX := make([]byte, 32)
	padY := make([]byte, 32)
	copy(padX[32-len(xBytes):], xBytes)
	copy(padY[32-len(yBytes):], yBytes)

	return JWK{
		Kty: "EC",
		Crv: "P-256",
		X:   base64.RawURLEncoding.EncodeToString(padX),
		Y:   base64.RawURLEncoding.EncodeToString(padY),
		Use: "sig",
		Kid: kid,
		Alg: "ES256",
	}
}

// JWKSHandler returns an HTTP handler serving the public key set (.well-known/jwks.json).
func JWKSHandler(jwks JWKS) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "public, max-age=3600")
		_ = json.NewEncoder(w).Encode(jwks)
	}
}
