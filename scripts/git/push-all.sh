#!/usr/bin/env bash
#
# push-all.sh — monorepo 单仓 commit + push
#
# 原 submodule 时代遍历各子仓分别 commit/push 的逻辑已废弃（8 子仓已合并为单一仓库）。
# 现行为：monorepo 根 git add -A + conventional commit + push 当前分支。
#
# 用法（仓库根目录）:
#   bash scripts/git/push-all.sh                       # 自动推断 scope
#   bash scripts/git/push-all.sh -m "feat(engine): X"  # 自定义提交说明
#   bash scripts/git/push-all.sh --plain               # 固定 chore 说明
#
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${ROOT}" ]]; then
  echo "Error: not inside a git repository." >&2
  exit 1
fi
cd "${ROOT}"

MSG=""
USE_PLAIN=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--message) MSG="${2:-}"; shift 2 ;;
    --plain)      USE_PLAIN=1; shift ;;
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

if [[ -z "$(git status --porcelain 2>/dev/null)" ]]; then
  echo "[monorepo] 无改动，跳过 (${CURRENT})"
  exit 0
fi

git add -A
if git diff --cached --quiet; then
  echo "[monorepo] add 后无可提交内容（可能仅剩被忽略文件）"
  exit 0
fi

if [[ -n "${MSG}" ]]; then
  COMMIT_MSG="${MSG}"
elif [[ "${USE_PLAIN}" == "1" ]]; then
  COMMIT_MSG="chore: push-all 同步本地改动 ($(date -u +%Y-%m-%d))"
else
  # 自动推断 conventional scope：改动最多的顶层目录
  SCOPE="$(git diff --cached --name-only | sed 's#/.*##' | sort | uniq -c | sort -rn | head -1 | awk '{print $2}')"
  case "${SCOPE}" in
    apps|packages|docs|.agents|.claude|scripts|harness|e2e) COMMIT_MSG="chore(${SCOPE}): push-all 同步本地改动" ;;
    *) COMMIT_MSG="chore: push-all 同步本地改动 ($(date -u +%Y-%m-%d))" ;;
  esac
fi

echo "[monorepo] commit: ${COMMIT_MSG} (${CURRENT})"
git commit -m "${COMMIT_MSG}"
echo "[monorepo] push → origin ${CURRENT}"
git push -u origin "${CURRENT}"
echo "[monorepo] ✓ done"
