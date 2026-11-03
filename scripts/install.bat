@echo off
setlocal

:: ============================================================================
:: Cross-Platform Installer (Windows)
:: Note: Change NPM_PACKAGE_NAME below when final npm package name is decided,
:: or pass custom package name as the first argument: scripts\install.bat <pkg>
:: ============================================================================
set "NPM_PACKAGE_NAME=@loviusc/refactor-analyze"
if not "%~1"=="" if not "%~1"=="--local" set "NPM_PACKAGE_NAME=%~1"
set "CLI_NAME=refactor-analyze"

echo ==================================================
echo  Installing %CLI_NAME% (%NPM_PACKAGE_NAME%)
echo  OS: Windows
echo ==================================================

:: 1. Check if Node.js and npm are installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo [ERROR] Node.js is not installed. Please install Node.js ^(^>= 18^) first: https://nodejs.org/
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

:: 2. Install globally or via local npm link
set "SCRIPT_DIR=%~dp0"
set "REPO_ROOT=%SCRIPT_DIR%.."

if "%~1"=="--local" goto :local_install
if "%~2"=="--local" goto :local_install

echo [INFO] Installing %NPM_PACKAGE_NAME% globally via npm...
call npm install -g "%NPM_PACKAGE_NAME%"
if %ERRORLEVEL% neq 0 (
  if exist "%REPO_ROOT%\package.json" (
    echo [WARN] Remote package %NPM_PACKAGE_NAME% not yet published or unreachable. Falling back to local npm link...
    goto :local_install
  ) else (
    echo [ERROR] Failed to install %NPM_PACKAGE_NAME%.
    exit /b 1
  )
)
goto :verify

:local_install
echo [INFO] Installing from local repository via npm link...
pushd "%REPO_ROOT%"
call npm link
popd

:verify
where %CLI_NAME% >nul 2>nul
if %ERRORLEVEL% equ 0 (
  echo [SUCCESS] %CLI_NAME% installed successfully!
  call %CLI_NAME% --version
) else (
  echo [WARN] %CLI_NAME% was installed, but may not be in your Windows PATH.
  echo        Run "npm prefix -g" and add that directory to your user Path environment variable.
)

endlocal
