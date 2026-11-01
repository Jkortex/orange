package resilience

import (
	"errors"
	"sync"
	"time"
)

// State represents the current status of the circuit breaker.
type State int

const (
	StateClosed State = iota
	StateOpen
	StateHalfOpen
)

func (s State) String() string {
	switch s {
	case StateClosed:
		return "CLOSED"
	case StateOpen:
		return "OPEN"
	case StateHalfOpen:
		return "HALF_OPEN"
	default:
		return "UNKNOWN"
	}
}

var ErrCircuitOpen = errors.New("circuit breaker is open: request fast-failed")

// CircuitBreaker prevents cascading failures by rejecting requests when failure rate exceeds threshold.
type CircuitBreaker struct {
	mu           sync.Mutex
	failures     int
	successCount int
	lastFailure  time.Time
	state        State
	threshold    int
	resetTimeout time.Duration
}

// NewCircuitBreaker creates a CircuitBreaker with a failure threshold and reset cooldown.
func NewCircuitBreaker(threshold int, resetTimeout time.Duration) *CircuitBreaker {
	if threshold <= 0 {
		threshold = 5
	}
	if resetTimeout <= 0 {
		resetTimeout = 10 * time.Second
	}
	return &CircuitBreaker{
		threshold:    threshold,
		resetTimeout: resetTimeout,
		state:        StateClosed,
	}
}

// Execute wraps a function call with circuit breaker protection.
func (cb *CircuitBreaker) Execute(fn func() error) error {
	cb.mu.Lock()
	currentState := cb.checkState()
	cb.mu.Unlock()

	if currentState == StateOpen {
		return ErrCircuitOpen
	}

	err := fn()

	cb.mu.Lock()
	defer cb.mu.Unlock()

	if err != nil {
		cb.failures++
		cb.lastFailure = time.Now()
		cb.successCount = 0
		if cb.failures >= cb.threshold {
			cb.state = StateOpen
		}
		return err
	}

	if cb.state == StateHalfOpen {
		cb.successCount++
		if cb.successCount >= 2 { // Two consecutive successes to recover
			cb.state = StateClosed
			cb.failures = 0
			cb.successCount = 0
		}
	} else {
		cb.failures = 0
	}

	return nil
}

// State returns the current State.
func (cb *CircuitBreaker) State() State {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	return cb.checkState()
}

func (cb *CircuitBreaker) checkState() State {
	if cb.state == StateOpen && time.Since(cb.lastFailure) > cb.resetTimeout {
		cb.state = StateHalfOpen
	}
	return cb.state
}
