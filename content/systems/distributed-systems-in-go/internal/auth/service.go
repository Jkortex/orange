package auth

import (
	"context"
	"crypto/ecdsa"
	"errors"
	"fmt"
	"sync"
	"time"

	"distributed-systems-in-go/pkg/platform/auth"
	"github.com/google/uuid"
)

var (
	ErrUserExists    = errors.New("user with this email already exists")
	ErrInvalidCreds  = errors.New("invalid email or password")
	ErrUserNotFound  = errors.New("user not found")
)

type User struct {
	ID           string
	Email        string
	PasswordHash string
	Roles        []string
	Scopes       []string
	CreatedAt    time.Time
}

type UserStore interface {
	Create(ctx context.Context, u *User) error
	GetByEmail(ctx context.Context, email string) (*User, error)
	GetByID(ctx context.Context, id string) (*User, error)
}

type MemoryUserStore struct {
	mu    sync.RWMutex
	users map[string]*User
}

func NewMemoryUserStore() *MemoryUserStore {
	return &MemoryUserStore{users: make(map[string]*User)}
}

func (s *MemoryUserStore) Create(ctx context.Context, u *User) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, existing := range s.users {
		if existing.Email == u.Email {
			return ErrUserExists
		}
	}
	s.users[u.ID] = u
	return nil
}

func (s *MemoryUserStore) GetByEmail(ctx context.Context, email string) (*User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, u := range s.users {
		if u.Email == email {
			return u, nil
		}
	}
	return nil, ErrUserNotFound
}

func (s *MemoryUserStore) GetByID(ctx context.Context, id string) (*User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	u, ok := s.users[id]
	if !ok {
		return nil, ErrUserNotFound
	}
	return u, nil
}

type Service struct {
	store      UserStore
	privateKey *ecdsa.PrivateKey
	keyID      string
}

func NewService(store UserStore, privKey *ecdsa.PrivateKey, keyID string) *Service {
	return &Service{
		store:      store,
		privateKey: privKey,
		keyID:      keyID,
	}
}

func (s *Service) Register(ctx context.Context, email, password string) (*User, error) {
	hash, err := auth.HashPassword(password)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	user := &User{
		ID:           uuid.NewString(),
		Email:        email,
		PasswordHash: hash,
		Roles:        []string{"customer"},
		Scopes:       []string{"orders:create", "orders:read"},
		CreatedAt:    time.Now().UTC(),
	}

	if err := s.store.Create(ctx, user); err != nil {
		return nil, err
	}
	return user, nil
}

func (s *Service) Login(ctx context.Context, email, password string) (string, *User, error) {
	user, err := s.store.GetByEmail(ctx, email)
	if err != nil {
		return "", nil, ErrInvalidCreds
	}

	if !auth.VerifyPassword(user.PasswordHash, password) {
		return "", nil, ErrInvalidCreds
	}

	claims := &auth.Claims{
		Subject:   user.ID,
		Issuer:    "orderflow-auth",
		Roles:     user.Roles,
		Scopes:    user.Scopes,
		IssuedAt:  time.Now().UTC(),
		ExpiresAt: time.Now().UTC().Add(time.Hour),
	}

	token, err := auth.GenerateToken(claims, s.privateKey, s.keyID)
	if err != nil {
		return "", nil, fmt.Errorf("generate token: %w", err)
	}

	return token, user, nil
}

func (s *Service) PublicKey() *ecdsa.PublicKey {
	return &s.privateKey.PublicKey
}
