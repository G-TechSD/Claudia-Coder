@echo off
REM ============================================
REM Claudia Coder - All-in-One Docker Run Script
REM ============================================
REM Usage: docker-run.bat [start|stop|restart|logs|status|build]
REM ============================================

setlocal EnableDelayedExpansion

set IMAGE_NAME=claudiacoder/allinone
if not defined IMAGE_TAG set IMAGE_TAG=latest
set CONTAINER_NAME=claudia
set DATA_VOLUME=claudia-data

REM Parse command line argument
set COMMAND=%1
if "%COMMAND%"=="" set COMMAND=start

goto :%COMMAND% 2>nul || goto :unknown

:start
echo.
echo   ============================================================
echo   Claudia Coder - All-in-One Docker Container
echo   ============================================================
echo   Services:
echo     - Claudia Coder    : http://localhost:3000
echo     - Gitea (Git)      : http://localhost:8929
echo     - n8n (Workflows)  : http://localhost:5678
echo     - Whisper (STT)    : http://localhost:8000
echo   ============================================================
echo.

REM Check if Docker is available
docker info >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not running or not installed.
    echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop
    echo and ensure it is running.
    pause
    exit /b 1
)

REM Check if container already exists and is running
docker ps --format "{{.Names}}" | findstr /b /c:"%CONTAINER_NAME%" >nul 2>&1
if not errorlevel 1 (
    echo Container '%CONTAINER_NAME%' is already running.
    goto :show_urls
)

REM Check if container exists but stopped
docker ps -a --format "{{.Names}}" | findstr /b /c:"%CONTAINER_NAME%" >nul 2>&1
if not errorlevel 1 (
    echo Removing stopped container...
    docker rm %CONTAINER_NAME% >nul 2>&1
)

REM Create data volume
docker volume create %DATA_VOLUME% >nul 2>&1

echo Starting Claudia All-in-One container...

REM Generate a random secret if not set
if not defined BETTER_AUTH_SECRET (
    for /f %%i in ('powershell -Command "[guid]::NewGuid().ToString('N')"') do set BETTER_AUTH_SECRET=%%i
)

REM Default credentials
if not defined N8N_BASIC_AUTH_USER set N8N_BASIC_AUTH_USER=admin
if not defined N8N_BASIC_AUTH_PASSWORD set N8N_BASIC_AUTH_PASSWORD=changeme
if not defined POSTGRES_PASSWORD set POSTGRES_PASSWORD=claudia_secure_password

docker run -d ^
    --name %CONTAINER_NAME% ^
    -p 3000:3000 ^
    -p 8929:8929 ^
    -p 5678:5678 ^
    -p 8000:8000 ^
    -v %DATA_VOLUME%:/data ^
    -e "ANTHROPIC_API_KEY=%ANTHROPIC_API_KEY%" ^
    -e "BETTER_AUTH_SECRET=%BETTER_AUTH_SECRET%" ^
    -e "N8N_BASIC_AUTH_USER=%N8N_BASIC_AUTH_USER%" ^
    -e "N8N_BASIC_AUTH_PASSWORD=%N8N_BASIC_AUTH_PASSWORD%" ^
    -e "POSTGRES_PASSWORD=%POSTGRES_PASSWORD%" ^
    --restart unless-stopped ^
    %IMAGE_NAME%:%IMAGE_TAG%

if errorlevel 1 (
    echo ERROR: Failed to start container.
    echo Make sure the image exists. Run: docker-run.bat build
    pause
    exit /b 1
)

echo.
echo Container started successfully!
echo.
echo NOTE: Services may take 1-2 minutes to fully initialize.
echo.

:show_urls
echo ============================================================
echo Access your services at:
echo   Claudia Coder : http://localhost:3000
echo   Gitea         : http://localhost:8929
echo   n8n           : http://localhost:5678
echo   Whisper API   : http://localhost:8000
echo ============================================================
goto :eof

:stop
echo Stopping Claudia container...
docker ps --format "{{.Names}}" | findstr /b /c:"%CONTAINER_NAME%" >nul 2>&1
if errorlevel 1 (
    echo Container is not running.
    goto :eof
)
docker stop %CONTAINER_NAME%
echo Container stopped.
goto :eof

:restart
call :stop
timeout /t 2 /nobreak >nul
call :start
goto :eof

:logs
docker ps -a --format "{{.Names}}" | findstr /b /c:"%CONTAINER_NAME%" >nul 2>&1
if errorlevel 1 (
    echo Container '%CONTAINER_NAME%' does not exist.
    exit /b 1
)
docker logs -f %CONTAINER_NAME%
goto :eof

:status
echo.
echo === Claudia Container Status ===
echo.

docker ps --format "{{.Names}}" | findstr /b /c:"%CONTAINER_NAME%" >nul 2>&1
if not errorlevel 1 (
    echo Container: RUNNING
    echo.
    docker ps --filter "name=%CONTAINER_NAME%" --format "table {{.Status}}\t{{.Ports}}"
    echo.
    echo Checking service health...
    echo.

    curl -sf http://localhost:3000/api/health >nul 2>&1
    if not errorlevel 1 (
        echo   Claudia Coder: Healthy
    ) else (
        echo   Claudia Coder: Starting...
    )

    curl -sf http://localhost:8929/ >nul 2>&1
    if not errorlevel 1 (
        echo   Gitea: Healthy
    ) else (
        echo   Gitea: Starting...
    )

    curl -sf http://localhost:5678/healthz >nul 2>&1
    if not errorlevel 1 (
        echo   n8n: Healthy
    ) else (
        echo   n8n: Starting...
    )

    curl -sf http://localhost:8000/health >nul 2>&1
    if not errorlevel 1 (
        echo   Whisper: Healthy
    ) else (
        echo   Whisper: Starting...
    )
) else (
    docker ps -a --format "{{.Names}}" | findstr /b /c:"%CONTAINER_NAME%" >nul 2>&1
    if not errorlevel 1 (
        echo Container: STOPPED
    ) else (
        echo Container: NOT FOUND
    )
)
goto :eof

:build
echo Building Claudia All-in-One image...
echo.

REM Get the directory where this script is located
set SCRIPT_DIR=%~dp0
REM Navigate to project root (3 levels up)
pushd %SCRIPT_DIR%..\..

echo Building from: %CD%

docker build -t %IMAGE_NAME%:%IMAGE_TAG% -f "%SCRIPT_DIR%Dockerfile.allinone" .

if errorlevel 1 (
    echo.
    echo ERROR: Build failed.
    popd
    pause
    exit /b 1
)

popd

echo.
echo Build complete!
echo Run 'docker-run.bat start' to start the container.
goto :eof

:remove
echo Removing Claudia container...
docker ps --format "{{.Names}}" | findstr /b /c:"%CONTAINER_NAME%" >nul 2>&1
if not errorlevel 1 (
    docker stop %CONTAINER_NAME%
)
docker ps -a --format "{{.Names}}" | findstr /b /c:"%CONTAINER_NAME%" >nul 2>&1
if not errorlevel 1 (
    docker rm %CONTAINER_NAME%
    echo Container removed.
) else (
    echo Container does not exist.
)
goto :eof

:clean
echo.
echo WARNING: This will remove the container AND all data!
echo.
set /p CONFIRM="Are you sure? (y/N): "
if /i not "%CONFIRM%"=="y" (
    echo Cancelled.
    goto :eof
)

call :remove
echo Removing data volume...
docker volume rm %DATA_VOLUME% >nul 2>&1
echo Cleanup complete.
goto :eof

:help
echo.
echo Claudia Coder - All-in-One Docker Management Script
echo.
echo Usage: %~nx0 [command]
echo.
echo Commands:
echo   start     Start the Claudia container
echo   stop      Stop the Claudia container
echo   restart   Restart the Claudia container
echo   logs      Show container logs (follow mode)
echo   status    Show container and service status
echo   build     Build the Docker image locally
echo   remove    Remove the container (keeps data)
echo   clean     Remove container AND all data
echo   help      Show this help message
echo.
echo Environment Variables:
echo   IMAGE_TAG               Docker image tag (default: latest)
echo   ANTHROPIC_API_KEY       Anthropic API key for AI features
echo   N8N_BASIC_AUTH_USER     n8n admin username (default: admin)
echo   N8N_BASIC_AUTH_PASSWORD n8n admin password (default: changeme)
echo.
goto :eof

:unknown
echo Unknown command: %COMMAND%
echo.
call :help
exit /b 1
