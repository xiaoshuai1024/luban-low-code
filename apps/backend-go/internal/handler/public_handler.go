package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/xiaoshuai1024/luban-backend-go/internal/service"
)

// PublicHandler 公开接口 handler（无需鉴权），对齐 Java PublicController。
type PublicHandler struct {
	svc *service.PublicService
}

func NewPublicHandler(svc *service.PublicService) *PublicHandler {
	return &PublicHandler{svc: svc}
}

// GetByPath GET /backend/public/sites/:slug/pages?path=/home
//
// 对齐 Java PublicController.getByPath：
//   - 取 :slug（path variable）+ path（query param）
//   - path 为空 → 400 INVALID_ARGUMENT（Java 靠 @GetMapping(params="path") 强制要求，
//     无 path 直接 400；这里手动校验保持一致语义）
//   - 调 service.GetPublishedPageBySlugAndPath
func (h *PublicHandler) GetByPath(c *gin.Context) {
	slug := c.Param("slug")
	path := c.Query("path")
	if path == "" {
		c.JSON(http.StatusBadRequest, APIError{Code: "INVALID_ARGUMENT", Message: "path required"})
		return
	}
	page, err := h.svc.GetPublishedPageBySlugAndPath(c.Request.Context(), slug, path)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, page)
}
