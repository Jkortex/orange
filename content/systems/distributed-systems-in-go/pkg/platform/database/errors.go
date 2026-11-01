package database

import (
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// Common domain storage errors.
var (
	ErrNotFound = errors.New("record not found")
	ErrConflict = errors.New("optimistic lock conflict")
)

// IsNotFound returns true if the error is pgx.ErrNoRows or ErrNotFound.
func IsNotFound(err error) bool {
	return errors.Is(err, pgx.ErrNoRows) || errors.Is(err, ErrNotFound)
}

// IsConflict returns true if the error represents an optimistic locking conflict.
func IsConflict(err error) bool {
	return errors.Is(err, ErrConflict)
}

// IsUniqueViolation returns true if the PostgreSQL error code is 23505 (unique_violation).
func IsUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	return false
}

// IsForeignKeyViolation returns true if the PostgreSQL error code is 23503 (foreign_key_violation).
func IsForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23503"
	}
	return false
}
