package cli

import (
	"context"
	"fmt"
	"net/http"
	"time"
)

// CheckHealth queries a target HTTP health endpoint with a timeout.
// Returns an error if the status code is not 200 OK.
func CheckHealth(ctx context.Context, endpointURL string, timeout time.Duration) error {
	client := &http.Client{Timeout: timeout}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpointURL, nil)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("health check request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("health check failed with status %d", resp.StatusCode)
	}

	return nil
}
