package auth

import (
	"errors"
	"net/http"

	pkgAuth "distributed-systems-in-go/pkg/platform/auth"
	"distributed-systems-in-go/pkg/platform/middleware"
)

type AuthRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Token  string `json:"token,omitempty"`
	UserID string `json:"user_id"`
	Email  string `json:"email"`
}

func RegisterRoutes(mux *http.ServeMux, svc *Service) {
	mux.HandleFunc("POST /api/auth/register", func(w http.ResponseWriter, r *http.Request) {
		var req AuthRequest
		if err := middleware.DecodeJSON(r, &req); err != nil {
			middleware.WriteError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
			return
		}

		user, err := svc.Register(r.Context(), req.Email, req.Password)
		if err != nil {
			if errors.Is(err, ErrUserExists) {
				middleware.WriteError(w, http.StatusConflict, "USER_EXISTS", err.Error())
				return
			}
			middleware.WriteError(w, http.StatusInternalServerError, "AUTH_ERROR", err.Error())
			return
		}

		middleware.WriteJSON(w, http.StatusCreated, AuthResponse{
			UserID: user.ID,
			Email:  user.Email,
		})
	})

	mux.HandleFunc("POST /api/auth/login", func(w http.ResponseWriter, r *http.Request) {
		var req AuthRequest
		if err := middleware.DecodeJSON(r, &req); err != nil {
			middleware.WriteError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
			return
		}

		token, user, err := svc.Login(r.Context(), req.Email, req.Password)
		if err != nil {
			if errors.Is(err, ErrInvalidCreds) {
				middleware.WriteError(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "invalid email or password")
				return
			}
			middleware.WriteError(w, http.StatusInternalServerError, "AUTH_ERROR", err.Error())
			return
		}

		middleware.WriteJSON(w, http.StatusOK, AuthResponse{
			Token:  token,
			UserID: user.ID,
			Email:  user.Email,
		})
	})

	jwk := pkgAuth.PublicKeyToJWK(svc.PublicKey(), svc.keyID)
	mux.HandleFunc("GET /.well-known/jwks.json", pkgAuth.JWKSHandler(pkgAuth.JWKS{Keys: []pkgAuth.JWK{jwk}}))
}
