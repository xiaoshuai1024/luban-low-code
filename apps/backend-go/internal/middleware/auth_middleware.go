package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/xiaoshuai1024/luban-backend-go/internal/handler"
)

type Middleware struct{}

func NewMiddleware() *Middleware { return &Middleware{} }

// RequireUser 从 Header 中解析用户上下文
func (m *Middleware) RequireUser() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetHeader("X-User-ID")
		role := c.GetHeader("X-User-Role")
		if userID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, handler.APIError{
				Code:    "UNAUTHENTICATED",
				Message: "missing user",
			})
			return
		}
		c.Set("userId", userID)
		c.Set("role", role)
		c.Next()
	}
}

// RequireAdmin 仅允许管理员访问
func (m *Middleware) RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("role")
		if role != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, handler.APIError{
				Code:    "PERMISSION_DENIED",
				Message: "admin only",
			})
			return
		}
		c.Next()
	}
}

