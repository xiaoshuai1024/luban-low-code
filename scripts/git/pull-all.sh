#!/usr/bin/env bash
#
# pull-all.sh — monorepo 单仓拉取
#
# 原 submodule 时代遍历 .gitmodules 各子仓同步的逻辑已废弃（8 子仓已合并为单一仓库）。
# 现行为：在 monorepo 根 fetch + 合并 origin/<分支> 到当前分支。
#
# 用法（仓库根目录）:
#   bash scripts/git/pull-all.sh            # 拉取当前分支
#   bash scripts/git/pull-all.sh master     # 拉取并合并指定分支
#
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${ROOT}" ]]; then
  echo "Error: not inside a git repository." >&2
  exit 1
fi
cd "${ROOT}"

CURRENT="$(git symbolic-ref -q --short HEAD 2>/dev/null || true)"
if [[ -z "${CURRENT}" ]]; then
  echo "Error: detached HEAD，请先 checkout 一个分支。" >&2
  exit 1
fi
BRANCH="${1:-${CURRENT}}"

echo "[monorepo] 当前分支: ${CURRENT}，目标: origin/${BRANCH}"
if ! git fetch origin "${BRANCH}" 2>&1; then
  echo "[monorepo] warn: fetch origin ${BRANCH} 失败（远端无该分支？）" >&2
  exit 0
fi

if [[ "${CURRENT}" == "${BRANCH}" ]]; then
  git merge --ff-only "origin/${BRANCH}" 2>&1 || git merge --no-edit "origin/${BRANCH}" 2>&1
  echo "[monorepo] ✓ 已同步到 $(git rev-parse --short HEAD)"
else
  git merge --no-edit "origin/${BRANCH}" 2>&1
  echo "[monorepo] ✓ 已合并 origin/${BRANCH} 进 ${CURRENT} ($(git rev-parse --short HEAD))"
fi
