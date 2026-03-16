package handler

import (
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
	switch err {
	case repository.ErrSiteNotFound:
		c.JSON(http.StatusNotFound, APIError{Code: "SITE_NOT_FOUND", Message: "站点不存在"})
	case repository.ErrPageNotFound:
		c.JSON(http.StatusNotFound, APIError{Code: "PAGE_NOT_FOUND", Message: "页面不存在"})
	case repository.ErrUserNotFound:
		c.JSON(http.StatusNotFound, APIError{Code: "USER_NOT_FOUND", Message: "用户不存在"})
	case repository.ErrPagePathConflict:
		c.JSON(http.StatusConflict, APIError{Code: "PAGE_PATH_CONFLICT", Message: "页面 path 已存在"})
	case repository.ErrUsernameConflict:
		c.JSON(http.StatusConflict, APIError{Code: "USERNAME_CONFLICT", Message: "用户名已存在"})
	case service.ErrInvalidCredentials:
		c.JSON(http.StatusUnauthorized, APIError{Code: "INVALID_CREDENTIALS", Message: "账号或密码错误"})
	case service.ErrUserDisabled:
		c.JSON(http.StatusForbidden, APIError{Code: "USER_DISABLED", Message: "用户已被禁用"})
	default:
		c.JSON(http.StatusInternalServerError, APIError{Code: "INTERNAL", Message: err.Error()})
	}
}

