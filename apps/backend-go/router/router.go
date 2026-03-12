package router

import (
	"github.com/gin-gonic/gin"
	"github.com/xiaoshuai1024/luban-backend-go/controller" // 替换为你的模块名
)

// InitRouter 初始化路由
func InitRouter() *gin.Engine {
	// 根据环境设置Gin模式
	if gin.Mode() == gin.ReleaseMode {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	// 测试路由
	r.GET("/ping", controller.PingHandler)

	return r
}
