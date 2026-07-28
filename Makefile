# luban-workspace — monorepo 全栈编排入口
# 用法见 README.md 与 docs/SYSTEM_ARCHITECTURE.md（服务拓扑 SSOT）
#
# 端口约定（本机 dev 裸进程，互不冲突；中间件在远端 dev 服务器）：
#   engine    :5173   (vite; /api → proxy → bff:3100)
#   bff       :3100   (next dev -p 3100; 显式 3100 避免与 website 3000 冲突)
#   website   :3000   (nuxt dev; bffBaseUrl env 修正为 3100)
#   Java      :8080   (mvn spring-boot:run; ctx /backend)
#   Go        :8081   (可选; 双后端契约测试)
#   MySQL     :13306  (远端 192.168.100.248)
#   Redis     :16379  (远端 192.168.100.248)
# 本机禁起 docker / 中间件。
#
# monorepo 结构（原 git submodule 已合并为单一仓库）：
#   apps/{engine,bff,website,backend-java,backend-go}   可部署应用
#   packages/{ui,ai-assistant}                           库（ui 含独立 nx workspace）
#   docs/architecture                                    架构文档

# pnpm 11.13 的 runDepsStatusCheck 需此 flag 绕过（pnpm-workspace.yaml verifyDepsBeforeRun 已设）
PNPM := pnpm --config.verifyDepsBeforeRun=false

PKG_DIRS := apps/engine apps/bff packages/ui apps/website \
            apps/backend-java apps/backend-go

.PHONY: install ui-build build test test-coverage lint \
        dev-engine dev-bff dev-website dev-java dev-go dev-apps dev-check \
        clean \
        e2e-up e2e-down e2e e2e-cross e2e-install e2e-report

# --- E2E 服务编排 + 跨项目流程性 E2E ---
COMPOSE_E2E := docker-compose.e2e.yml

# 起 E2E 服务编排（MySQL/Redis/双后端/bff/engine/website）
e2e-up:
	@bash scripts/e2e/up-all.sh

# 停 E2E 服务编排
e2e-down:
	@bash scripts/e2e/down-all.sh

# 安装 Playwright 浏览器（首次）
e2e-install:
	cd e2e && pnpm install && pnpm run install:e2e

# 跑全部跨项目流程（需先 e2e-up）
e2e:
	cd e2e && pnpm test

# 跑跨项目黄金流程（发布/线索/双后端一致性）
e2e-cross:
	cd e2e && pnpm test:cross

e2e-report:
	cd e2e && pnpm report

# ============================================================
# 依赖安装 / 构建
# ============================================================

# 安装所有 workspace 依赖（root apps/* + packages/ui 独立 workspace）
install:
	$(PNPM) install
	cd packages/ui && $(PNPM) install

# 构建 ui 物料库（luban-base/luban-low-code dist，apps production build 的前置依赖）
ui-build:
	cd packages/ui && $(PNPM) nx run-many --projects=luban-base,luban-low-code --target=build

# 构建所有 TS 应用（engine/bff/website；依赖 ui-build 产出 dist）
build: ui-build
	$(PNPM) --filter './apps/*' build

# ============================================================
# 测试 / lint / 覆盖率
# ============================================================

# 各包测试（按技术栈，遍历 PKG_DIRS）
test:
	@bash scripts/git/run-per-pkg.sh test

# 各包 lint
lint:
	@bash scripts/git/run-per-pkg.sh lint

# 一键全栈覆盖率门禁（汇总表 + HTML 报告）
test-coverage:
	@bash scripts/coverage/coverage-summary.sh

# ============================================================
# 本地开发启动（单服务 / 全栈）—— 见 docs/SYSTEM_ARCHITECTURE.md
# 端口：engine 5173 / bff 3100 / website 3000 / Java 8080 / Go 8081
# 中间件 MySQL 13306 / Redis 16379 在远端 192.168.100.248
# ============================================================

# --- 单服务启动 ---

# Java 后端（Spring Boot；start-mvn.bat 内置远端中间件 env + Flyway 自动迁移）
# 启动慢（~30-60s），健康检查：http://localhost:8080/backend/actuator/health
dev-java:
	cd apps/backend-java && cmd //c start-mvn.bat

# Go 后端（可选；双后端契约测试场景用。端口 8081）
dev-go:
	cd apps/backend-go && APP_PORT=8081 go run .

# BFF（Next.js；显式 -p 3100，避免与 website 默认 3000 冲突）
dev-bff:
	cd apps/bff && $(PNPM) exec next dev -p 3100

# engine（Vue SPA；vite 默认 5173；/api proxy 已指向 bff:3100）
dev-engine:
	cd apps/engine && $(PNPM) run dev

# website（Nuxt SSR；nuxt 默认 3000；env 修正 bffBaseUrl 默认值错误→3100）
dev-website:
	cd apps/website && NUXT_PUBLIC_BFF_BASE_URL=http://127.0.0.1:3100 $(PNPM) exec nuxt dev

# --- 全栈一键启动 ---

# 并行起 4 个核心应用（Java + BFF + engine + website），trap 统一清理
# 依赖顺序：Java → BFF → engine/website（本 target 并行起，Java 自带健康自检）
dev-apps:
	@echo "Starting Java + BFF + engine + website (parallel)..."
	@echo "  middleware: MySQL 192.168.100.248:13306 / Redis :16379 (remote)"
	@echo "  Java boots ~30-60s (Flyway); wait for http://localhost:8080/backend/actuator/health"
	@trap 'kill 0' INT TERM EXIT; \
	$(MAKE) dev-java & \
	$(MAKE) dev-bff & \
	$(MAKE) dev-engine & \
	$(MAKE) dev-website & \
	wait

# --- 健康检查（探测 4 个应用端口；200/302/404 = OK，DOWN/ECONN = 未起）---
dev-check:
	@echo "Probing services..."
	@for svc in "Java:8080/backend/actuator/health" "BFF:3100" "engine:5173" "website:3000"; do \
		name=$${svc%%:*}; rest=$${svc#*:}; port=$${rest%%/*}; path=$${rest#*:}; \
		code=$$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$$port/$$path 2>/dev/null || echo DOWN); \
		printf "  %-10s :%-5s %s\n" "$$name" "$$port" "$$code"; \
	done

clean:
	@for d in $(PKG_DIRS); do [ -d "$$d" ] && rm -rf $$d/dist $$d/build $$d/target $$d/coverage 2>/dev/null; done; true
