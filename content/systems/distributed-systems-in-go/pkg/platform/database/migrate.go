package database

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// MigrationRunner executes SQL migrations against PostgreSQL.
type MigrationRunner struct {
	pool *pgxpool.Pool
}

// NewMigrationRunner creates a MigrationRunner.
func NewMigrationRunner(pool *pgxpool.Pool) *MigrationRunner {
	return &MigrationRunner{pool: pool}
}

// Run executes all unapplied `*.up.sql` files from the specified directory in lexicographical order.
func (m *MigrationRunner) Run(ctx context.Context, dir string) error {
	// 1. Ensure migrations tracking table exists
	initSQL := `
	CREATE TABLE IF NOT EXISTS schema_migrations (
		version VARCHAR(255) PRIMARY KEY,
		applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);`
	if _, err := m.pool.Exec(ctx, initSQL); err != nil {
		return fmt.Errorf("init schema_migrations table: %w", err)
	}

	// 2. Query already applied migrations
	rows, err := m.pool.Query(ctx, `SELECT version FROM schema_migrations;`)
	if err != nil {
		return fmt.Errorf("query applied migrations: %w", err)
	}
	defer rows.Close()

	applied := make(map[string]bool)
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			return err
		}
		applied[v] = true
	}

	// 3. Scan directory for *.up.sql files
	files, err := os.ReadDir(dir)
	if err != nil {
		return fmt.Errorf("read migration dir: %w", err)
	}

	var upFiles []string
	for _, f := range files {
		if !f.IsDir() && strings.HasSuffix(f.Name(), ".up.sql") {
			upFiles = append(upFiles, f.Name())
		}
	}
	sort.Strings(upFiles)

	// 4. Execute pending migrations in transaction
	for _, fileName := range upFiles {
		version := strings.TrimSuffix(fileName, ".up.sql")
		if applied[version] {
			continue
		}

		filePath := filepath.Join(dir, fileName)
		content, err := os.ReadFile(filePath)
		if err != nil {
			return fmt.Errorf("read migration file %s: %w", fileName, err)
		}

		slog.InfoContext(ctx, "applying database migration", "version", version)
		err = InTransaction(ctx, m.pool, func(tx pgx.Tx) error {
			if _, err := tx.Exec(ctx, string(content)); err != nil {
				return fmt.Errorf("execute %s: %w", fileName, err)
			}
			if _, err := tx.Exec(ctx, "INSERT INTO schema_migrations (version) VALUES ($1);", version); err != nil {
				return fmt.Errorf("record migration %s: %w", version, err)
			}
			return nil
		})
		if err != nil {
			return err
		}
	}

	slog.InfoContext(ctx, "database migrations up to date")
	return nil
}
