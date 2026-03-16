# 包管理器：pnpm / npm / yarn
PKG_MANAGER := pnpm

# 定义目录
ROOT := .
APPS_DIRS := $(wildcard apps/*)
PACKAGES_DIRS := $(wildcard packages/*)

# 所有需要处理的目录 = 根目录 + apps所有一级子目录 + packages所有一级子目录
ALL_DIRS := $(ROOT) $(APPS_DIRS) $(PACKAGES_DIRS)

.PHONY: clean install help version publish publish-packages

# 帮助
help:
	@echo "可用命令:"
	@echo "  make clean              清理：根目录 + apps所有子目录 + packages所有子目录 的 node_modules"
	@echo "  make install            在上述所有目录执行 install"
	@echo "  make version            直接修改 luban-base 和 luban-low-code 的 package.json，patch 版本号 +1（无依赖、无 git tag）"
	@echo "  make publish NPM_TOKEN=xxxx  通过 Nx 发布 packages(luban-base,luban-low-code)"
	@echo "  make publish-packages   串联执行 version + publish"
	@echo "  make help               查看帮助"

# 清理：只删除 node_modules，不删代码
clean:
	@echo "=== 开始清理所有 node_modules ==="
	@for dir in $(ALL_DIRS); do \
		if [ -d "$${dir}/node_modules" ]; then \
			echo "清理: $${dir}/node_modules"; \
			rm -rf "$${dir}/node_modules"; \
		fi; \
	done
	@echo "=== 清理完成 ==="

# 安装：在所有清理过的目录执行 install
install:
	@echo "=== 开始安装所有依赖 ==="
	@for dir in $(ALL_DIRS); do \
		if [ -f "$${dir}/package.json" ]; then \
			echo "----------------------------------------"; \
			echo "安装: $${dir}"; \
			cd "$${dir}" && $(PKG_MANAGER) install && cd - > /dev/null; \
		fi; \
	done
	@echo "=== 所有依赖安装完成 ==="

version:
	@echo "=== 直接修改 packages(luban-base, luban-low-code) 的 package.json patch 版本号（无依赖命令） ==="
	@for pkg in luban-base luban-low-code; do \
		FILE="packages/$$pkg/package.json"; \
		if [ ! -f "$$FILE" ]; then \
			echo "找不到 $$FILE，跳过"; \
			continue; \
		fi; \
		OLD_VER=$$(grep -m1 '"version"' "$$FILE" | sed -E 's/.*"version": *"([^"]+)".*/\1/'); \
		MAJOR=$$(echo "$$OLD_VER" | cut -d. -f1); \
		MINOR=$$(echo "$$OLD_VER" | cut -d. -f2); \
		PATCH=$$(echo "$$OLD_VER" | cut -d. -f3); \
		NEW_PATCH=$$((PATCH + 1)); \
		NEW_VER="$$MAJOR.$$MINOR.$$NEW_PATCH"; \
		echo "$$pkg: $$OLD_VER -> $$NEW_VER"; \
		sed -i '' -E "s/\"version\": *\"$$OLD_VER\"/\"version\": \"$$NEW_VER\"/" "$$FILE"; \
	done
	@echo "=== 版本号修改完成（仅改 package.json，不触碰 node_modules / 不创建 git tag） ==="

# 发布 packages 下的包到 npm（依赖 Nx 的 publish 目标）
# 使用方式：
#   make publish NPM_TOKEN=your_token
publish:
	@# 优先使用环境变量 NPM_TOKEN；若未设置，则尝试从根目录 .env 中加载
	@if [ -z "$$NPM_TOKEN" ]; then \
		if [ -f ".env" ]; then \
			echo "从 .env 加载 NPM_TOKEN..."; \
			set -a; . ./.env; set +a; \
		fi; \
	fi; \
	if [ -z "$$NPM_TOKEN" ]; then \
		echo "NPM_TOKEN 未设置，请在环境变量或根目录 .env 中配置 NPM_TOKEN=your_token"; \
		exit 1; \
	fi
	@echo "=== 使用 Nx 执行 build + test + publish（run-many: publish） ==="
	@cd $(ROOT) && npm config set //registry.npmjs.org/:_authToken "$$NPM_TOKEN" >/dev/null 2>&1 && \
		$(PKG_MANAGER) exec nx run-many --target=publish --projects=luban-base,luban-low-code --skip-nx-cache
	@echo "=== 所有 packages 发布完成 ==="

# 串联执行 version + publish
publish-packages:
	@$(MAKE) version
	@$(MAKE) publish