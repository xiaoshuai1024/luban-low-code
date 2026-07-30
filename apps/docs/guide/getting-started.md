# 快速开始

## 环境准备

| 工具 | 版本要求 | 说明 |
|------|---------|------|
| Node.js | ≥ 20 | LTS 版本 |
| pnpm | ≥ 10 | 包管理器 |
| Java | 17 | 后端运行时 |
| Maven | 3.9+ | Java 构建 |
| Docker | 26+ | 可选，容器化部署 |

## 安装

```bash
# 克隆仓库
git clone https://github.com/xiaoshuai1024/luban-low-code.git
cd luban-low-code

# 安装根依赖
pnpm install

# 构建 UI 物料库（引擎和网站的前置依赖）
cd packages/ui && pnpm install && pnpm exec nx run-many --target=build --projects=luban-base,luban-low-code
cd ../..

# 安装各应用依赖
pnpm --filter './apps/*' install
```

## 启动服务

### 方式一：Docker Compose（推荐）

```bash
# 复制环境变量配置
cp .env.example .env

# 启动全部服务
docker compose up -d --build
```

服务端口：
- **引擎（管理后台）**: http://localhost:5173
- **Website（SSR 站点）**: http://localhost:3001
- **BFF**: http://localhost:3000
- **Java 后端**: http://localhost:8080

### 方式二：本地开发

```bash
# 1. 启动中间件（MySQL + Redis）
docker compose up -d mysql redis

# 2. 启动 Java 后端
cd apps/backend-java && mvn spring-boot:run

# 3. 启动 BFF
cd apps/bff && pnpm dev

# 4. 启动引擎（设计器）
cd apps/engine && pnpm dev

# 5. 启动 Website（SSR）
cd apps/website && pnpm dev
```

## 创建第一个页面

1. 打开引擎管理后台 `http://localhost:5173`
2. 登录（默认账号参考 `.env`）
3. 进入 **站点管理** → 选择站点 → **页面**
4. 点击 **新建页面**，选择模板或空白页
5. 从左侧物料面板拖拽组件到画布
6. 在右侧属性面板配置组件
7. 点击 **保存** 或 **发布**
8. 访问 Website 查看渲染结果

## 下一步

- [系统架构](/guide/architecture) — 了解引擎、BFF、后端的分层设计
- [部署指南](/guide/deployment) — 生产环境部署
- [组件文档](/components/overview) — 浏览 75+ 组件
