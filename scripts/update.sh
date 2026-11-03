#!/usr/bin/env bash
set -e

# ============================================================================
# Cross-Platform Updater (macOS / Linux)
# Note: Change NPM_PACKAGE_NAME below when final npm package name is decided,
# or pass custom package name as the first argument: ./scripts/update.sh <pkg>
# ============================================================================
NPM_PACKAGE_NAME="${1:-@loviusc/refactor-analyze}"
CLI_NAME="refactor-analyze"

echo "=================================================="
echo " Updating ${CLI_NAME} (${NPM_PACKAGE_NAME})"
echo " OS: $(uname -s)"
echo "=================================================="

# 1. Check if Node.js and npm are installed
if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js is not installed. Please install Node.js (>= 18) first."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[ERROR] npm is not installed. Please install npm before running this script."
  exit 1
fi

echo "[OK] Detected Node.js $(node --version) and npm $(npm --version)"

# 2. Update global package
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "[INFO] Updating ${NPM_PACKAGE_NAME} to latest version..."
if ! npm install -g "${NPM_PACKAGE_NAME}@latest"; then
  if [ -f "${REPO_ROOT}/package.json" ]; then
    echo "[WARN] Remote package ${NPM_PACKAGE_NAME} not yet published or unreachable. Updating from local repository via npm link..."
    cd "${REPO_ROOT}"
    npm link
  else
    echo "[ERROR] Failed to update ${NPM_PACKAGE_NAME}."
    exit 1
  fi
fi

if command -v "${CLI_NAME}" >/dev/null 2>&1; then
  echo "[SUCCESS] ${CLI_NAME} updated successfully! Current version: $(${CLI_NAME} --version)"
  echo "[TIP] To update an existing analysis workspace, run '${CLI_NAME} upgrade' inside that project directory."
fi
