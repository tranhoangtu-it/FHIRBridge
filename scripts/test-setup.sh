#!/usr/bin/env bash
# FHIRBridge Test/Dev Infrastructure Setup Script
# Usage:
#   ./scripts/test-setup.sh           # dev mode: uses docker-compose.yml + .env
#   ./scripts/test-setup.sh --test    # test mode: uses docker-compose.test.yml + .env.test (ports 5433, 6380)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log_info()  { echo -e "${GREEN}[setup]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
log_error() { echo -e "${RED}[error]${NC} $*" >&2; }

# ── Parse flags ───────────────────────────────────────────────────────────────
TEST_MODE=false
for arg in "$@"; do
  case "$arg" in
    --test) TEST_MODE=true ;;
    *) log_warn "Unknown argument: $arg" ;;
  esac
done

# ── Mode-specific config ──────────────────────────────────────────────────────
if [[ "${TEST_MODE}" == true ]]; then
  ENV_FILE="${ROOT_DIR}/.env.test"
  COMPOSE_FILE="${ROOT_DIR}/docker/docker-compose.test.yml"
  POSTGRES_SERVICE="postgres-test"
  REDIS_SERVICE="redis-test"
  POSTGRES_USER_DEFAULT="fhirbridge_test"
  POSTGRES_DB_DEFAULT="fhirbridge_test"
  POSTGRES_PORT_DEFAULT=5433
  REDIS_PORT_DEFAULT=6380
  log_info "Running in TEST mode (isolated ports: Postgres=5433, Redis=6380)"
else
  ENV_FILE="${ROOT_DIR}/.env"
  COMPOSE_FILE="${ROOT_DIR}/docker/docker-compose.yml"
  POSTGRES_SERVICE="postgres"
  REDIS_SERVICE="redis"
  POSTGRES_USER_DEFAULT="fhirbridge"
  POSTGRES_DB_DEFAULT="fhirbridge_audit"
  POSTGRES_PORT_DEFAULT=5432
  REDIS_PORT_DEFAULT=6379
  log_info "Running in DEV mode (standard ports: Postgres=5432, Redis=6379)"
fi

# ── Check prerequisites ───────────────────────────────────────────────────────
check_command() {
  if ! command -v "$1" &>/dev/null; then
    log_error "Required command '$1' not found. Please install it first."
    exit 1
  fi
}

log_info "Checking prerequisites..."
check_command docker

# ── Environment setup ─────────────────────────────────────────────────────────
if [[ ! -f "${ENV_FILE}" ]]; then
  if [[ "${TEST_MODE}" == true ]]; then
    log_error ".env.test not found. Expected at ${ENV_FILE}"
    exit 1
  else
    log_warn ".env not found. Copying from .env.example..."
    cp "${ROOT_DIR}/.env.example" "${ENV_FILE}"
    log_warn "Please edit .env with your actual values before running services."
  fi
fi

# Load env vars for Docker
set -a
# shellcheck source=/dev/null
source "${ENV_FILE}" 2>/dev/null || true
set +a

# ── Docker services ───────────────────────────────────────────────────────────
log_info "Starting Docker services..."
docker compose -f "${COMPOSE_FILE}" up -d

# ── Wait for Postgres ─────────────────────────────────────────────────────────
log_info "Waiting for Postgres to be ready on port ${POSTGRES_PORT_DEFAULT}..."
MAX_RETRIES=30
RETRY_COUNT=0

until docker compose -f "${COMPOSE_FILE}" exec -T "${POSTGRES_SERVICE}" \
  pg_isready -U "${POSTGRES_USER:-${POSTGRES_USER_DEFAULT}}" \
  -d "${POSTGRES_DB:-${POSTGRES_DB_DEFAULT}}" \
  &>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [[ "${RETRY_COUNT}" -ge "${MAX_RETRIES}" ]]; then
    log_error "Postgres not ready after ${MAX_RETRIES} attempts. Check Docker logs."
    docker compose -f "${COMPOSE_FILE}" logs "${POSTGRES_SERVICE}"
    exit 1
  fi
  sleep 2
done

log_info "Postgres is ready."

# ── Wait for Redis ────────────────────────────────────────────────────────────
log_info "Waiting for Redis to be ready on port ${REDIS_PORT_DEFAULT}..."
RETRY_COUNT=0

until docker compose -f "${COMPOSE_FILE}" exec -T "${REDIS_SERVICE}" \
  redis-cli ping &>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [[ "${RETRY_COUNT}" -ge "${MAX_RETRIES}" ]]; then
    log_error "Redis not ready after ${MAX_RETRIES} attempts. Check Docker logs."
    docker compose -f "${COMPOSE_FILE}" logs "${REDIS_SERVICE}"
    exit 1
  fi
  sleep 2
done

log_info "Redis is ready."

# ── Setup complete ────────────────────────────────────────────────────────────
echo ""
log_info "Infrastructure setup complete!"
echo ""
echo "  Postgres: postgresql://${POSTGRES_USER:-${POSTGRES_USER_DEFAULT}}@localhost:${POSTGRES_PORT:-${POSTGRES_PORT_DEFAULT}}/${POSTGRES_DB:-${POSTGRES_DB_DEFAULT}}"
echo "  Redis:    redis://localhost:${REDIS_PORT:-${REDIS_PORT_DEFAULT}}"
echo ""
if [[ "${TEST_MODE}" == true ]]; then
  echo "  Run 'pnpm test' to execute the test suite."
  echo "  Run './scripts/test-teardown.sh' to stop test infrastructure."
else
  echo "  Run 'pnpm dev' to start all packages in development mode."
  echo "  Run 'pnpm build' to build all packages."
fi
echo ""
