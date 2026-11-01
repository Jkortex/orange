package config

import (
	"bufio"
	"fmt"
	"os"
	"reflect"
	"strconv"
	"strings"
	"time"
)

// Validator is an optional interface that config structs can implement for domain-specific checks.
type Validator interface {
	Validate() error
}

// Load populates a config struct T from environment variables based on struct tags.
// Supports `env:"VAR_NAME"`, `envDefault:"val"`, and `required:"true"`.
func Load[T any]() (T, error) {
	var cfg T
	val := reflect.ValueOf(&cfg).Elem()
	if val.Kind() != reflect.Struct {
		return cfg, fmt.Errorf("config target must be a struct")
	}

	if err := populateStruct(val); err != nil {
		return cfg, fmt.Errorf("load config: %w", err)
	}

	// Run custom validation if implemented
	if v, ok := any(cfg).(Validator); ok {
		if err := v.Validate(); err != nil {
			return cfg, fmt.Errorf("validate config: %w", err)
		}
	} else if v, ok := any(&cfg).(Validator); ok {
		if err := v.Validate(); err != nil {
			return cfg, fmt.Errorf("validate config: %w", err)
		}
	}

	return cfg, nil
}

func populateStruct(val reflect.Value) error {
	t := val.Type()

	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		fieldVal := val.Field(i)

		if !fieldVal.CanSet() {
			continue
		}

		if fieldVal.Kind() == reflect.Struct && field.Type != reflect.TypeOf(time.Time{}) {
			if err := populateStruct(fieldVal); err != nil {
				return err
			}
			continue
		}

		envKey := field.Tag.Get("env")
		if envKey == "" {
			continue
		}

		envVal, found := os.LookupEnv(envKey)
		if !found || envVal == "" {
			envVal = field.Tag.Get("envDefault")
		}

		if envVal == "" {
			if field.Tag.Get("required") == "true" {
				return fmt.Errorf("missing required environment variable: %s", envKey)
			}
			continue
		}

		if err := setFieldValue(fieldVal, envVal); err != nil {
			return fmt.Errorf("field %s (%s): %w", field.Name, envKey, err)
		}
	}
	return nil
}

func setFieldValue(f reflect.Value, raw string) error {
	if f.Type() == reflect.TypeOf(time.Duration(0)) {
		d, err := time.ParseDuration(raw)
		if err != nil {
			return err
		}
		f.Set(reflect.ValueOf(d))
		return nil
	}

	switch f.Kind() {
	case reflect.String:
		f.SetString(raw)
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		n, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			return err
		}
		f.SetInt(n)
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		n, err := strconv.ParseUint(raw, 10, 64)
		if err != nil {
			return err
		}
		f.SetUint(n)
	case reflect.Bool:
		b, err := strconv.ParseBool(raw)
		if err != nil {
			return err
		}
		f.SetBool(b)
	case reflect.Float32, reflect.Float64:
		fl, err := strconv.ParseFloat(raw, 64)
		if err != nil {
			return err
		}
		f.SetFloat(fl)
	default:
		return fmt.Errorf("unsupported type %s", f.Type())
	}
	return nil
}

// LoadDotEnv parses and sets environment variables from a .env file.
func LoadDotEnv(filePath string) error {
	file, err := os.Open(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			key := strings.TrimSpace(parts[0])
			val := strings.Trim(strings.TrimSpace(parts[1]), `"'`)
			if _, exists := os.LookupEnv(key); !exists {
				_ = os.Setenv(key, val)
			}
		}
	}
	return scanner.Err()
}
