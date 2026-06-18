package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/xiaoshuai1024/luban-backend-go/internal/service"
)

type AuthHandler struct {
	svc *service.AuthService
}

func NewAuthHandler(svc *service.AuthService) *AuthHandler {
	return &AuthHandler{svc: svc}
}

type loginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIError{Code: "INVALID_ARGUMENT", Message: "invalid body"})
		return
	}
	res, err := h.svc.Login(c.Request.Context(), req.Username, req.Password)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, res)
}

// Me 返回当前登录用户的完整信息（不含 password）。
//
// 对齐 Java AuthController.me → AuthService.me：从 DB 取完整 user 返回。
// 上游 RequireUser 中间件已把 X-User-ID 注入到 "userId"，这里取出来调 service。
// 返回的是 *model.User（Password 字段 json:"-" 自动脱敏），字段顺序与 Java
// UserResponse 一致：id/username/name/role/status/createdAt/updatedAt。
func (h *AuthHandler) Me(c *gin.Context) {
	userID, _ := c.Get("userId")
	id, _ := userID.(string)
	if id == "" {
		c.JSON(http.StatusUnauthorized, APIError{Code: "UNAUTHENTICATED", Message: "missing user"})
		return
	}
	u, err := h.svc.Me(c.Request.Context(), id)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, u)
}

