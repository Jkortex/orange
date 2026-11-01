package observability

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"distributed-systems-in-go/pkg/platform/middleware"
)

// MetricsRegistry maintains application metrics in memory and exports them in Prometheus format.
type MetricsRegistry struct {
	mu           sync.RWMutex
	counters     map[string]*atomic.Uint64
	latencySum   map[string]*atomic.Uint64 // in milliseconds
	latencyCount map[string]*atomic.Uint64
}

// Global default registry
var DefaultRegistry = NewMetricsRegistry()

// NewMetricsRegistry initializes a metrics registry.
func NewMetricsRegistry() *MetricsRegistry {
	return &MetricsRegistry{
		counters:     make(map[string]*atomic.Uint64),
		latencySum:   make(map[string]*atomic.Uint64),
		latencyCount: make(map[string]*atomic.Uint64),
	}
}

// IncCounter increments a counter metric by 1.
func (r *MetricsRegistry) IncCounter(name string, labels map[string]string) {
	key := metricKey(name, labels)
	r.mu.Lock()
	c, ok := r.counters[key]
	if !ok {
		c = &atomic.Uint64{}
		r.counters[key] = c
	}
	r.mu.Unlock()
	c.Add(1)
}

// ObserveLatency records an observation in milliseconds.
func (r *MetricsRegistry) ObserveLatency(name string, labels map[string]string, d time.Duration) {
	key := metricKey(name, labels)
	ms := uint64(d.Milliseconds())
	r.mu.Lock()
	sum, ok := r.latencySum[key]
	if !ok {
		sum = &atomic.Uint64{}
		r.latencySum[key] = sum
	}
	count, ok := r.latencyCount[key]
	if !ok {
		count = &atomic.Uint64{}
		r.latencyCount[key] = count
	}
	r.mu.Unlock()

	sum.Add(ms)
	count.Add(1)
}

// PrometheusHandler exposes the metrics at /metrics in standard Prometheus text format.
func (r *MetricsRegistry) PrometheusHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "text/plain; version=0.0.4")
		r.mu.RLock()
		defer r.mu.RUnlock()

		var sb strings.Builder
		for key, counter := range r.counters {
			sb.WriteString(fmt.Sprintf("%s %d\n", key, counter.Load()))
		}
		for key, sum := range r.latencySum {
			count := r.latencyCount[key].Load()
			sb.WriteString(fmt.Sprintf("%s_sum_ms %d\n", key, sum.Load()))
			sb.WriteString(fmt.Sprintf("%s_count %d\n", key, count))
		}
		_, _ = w.Write([]byte(sb.String()))
	}
}

// HTTPMetricsMiddleware instruments HTTP requests with request count and latency metrics.
func HTTPMetricsMiddleware(registry *MetricsRegistry) middleware.Middleware {
	if registry == nil {
		registry = DefaultRegistry
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			next.ServeHTTP(w, r)
			duration := time.Since(start)

			labels := map[string]string{
				"method": r.Method,
				"path":   r.URL.Path,
			}
			registry.IncCounter("http_requests_total", labels)
			registry.ObserveLatency("http_request_duration_ms", labels, duration)
		})
	}
}

func metricKey(name string, labels map[string]string) string {
	if len(labels) == 0 {
		return name
	}
	var pairs []string
	for k, v := range labels {
		pairs = append(pairs, fmt.Sprintf("%s=\"%s\"", k, v))
	}
	return fmt.Sprintf("%s{%s}", name, strings.Join(pairs, ","))
}
