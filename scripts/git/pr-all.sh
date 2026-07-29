#!/usr/bin/env bash
#
# pr-all.sh — monorepo 单仓 gh pr create
#
# 原 submodule 时代为各子仓 + meta 分别建 PR 的逻辑已废弃（8 子仓已合并为单一仓库）。
# 现行为：确保改动已 push，然后 gh pr create 当前分支 → master。
#
# 用法（仓库根目录）:
#   bash scripts/git/pr-all.sh                # 建 PR 当前分支 → master
#   bash scripts/git/pr-all.sh --base develop # 指定 base
#   bash scripts/git/pr-all.sh --draft        # 草稿 PR
#
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${ROOT}" ]]; then
  echo "Error: not inside a git repository." >&2
  exit 1
fi
cd "${ROOT}"

BASE="master"
DRAFT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --base) BASE="${2:-master}"; shift 2 ;;
    --draft) DRAFT="--draft"; shift ;;
    -h|--help)
      sed -n '3,12p' "$0"
      exit 0 ;;
    *) echo "Error: 未知参数: $1" >&2; exit 1 ;;
  esac
done

CURRENT="$(git symbolic-ref -q --short HEAD 2>/dev/null || true)"
if [[ -z "${CURRENT}" ]]; then
  echo "Error: detached HEAD，请先 checkout 一个分支。" >&2
  exit 1
fi

# 有未提交改动则先 push
if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
  echo "[monorepo] 检测到未提交改动，先执行 push-all..."
  bash "${ROOT}/scripts/git/push-all.sh"
fi

echo "[monorepo] gh pr create: ${CURRENT} → ${BASE}"
gh pr create --base "${BASE}" --head "${CURRENT}" --fill ${DRAFT}
echo "[monorepo] ✓ PR 已创建"
