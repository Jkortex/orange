package config

import (
	"errors"
	"os"
	"testing"
	"time"
)

type TestAppConfig struct {
	AppName     string        `env:"APP_NAME" envDefault:"orderflow"`
	Port        int           `env:"PORT" envDefault:"8080"`
	DatabaseURL string        `env:"DATABASE_URL" required:"true"`
	Timeout     time.Duration `env:"TIMEOUT" envDefault:"5s"`
	Debug       bool          `env:"DEBUG" envDefault:"false"`
}

func (c TestAppConfig) Validate() error {
	if c.Port <= 0 || c.Port > 65535 {
		return errors.New("port out of range")
	}
	return nil
}

func TestConfig_LoadWithDefaultsAndOverrides(t *testing.T) {
	_ = os.Setenv("DATABASE_URL", "postgres://user:pass@localhost:5432/orders")
	_ = os.Setenv("PORT", "9090")
	_ = os.Setenv("DEBUG", "true")
	defer func() {
		_ = os.Unsetenv("DATABASE_URL")
		_ = os.Unsetenv("PORT")
		_ = os.Unsetenv("DEBUG")
	}()

	cfg, err := Load[TestAppConfig]()
	if err != nil {
		t.Fatalf("failed to load config: %v", err)
	}

	if cfg.AppName != "orderflow" {
		t.Fatalf("expected default orderflow, got %s", cfg.AppName)
	}
	if cfg.Port != 9090 {
		t.Fatalf("expected overridden port 9090, got %d", cfg.Port)
	}
	if !cfg.Debug {
		t.Fatal("expected debug to be true")
	}
	if cfg.Timeout != 5*time.Second {
		t.Fatalf("expected 5s timeout, got %v", cfg.Timeout)
	}
}

func TestConfig_RequiredValidation(t *testing.T) {
	_ = os.Unsetenv("DATABASE_URL")

	_, err := Load[TestAppConfig]()
	if err == nil {
		t.Fatal("expected error due to missing required DATABASE_URL")
	}
}
