package messaging

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// EventEnvelope standardizes event metadata across all asynchronous message brokers.
type EventEnvelope struct {
	ID        string          `json:"id"`
	Type      string          `json:"type"`      // e.g. "order.created"
	Version   string          `json:"version"`   // e.g. "v1"
	Source    string          `json:"source"`    // e.g. "order-service"
	Timestamp time.Time       `json:"timestamp"` // UTC timestamp
	Data      json.RawMessage `json:"data"`
}

// NewEventEnvelope wraps payload data in a standard versioned event envelope.
func NewEventEnvelope(eventType, version, source string, payload any) (*EventEnvelope, error) {
	dataBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	return &EventEnvelope{
		ID:        uuid.NewString(),
		Type:      eventType,
		Version:   version,
		Source:    source,
		Timestamp: time.Now().UTC(),
		Data:      dataBytes,
	}, nil
}
