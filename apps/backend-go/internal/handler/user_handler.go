package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/xiaoshuai1024/luban-backend-go/internal/model"
	"github.com/xiaoshuai1024/luban-backend-go/internal/service"
)

type UserHandler struct {
	svc *service.UserService
}

func NewUserHandler(svc *service.UserService) *UserHandler {
	return &UserHandler{svc: svc}
}

func (h *UserHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "10"))
	keyword := c.Query("keyword")
	list, total, err := h.svc.List(c.Request.Context(), page, size, keyword)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"list":  list,
		"total": total,
	})
}

func (h *UserHandler) Get(c *gin.Context) {
	id := c.Param("id")
	u, err := h.svc.Get(c.Request.Context(), id)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, u)
}

type userCreateRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
	Name     string `json:"name"`
	Role     string `json:"role"`
}

func (h *UserHandler) Create(c *gin.Context) {
	var req userCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIError{Code: "INVALID_ARGUMENT", Message: "invalid body"})
		return
	}
	u, err := h.svc.Create(c.Request.Context(), req.Username, req.Password, req.Name, req.Role)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusCreated, u)
}

type userUpdateRequest struct {
	Username string `json:"username"`
	Name     string `json:"name"`
	Role     string `json:"role"`
	Status   string `json:"status"`
	Password string `json:"password"`
}

func (h *UserHandler) Update(c *gin.Context) {
	id := c.Param("id")
	var req userUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIError{Code: "INVALID_ARGUMENT", Message: "invalid body"})
		return
	}
	u := &model.User{
		ID:       id,
		Username: req.Username,
		Name:     req.Name,
		Role:     req.Role,
		Status:   req.Status,
	}
	// 密码处理直接交给 service.Update 内部或后续扩展
	if err := h.svc.Update(c.Request.Context(), u); err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, u)
}

func (h *UserHandler) UpdateStatus(c *gin.Context) {
	// 简化：直接通过 Update 实现，实际可单独调用 repo 更新 status
	id := c.Param("id")
	var body struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, APIError{Code: "INVALID_ARGUMENT", Message: "invalid body"})
		return
	}
	u, err := h.svc.Get(c.Request.Context(), id)
	if err != nil {
		writeError(c, err)
		return
	}
	u.Status = body.Status
	if err := h.svc.Update(c.Request.Context(), u); err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, u)
}

