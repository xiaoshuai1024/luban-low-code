package handler

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/xiaoshuai1024/luban-backend-go/internal/model"
	"github.com/xiaoshuai1024/luban-backend-go/internal/service"
)

type PageHandler struct {
	svc *service.PageService
}

func NewPageHandler(svc *service.PageService) *PageHandler {
	return &PageHandler{svc: svc}
}

func (h *PageHandler) List(c *gin.Context) {
	siteID := c.Param("siteId")
	if siteID == "" {
		siteID = c.Param("id")
	}
	pages, err := h.svc.List(c.Request.Context(), siteID)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, pages)
}

func (h *PageHandler) Get(c *gin.Context) {
	siteID := c.Param("siteId")
	if siteID == "" {
		siteID = c.Param("id")
	}
	pageID := c.Param("pageId")
	page, err := h.svc.Get(c.Request.Context(), siteID, pageID)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, page)
}

type pageSaveRequest struct {
	Name   string          `json:"name" binding:"required"`
	Path   string          `json:"path" binding:"required"`
	Status string          `json:"status"`
	Schema json.RawMessage `json:"schema"`
}

func (h *PageHandler) Create(c *gin.Context) {
	siteID := c.Param("siteId")
	if siteID == "" {
		siteID = c.Param("id")
	}
	var req pageSaveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIError{Code: "INVALID_ARGUMENT", Message: "invalid body"})
		return
	}
	page, err := h.svc.Create(c.Request.Context(), siteID, req.Name, req.Path, req.Status, req.Schema)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusCreated, page)
}

func (h *PageHandler) Update(c *gin.Context) {
	siteID := c.Param("siteId")
	if siteID == "" {
		siteID = c.Param("id")
	}
	pageID := c.Param("pageId")
	var req pageSaveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIError{Code: "INVALID_ARGUMENT", Message: "invalid body"})
		return
	}
	page := &model.Page{
		ID:     pageID,
		SiteID: siteID,
		Name:   req.Name,
		Path:   req.Path,
		Status: req.Status,
		Schema: req.Schema,
	}
	if err := h.svc.Update(c.Request.Context(), page); err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, page)
}

func (h *PageHandler) Delete(c *gin.Context) {
	siteID := c.Param("siteId")
	if siteID == "" {
		siteID = c.Param("id")
	}
	pageID := c.Param("pageId")
	if err := h.svc.Delete(c.Request.Context(), siteID, pageID); err != nil {
		writeError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

