#!/usr/bin/env bash
# Generate synthetic FHIR R4 patient data using Synthea.
# Downloads the Synthea JAR if not present, then generates test patients.
# Output: tests/fixtures/synthea/
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SYNTHEA_VERSION="3.3.0"
SYNTHEA_JAR="${ROOT_DIR}/tmp/synthea-with-dependencies.jar"
SYNTHEA_JAR_URL="https://github.com/synthetichealth/synthea/releases/download/v${SYNTHEA_VERSION}/synthea-with-dependencies.jar"
OUTPUT_DIR="${SYNTHEA_OUTPUT_DIR:-${ROOT_DIR}/tests/fixtures/synthea}"
PATIENT_COUNT="${SYNTHEA_PATIENT_COUNT:-10}"

# ── Colors ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log_info()  { echo -e "${GREEN}[synthea]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
log_error() { echo -e "${RED}[error]${NC} $*" >&2; }

# ── Check prerequisites ───────────────────────────────────────────────────────
if ! command -v java &>/dev/null; then
  log_error "Java is required to run Synthea. Please install JDK 17+."
  exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' | cut -d. -f1)
if [[ "${JAVA_VERSION}" -lt 17 ]]; then
  log_error "Java 17+ required for Synthea. Found: Java ${JAVA_VERSION}"
  exit 1
fi

# ── Create directories ────────────────────────────────────────────────────────
mkdir -p "${ROOT_DIR}/tmp"
mkdir -p "${OUTPUT_DIR}"

# ── Download Synthea JAR ──────────────────────────────────────────────────────
if [[ ! -f "${SYNTHEA_JAR}" ]]; then
  log_info "Downloading Synthea v${SYNTHEA_VERSION}..."
  if command -v curl &>/dev/null; then
    curl -L -o "${SYNTHEA_JAR}" "${SYNTHEA_JAR_URL}"
  elif command -v wget &>/dev/null; then
    wget -O "${SYNTHEA_JAR}" "${SYNTHEA_JAR_URL}"
  else
    log_error "curl or wget required to download Synthea JAR."
    exit 1
  fi
  log_info "Synthea JAR downloaded: ${SYNTHEA_JAR}"
else
  log_info "Using existing Synthea JAR: ${SYNTHEA_JAR}"
fi

# ── Generate patients ─────────────────────────────────────────────────────────
log_info "Generating ${PATIENT_COUNT} synthetic patients (FHIR R4)..."
log_info "Output directory: ${OUTPUT_DIR}"

# Run Synthea: generate FHIR R4 bundles
java -jar "${SYNTHEA_JAR}" \
  --exporter.fhir.export true \
  --exporter.fhir_r4.export true \
  --exporter.baseDirectory "${OUTPUT_DIR}" \
  --exporter.years_of_history 5 \
  -p "${PATIENT_COUNT}" \
  2>&1 | grep -E "(Generated|Error|Warning|patients)" || true

# ── Verify output ─────────────────────────────────────────────────────────────
FHIR_COUNT=$(find "${OUTPUT_DIR}/fhir" -name "*.json" 2>/dev/null | wc -l | tr -d ' ')

if [[ "${FHIR_COUNT}" -gt 0 ]]; then
  log_info "Successfully generated ${FHIR_COUNT} FHIR bundle files."
  log_info "Files saved to: ${OUTPUT_DIR}/fhir/"
else
  log_warn "No FHIR files found in output. Check Synthea output above."
fi

log_info "Synthea data generation complete."
