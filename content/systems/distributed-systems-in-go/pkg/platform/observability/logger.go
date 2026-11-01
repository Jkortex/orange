package observability

import (
	"io"
	"log/slog"
	"os"
	"strings"
)

// LogConfig holds logger configuration.
type LogConfig struct {
	Level       string    // "debug", "info", "warn", "error"
	Environment string    // "production", "development"
	Output      io.Writer // Defaults to os.Stdout
}

// NewLogger initializes a structured slog.Logger with automatic context extraction.
func NewLogger(cfg LogConfig) *slog.Logger {
	out := cfg.Output
	if out == nil {
		out = os.Stdout
	}

	opts := &slog.HandlerOptions{
		Level:     ParseLogLevel(cfg.Level),
		AddSource: cfg.Environment != "production",
	}

	var base slog.Handler
	if cfg.Environment == "production" {
		base = slog.NewJSONHandler(out, opts)
	} else {
		base = slog.NewTextHandler(out, opts)
	}

	return slog.New(NewContextHandler(base))
}

// ParseLogLevel converts string representation to slog.Level.
func ParseLogLevel(level string) slog.Level {
	switch strings.ToLower(level) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
