@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: Claudia Service Stopper for Windows
:: ============================================================================

title Claudia - Stopping Services

echo.
echo ============================================================
echo                 STOPPING CLAUDIA SERVICES
echo ============================================================
echo.

:: Check if Docker is running
echo [1/2] Checking Docker status...
docker info >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo [WARNING] Docker is not running.
    echo [WARNING] Services may already be stopped.
    echo.
    goto :end
)
echo       Docker is running.

:: Find docker-compose.yml
echo.
echo [2/2] Stopping services...
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
    echo [WARNING] Could not find docker-compose.yml
    echo [WARNING] Attempting to stop containers by name...
    echo.
    docker stop claudia-web claudia-api claudia-db 2>nul
    docker rm claudia-web claudia-api claudia-db 2>nul
    goto :done
)

:: Get the directory containing docker-compose.yml
for %%i in ("!COMPOSE_FILE!") do set "COMPOSE_DIR=%%~dpi"

:: Stop services
echo.
cd /d "!COMPOSE_DIR!"
docker-compose down

if %errorLevel% neq 0 (
    echo.
    echo [WARNING] Some services may not have stopped cleanly.
    echo [WARNING] Check 'docker ps' for any remaining containers.
    echo.
)

:done
echo.
echo ============================================================
echo               CLAUDIA SERVICES STOPPED
echo ============================================================
echo.
echo All Claudia services have been stopped.
echo.
echo To start services again, run 'start-claudia.bat'
echo.
goto :end

:end
echo Press any key to exit...
pause >nul
endlocal
