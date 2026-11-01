package concurrency

import (
	"context"
	"sync"
)

// WorkerPool manages a pool of workers processing concurrent jobs with bounded concurrency.
type WorkerPool struct {
	ctx        context.Context
	cancel     context.CancelFunc
	jobs       chan func() error
	results    chan error
	drainWg    sync.WaitGroup
	workersWg  sync.WaitGroup
	errsMu     sync.Mutex
	collected  []error
}

// NewWorkerPool creates and starts a WorkerPool with the specified number of workers.
func NewWorkerPool(parentCtx context.Context, workers int) *WorkerPool {
	ctx, cancel := context.WithCancel(parentCtx)
	wp := &WorkerPool{
		ctx:     ctx,
		cancel:  cancel,
		jobs:    make(chan func() error, workers*2),
		results: make(chan error, workers*2),
	}

	// Result collector goroutine to prevent deadlocks when error count exceeds buffer size
	wp.drainWg.Add(1)
	go func() {
		defer wp.drainWg.Done()
		for err := range wp.results {
			if err != nil {
				wp.errsMu.Lock()
				wp.collected = append(wp.collected, err)
				wp.errsMu.Unlock()
			}
		}
	}()

	for i := 0; i < workers; i++ {
		wp.workersWg.Add(1)
		go func() {
			defer wp.workersWg.Done()
			for {
				select {
				case <-wp.ctx.Done():
					return
				case fn, ok := <-wp.jobs:
					if !ok {
						return
					}
					if fn != nil {
						err := fn()
						select {
						case wp.results <- err:
						case <-wp.ctx.Done():
							return
						}
					}
				}
			}
		}()
	}
	return wp
}

// Submit enqueues a job for execution. Returns false if the pool context is canceled.
func (wp *WorkerPool) Submit(fn func() error) bool {
	select {
	case <-wp.ctx.Done():
		return false
	case wp.jobs <- fn:
		return true
	}
}

// Close closes the job channel, waits for all active workers to finish, and returns any collected errors.
func (wp *WorkerPool) Close() []error {
	close(wp.jobs)
	wp.workersWg.Wait()
	close(wp.results)
	wp.drainWg.Wait()

	wp.errsMu.Lock()
	defer wp.errsMu.Unlock()
	return wp.collected
}
