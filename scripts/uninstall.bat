@echo off
setlocal

:: ============================================================================
:: Cross-Platform Uninstaller (Windows)
:: Note: Change NPM_PACKAGE_NAME below when final npm package name is decided,
:: or pass custom package name as the first argument: scripts\uninstall.bat <pkg>
:: ============================================================================
set "NPM_PACKAGE_NAME=@loviusc/refactor-analyze"
if not "%~1"=="" set "NPM_PACKAGE_NAME=%~1"
set "CLI_NAME=refactor-analyze"

echo ==================================================
echo  Uninstalling %CLI_NAME% (%NPM_PACKAGE_NAME%)
echo  OS: Windows
echo ==================================================

:: 1. Check if npm is installed
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo [ERROR] npm is not installed. Cannot uninstall via npm.
  exit /b 1
)

for /f "delims=" %%v in ('npm --version') do set "NPM_VER=%%v"
echo [OK] Detected npm %NPM_VER%

:: 2. Uninstall global package
echo [INFO] Removing global package %NPM_PACKAGE_NAME%...
call npm uninstall -g "%NPM_PACKAGE_NAME%"

echo [SUCCESS] %NPM_PACKAGE_NAME% has been uninstalled.
endlocal
