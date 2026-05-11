#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/local-dev-env.sh"

load_local_dev_env

echo "Starting AI Newsroom Frontend..."
echo "Frontend port: $FRONTEND_PORT"
echo "Backend API URL: $NEXT_PUBLIC_API_URL"

cd "$FRONTEND_DIR"
if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
    # shellcheck disable=SC1090
    source "$HOME/.nvm/nvm.sh"
    nvm use 20 || nvm install 20
fi

ensure_frontend_deps
exec npm run dev -- --hostname 0.0.0.0 --port "$FRONTEND_PORT"
