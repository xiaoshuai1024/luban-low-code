#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

git pull --ff-only

GHCR_USER="${GHCR_USER:-xiaoshuai1024}"
TOKEN_FILE="${ROOT}/deploy/environments/prod/secrets/ghcr_token"
if [[ -f "${TOKEN_FILE}" ]]; then
  cat "${TOKEN_FILE}" | docker login ghcr.io -u "${GHCR_USER}" --password-stdin
fi

export COMPOSE_PROJECT_NAME=luban-prod

COMPOSE_ARGS=( -f deploy/compose/prod.yml --env-file deploy/environments/prod/versions.env )
if [[ -f deploy/environments/prod/app.env ]]; then
  COMPOSE_ARGS+=( --env-file deploy/environments/prod/app.env )
fi

docker compose "${COMPOSE_ARGS[@]}" pull
docker compose "${COMPOSE_ARGS[@]}" up -d --remove-orphans

echo "Deploy finished."
