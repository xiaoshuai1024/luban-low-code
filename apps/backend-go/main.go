package main

import (
	"fmt"
	"net/http"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/xiaoshuai1024/luban-backend-go/config"
	"github.com/xiaoshuai1024/luban-backend-go/dao"
	"github.com/xiaoshuai1024/luban-backend-go/router"
)

func main() {
	// 1. 初始化配置
	config.InitConfig()

	// 2. 初始化数据库连接
	dao.InitMySQL()
	dao.InitRedis()

	// 3. 初始化路由
	r := router.InitRouter()

	// 4. 启动服务器
	server := &http.Server{
		Addr:         fmt.Sprintf(":%s", config.App.Port),
		Handler:      r,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	logrus.Infof("服务器启动成功，监听端口: %s", config.App.Port)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logrus.Fatalf("服务器启动失败: %v", err)
	}
}
