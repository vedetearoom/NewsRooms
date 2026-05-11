#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/local-dev-env.sh"

load_local_dev_env
export ENABLE_SCHEDULER=false

echo "Starting AI Newsroom Celery Worker..."
echo "Using settings file: $AI_NEWSROOM_SETTINGS_FILE"
echo "Tenant root: $NEWSROOM_TENANT_ROOT"

ensure_backend_venv
cd "$BACKEND_DIR"
exec .venv/bin/celery -A app.celery_app worker --loglevel=info --concurrency="${AI_NEWSROOM_CELERY_CONCURRENCY:-2}" -n newsroom@%h
