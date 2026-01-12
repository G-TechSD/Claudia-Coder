@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: Claudia Service Status Checker for Windows
:: ============================================================================

title Claudia - Service Status

echo.
echo ============================================================
echo                  CLAUDIA SERVICE STATUS
echo ============================================================
echo.

:: Check if Docker is running
echo Checking Docker status...
echo.
docker info >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Docker is not running or not installed.
    echo.
    echo Please ensure Docker Desktop is installed and running.
    echo Download from: https://www.docker.com/products/docker-desktop
    echo.
    goto :end
)
echo Docker: Running
echo.

:: Find docker-compose.yml
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
    echo [WARNING] Could not find docker-compose.yml
    echo [WARNING] Showing all Docker containers instead...
    echo.
    echo ------------------------------------------------------------
    echo                    ALL DOCKER CONTAINERS
    echo ------------------------------------------------------------
    echo.
    docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo.
    goto :urls
)

:: Get the directory containing docker-compose.yml
for %%i in ("!COMPOSE_FILE!") do set "COMPOSE_DIR=%%~dpi"

echo ------------------------------------------------------------
echo                    CONTAINER STATUS
echo ------------------------------------------------------------
echo.
cd /d "!COMPOSE_DIR!"
docker-compose ps

echo.
echo ------------------------------------------------------------
echo                    CONTAINER HEALTH
echo ------------------------------------------------------------
echo.

:: Show detailed status for each service
for /f "tokens=*" %%i in ('docker-compose ps -q 2^>nul') do (
    for /f "tokens=*" %%n in ('docker inspect --format "{{.Name}}: {{.State.Status}}" %%i 2^>nul') do (
        echo %%n
    )
)

:urls
echo.
echo ------------------------------------------------------------
echo                    SERVICE URLS
echo ------------------------------------------------------------
echo.
echo   Web Interface:     http://localhost:3000
echo   API Server:        http://localhost:8080
echo   API Documentation: http://localhost:8080/docs
echo   Health Check:      http://localhost:8080/health
echo.

:: Quick connectivity check
echo ------------------------------------------------------------
echo                  CONNECTIVITY CHECK
echo ------------------------------------------------------------
echo.

:: Check web interface
curl -s -o nul -w "" http://localhost:3000 >nul 2>&1
if %errorLevel% equ 0 (
    echo   Web Interface:     [ACCESSIBLE]
) else (
    echo   Web Interface:     [NOT RESPONDING]
)

:: Check API
curl -s -o nul -w "" http://localhost:8080/health >nul 2>&1
if %errorLevel% equ 0 (
    echo   API Server:        [ACCESSIBLE]
) else (
    echo   API Server:        [NOT RESPONDING]
)

echo.
echo ------------------------------------------------------------
echo                      QUICK ACTIONS
echo ------------------------------------------------------------
echo.
echo   Start services:  start-claudia.bat
echo   Stop services:   stop-claudia.bat
echo   View logs:       docker-compose logs -f
echo   Restart:         stop-claudia.bat then start-claudia.bat
echo.

:end
echo Press any key to exit...
pause >nul
endlocal
