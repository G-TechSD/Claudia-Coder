@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: Claudia Service Starter for Windows
:: ============================================================================

title Claudia - Starting Services

echo.
echo ============================================================
echo                 STARTING CLAUDIA SERVICES
echo ============================================================
echo.

:: Check if Docker is running
echo [1/4] Checking Docker status...
docker info >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo [ERROR] Docker is not running or not installed.
    echo.
    echo Please ensure Docker Desktop is installed and running.
    echo Download from: https://www.docker.com/products/docker-desktop
    echo.
    goto :error
)
echo       Docker is running.

:: Find docker-compose.yml
echo.
echo [2/4] Locating configuration...
set "SCRIPT_DIR=%~dp0"

:: Try to find docker-compose.yml in common locations
set "COMPOSE_FILE="
if exist "%SCRIPT_DIR%docker-compose.yml" (
    set "COMPOSE_FILE=%SCRIPT_DIR%docker-compose.yml"
) else if exist "%SCRIPT_DIR%..\docker-compose.yml" (
    set "COMPOSE_FILE=%SCRIPT_DIR%..\docker-compose.yml"
) else if exist "%USERPROFILE%\.claudia\docker-compose.yml" (
    set "COMPOSE_FILE=%USERPROFILE%\.claudia\docker-compose.yml"
) else if exist "%PROGRAMDATA%\Claudia\docker-compose.yml" (
    set "COMPOSE_FILE=%PROGRAMDATA%\Claudia\docker-compose.yml"
)

if "!COMPOSE_FILE!"=="" (
    echo.
    echo [ERROR] Could not find docker-compose.yml
    echo [ERROR] Please run install.bat first or specify the install location.
    echo.
    goto :error
)
echo       Found: !COMPOSE_FILE!

:: Get the directory containing docker-compose.yml
for %%i in ("!COMPOSE_FILE!") do set "COMPOSE_DIR=%%~dpi"

:: Start services
echo.
echo [3/4] Starting services...
echo.
cd /d "!COMPOSE_DIR!"
docker-compose up -d

if %errorLevel% neq 0 (
    echo.
    echo [ERROR] Failed to start services.
    echo [ERROR] Please check the error messages above.
    echo.
    goto :error
)

:: Wait for services to be healthy
echo.
echo [4/4] Waiting for services to be healthy...
echo.

set "MAX_ATTEMPTS=30"
set "ATTEMPT=0"

:healthcheck
set /a ATTEMPT+=1
if !ATTEMPT! gtr !MAX_ATTEMPTS! (
    echo.
    echo [WARNING] Services are taking longer than expected to start.
    echo [WARNING] They may still be initializing. Check status with status.bat
    echo.
    goto :open_browser
)

:: Check if all containers are running
docker-compose ps --format "table {{.Name}}\t{{.Status}}" 2>nul | findstr /i "unhealthy starting" >nul
if %errorLevel% equ 0 (
    echo       Waiting for services... (attempt !ATTEMPT!/!MAX_ATTEMPTS!)
    timeout /t 2 /nobreak >nul
    goto :healthcheck
)

echo       All services are running!

:open_browser
echo.
echo ============================================================
echo               CLAUDIA SERVICES STARTED
echo ============================================================
echo.
echo Services are now running:
echo.
echo   Web Interface:  http://localhost:3000
echo   API Server:     http://localhost:8080
echo   Documentation:  http://localhost:3000/docs
echo.

:: Ask to open browser
echo Opening browser to http://localhost:3000 ...
timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"

echo.
echo To stop services, run 'stop-claudia.bat'
echo To check status, run 'status.bat'
echo.
goto :end

:error
echo.
echo Failed to start Claudia services.
echo.

:end
echo Press any key to exit...
pause >nul
endlocal
