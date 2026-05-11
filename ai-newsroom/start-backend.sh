#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/local-dev-env.sh"

load_local_dev_env
export ENABLE_SCHEDULER="${ENABLE_SCHEDULER:-true}"

echo "Starting AI Newsroom Backend..."
echo "Using settings file: $AI_NEWSROOM_SETTINGS_FILE"
echo "Tenant root: $NEWSROOM_TENANT_ROOT"
echo "Backend port: $BACKEND_PORT"
echo "NOTE: Remember to start the background worker in a separate terminal: bash start-celery.sh"

ensure_backend_venv
cd "$BACKEND_DIR"
exec .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" --reload
