package dao

import (
	"fmt"
	"time"

	// 必须添加这行匿名导入，初始化MySQL驱动
	_ "github.com/go-sql-driver/mysql"
	"github.com/jmoiron/sqlx"
	"github.com/sirupsen/logrus"
	"github.com/xiaoshuai1024/luban-backend-go/config"
)

// DB MySQL连接实例
var DB *sqlx.DB

// InitMySQL 初始化MySQL连接
func InitMySQL() {
	// 先连接到 MySQL 实例本身（不指定 DB），用于自动建库
	baseDSN := fmt.Sprintf("%s:%s@tcp(%s:%s)/?charset=%s&parseTime=true&loc=Local",
		config.MySQL.User,
		config.MySQL.Password,
		config.MySQL.Host,
		config.MySQL.Port,
		config.MySQL.Charset,
	)

	// 连接到实例
	rootDB, err := sqlx.Connect("mysql", baseDSN)
	if err != nil {
		logrus.Fatalf("连接MySQL实例失败: %v", err)
	}
	// 创建数据库（例如 luban），若不存在
	createDBSQL := fmt.Sprintf("CREATE DATABASE IF NOT EXISTS `%s` DEFAULT CHARSET %s", config.MySQL.DB, config.MySQL.Charset)
	if _, err := rootDB.Exec(createDBSQL); err != nil {
		logrus.Fatalf("创建数据库 %s 失败: %v", config.MySQL.DB, err)
	}
	_ = rootDB.Close()

	// 再构建带数据库名的 DSN
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=%s&parseTime=true&loc=Local",
		config.MySQL.User,
		config.MySQL.Password,
		config.MySQL.Host,
		config.MySQL.Port,
		config.MySQL.DB,
		config.MySQL.Charset,
	)

	// 连接指定数据库
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

	// 4. 自动初始化数据库表结构（幂等）
	if err := initSchema(DB); err != nil {
		logrus.Fatalf("初始化数据库表结构失败: %v", err)
	}
}

// initSchema 创建核心表（若不存在）。语句是幂等的，可多次执行。
func initSchema(db *sqlx.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS sites (
			id         VARCHAR(36)  PRIMARY KEY,
			name       VARCHAR(255) NOT NULL,
			slug       VARCHAR(128) NOT NULL UNIQUE,
			base_url   VARCHAR(512),
			status     VARCHAR(32)  NOT NULL DEFAULT 'active',
			created_at DATETIME(3)  NOT NULL,
			updated_at DATETIME(3)  NOT NULL
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
		`CREATE TABLE IF NOT EXISTS pages (
			id          VARCHAR(36)  PRIMARY KEY,
			site_id     VARCHAR(36)  NOT NULL,
			name        VARCHAR(255) NOT NULL,
			path        VARCHAR(255) NOT NULL,
			status      VARCHAR(32)  NOT NULL DEFAULT 'draft',
			schema_json JSON         NOT NULL,
			created_at  DATETIME(3)  NOT NULL,
			updated_at  DATETIME(3)  NOT NULL,
			UNIQUE KEY uk_site_path (site_id, path),
			CONSTRAINT fk_pages_site FOREIGN KEY (site_id) REFERENCES sites(id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
		`CREATE TABLE IF NOT EXISTS users (
			id         VARCHAR(36)  PRIMARY KEY,
			username   VARCHAR(128) NOT NULL UNIQUE,
			name       VARCHAR(255),
			role       VARCHAR(32)  NOT NULL DEFAULT 'user',
			status     VARCHAR(32)  NOT NULL DEFAULT 'active',
			password   VARCHAR(255) NOT NULL,
			created_at DATETIME(3)  NOT NULL,
			updated_at DATETIME(3)  NOT NULL
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
		`CREATE TABLE IF NOT EXISTS system_settings (
			id         TINYINT       PRIMARY KEY,
			data_json  JSON          NOT NULL,
			updated_at DATETIME(3)   NOT NULL
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
		// datasources: per-site data source definitions (W1-T2). Aligned with Java
		// Flyway V20260619000001__add_datasources.sql (same columns, uk + fk names).
		// type whitelist static|api is enforced in the service layer on both backends.
		`CREATE TABLE IF NOT EXISTS datasources (
			id          VARCHAR(36)  PRIMARY KEY,
			site_id     VARCHAR(36)  NOT NULL,
			name        VARCHAR(255) NOT NULL,
			type        VARCHAR(32)  NOT NULL,
			config_json JSON         NOT NULL,
			created_at  DATETIME(3)  NOT NULL,
			updated_at  DATETIME(3)  NOT NULL,
			UNIQUE KEY uk_datasources_site_name (site_id, name),
			CONSTRAINT fk_datasources_site FOREIGN KEY (site_id) REFERENCES sites(id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
		// V2-T2 SEO：pages + sites 增加 seo_json（与 Java Flyway V20260621000003 对齐）。
		// MySQL 8.0+ 支持 ADD COLUMN IF NOT EXISTS；5.7 需 INFORMATION_SCHEMA 探测，
		// 此处用 IF NOT EXISTS 兜底（本仓统一 MySQL 8.0，见 plan §9.3）。
		`ALTER TABLE pages ADD COLUMN IF NOT EXISTS seo_json JSON NULL AFTER schema_json;`,
		`ALTER TABLE sites ADD COLUMN IF NOT EXISTS seo_json JSON NULL AFTER base_url;`,
	}

	for _, sql := range stmts {
		if _, err := db.Exec(sql); err != nil {
			return err
		}
	}
	return nil
}
