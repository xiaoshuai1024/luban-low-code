# 部署指南

## Docker Compose 部署（推荐）

### 1. 准备环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，设置关键变量：

```bash
# 数据库
MYSQL_ROOT_PASSWORD=your_secure_password
MYSQL_DATABASE=luban
MYSQL_USER=luban
MYSQL_PASSWORD=your_secure_password

# JWT 密钥
AUTH_JWT_SECRET=your_jwt_secret_min_32_chars

# 线索加密
LEAD_ENC_KEY=your_32_char_encryption_key
```

### 2. 构建并启动

```bash
# 构建所有镜像并启动
docker compose up -d --build

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f engine
```

### 3. 服务端口

| 服务 | 容器端口 | 主机端口 | 说明 |
|------|---------|---------|------|
| MySQL | 3306 | 3306 | 数据库 |
| Redis | 6379 | 6379 | 缓存 |
| Backend | 8080 | 8080 | Java API |
| BFF | 3000 | 3000 | Next.js BFF |
| Engine | 4200 | 5173 | Vue SPA 设计器 |
| Website | 4173 | 3001 | Nuxt SSR |

### 4. 初始化数据

首次部署后，创建管理员账号和默认站点：

```bash
# 进入 MySQL 容器创建管理员
docker compose exec mysql mysql -uroot -p luban

-- 创建管理员用户（密码需 BCrypt 加密）
INSERT INTO users (id, username, name, role, status, password, created_at, updated_at)
VALUES (UUID(), 'admin', 'Admin', 'admin', 'active', '<bcrypt_hash>', NOW(), NOW());

-- 创建默认站点
INSERT INTO sites (id, name, slug, status, created_at, updated_at)
VALUES (UUID(), 'Default Site', 'default', 'active', NOW(), NOW());
```

## 环境变量说明

| 变量 | 必需 | 默认值 | 说明 |
|------|:---:|--------|------|
| `MYSQL_ROOT_PASSWORD` | ✅ | - | MySQL root 密码 |
| `MYSQL_DATABASE` | - | luban | 数据库名 |
| `AUTH_JWT_SECRET` | ✅ | - | JWT 签名密钥（≥32 字符） |
| `LEAD_ENC_KEY` | ✅ | - | 线索手机号加密密钥 |
| `DEEPSEEK_API_KEY` | - | - | AI 生成功能密钥 |
| `AUTH_JWT_SECRET` | - | dev-secret | BFF JWT 密钥（须与后端一致） |

## 域名配置

### Nginx 反向代理

```nginx
server {
    listen 80;
    server_name luban.example.com;

    location / {
        proxy_pass http://127.0.0.1:3001;  # Website SSR
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;  # BFF
    }

    location /admin/ {
        proxy_pass http://127.0.0.1:5173;  # Engine
    }
}
```

## 升级

```bash
# 拉取最新代码
git pull origin master

# 重新构建并重启
docker compose up -d --build

# Flyway 自动执行数据库迁移
```

## 回滚

```bash
# 回退到上一个版本
git checkout <previous_tag>

# 重建
docker compose up -d --build
```
