package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/xiaoshuai1024/luban-backend-go/internal/model"
	"github.com/xiaoshuai1024/luban-backend-go/internal/service"
)

type SiteHandler struct {
	svc *service.SiteService
}

func NewSiteHandler(svc *service.SiteService) *SiteHandler {
	return &SiteHandler{svc: svc}
}

func (h *SiteHandler) List(c *gin.Context) {
	sites, err := h.svc.List(c.Request.Context())
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, sites)
}

func (h *SiteHandler) Get(c *gin.Context) {
	id := c.Param("id")
	site, err := h.svc.Get(c.Request.Context(), id)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, site)
}

type siteCreateRequest struct {
	Name    string `json:"name" binding:"required"`
	Slug    string `json:"slug" binding:"required"`
	BaseURL string `json:"baseUrl"`
	Status  string `json:"status"`
}

func (h *SiteHandler) Create(c *gin.Context) {
	var req siteCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIError{Code: "INVALID_ARGUMENT", Message: "invalid body"})
		return
	}
	site, err := h.svc.Create(c.Request.Context(), req.Name, req.Slug, req.BaseURL, req.Status)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusCreated, site)
}

func (h *SiteHandler) Update(c *gin.Context) {
	id := c.Param("id")
	var req siteCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIError{Code: "INVALID_ARGUMENT", Message: "invalid body"})
		return
	}
	site := &model.Site{
		ID:      id,
		Name:    req.Name,
		Slug:    req.Slug,
		BaseURL: req.BaseURL,
		Status:  req.Status,
	}
	if err := h.svc.Update(c.Request.Context(), site); err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, site)
}

func (h *SiteHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		writeError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

