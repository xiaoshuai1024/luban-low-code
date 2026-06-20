package handler

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/xiaoshuai1024/luban-backend-go/internal/model"
	"github.com/xiaoshuai1024/luban-backend-go/internal/service"
)

// DatasourceSvc is the subset of *service.DatasourceService the handler needs.
// Declared here (not in the test) so the production handler depends on the
// abstraction — the test injects a stub, the real router injects the concrete
// *service.DatasourceService. This kills the previous "stubHandler mirrors
// production" fake-green: every handler test now runs the real handler body and
// only the service is stubbed.
type DatasourceSvc interface {
	List(ctx context.Context, siteID string) ([]*model.Datasource, error)
	Get(ctx context.Context, id, siteID string) (*model.Datasource, error)
	Create(ctx context.Context, siteID, name, dsType string, config json.RawMessage) (*model.Datasource, error)
	Update(ctx context.Context, siteID, id, name, dsType string, config json.RawMessage) (*model.Datasource, error)
	Delete(ctx context.Context, id, siteID string) error
	TestConnection(ctx context.Context, id string) (*service.TestConnectionResult, error)
}

// DatasourceHandler exposes the datasource REST API under /datasources.
//
// Routes (assembled in router/router.go):
//
//	GET    /datasources?siteId=   → 200 []
//	POST   /datasources           → 201 | 409 | 404 | 400
//	GET    /datasources/:id       → 200 | 404
//	PUT    /datasources/:id       → 200 | 404 | 409
//	DELETE /datasources/:id       → 204 | 404
//	POST   /datasources/:id/test  → 200 {ok,message,latencyMs} | 503
//
// Field shape matches the Java DatasourceResponse/Result records (see dto package).
type DatasourceHandler struct {
	svc DatasourceSvc
}

func NewDatasourceHandler(svc *service.DatasourceService) *DatasourceHandler {
	return &DatasourceHandler{svc: svc}
}

// List is multi-tenant: only datasources for the siteId query param are returned.
func (h *DatasourceHandler) List(c *gin.Context) {
	siteID := c.Query("siteId")
	list, err := h.svc.List(c.Request.Context(), siteID)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *DatasourceHandler) Get(c *gin.Context) {
	id := c.Param("id")
	siteID := c.Query("siteId") // optional multi-tenant guard, aligned with Java
	ds, err := h.svc.Get(c.Request.Context(), id, siteID)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, ds)
}

type datasourceSaveRequest struct {
	SiteID string          `json:"siteId" binding:"required"`
	Name   string          `json:"name" binding:"required"`
	Type   string          `json:"type" binding:"required"`
	Config json.RawMessage `json:"config"`
}

func (h *DatasourceHandler) Create(c *gin.Context) {
	var req datasourceSaveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIError{Code: "INVALID_ARGUMENT", Message: "invalid body"})
		return
	}
	ds, err := h.svc.Create(c.Request.Context(), req.SiteID, req.Name, req.Type, req.Config)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusCreated, ds)
}

func (h *DatasourceHandler) Update(c *gin.Context) {
	id := c.Param("id")
	siteID := c.Query("siteId") // optional multi-tenant guard, aligned with Java
	var req datasourceSaveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIError{Code: "INVALID_ARGUMENT", Message: "invalid body"})
		return
	}
	// Prefer query-param siteId for the tenant guard; fall back to the body value
	// (backward compat with callers that only send siteId in the body).
	effectiveSite := siteID
	if effectiveSite == "" {
		effectiveSite = req.SiteID
	}
	ds, err := h.svc.Update(c.Request.Context(), effectiveSite, id, req.Name, req.Type, req.Config)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, ds)
}

func (h *DatasourceHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	siteID := c.Query("siteId") // optional multi-tenant guard, aligned with Java
	if err := h.svc.Delete(c.Request.Context(), id, siteID); err != nil {
		writeError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// Test runs the connection probe; 200 with {ok,message,latencyMs} on success,
// 503 DATASOURCE_CONNECTION_FAILED on probe failure.
func (h *DatasourceHandler) Test(c *gin.Context) {
	id := c.Param("id")
	res, err := h.svc.TestConnection(c.Request.Context(), id)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, res)
}
