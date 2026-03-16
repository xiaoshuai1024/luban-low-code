# 包管理器：pnpm / npm / yarn
PKG_MANAGER := pnpm

# 定义目录
ROOT := .
APPS_DIRS := $(wildcard apps/*)
PACKAGES_DIRS := $(wildcard packages/*)

# 所有需要处理的目录 = 根目录 + apps所有一级子目录 + packages所有一级子目录
ALL_DIRS := $(ROOT) $(APPS_DIRS) $(PACKAGES_DIRS)

.PHONY: clean install help

# 帮助
help:
	@echo "可用命令:"
	@echo "  make clean     清理：根目录 + apps所有子目录 + packages所有子目录 的 node_modules"
	@echo "  make install   在上述所有目录执行 install"
	@echo "  make help      查看帮助"

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