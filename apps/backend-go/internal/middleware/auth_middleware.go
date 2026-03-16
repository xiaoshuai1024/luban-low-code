package middleware

import (
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

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

		// #region agent log
		func() {
			f, err := os.OpenFile("/Users/john/codes/luban-ui/.cursor/debug-6eb26e.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
			if err != nil {
				return
			}
			defer f.Close()
			_, _ = f.WriteString(fmt.Sprintf(`{"sessionId":"%s","runId":"users-403","hypothesisId":"H3","location":"internal/middleware/auth_middleware.go:RequireUser","message":"RequireUser headers","data":{"userId":"%s","role":"%s"},"timestamp":%d}`+"\n", "6eb26e", userID, role, time.Now().UnixMilli()))
		}()
		// #endregion agent log
		c.Set("userId", userID)
		c.Set("role", role)
		c.Next()
	}
}

// RequireAdmin 仅允许管理员访问
func (m *Middleware) RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		roleVal, _ := c.Get("role")
		role, _ := roleVal.(string)
		normalized := strings.ToLower(strings.TrimSpace(role))

		// #region agent log
		func() {
			f, err := os.OpenFile("/Users/john/codes/luban-ui/.cursor/debug-6eb26e.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
			if err != nil {
				return
			}
			defer f.Close()
			_, _ = f.WriteString(fmt.Sprintf(`{"sessionId":"%s","runId":"users-403","hypothesisId":"H4","location":"internal/middleware/auth_middleware.go:RequireAdmin","message":"RequireAdmin role check","data":{"role":"%s","normalized":"%s"},"timestamp":%d}`+"\n", "6eb26e", role, normalized, time.Now().UnixMilli()))
		}()
		// #endregion agent log
		if normalized != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, handler.APIError{
				Code:    "PERMISSION_DENIED",
				Message: "admin only",
			})
			return
		}
		c.Next()
	}
}

