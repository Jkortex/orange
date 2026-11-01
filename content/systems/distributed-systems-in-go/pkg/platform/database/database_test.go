package database

import (
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func TestDatabase_ErrorHelpers(t *testing.T) {
	if !IsNotFound(pgx.ErrNoRows) {
		t.Fatal("expected pgx.ErrNoRows to be recognized as NotFound")
	}
	if !IsNotFound(ErrNotFound) {
		t.Fatal("expected ErrNotFound to be recognized as NotFound")
	}
	if IsNotFound(errors.New("some other error")) {
		t.Fatal("did not expect generic error to be recognized as NotFound")
	}

	uniquePgErr := &pgconn.PgError{Code: "23505"}
	if !IsUniqueViolation(uniquePgErr) {
		t.Fatal("expected 23505 to be recognized as UniqueViolation")
	}

	fkPgErr := &pgconn.PgError{Code: "23503"}
	if !IsForeignKeyViolation(fkPgErr) {
		t.Fatal("expected 23503 to be recognized as ForeignKeyViolation")
	}
}
