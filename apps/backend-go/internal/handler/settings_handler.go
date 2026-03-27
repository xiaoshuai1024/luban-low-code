package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/xiaoshuai1024/luban-backend-go/internal/service"
)

type SettingsHandler struct {
	svc *service.SettingsService
}

func NewSettingsHandler(svc *service.SettingsService) *SettingsHandler {
	return &SettingsHandler{svc: svc}
}

func (h *SettingsHandler) Get(c *gin.Context) {
	data, err := h.svc.Get(c.Request.Context())
	if err != nil {
		writeError(c, err)
		return
	}
	c.Data(http.StatusOK, "application/json", data)
}

func (h *SettingsHandler) Update(c *gin.Context) {
	body, err := c.GetRawData()
	if err != nil {
		c.JSON(http.StatusBadRequest, APIError{Code: "INVALID_ARGUMENT", Message: "invalid body"})
		return
	}
	data, err := h.svc.Update(c.Request.Context(), body)
	if err != nil {
		writeError(c, err)
		return
	}
	c.Data(http.StatusOK, "application/json", data)
}

