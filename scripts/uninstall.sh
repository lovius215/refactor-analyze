#!/usr/bin/env bash
set -e

# ============================================================================
# Cross-Platform Uninstaller (macOS / Linux)
# Note: Change NPM_PACKAGE_NAME below when final npm package name is decided,
# or pass custom package name as the first argument: ./scripts/uninstall.sh <pkg>
# ============================================================================
NPM_PACKAGE_NAME="${1:-@loviusc/refactor-analyze}"
CLI_NAME="refactor-analyze"

echo "=================================================="
echo " Uninstalling ${CLI_NAME} (${NPM_PACKAGE_NAME})"
echo " OS: $(uname -s)"
echo "=================================================="

# 1. Check if npm is installed
if ! command -v npm >/dev/null 2>&1; then
  echo "[ERROR] npm is not installed. Cannot uninstall via npm."
  exit 1
fi

echo "[OK] Detected npm $(npm --version)"

# 2. Uninstall global package
echo "[INFO] Removing global package ${NPM_PACKAGE_NAME}..."
npm uninstall -g "${NPM_PACKAGE_NAME}" || true

echo "[SUCCESS] ${NPM_PACKAGE_NAME} has been uninstalled."
