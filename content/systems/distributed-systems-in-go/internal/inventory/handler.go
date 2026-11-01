package inventory

import (
	"errors"
	"net/http"

	"distributed-systems-in-go/pkg/platform/middleware"
)

type ReserveRequest struct {
	ProductID string `json:"product_id"`
	Quantity  int    `json:"quantity"`
}

type ReleaseRequest struct {
	ProductID string `json:"product_id"`
	Quantity  int    `json:"quantity"`
}

func RegisterRoutes(mux *http.ServeMux, svc *Service) {
	mux.HandleFunc("POST /api/inventory/reserve", func(w http.ResponseWriter, r *http.Request) {
		var req ReserveRequest
		if err := middleware.DecodeJSON(r, &req); err != nil {
			middleware.WriteError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
			return
		}

		if err := svc.ReserveInventory(r.Context(), req.ProductID, req.Quantity); err != nil {
			if errors.Is(err, ErrInsufficientInventory) {
				middleware.WriteError(w, http.StatusPreconditionFailed, "INSUFFICIENT_INVENTORY", err.Error())
				return
			}
			middleware.WriteError(w, http.StatusInternalServerError, "INVENTORY_ERROR", err.Error())
			return
		}

		middleware.WriteJSON(w, http.StatusOK, map[string]string{"status": "reserved"})
	})

	mux.HandleFunc("POST /api/inventory/release", func(w http.ResponseWriter, r *http.Request) {
		var req ReleaseRequest
		if err := middleware.DecodeJSON(r, &req); err != nil {
			middleware.WriteError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
			return
		}

		if err := svc.ReleaseReservation(r.Context(), req.ProductID, req.Quantity); err != nil {
			middleware.WriteError(w, http.StatusInternalServerError, "INVENTORY_ERROR", err.Error())
			return
		}

		middleware.WriteJSON(w, http.StatusOK, map[string]string{"status": "released"})
	})

	mux.HandleFunc("GET /api/inventory/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		item, err := svc.GetStock(r.Context(), id)
		if err != nil {
			if errors.Is(err, ErrProductNotFound) {
				middleware.WriteError(w, http.StatusNotFound, "NOT_FOUND", "product not found")
				return
			}
			middleware.WriteError(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
			return
		}

		middleware.WriteJSON(w, http.StatusOK, item)
	})
}
