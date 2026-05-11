#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_DEPLOY_DIR="$(cd "$ROOT_DIR/../docker/ai-newsroom" 2>/dev/null && pwd || true)"
DEFAULT_ENV_FILE="$DEFAULT_DEPLOY_DIR/.env"
EXAMPLE_ENV_FILE="$DEFAULT_DEPLOY_DIR/.env.example"

DRY_RUN=0

usage() {
  cat <<'EOF'
Usage:
  ./docker-local.sh local [options]
  ./docker-local.sh archive [options]
  ./docker-local.sh help

Commands:
  local     Build frontend and backend for the current machine architecture.
  archive   Export frontend and backend OCI archives. Default platforms:
            linux/amd64,linux/arm64
  help      Show this help text.

Shared options:
  --frontend-image <ref>  Override frontend image reference.
  --backend-image <ref>   Override backend image reference.
  --hermes-light-image <ref>
                          Override Hermes light sandbox image reference.
  --internal-api-url <u>  Override frontend INTERNAL_API_URL build arg.
  --env-file <file>       Load variables from env file. Default: ../docker/ai-newsroom/.env
                          falls back to ../docker/ai-newsroom/.env.example if missing.
  --deploy-dir <dir>      Deployment directory. Default: ../docker/ai-newsroom
  --dry-run               Print commands without executing them.

Archive options:
  --platform <value>      Target platforms. Default: linux/amd64,linux/arm64
  --output-dir <dir>      Archive output directory. Default: dist/docker

Examples:
  ./docker-local.sh local
  ./docker-local.sh local --hermes-light-image my/light:dev
  ./docker-local.sh archive
  ./docker-local.sh archive --output-dir /tmp/ai-newsroom-images
EOF
}

log() {
  printf '[docker-local] %s\n' "$*"
}

die() {
  printf '[docker-local] ERROR: %s\n' "$*" >&2
  exit 1
}

run_cmd() {
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '[dry-run]'
    printf ' %q' "$@"
    printf '\n'
    return 0
  fi
  "$@"
}

resolve_deploy_dir() {
  local provided="${1:-}"
  if [[ -n "$provided" ]]; then
    printf '%s\n' "$provided"
    return 0
  fi
  if [[ -n "$DEFAULT_DEPLOY_DIR" ]]; then
    printf '%s\n' "$DEFAULT_DEPLOY_DIR"
    return 0
  fi
  die "Unable to resolve default deploy directory. Pass --deploy-dir explicitly."
}

resolve_env_file() {
  local provided="${1:-}"
  if [[ -n "$provided" ]]; then
    printf '%s\n' "$provided"
    return 0
  fi
  if [[ -f "$DEFAULT_ENV_FILE" ]]; then
    printf '%s\n' "$DEFAULT_ENV_FILE"
    return 0
  fi
  printf '%s\n' "$EXAMPLE_ENV_FILE"
}

load_env_file() {
  local env_file="$1"
  if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  fi
}

detect_current_platform() {
  local machine
  machine="$(uname -m)"
  case "$machine" in
    x86_64|amd64)
      printf 'linux/amd64\n'
      ;;
    arm64|aarch64)
      printf 'linux/arm64\n'
      ;;
    *)
      die "Unsupported local architecture: $machine"
      ;;
  esac
}

normalize_platform() {
  local platform="$1"
  if [[ "$platform" == "current" ]]; then
    detect_current_platform
  else
    printf '%s\n' "$platform"
  fi
}

is_multi_platform() {
  local platform="$1"
  [[ "$platform" == *","* ]]
}

safe_platform_slug() {
  local platform="$1"
  local slug="${platform//\//_}"
  slug="${slug//,/__}"
  printf '%s\n' "$slug"
}

build_target_image() {
  local target="$1"
  local platform="$2"
  local mode="$3"
  local env_file="$4"
  local output_dir="$5"
  local internal_api_url="$6"

  load_env_file "$env_file"

  local backend_image="${BACKEND_IMAGE_OVERRIDE:-${AI_NEWSROOM_BACKEND_IMAGE:-ai-newsroom-backend:local}}"
  local frontend_image="${FRONTEND_IMAGE_OVERRIDE:-${AI_NEWSROOM_FRONTEND_IMAGE:-ai-newsroom-frontend:local}}"
  local hermes_light_image="${HERMES_LIGHT_IMAGE_OVERRIDE:-${AI_NEWSROOM_HERMES_SANDBOX_LIGHT_IMAGE:-ai-newsroom-hermes-sandbox-light:local}}"
  local frontend_internal_api="${internal_api_url:-${AI_NEWSROOM_INTERNAL_API_URL:-http://backend:8000}}"
  local node_base_image="${AI_NEWSROOM_NODE_BASE_IMAGE:-docker.m.daocloud.io/library/node:20-bookworm-slim}"
  local python_base_image="${AI_NEWSROOM_PYTHON_BASE_IMAGE:-docker.m.daocloud.io/library/python:3.13-slim}"
  local npm_registry="${AI_NEWSROOM_NPM_REGISTRY:-https://registry.npmmirror.com}"
  local apt_mirror_host="${AI_NEWSROOM_APT_MIRROR_HOST:-mirrors.aliyun.com}"
  local pip_index_url="${AI_NEWSROOM_PIP_INDEX_URL:-https://mirrors.aliyun.com/pypi/simple/}"
  local pip_trusted_host="${AI_NEWSROOM_PIP_TRUSTED_HOST:-mirrors.aliyun.com}"
  local playwright_download_host="${AI_NEWSROOM_PLAYWRIGHT_DOWNLOAD_HOST:-}"
  local playwright_download_connection_timeout="${AI_NEWSROOM_PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT:-120000}"

  local context dockerfile image_ref
  local -a cmd
  local dest

  case "$target" in
    backend)
      context="$ROOT_DIR/backend"
      dockerfile="$ROOT_DIR/backend/Dockerfile"
      image_ref="$backend_image"
      cmd=(
        docker buildx build
        --platform "$platform"
        -f "$dockerfile"
        -t "$image_ref"
        --build-arg "PYTHON_BASE_IMAGE=$python_base_image"
        --build-arg "APT_MIRROR_HOST=$apt_mirror_host"
        --build-arg "PIP_INDEX_URL=$pip_index_url"
        --build-arg "PIP_TRUSTED_HOST=$pip_trusted_host"
        --build-arg "PLAYWRIGHT_DOWNLOAD_HOST=$playwright_download_host"
        --build-arg "PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=$playwright_download_connection_timeout"
        "$context"
      )
      ;;
    frontend)
      context="$ROOT_DIR/frontend"
      dockerfile="$ROOT_DIR/frontend/Dockerfile"
      image_ref="$frontend_image"
      cmd=(
        docker buildx build
        --platform "$platform"
        -f "$dockerfile"
        -t "$image_ref"
        --build-arg "NODE_BASE_IMAGE=$node_base_image"
        --build-arg "NPM_REGISTRY=$npm_registry"
        --build-arg "INTERNAL_API_URL=$frontend_internal_api"
        "$context"
      )
      ;;
    hermes-sandbox-light)
      context="$ROOT_DIR/backend"
      dockerfile="$ROOT_DIR/backend/docker/hermes-sandbox-light.Dockerfile"
      image_ref="$hermes_light_image"
      cmd=(
        docker buildx build
        --platform "$platform"
        -f "$dockerfile"
        -t "$image_ref"
        --build-arg "PYTHON_BASE_IMAGE=$python_base_image"
        --build-arg "APT_MIRROR_HOST=$apt_mirror_host"
        --build-arg "PIP_INDEX_URL=$pip_index_url"
        --build-arg "PIP_TRUSTED_HOST=$pip_trusted_host"
        "$context"
      )
      ;;
    *)
      die "Unknown build target: $target"
      ;;
  esac

  if [[ "$mode" == "local" ]]; then
    if is_multi_platform "$platform"; then
      die "Multi-platform builds cannot be loaded into the local Docker image store. Use the archive command for $platform."
    fi
    cmd+=(--load)
    log "Building $target for $platform into local Docker image store: $image_ref"
    run_cmd "${cmd[@]}"
    return 0
  fi

  mkdir -p "$output_dir"
  dest="$output_dir/${target}-$(safe_platform_slug "$platform").oci.tar"
  cmd+=(--output "type=oci,dest=$dest")
  log "Exporting $target for $platform to OCI archive: $dest"
  run_cmd "${cmd[@]}"
}

local_command() {
  local deploy_dir=""
  local env_file=""
  local internal_api_url=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --frontend-image)
        FRONTEND_IMAGE_OVERRIDE="${2:-}"
        shift 2
        ;;
      --backend-image)
        BACKEND_IMAGE_OVERRIDE="${2:-}"
        shift 2
        ;;
      --hermes-light-image)
        HERMES_LIGHT_IMAGE_OVERRIDE="${2:-}"
        shift 2
        ;;
      --internal-api-url)
        internal_api_url="${2:-}"
        shift 2
        ;;
      --deploy-dir)
        deploy_dir="${2:-}"
        shift 2
        ;;
      --env-file)
        env_file="${2:-}"
        shift 2
        ;;
      --dry-run)
        DRY_RUN=1
        shift
        ;;
      *)
        die "Unknown local option: $1"
        ;;
    esac
  done

  deploy_dir="$(resolve_deploy_dir "$deploy_dir")"
  DEFAULT_ENV_FILE="$deploy_dir/.env"
  EXAMPLE_ENV_FILE="$deploy_dir/.env.example"
  env_file="$(resolve_env_file "$env_file")"
  local platform
  platform="$(detect_current_platform)"

  build_target_image backend "$platform" "local" "$env_file" "$ROOT_DIR/dist/docker" "$internal_api_url"
  build_target_image frontend "$platform" "local" "$env_file" "$ROOT_DIR/dist/docker" "$internal_api_url"
  build_target_image hermes-sandbox-light "$platform" "local" "$env_file" "$ROOT_DIR/dist/docker" "$internal_api_url"
}

archive_command() {
  local platform="linux/amd64,linux/arm64"
  local deploy_dir=""
  local env_file=""
  local output_dir="$ROOT_DIR/dist/docker"
  local internal_api_url=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --platform)
        platform="${2:-}"
        shift 2
        ;;
      --output-dir)
        output_dir="${2:-}"
        shift 2
        ;;
      --frontend-image)
        FRONTEND_IMAGE_OVERRIDE="${2:-}"
        shift 2
        ;;
      --backend-image)
        BACKEND_IMAGE_OVERRIDE="${2:-}"
        shift 2
        ;;
      --hermes-light-image)
        HERMES_LIGHT_IMAGE_OVERRIDE="${2:-}"
        shift 2
        ;;
      --internal-api-url)
        internal_api_url="${2:-}"
        shift 2
        ;;
      --env-file)
        env_file="${2:-}"
        shift 2
        ;;
      --deploy-dir)
        deploy_dir="${2:-}"
        shift 2
        ;;
      --dry-run)
        DRY_RUN=1
        shift
        ;;
      *)
        die "Unknown archive option: $1"
        ;;
    esac
  done

  deploy_dir="$(resolve_deploy_dir "$deploy_dir")"
  DEFAULT_ENV_FILE="$deploy_dir/.env"
  EXAMPLE_ENV_FILE="$deploy_dir/.env.example"
  env_file="$(resolve_env_file "$env_file")"
  platform="$(normalize_platform "$platform")"

  build_target_image backend "$platform" "archive" "$env_file" "$output_dir" "$internal_api_url"
  build_target_image frontend "$platform" "archive" "$env_file" "$output_dir" "$internal_api_url"
  build_target_image hermes-sandbox-light "$platform" "archive" "$env_file" "$output_dir" "$internal_api_url"
}

main() {
  local command="${1:-help}"
  shift || true

  case "$command" in
    local)
      local_command "$@"
      ;;
    archive)
      archive_command "$@"
      ;;
    help|-h|--help)
      usage
      ;;
    *)
      die "Unknown command: $command"
      ;;
  esac
}

main "$@"
