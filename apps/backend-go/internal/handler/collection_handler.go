package handler

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/xiaoshuai1024/luban-backend-go/internal/model"
	"github.com/xiaoshuai1024/luban-backend-go/internal/service"
)

// V2-T7 Collection + CollectionItem handler（对齐 Java CollectionController + CollectionItemController）。
type CollectionHandler struct {
	svc *service.CollectionService
}

func NewCollectionHandler(svc *service.CollectionService) *CollectionHandler {
	return &CollectionHandler{svc: svc}
}

type collectionSaveRequest struct {
	Name        string          `json:"name" binding:"required"`
	FieldSchema json.RawMessage `json:"fieldSchema"`
	Status      string          `json:"status"`
}

type collectionItemSaveRequest struct {
	Data   json.RawMessage `json:"data" binding:"required"`
	Status string          `json:"status"`
}

// === Collection ===

func (h *CollectionHandler) List(c *gin.Context) {
	siteID := c.Query("siteId")
	list, err := h.svc.List(c.Request.Context(), siteID)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *CollectionHandler) Get(c *gin.Context) {
	siteID := c.Query("siteId")
	id := c.Param("id")
	col, err := h.svc.Get(c.Request.Context(), siteID, id)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, col)
}

func (h *CollectionHandler) Create(c *gin.Context) {
	siteID := c.Query("siteId")
	var req collectionSaveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIError{Code: "INVALID_ARGUMENT", Message: "invalid body"})
		return
	}
	col, err := h.svc.Create(c.Request.Context(), siteID, req.Name, req.FieldSchema, req.Status)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusCreated, col)
}

func (h *CollectionHandler) Update(c *gin.Context) {
	siteID := c.Query("siteId")
	id := c.Param("id")
	var req collectionSaveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIError{Code: "INVALID_ARGUMENT", Message: "invalid body"})
		return
	}
	col := &model.Collection{
		ID:          id,
		SiteID:      siteID,
		Name:        req.Name,
		FieldSchema: req.FieldSchema,
		Status:      req.Status,
	}
	if err := h.svc.Update(c.Request.Context(), col); err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, col)
}

func (h *CollectionHandler) Delete(c *gin.Context) {
	siteID := c.Query("siteId")
	id := c.Param("id")
	if err := h.svc.Delete(c.Request.Context(), siteID, id); err != nil {
		writeError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// === CollectionItem ===

func (h *CollectionHandler) ListItems(c *gin.Context) {
	siteID := c.Query("siteId")
	collectionID := c.Param("collectionId")
	list, err := h.svc.ListItems(c.Request.Context(), siteID, collectionID)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *CollectionHandler) GetItem(c *gin.Context) {
	siteID := c.Query("siteId")
	collectionID := c.Param("collectionId")
	itemID := c.Param("itemId")
	it, err := h.svc.GetItem(c.Request.Context(), siteID, collectionID, itemID)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, it)
}

func (h *CollectionHandler) CreateItem(c *gin.Context) {
	siteID := c.Query("siteId")
	collectionID := c.Param("collectionId")
	var req collectionItemSaveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIError{Code: "INVALID_ARGUMENT", Message: "invalid body"})
		return
	}
	it, err := h.svc.CreateItem(c.Request.Context(), siteID, collectionID, req.Data, req.Status)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusCreated, it)
}

func (h *CollectionHandler) UpdateItem(c *gin.Context) {
	collectionID := c.Param("collectionId")
	itemID := c.Param("itemId")
	var req collectionItemSaveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIError{Code: "INVALID_ARGUMENT", Message: "invalid body"})
		return
	}
	it := &model.CollectionItem{
		ID:           itemID,
		CollectionID: collectionID,
		Data:         req.Data,
		Status:       req.Status,
	}
	if err := h.svc.UpdateItem(c.Request.Context(), it); err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, it)
}

func (h *CollectionHandler) DeleteItem(c *gin.Context) {
	siteID := c.Query("siteId")
	collectionID := c.Param("collectionId")
	itemID := c.Param("itemId")
	if err := h.svc.DeleteItem(c.Request.Context(), siteID, collectionID, itemID); err != nil {
		writeError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
