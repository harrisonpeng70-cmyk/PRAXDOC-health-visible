@echo off
setlocal
cd /d "%~dp0"

if /I "%~1"=="--help" goto :help

set "PORT=18082"
set "CLIENT_ID=C_AUTO_001"
set "TENANT_ID=00000000-0000-0000-0000-000000000001"
set "SCENARIO=full"
set "TSC_JS=node_modules\typescript\bin\tsc"

if not "%~1"=="" set "SCENARIO=%~1"

set "NODE_EXE=node"
where node >nul 2>nul
if errorlevel 1 (
  if exist "D:\Program Files\nodejs\node.exe" (
    set "NODE_EXE=D:\Program Files\nodejs\node.exe"
  ) else (
    echo [ERROR] Node.js not found. Please install Node.js or add it to PATH.
    pause
    exit /b 1
  )
)

if not exist "node_modules" (
  echo [ERROR] node_modules not found. Run npm install first.
  pause
  exit /b 1
)

if not exist "%TSC_JS%" (
  echo [ERROR] TypeScript compiler not found at "%TSC_JS%".
  echo Please run npm install first.
  pause
  exit /b 1
)

set "PREVIEW_URL=http://127.0.0.1:%PORT%/client-workspace-page-v1/index.html?client_id=%CLIENT_ID%^&scenario=%SCENARIO%^&tenant_id=%TENANT_ID%"

echo [Health Visible] Building preview server...
"%NODE_EXE%" "%TSC_JS%" -p tsconfig.json
if errorlevel 1 (
  echo [ERROR] Build failed. Fix the error above and rerun this file.
  pause
  exit /b 1
)

echo.
echo [Health Visible] Starting local preview on port %PORT%
echo [Health Visible] Open this URL in your browser:
echo %PREVIEW_URL%
echo.
echo Tip: default is mock preview. Run with "auto" to use real DB-backed workspace data:
echo   %~nx0 auto
echo.
echo Press Ctrl+C to stop the server.
echo.

"%NODE_EXE%" dist\server.js
exit /b %ERRORLEVEL%

:help
echo Usage: %~nx0 [scenario]
echo.
echo Scenario options:
echo   full        mock full page preview (default)
echo   files_only  mock partial preview
echo   partial     mock partial preview
echo   empty       mock empty preview
echo   error       mock error preview
echo   auto        real DB-backed workspace data
exit /b 0
