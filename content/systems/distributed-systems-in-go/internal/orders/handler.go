package orders

import (
	"errors"
	"net/http"

	"distributed-systems-in-go/pkg/platform/auth"
	"distributed-systems-in-go/pkg/platform/middleware"
)

type CreateOrderHTTPReq struct {
	ProductID string  `json:"product_id"`
	Quantity  int     `json:"quantity"`
	UnitPrice float64 `json:"unit_price"`
}

func RegisterRoutes(mux *http.ServeMux, svc *Service) {
	mux.HandleFunc("POST /api/orders", func(w http.ResponseWriter, r *http.Request) {
		var req CreateOrderHTTPReq
		if err := middleware.DecodeJSON(r, &req); err != nil {
			middleware.WriteError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
			return
		}

		claims, _ := auth.ClaimsFromContext(r.Context())
		userID := "anonymous"
		if claims != nil && claims.Subject != "" {
			userID = claims.Subject
		}

		order, err := svc.CreateOrder(r.Context(), CreateOrderRequest{
			UserID:    userID,
			ProductID: req.ProductID,
			Quantity:  req.Quantity,
			UnitPrice: req.UnitPrice,
		})
		if err != nil {
			middleware.WriteError(w, http.StatusBadRequest, "ORDER_CREATION_FAILED", err.Error())
			return
		}

		middleware.WriteJSON(w, http.StatusCreated, order)
	})

	mux.HandleFunc("GET /api/orders/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		order, err := svc.GetOrder(r.Context(), id)
		if err != nil {
			if errors.Is(err, ErrOrderNotFound) {
				middleware.WriteError(w, http.StatusNotFound, "ORDER_NOT_FOUND", "order not found")
				return
			}
			middleware.WriteError(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
			return
		}

		middleware.WriteJSON(w, http.StatusOK, order)
	})
}
