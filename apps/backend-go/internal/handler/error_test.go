package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/xiaoshuai1024/luban-backend-go/internal/repository"
	"github.com/xiaoshuai1024/luban-backend-go/internal/service"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// callWriteError 用一个 httptest recorder 构造 gin.Context，调用 writeError，
// 返回 HTTP 状态码与解析后的 APIError。
func callWriteError(t *testing.T, err error) (int, APIError) {
	t.Helper()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	writeError(c, err)

	var apiErr APIError
	if w.Body.Len() > 0 {
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &apiErr))
	}
	return w.Code, apiErr
}

// TestWriteError_Mappings 覆盖每个错误码 → HTTP 状态 + API code 的映射。
// 这是双后端契约一致的关键检查点：Go 端的状态码/code 必须与 Java
// BusinessException 的 HttpStatus/code 一一对应。
func TestWriteError_Mappings(t *testing.T) {
	cases := []struct {
		name       string
		err        error
		wantStatus int
		wantCode   string
	}{
		{"site_not_found", repository.ErrSiteNotFound, http.StatusNotFound, "SITE_NOT_FOUND"},
		{"page_not_found", repository.ErrPageNotFound, http.StatusNotFound, "PAGE_NOT_FOUND"},
		{"user_not_found", repository.ErrUserNotFound, http.StatusNotFound, "USER_NOT_FOUND"},
		{"settings_not_found", repository.ErrSettingsNotFound, http.StatusNotFound, "SETTINGS_NOT_FOUND"},
		{"page_path_conflict", repository.ErrPagePathConflict, http.StatusConflict, "PAGE_PATH_CONFLICT"},
		{"username_conflict", repository.ErrUsernameConflict, http.StatusConflict, "USERNAME_CONFLICT"},
		{"slug_conflict", repository.ErrSlugConflict, http.StatusConflict, "SLUG_CONFLICT"},
		{"invalid_credentials", service.ErrInvalidCredentials, http.StatusUnauthorized, "INVALID_CREDENTIALS"},
		{"user_disabled", service.ErrUserDisabled, http.StatusForbidden, "USER_DISABLED"},
		{"datasource_not_found", repository.ErrDatasourceNotFound, http.StatusNotFound, "DATASOURCE_NOT_FOUND"},
		{"datasource_name_conflict", repository.ErrDatasourceNameConflict, http.StatusConflict, "DATASOURCE_NAME_CONFLICT"},
		{"invalid_argument", service.ErrInvalidArgument, http.StatusBadRequest, "INVALID_ARGUMENT"},
		// ErrDatasourceConnectionFailed is wrapped with %w in the service, so test both
		// the bare sentinel and a wrapped instance (writeError uses a switch on identity;
		// wrapped errors fall through to the case only if unwrapped, which they aren't here —
		// the dedicated test below covers the wrapped path via errors.Is-compatible mapping).
		{"datasource_connection_failed_bare", service.ErrDatasourceConnectionFailed, http.StatusServiceUnavailable, "DATASOURCE_CONNECTION_FAILED"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			status, apiErr := callWriteError(t, tc.err)
			assert.Equal(t, tc.wantStatus, status, "HTTP status for %s", tc.err)
			assert.Equal(t, tc.wantCode, apiErr.Code, "API code for %s", tc.err)
			assert.NotEmpty(t, apiErr.Message, "message should not be empty")
		})
	}
}

// TestWriteError_SlugConflict409 是对齐 Java BusinessException.slugConflict() 的
// 专门守护：slug 冲突必须返回 409 + SLUG_CONFLICT，而不是落到 default 500。
// 失败即代表站点 slug 冲突语义与 Java 端分叉。
func TestWriteError_SlugConflict409(t *testing.T) {
	status, apiErr := callWriteError(t, repository.ErrSlugConflict)
	assert.Equal(t, http.StatusConflict, status)
	assert.Equal(t, "SLUG_CONFLICT", apiErr.Code)
}

// TestWriteError_SettingsNotFound404 守护 SETTINGS_NOT_FOUND 404 映射。
func TestWriteError_SettingsNotFound404(t *testing.T) {
	status, apiErr := callWriteError(t, repository.ErrSettingsNotFound)
	assert.Equal(t, http.StatusNotFound, status)
	assert.Equal(t, "SETTINGS_NOT_FOUND", apiErr.Code)
}

// TestWriteError_UnknownErrorFallsBackTo500 验证未知错误落到 default 500 INTERNAL。
func TestWriteError_UnknownErrorFallsBackTo500(t *testing.T) {
	unknown := errors.New("something broke")
	status, apiErr := callWriteError(t, unknown)
	assert.Equal(t, http.StatusInternalServerError, status)
	assert.Equal(t, "INTERNAL", apiErr.Code)
	assert.Equal(t, "something broke", apiErr.Message)
}

// TestWriteError_WrappedDatasourceConnectionFailed503 guards a real parity bug:
// the service returns the sentinel wrapped with fmt.Errorf("%w: ...") to attach
// the upstream reason. A plain switch err wouldn't match the wrapped value and
// would silently fall through to 500 INTERNAL — breaking the contract that a
// failed datasource probe returns 503 DATASOURCE_CONNECTION_FAILED. writeError
// must use errors.Is for this case.
func TestWriteError_WrappedDatasourceConnectionFailed503(t *testing.T) {
	wrapped := fmt.Errorf("%w: HTTP 500", service.ErrDatasourceConnectionFailed)
	status, apiErr := callWriteError(t, wrapped)
	assert.Equal(t, http.StatusServiceUnavailable, status)
	assert.Equal(t, "DATASOURCE_CONNECTION_FAILED", apiErr.Code)
	assert.Contains(t, apiErr.Message, "HTTP 500", "wrapped reason should reach the client")
}

// TestWriteError_WrappedInvalidArgument400 guards the same wrapped-error path for
// the type-whitelist rejection (service wraps ErrInvalidArgument with the offending type).
func TestWriteError_WrappedInvalidArgument400(t *testing.T) {
	wrapped := fmt.Errorf("%w: type must be one of static, api", service.ErrInvalidArgument)
	status, apiErr := callWriteError(t, wrapped)
	assert.Equal(t, http.StatusBadRequest, status)
	assert.Equal(t, "INVALID_ARGUMENT", apiErr.Code)
}
