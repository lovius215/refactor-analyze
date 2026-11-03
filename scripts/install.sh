#!/usr/bin/env bash
set -e

# ============================================================================
# Cross-Platform Installer (macOS / Linux)
# Note: Change NPM_PACKAGE_NAME below when final npm package name is decided,
# or pass custom package name as the first argument: ./scripts/install.sh <pkg>
# ============================================================================
NPM_PACKAGE_NAME="${1:-@loviusc/refactor-analyze}"
CLI_NAME="refactor-analyze"

echo "=================================================="
echo " Installing ${CLI_NAME} (${NPM_PACKAGE_NAME})"
echo " OS: $(uname -s)"
echo "=================================================="

# 1. Check if Node.js and npm are installed
if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js is not installed. Please install Node.js (>= 18) first: https://nodejs.org/"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[ERROR] npm is not installed. Please install npm before running this script."
  exit 1
fi

echo "[OK] Detected Node.js $(node --version) and npm $(npm --version)"

# 2. Install via local package.json (if inside repository and --local passed) or npm global
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [ "${2}" = "--local" ] || [ "${1}" = "--local" ]; then
  echo "[INFO] Installing from local repository via npm link..."
  cd "${REPO_ROOT}"
  npm link
else
  echo "[INFO] Installing ${NPM_PACKAGE_NAME} globally via npm..."
  if ! npm install -g "${NPM_PACKAGE_NAME}"; then
    if [ -f "${REPO_ROOT}/package.json" ]; then
      echo "[WARN] Remote package ${NPM_PACKAGE_NAME} not yet published or unreachable. Falling back to local npm link..."
      cd "${REPO_ROOT}"
      npm link
    else
      echo "[ERROR] Failed to install ${NPM_PACKAGE_NAME}."
      exit 1
    fi
  fi
fi

# 3. Verify installation
if command -v "${CLI_NAME}" >/dev/null 2>&1; then
  echo "[SUCCESS] ${CLI_NAME} installed successfully! Version: $(${CLI_NAME} --version)"
else
  NPM_GLOBAL_BIN="$(npm prefix -g)/bin"
  echo "[WARN] ${CLI_NAME} was installed, but is not in your PATH."
  echo "       Please add the following to your ~/.zshrc or ~/.bashrc:"
  echo "       export PATH=\"${NPM_GLOBAL_BIN}:\$PATH\""
fi
