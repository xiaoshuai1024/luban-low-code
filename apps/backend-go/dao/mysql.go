package dao

import (
	"fmt"
	"time"

	// 必须添加这行匿名导入，初始化MySQL驱动（修复核心问题）
	_ "github.com/go-sql-driver/mysql"
	"github.com/jmoiron/sqlx"
	"github.com/sirupsen/logrus"
	"github.com/xiaoshuai1024/luban-backend-go/config" // 你的模块名，无需修改
)

// DB MySQL连接实例
var DB *sqlx.DB

// InitMySQL 初始化MySQL连接
func InitMySQL() {
	// 构建DSN（数据源名称）
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=%s&parseTime=true&loc=Local",
		config.MySQL.User,
		config.MySQL.Password,
		config.MySQL.Host,
		config.MySQL.Port,
		config.MySQL.DB,
		config.MySQL.Charset,
	)

	// 连接数据库
	db, err := sqlx.Connect("mysql", dsn)
	if err != nil {
		logrus.Fatalf("连接MySQL失败: %v", err)
	}

	// 设置连接池参数
	db.SetMaxOpenConns(config.MySQL.MaxOpenConns)
	db.SetMaxIdleConns(config.MySQL.MaxIdleConns)
	db.SetConnMaxLifetime(60 * time.Minute)

	DB = db
	logrus.Info("MySQL连接初始化成功")
}
