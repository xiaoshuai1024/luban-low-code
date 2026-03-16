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

// Me 依赖上游中间件注入的用户信息
func (h *AuthHandler) Me(c *gin.Context) {
	userID, _ := c.Get("userId")
	role, _ := c.Get("role")
	if userID == nil {
		c.JSON(http.StatusUnauthorized, APIError{Code: "UNAUTHENTICATED", Message: "missing user"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"id":   userID,
		"role": role,
	})
}

