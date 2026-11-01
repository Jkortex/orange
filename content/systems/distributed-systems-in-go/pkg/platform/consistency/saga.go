package consistency

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"distributed-systems-in-go/pkg/platform/concurrency"
)

// SagaStep defines an operation and its corresponding compensation (undo) action.
type SagaStep struct {
	Name       string
	Action     func(ctx context.Context) error
	Compensate func(ctx context.Context) error
}

// RunSaga executes steps in order. If any step fails, it executes the compensating
// actions of all completed steps in reverse order with a detached timeout context.
func RunSaga(ctx context.Context, steps []SagaStep) error {
	var completed []SagaStep

	for i, step := range steps {
		if err := step.Action(ctx); err != nil {
			slog.WarnContext(ctx, "saga step failed, beginning compensation",
				"step_index", i,
				"step_name", step.Name,
				"error", err,
			)

			// Detach context for compensation to ensure cleanup runs even if parent timed out
			compCtx, cancel := concurrency.Detach(ctx, 30*time.Second)
			defer cancel()

			for j := len(completed) - 1; j >= 0; j-- {
				compStep := completed[j]
				if compStep.Compensate != nil {
					if compErr := compStep.Compensate(compCtx); compErr != nil {
						slog.ErrorContext(compCtx, "saga compensation failed: manual intervention required",
							"step_index", j,
							"step_name", compStep.Name,
							"error", compErr,
						)
					}
				}
			}

			return fmt.Errorf("saga step %s failed: %w", step.Name, err)
		}

		completed = append(completed, step)
	}

	return nil
}
