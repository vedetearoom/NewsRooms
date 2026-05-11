#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Delegating to repository start-backend.sh..."
exec bash "$REPO_ROOT/start-backend.sh"
