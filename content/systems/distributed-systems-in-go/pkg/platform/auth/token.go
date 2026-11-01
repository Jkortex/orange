package auth

import (
	"crypto/ecdsa"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"
)

var (
	ErrInvalidToken   = errors.New("invalid token format")
	ErrExpiredToken   = errors.New("token is expired")
	ErrInvalidSig     = errors.New("signature verification failed")
	ErrUnsupportedAlg = errors.New("unsupported signing algorithm")
)

type tokenHeader struct {
	Alg string `json:"alg"`
	Typ string `json:"typ"`
	Kid string `json:"kid,omitempty"`
}

// GenerateToken signs claims using ECDSA (ES256) and returns a compact JWT string.
func GenerateToken(claims *Claims, key *ecdsa.PrivateKey, kid string) (string, error) {
	if claims.IssuedAt.IsZero() {
		claims.IssuedAt = time.Now()
	}
	if claims.ExpiresAt.IsZero() {
		claims.ExpiresAt = claims.IssuedAt.Add(24 * time.Hour)
	}

	header := tokenHeader{
		Alg: "ES256",
		Typ: "JWT",
		Kid: kid,
	}

	hBytes, err := json.Marshal(header)
	if err != nil {
		return "", fmt.Errorf("marshal header: %w", err)
	}
	cBytes, err := json.Marshal(claims)
	if err != nil {
		return "", fmt.Errorf("marshal claims: %w", err)
	}

	hB64 := base64.RawURLEncoding.EncodeToString(hBytes)
	cB64 := base64.RawURLEncoding.EncodeToString(cBytes)
	signingInput := hB64 + "." + cB64

	digest := sha256.Sum256([]byte(signingInput))
	r, s, err := ecdsa.Sign(rand.Reader, key, digest[:])
	if err != nil {
		return "", fmt.Errorf("ecdsa sign: %w", err)
	}

	// IEEE P1363 encoding for ES256: 32 bytes r + 32 bytes s
	curveByteSize := 32
	sig := make([]byte, curveByteSize*2)
	rBytes := r.Bytes()
	sBytes := s.Bytes()
	copy(sig[curveByteSize-len(rBytes):curveByteSize], rBytes)
	copy(sig[2*curveByteSize-len(sBytes):], sBytes)

	sigB64 := base64.RawURLEncoding.EncodeToString(sig)
	return signingInput + "." + sigB64, nil
}

// ValidateToken verifies the JWT signature against the public key and returns parsed Claims.
func ValidateToken(tokenStr string, pub *ecdsa.PublicKey) (*Claims, error) {
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 {
		return nil, ErrInvalidToken
	}

	hBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, fmt.Errorf("decode header: %w", err)
	}
	var header tokenHeader
	if err := json.Unmarshal(hBytes, &header); err != nil {
		return nil, fmt.Errorf("unmarshal header: %w", err)
	}
	if header.Alg != "ES256" {
		return nil, ErrUnsupportedAlg
	}

	sig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil || len(sig) != 64 {
		return nil, ErrInvalidSig
	}

	r := new(big.Int).SetBytes(sig[:32])
	s := new(big.Int).SetBytes(sig[32:])

	signingInput := parts[0] + "." + parts[1]
	digest := sha256.Sum256([]byte(signingInput))

	if !ecdsa.Verify(pub, digest[:], r, s) {
		return nil, ErrInvalidSig
	}

	cBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("decode claims: %w", err)
	}

	var claims Claims
	if err := json.Unmarshal(cBytes, &claims); err != nil {
		return nil, fmt.Errorf("unmarshal claims: %w", err)
	}

	if !claims.Valid() {
		return nil, ErrExpiredToken
	}

	return &claims, nil
}
