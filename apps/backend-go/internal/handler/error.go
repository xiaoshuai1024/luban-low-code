package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/xiaoshuai1024/luban-backend-go/internal/repository"
	"github.com/xiaoshuai1024/luban-backend-go/internal/service"
)

type APIError struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}

func writeError(c *gin.Context, err error) {
	// The service wraps ErrDatasourceConnectionFailed with fmt.Errorf("%w: ...", ...)
	// to attach the upstream reason. A plain switch err wouldn't match the wrapped
	// value, so probe it with errors.Is first and preserve the wrapped message.
	if errors.Is(err, service.ErrDatasourceConnectionFailed) {
		c.JSON(http.StatusServiceUnavailable, APIError{Code: "DATASOURCE_CONNECTION_FAILED", Message: err.Error()})
		return
	}
	// ErrInvalidArgument is also wrapped in the service (whitelist failure includes
	// the offending type). Map the same way.
	if errors.Is(err, service.ErrInvalidArgument) {
		c.JSON(http.StatusBadRequest, APIError{Code: "INVALID_ARGUMENT", Message: err.Error()})
		return
	}

	switch err {
	case repository.ErrSiteNotFound:
		c.JSON(http.StatusNotFound, APIError{Code: "SITE_NOT_FOUND", Message: "站点不存在"})
	case repository.ErrPageNotFound:
		c.JSON(http.StatusNotFound, APIError{Code: "PAGE_NOT_FOUND", Message: "页面不存在"})
	case repository.ErrUserNotFound:
		c.JSON(http.StatusNotFound, APIError{Code: "USER_NOT_FOUND", Message: "用户不存在"})
	case repository.ErrSettingsNotFound:
		c.JSON(http.StatusNotFound, APIError{Code: "SETTINGS_NOT_FOUND", Message: "设置不存在"})
	case repository.ErrPagePathConflict:
		c.JSON(http.StatusConflict, APIError{Code: "PAGE_PATH_CONFLICT", Message: "页面 path 已存在"})
	case repository.ErrUsernameConflict:
		c.JSON(http.StatusConflict, APIError{Code: "USERNAME_CONFLICT", Message: "用户名已存在"})
	case repository.ErrSlugConflict:
		c.JSON(http.StatusConflict, APIError{Code: "SLUG_CONFLICT", Message: "slug 已存在"})
	case service.ErrInvalidCredentials:
		c.JSON(http.StatusUnauthorized, APIError{Code: "INVALID_CREDENTIALS", Message: "账号或密码错误"})
	case service.ErrUserDisabled:
		c.JSON(http.StatusForbidden, APIError{Code: "USER_DISABLED", Message: "用户已被禁用"})
	case repository.ErrDatasourceNotFound:
		c.JSON(http.StatusNotFound, APIError{Code: "DATASOURCE_NOT_FOUND", Message: "数据源不存在"})
	case repository.ErrDatasourceNameConflict:
		c.JSON(http.StatusConflict, APIError{Code: "DATASOURCE_NAME_CONFLICT", Message: "数据源名称已存在"})
	default:
		c.JSON(http.StatusInternalServerError, APIError{Code: "INTERNAL", Message: err.Error()})
	}
}

