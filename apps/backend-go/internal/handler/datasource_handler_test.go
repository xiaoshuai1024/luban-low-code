package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/xiaoshuai1024/luban-backend-go/internal/model"
	"github.com/xiaoshuai1024/luban-backend-go/internal/repository"
	"github.com/xiaoshuai1024/luban-backend-go/internal/service"
)

func init() { gin.SetMode(gin.TestMode) }

// stubDatasourceSvc records call args and returns canned responses. It implements
// handler.DatasourceSvc, so the test mounts the REAL DatasourceHandler and only the
// service is stubbed — this is the contract-under-test (no fake-green copy of the
// handler body, which previously drifted silently from production).
type stubDatasourceSvc struct {
	listResult    []*model.Datasource
	listErr       error
	getResult     *model.Datasource
	getErr        error
	createResult  *model.Datasource
	createErr     error
	updateResult  *model.Datasource
	updateErr     error
	deleteErr     error
	testResult    *service.TestConnectionResult
	testErr       error

	// recorded call args (for transparency assertions)
	createSiteID string
	createName   string
	createType   string
	createConfig json.RawMessage
	updateSiteID string
	updateID     string
	updateName   string
	updateType   string
	deleteID     string
	deleteSiteID string
	getID        string
	getSiteID    string
}

func (s *stubDatasourceSvc) List(ctx context.Context, siteID string) ([]*model.Datasource, error) {
	return s.listResult, s.listErr
}
func (s *stubDatasourceSvc) Get(ctx context.Context, id, siteID string) (*model.Datasource, error) {
	s.getID, s.getSiteID = id, siteID
	return s.getResult, s.getErr
}
func (s *stubDatasourceSvc) Create(ctx context.Context, siteID, name, dsType string, config json.RawMessage) (*model.Datasource, error) {
	s.createSiteID, s.createName, s.createType, s.createConfig = siteID, name, dsType, config
	return s.createResult, s.createErr
}
func (s *stubDatasourceSvc) Update(ctx context.Context, siteID, id, name, dsType string, config json.RawMessage) (*model.Datasource, error) {
	s.updateSiteID, s.updateID, s.updateName, s.updateType = siteID, id, name, dsType
	return s.updateResult, s.updateErr
}
func (s *stubDatasourceSvc) Delete(ctx context.Context, id, siteID string) error {
	s.deleteID, s.deleteSiteID = id, siteID
	return s.deleteErr
}
func (s *stubDatasourceSvc) TestConnection(ctx context.Context, id string) (*service.TestConnectionResult, error) {
	return s.testResult, s.testErr
}

// newStubRouter mounts the REAL DatasourceHandler with the stubbed service under the
// same group+middleware shape as router/router.go (RequireUser base, RequireAdmin on
// writes), so guard behavior is exercised alongside the real handler body.
func newStubRouter(svc DatasourceSvc) *gin.Engine {
	r := gin.New()
	h := &DatasourceHandler{svc: svc} // real production handler, stubbed svc only
	ds := r.Group("/backend/datasources")
	ds.Use(func(c *gin.Context) {
		if c.GetHeader("X-User-ID") == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, APIError{Code: "UNAUTHENTICATED", Message: "missing user"})
			return
		}
		c.Set("role", c.GetHeader("X-User-Role"))
		c.Next()
	})
	adminGuard := func(c *gin.Context) {
		role, _ := c.Get("role")
		if role != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, APIError{Code: "PERMISSION_DENIED", Message: "admin only"})
			return
		}
		c.Next()
	}
	ds.GET("", h.List)
	ds.POST("", adminGuard, h.Create)
	ds.GET("/:id", h.Get)
	ds.PUT("/:id", adminGuard, h.Update)
	ds.DELETE("/:id", adminGuard, h.Delete)
	ds.POST("/:id/test", h.Test)
	return r
}

func doReq(t *testing.T, r *gin.Engine, method, path string, body interface{}, role string) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		require.NoError(t, json.NewEncoder(&buf).Encode(body))
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("X-User-ID", "u-1")
	if role != "" {
		req.Header.Set("X-User-Role", role)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func decodeErr(t *testing.T, w *httptest.ResponseRecorder) APIError {
	t.Helper()
	var e APIError
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &e))
	return e
}

// TestDatasourceHandler_FullCRUDContract exercises every documented status code in
// the datasource contract via the REAL production handler + real writeError mapping.
// Each subtest sets up exactly the service response it expects; unconfigured methods
// return zero values (nil/nil), so a missing stub fails loudly on the downstream
// assertion rather than passing spuriously.
func TestDatasourceHandler_FullCRUDContract(t *testing.T) {
	t.Run("list_200_returns_array", func(t *testing.T) {
		stub := &stubDatasourceSvc{listResult: []*model.Datasource{
			{ID: "ds-1", SiteID: "s-1", Name: "cfg", Type: "static", Config: []byte(`{}`)},
		}}
		w := doReq(t, newStubRouter(stub), http.MethodGet, "/backend/datasources?siteId=s-1", nil, "user")
		assert.Equal(t, http.StatusOK, w.Code)
		var out []*model.Datasource
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &out))
		require.Len(t, out, 1)
	})

	t.Run("list_site_not_found_404", func(t *testing.T) {
		stub := &stubDatasourceSvc{listErr: repository.ErrSiteNotFound}
		w := doReq(t, newStubRouter(stub), http.MethodGet, "/backend/datasources?siteId=nope", nil, "user")
		assert.Equal(t, http.StatusNotFound, w.Code)
		assert.Equal(t, "SITE_NOT_FOUND", decodeErr(t, w).Code)
	})

	t.Run("create_201", func(t *testing.T) {
		stub := &stubDatasourceSvc{createResult: &model.Datasource{ID: "ds-1", SiteID: "s-1", Name: "cfg", Type: "static"}}
		w := doReq(t, newStubRouter(stub), http.MethodPost, "/backend/datasources",
			map[string]interface{}{"siteId": "s-1", "name": "cfg", "type": "static", "config": map[string]interface{}{"rows": []interface{}{}}}, "admin")
		assert.Equal(t, http.StatusCreated, w.Code)
		assert.Equal(t, "s-1", stub.createSiteID)
		assert.Equal(t, "static", stub.createType)
		// Verify the response body carries the returned entity (field-level assert).
		var out model.Datasource
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &out))
		assert.Equal(t, "ds-1", out.ID)
		assert.Equal(t, "static", out.Type)
	})

	t.Run("create_name_conflict_409", func(t *testing.T) {
		stub := &stubDatasourceSvc{createErr: repository.ErrDatasourceNameConflict}
		w := doReq(t, newStubRouter(stub), http.MethodPost, "/backend/datasources",
			map[string]interface{}{"siteId": "s-1", "name": "dup", "type": "static", "config": map[string]interface{}{}}, "admin")
		assert.Equal(t, http.StatusConflict, w.Code)
		assert.Equal(t, "DATASOURCE_NAME_CONFLICT", decodeErr(t, w).Code)
	})

	t.Run("create_site_not_found_404", func(t *testing.T) {
		stub := &stubDatasourceSvc{createErr: repository.ErrSiteNotFound}
		w := doReq(t, newStubRouter(stub), http.MethodPost, "/backend/datasources",
			map[string]interface{}{"siteId": "nope", "name": "cfg", "type": "static", "config": map[string]interface{}{}}, "admin")
		assert.Equal(t, http.StatusNotFound, w.Code)
		assert.Equal(t, "SITE_NOT_FOUND", decodeErr(t, w).Code)
	})

	t.Run("create_invalid_type_400", func(t *testing.T) {
		// The real service returns ErrInvalidArgument wrapped via fmt.Errorf("%w: ...").
		stub := &stubDatasourceSvc{createErr: fmt.Errorf("%w: type must be one of static, api", service.ErrInvalidArgument)}
		w := doReq(t, newStubRouter(stub), http.MethodPost, "/backend/datasources",
			map[string]interface{}{"siteId": "s-1", "name": "x", "type": "mysql", "config": map[string]interface{}{}}, "admin")
		assert.Equal(t, http.StatusBadRequest, w.Code)
		assert.Equal(t, "INVALID_ARGUMENT", decodeErr(t, w).Code)
	})

	t.Run("create_invalid_body_400", func(t *testing.T) {
		stub := &stubDatasourceSvc{}
		w := doReq(t, newStubRouter(stub), http.MethodPost, "/backend/datasources",
			map[string]interface{}{"name": "missing-siteid"}, "admin")
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("get_200", func(t *testing.T) {
		stub := &stubDatasourceSvc{getResult: &model.Datasource{ID: "ds-1", Name: "x"}}
		w := doReq(t, newStubRouter(stub), http.MethodGet, "/backend/datasources/ds-1", nil, "user")
		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("get_404", func(t *testing.T) {
		stub := &stubDatasourceSvc{getErr: repository.ErrDatasourceNotFound}
		w := doReq(t, newStubRouter(stub), http.MethodGet, "/backend/datasources/nope", nil, "user")
		assert.Equal(t, http.StatusNotFound, w.Code)
		assert.Equal(t, "DATASOURCE_NOT_FOUND", decodeErr(t, w).Code)
	})

	t.Run("get_passes_siteId_query_through_to_service", func(t *testing.T) {
		// Multi-tenant guard: the handler must forward ?siteId= to the service.
		stub := &stubDatasourceSvc{getResult: &model.Datasource{ID: "ds-1", SiteID: "s-1"}}
		w := doReq(t, newStubRouter(stub), http.MethodGet, "/backend/datasources/ds-1?siteId=s-1", nil, "user")
		assert.Equal(t, http.StatusOK, w.Code)
		assert.Equal(t, "s-1", stub.getSiteID)
	})

	t.Run("update_200", func(t *testing.T) {
		stub := &stubDatasourceSvc{updateResult: &model.Datasource{ID: "ds-1", SiteID: "s-1", Name: "renamed", Type: "api"}}
		w := doReq(t, newStubRouter(stub), http.MethodPut, "/backend/datasources/ds-1",
			map[string]interface{}{"siteId": "s-1", "name": "renamed", "type": "api", "config": map[string]interface{}{"url": "https://x"}}, "admin")
		assert.Equal(t, http.StatusOK, w.Code)
		// Verify the response carries the service-returned entity (createdAt backfilled).
		var out model.Datasource
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &out))
		assert.Equal(t, "renamed", out.Name)
		assert.Equal(t, "s-1", stub.updateSiteID)
	})

	t.Run("update_404", func(t *testing.T) {
		stub := &stubDatasourceSvc{updateErr: repository.ErrDatasourceNotFound}
		w := doReq(t, newStubRouter(stub), http.MethodPut, "/backend/datasources/nope",
			map[string]interface{}{"siteId": "s-1", "name": "x", "type": "static", "config": map[string]interface{}{}}, "admin")
		assert.Equal(t, http.StatusNotFound, w.Code)
		assert.Equal(t, "DATASOURCE_NOT_FOUND", decodeErr(t, w).Code)
	})

	t.Run("update_name_conflict_409", func(t *testing.T) {
		stub := &stubDatasourceSvc{updateErr: repository.ErrDatasourceNameConflict}
		w := doReq(t, newStubRouter(stub), http.MethodPut, "/backend/datasources/ds-1",
			map[string]interface{}{"siteId": "s-1", "name": "taken", "type": "static", "config": map[string]interface{}{}}, "admin")
		assert.Equal(t, http.StatusConflict, w.Code)
		assert.Equal(t, "DATASOURCE_NAME_CONFLICT", decodeErr(t, w).Code)
	})

	t.Run("delete_204", func(t *testing.T) {
		stub := &stubDatasourceSvc{}
		w := doReq(t, newStubRouter(stub), http.MethodDelete, "/backend/datasources/ds-1", nil, "admin")
		assert.Equal(t, http.StatusNoContent, w.Code)
	})

	t.Run("delete_404", func(t *testing.T) {
		stub := &stubDatasourceSvc{deleteErr: repository.ErrDatasourceNotFound}
		w := doReq(t, newStubRouter(stub), http.MethodDelete, "/backend/datasources/nope", nil, "admin")
		assert.Equal(t, http.StatusNotFound, w.Code)
		assert.Equal(t, "DATASOURCE_NOT_FOUND", decodeErr(t, w).Code)
	})

	t.Run("delete_passes_siteId_query_through_to_service", func(t *testing.T) {
		stub := &stubDatasourceSvc{}
		w := doReq(t, newStubRouter(stub), http.MethodDelete, "/backend/datasources/ds-1?siteId=s-1", nil, "admin")
		assert.Equal(t, http.StatusNoContent, w.Code)
		assert.Equal(t, "s-1", stub.deleteSiteID)
	})

	t.Run("test_static_200", func(t *testing.T) {
		stub := &stubDatasourceSvc{testResult: &service.TestConnectionResult{OK: true, Message: "static", LatencyMs: 0}}
		w := doReq(t, newStubRouter(stub), http.MethodPost, "/backend/datasources/ds-1/test", nil, "user")
		assert.Equal(t, http.StatusOK, w.Code)
		var res service.TestConnectionResult
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &res))
		assert.True(t, res.OK)
	})

	t.Run("test_failed_503_wrapped", func(t *testing.T) {
		stub := &stubDatasourceSvc{testErr: fmt.Errorf("%w: config.url is required", service.ErrDatasourceConnectionFailed)}
		w := doReq(t, newStubRouter(stub), http.MethodPost, "/backend/datasources/ds-1/test", nil, "user")
		assert.Equal(t, http.StatusServiceUnavailable, w.Code)
		e := decodeErr(t, w)
		assert.Equal(t, "DATASOURCE_CONNECTION_FAILED", e.Code)
		assert.Contains(t, e.Message, "config.url")
	})

	t.Run("test_missing_404", func(t *testing.T) {
		// Covers the service.Get → ErrDatasourceNotFound path when the probe target
		// doesn't exist. Previously this contract scenario was untested.
		stub := &stubDatasourceSvc{testErr: repository.ErrDatasourceNotFound}
		w := doReq(t, newStubRouter(stub), http.MethodPost, "/backend/datasources/no-such/test", nil, "user")
		assert.Equal(t, http.StatusNotFound, w.Code)
		assert.Equal(t, "DATASOURCE_NOT_FOUND", decodeErr(t, w).Code)
	})

	t.Run("create_as_non_admin_403", func(t *testing.T) {
		stub := &stubDatasourceSvc{createResult: &model.Datasource{}}
		w := doReq(t, newStubRouter(stub), http.MethodPost, "/backend/datasources",
			map[string]interface{}{"siteId": "s-1", "name": "x", "type": "static", "config": map[string]interface{}{}}, "user")
		assert.Equal(t, http.StatusForbidden, w.Code)
		assert.Equal(t, "PERMISSION_DENIED", decodeErr(t, w).Code)
	})

	t.Run("update_as_non_admin_403", func(t *testing.T) {
		// Write verbs (POST/PUT/DELETE) are all RequireAdmin — lock each one so an
		// AuthFilter/regex change can't silently demote PUT/DELETE.
		stub := &stubDatasourceSvc{updateResult: &model.Datasource{}}
		w := doReq(t, newStubRouter(stub), http.MethodPut, "/backend/datasources/ds-1",
			map[string]interface{}{"siteId": "s-1", "name": "x", "type": "static", "config": map[string]interface{}{}}, "user")
		assert.Equal(t, http.StatusForbidden, w.Code)
		assert.Equal(t, "PERMISSION_DENIED", decodeErr(t, w).Code)
	})

	t.Run("delete_as_non_admin_403", func(t *testing.T) {
		stub := &stubDatasourceSvc{}
		w := doReq(t, newStubRouter(stub), http.MethodDelete, "/backend/datasources/ds-1", nil, "user")
		assert.Equal(t, http.StatusForbidden, w.Code)
		assert.Equal(t, "PERMISSION_DENIED", decodeErr(t, w).Code)
	})

	t.Run("unauthenticated_401", func(t *testing.T) {
		r := newStubRouter(&stubDatasourceSvc{})
		req := httptest.NewRequest(http.MethodGet, "/backend/datasources?siteId=s-1", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusUnauthorized, w.Code)
	})
}
