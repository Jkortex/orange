package middleware

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
)

// APIError represents the standard error response structure returned across all services.
type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details any    `json:"details,omitempty"`
}

// WriteError serializes a structured APIError as a JSON response.
func WriteError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(APIError{Code: code, Message: message}); err != nil {
		slog.Error("failed to write error response", "error", err)
	}
}

// WriteJSON serializes arbitrary data to an HTTP JSON response.
func WriteJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		slog.Error("failed to write json response", "error", err)
	}
}

// DecodeJSON decodes an incoming JSON request body into the target struct.
// It enforces application/json content type, disallows unknown fields, and ensures
// the body contains only a single JSON object.
func DecodeJSON(r *http.Request, v any) error {
	if r.Header.Get("Content-Type") != "application/json" {
		return fmt.Errorf("expected Content-Type: application/json")
	}

	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	if err := dec.Decode(v); err != nil {
		return fmt.Errorf("decode JSON: %w", err)
	}

	if dec.More() {
		return fmt.Errorf("request body must contain a single JSON object")
	}

	return nil
}
