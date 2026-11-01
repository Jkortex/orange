package database

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PoolConfig holds configurable parameters for pgxpool connection pool.
type PoolConfig struct {
	MaxConns          int32
	MinConns          int32
	MaxConnLifetime   time.Duration
	MaxConnIdleTime   time.Duration
	HealthCheckPeriod time.Duration
	ApplicationName   string
}

// DefaultPoolConfig returns recommended defaults for cloud-native services.
func DefaultPoolConfig() PoolConfig {
	return PoolConfig{
		MaxConns:          20,
		MinConns:          2,
		MaxConnLifetime:   time.Hour,
		MaxConnIdleTime:   30 * time.Minute,
		HealthCheckPeriod: time.Minute,
		ApplicationName:   "orderflow-service",
	}
}

// PoolOption provides functional configuration for NewDB.
type PoolOption func(*pgxpool.Config)

// WithApplicationName sets the PostgreSQL application name for monitoring in pg_stat_activity.
func WithApplicationName(name string) PoolOption {
	return func(c *pgxpool.Config) {
		c.BeforeConnect = func(ctx context.Context, cc *pgx.ConnConfig) error {
			if cc.RuntimeParams == nil {
				cc.RuntimeParams = make(map[string]string)
			}
			cc.RuntimeParams["application_name"] = name
			return nil
		}
	}
}

// WithMaxConns overrides max pool connections.
func WithMaxConns(n int32) PoolOption {
	return func(c *pgxpool.Config) {
		c.MaxConns = n
	}
}

// NewDB creates and tests a PostgreSQL connection pool using pgxpool.
func NewDB(ctx context.Context, connString string, opts ...PoolOption) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return nil, fmt.Errorf("parse db config: %w", err)
	}

	defaults := DefaultPoolConfig()
	cfg.MaxConns = defaults.MaxConns
	cfg.MinConns = defaults.MinConns
	cfg.MaxConnLifetime = defaults.MaxConnLifetime
	cfg.MaxConnIdleTime = defaults.MaxConnIdleTime
	cfg.HealthCheckPeriod = defaults.HealthCheckPeriod

	WithApplicationName(defaults.ApplicationName)(cfg)

	for _, opt := range opts {
		opt(cfg)
	}

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping db: %w", err)
	}

	return pool, nil
}
