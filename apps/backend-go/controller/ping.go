package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/xiaoshuai1024/luban-backend-go/dao" // 你的模块名，无需修改
)

// PingHandler 测试接口
func PingHandler(c *gin.Context) {
	// 测试MySQL连接
	var version string
	err := dao.DB.Get(&version, "SELECT VERSION()")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "MySQL连接失败",
			"err":  err.Error(),
		})
		return
	}

	redisPong, err := dao.RDB.Ping(c.Request.Context()).Result()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "Redis连接失败",
			"err":  err.Error(),
		})
		return
	}

	// 返回成功响应
	c.JSON(http.StatusOK, gin.H{
		"code":  200,
		"msg":   "pong",
		"mysql": version,
		"redis": redisPong, // 仍注释
		"env":   "dev",
	})
}
