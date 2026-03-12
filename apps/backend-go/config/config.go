package config

import (
	"os"

	"github.com/joho/godotenv"
	"github.com/sirupsen/logrus"
)

// AppConfig 应用配置
type AppConfig struct {
	Port   string
	Env    string
	Debug  bool
}

// MySQLConfig MySQL配置
type MySQLConfig struct {
	Host         string
	Port         string
	User         string
	Password     string
	DB           string
	Charset      string
	MaxOpenConns int
	MaxIdleConns int
}

// RedisConfig Redis配置
type RedisConfig struct {
	Host     string
	Port     string
	Password string
	DB       int
	PoolSize int
}

// Config 全局配置
var (
	App   AppConfig
	MySQL MySQLConfig
	Redis RedisConfig
)

// InitConfig 初始化配置
func InitConfig() {
	// 加载.env文件
	if err := godotenv.Load(); err != nil {
		logrus.Warn("未找到.env文件，将使用系统环境变量")
	}

	// 加载应用配置
	App = AppConfig{
		Port:   getEnv("APP_PORT", "8080"),
		Env:    getEnv("APP_ENV", "dev"),
		Debug:  getEnv("APP_DEBUG", "true") == "true",
	}

	// 加载MySQL配置
	MySQL = MySQLConfig{
		Host:         getEnv("MYSQL_HOST", "127.0.0.1"),
		Port:         getEnv("MYSQL_PORT", "3306"),
		User:         getEnv("MYSQL_USER", "root"),
		Password:     getEnv("MYSQL_PASSWORD", ""),
		DB:           getEnv("MYSQL_DB", "test"),
		Charset:      getEnv("MYSQL_CHARSET", "utf8mb4"),
		MaxOpenConns: 20,
		MaxIdleConns: 10,
	}

	// 加载Redis配置
	Redis = RedisConfig{
		Host:     getEnv("REDIS_HOST", "127.0.0.1"),
		Port:     getEnv("REDIS_PORT", "6379"),
		Password: getEnv("REDIS_PASSWORD", ""),
		DB:       0,
		PoolSize: 10,
	}
}

// getEnv 获取环境变量，无则返回默认值
func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}
