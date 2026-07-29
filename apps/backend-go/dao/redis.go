package dao

import (
	"context"
	"fmt"

	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
	"github.com/xiaoshuai1024/luban-backend-go/config" // 替换为你的模块名
)

// RDB Redis连接实例
var RDB *redis.Client
var ctx = context.Background()

// InitRedis 初始化Redis连接
func InitRedis() {
	// 创建Redis客户端
	client := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%s", config.Redis.Host, config.Redis.Port),
		Password: config.Redis.Password,
		DB:       config.Redis.DB,
		PoolSize: config.Redis.PoolSize,
	})

	// 测试连接
	_, err := client.Ping(ctx).Result()
	if err != nil {
		logrus.Fatalf("连接Redis失败: %v", err)
	}

	RDB = client
	logrus.Info("Redis连接初始化成功")
}
