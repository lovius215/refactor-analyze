@echo off
setlocal

:: ============================================================================
:: Cross-Platform Updater (Windows)
:: Note: Change NPM_PACKAGE_NAME below when final npm package name is decided,
:: or pass custom package name as the first argument: scripts\update.bat <pkg>
:: ============================================================================
set "NPM_PACKAGE_NAME=@loviusc/refactor-analyze"
if not "%~1"=="" set "NPM_PACKAGE_NAME=%~1"
set "CLI_NAME=refactor-analyze"

echo ==================================================
echo  Updating %CLI_NAME% (%NPM_PACKAGE_NAME%)
echo  OS: Windows
echo ==================================================

:: 1. Check if Node.js and npm are installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo [ERROR] Node.js is not installed. Please install Node.js ^(^>= 18^) first.
  exit /b 1
)

where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo [ERROR] npm is not installed. Please install npm before running this script.
  exit /b 1
)

for /f "delims=" %%v in ('node --version') do set "NODE_VER=%%v"
for /f "delims=" %%v in ('npm --version') do set "NPM_VER=%%v"
echo [OK] Detected Node.js %NODE_VER% and npm %NPM_VER%

:: 2. Update global package
set "SCRIPT_DIR=%~dp0"
set "REPO_ROOT=%SCRIPT_DIR%.."

echo [INFO] Updating %NPM_PACKAGE_NAME% to latest version...
call npm install -g "%NPM_PACKAGE_NAME%@latest"
if %ERRORLEVEL% neq 0 (
  if exist "%REPO_ROOT%\package.json" (
    echo [WARN] Remote package %NPM_PACKAGE_NAME% not yet published or unreachable. Updating from local repository via npm link...
    pushd "%REPO_ROOT%"
    call npm link
    popd
  ) else (
    echo [ERROR] Failed to update %NPM_PACKAGE_NAME%.
    exit /b 1
  )
)

where %CLI_NAME% >nul 2>nul
if %ERRORLEVEL% equ 0 (
  echo [SUCCESS] %CLI_NAME% updated successfully!
  call %CLI_NAME% --version
  echo [TIP] To update an existing analysis workspace, run "%CLI_NAME% upgrade" inside that project directory.
)

endlocal
