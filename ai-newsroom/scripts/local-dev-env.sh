#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
COMPOSE_DIR="${AI_NEWSROOM_DOCKER_APP_DIR:-$ROOT_DIR/../docker/ai-newsroom}"
REPO_ENV_FILE="$ROOT_DIR/.env"
COMPOSE_ENV_FILE="$COMPOSE_DIR/.env"

load_optional_env_file() {
  local env_file="$1"
  local line key value

  if [[ ! -f "$env_file" ]]; then
    return 0
  fi

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "${line//[[:space:]]/}" ]] && continue
    [[ "$line" == \#* ]] && continue
    [[ "$line" != *=* ]] && continue

    key="${line%%=*}"
    value="${line#*=}"

    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"

    if [[ "$value" == \"*\" && "$value" == *\" ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
      value="${value:1:${#value}-2}"
    fi

    export "$key=$value"
  done < "$env_file"
}

load_local_dev_env() {
  load_optional_env_file "$COMPOSE_ENV_FILE"
  load_optional_env_file "$REPO_ENV_FILE"

  export BACKEND_PORT="${BACKEND_PORT:-${AI_NEWSROOM_BACKEND_PORT:-8000}}"
  export FRONTEND_PORT="${FRONTEND_PORT:-${AI_NEWSROOM_FRONTEND_PORT:-3000}}"
  export NEWSROOM_TENANT_ROOT="${NEWSROOM_TENANT_ROOT:-$ROOT_DIR/.tenant-data}"
  export AI_NEWSROOM_SETTINGS_FILE="${AI_NEWSROOM_SETTINGS_FILE:-$REPO_ENV_FILE}"
  export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://127.0.0.1:${BACKEND_PORT}}"
  export INTERNAL_API_URL="${INTERNAL_API_URL:-http://127.0.0.1:${BACKEND_PORT}}"
  export INTERNAL_ASSET_URL="${INTERNAL_ASSET_URL:-$INTERNAL_API_URL}"
  export NEXT_PUBLIC_MINIO_BUCKET="${NEXT_PUBLIC_MINIO_BUCKET:-${MINIO_BUCKET:-newsroom-images}}"
  mkdir -p "$NEWSROOM_TENANT_ROOT"
}

ensure_backend_venv() {
  if ! command -v uv >/dev/null 2>&1; then
    echo "[local-dev] uv is required but was not found in PATH." >&2
    return 1
  fi

  cd "$BACKEND_DIR"

  if [[ ! -x ".venv/bin/python" ]]; then
    echo "[local-dev] Creating backend virtualenv with uv..."
    uv venv .venv
  fi

  if ! .venv/bin/python -c "import fastapi, uvicorn, celery, pydantic_settings" >/dev/null 2>&1; then
    echo "[local-dev] Installing backend dependencies with uv..."
    uv pip install --python .venv/bin/python -r requirements.txt
  fi

  export PATH="$BACKEND_DIR/.venv/bin:$PATH"
}

ensure_frontend_deps() {
  cd "$FRONTEND_DIR"

  if [[ ! -d "node_modules" ]]; then
    echo "[local-dev] Installing frontend dependencies with npm ci..."
    npm ci
  fi
}
