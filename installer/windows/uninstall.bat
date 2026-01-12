@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: Claudia Uninstaller for Windows
:: ============================================================================

title Claudia Uninstaller

echo.
echo ============================================================
echo                   CLAUDIA UNINSTALLER
echo ============================================================
echo.
echo This will remove Claudia from your system.
echo.
echo [WARNING] This action will:
echo   - Stop all running Claudia services
echo   - Remove all Claudia Docker containers
echo   - Optionally remove all data volumes
echo   - Optionally remove the installation directory
echo.
echo ============================================================
echo.

:: Confirm uninstallation
set /p "CONFIRM=Are you sure you want to uninstall Claudia? (yes/no): "
if /i not "!CONFIRM!"=="yes" (
    echo.
    echo Uninstallation cancelled.
    echo.
    goto :end
)

echo.
echo ------------------------------------------------------------
echo                  STEP 1: STOPPING SERVICES
echo ------------------------------------------------------------
echo.

:: Check if Docker is running
docker info >nul 2>&1
if %errorLevel% neq 0 (
    echo [WARNING] Docker is not running. Skipping container cleanup.
    echo.
    goto :remove_files
)

:: Find docker-compose.yml
set "SCRIPT_DIR=%~dp0"
set "COMPOSE_FILE="
set "COMPOSE_DIR="

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
    echo [WARNING] Attempting to stop containers by name...
    echo.
    docker stop claudia-web claudia-api claudia-db 2>nul
    goto :remove_containers
)

:: Get the directory containing docker-compose.yml
for %%i in ("!COMPOSE_FILE!") do set "COMPOSE_DIR=%%~dpi"

echo Stopping services...
cd /d "!COMPOSE_DIR!"
docker-compose down 2>nul

:remove_containers
echo.
echo ------------------------------------------------------------
echo                STEP 2: REMOVING CONTAINERS
echo ------------------------------------------------------------
echo.

echo Removing Claudia containers...
docker rm -f claudia-web claudia-api claudia-db claudia-redis claudia-nginx 2>nul
echo Done.

echo.
echo ------------------------------------------------------------
echo                  STEP 3: DATA VOLUMES
echo ------------------------------------------------------------
echo.
echo [WARNING] Removing volumes will DELETE ALL YOUR DATA including:
echo   - Database contents
echo   - User configurations
echo   - Uploaded files
echo.
set /p "REMOVE_VOLUMES=Remove all data volumes? This cannot be undone! (yes/no): "

if /i "!REMOVE_VOLUMES!"=="yes" (
    echo.
    echo Removing volumes...

    :: Remove via docker-compose if available
    if not "!COMPOSE_DIR!"=="" (
        cd /d "!COMPOSE_DIR!"
        docker-compose down -v 2>nul
    )

    :: Also try to remove by name pattern
    for /f "tokens=*" %%v in ('docker volume ls -q --filter "name=claudia" 2^>nul') do (
        echo   Removing volume: %%v
        docker volume rm %%v 2>nul
    )

    echo Volumes removed.
) else (
    echo Volumes preserved.
)

:remove_files
echo.
echo ------------------------------------------------------------
echo              STEP 4: INSTALLATION DIRECTORY
echo ------------------------------------------------------------
echo.

:: Determine installation directories
set "USER_INSTALL_DIR=%USERPROFILE%\.claudia"
set "SYSTEM_INSTALL_DIR=%PROGRAMDATA%\Claudia"

set "FOUND_INSTALL="
if exist "!USER_INSTALL_DIR!" set "FOUND_INSTALL=!USER_INSTALL_DIR!"
if exist "!SYSTEM_INSTALL_DIR!" set "FOUND_INSTALL=!SYSTEM_INSTALL_DIR!"

if "!FOUND_INSTALL!"=="" (
    echo No installation directory found.
    goto :remove_images
)

echo Found installation at: !FOUND_INSTALL!
echo.
set /p "REMOVE_FILES=Remove installation directory and all files? (yes/no): "

if /i "!REMOVE_FILES!"=="yes" (
    echo.
    echo Removing installation directory...

    if exist "!USER_INSTALL_DIR!" (
        rmdir /s /q "!USER_INSTALL_DIR!" 2>nul
        if exist "!USER_INSTALL_DIR!" (
            echo [WARNING] Could not fully remove !USER_INSTALL_DIR!
            echo [WARNING] Some files may be in use. Please remove manually.
        ) else (
            echo   Removed: !USER_INSTALL_DIR!
        )
    )

    if exist "!SYSTEM_INSTALL_DIR!" (
        rmdir /s /q "!SYSTEM_INSTALL_DIR!" 2>nul
        if exist "!SYSTEM_INSTALL_DIR!" (
            echo [WARNING] Could not fully remove !SYSTEM_INSTALL_DIR!
            echo [WARNING] You may need Administrator privileges.
        ) else (
            echo   Removed: !SYSTEM_INSTALL_DIR!
        )
    )
) else (
    echo Installation directory preserved.
)

:remove_images
echo.
echo ------------------------------------------------------------
echo                 STEP 5: DOCKER IMAGES
echo ------------------------------------------------------------
echo.
set /p "REMOVE_IMAGES=Remove Claudia Docker images to free disk space? (yes/no): "

if /i "!REMOVE_IMAGES!"=="yes" (
    echo.
    echo Removing Docker images...

    for /f "tokens=*" %%i in ('docker images --filter "reference=*claudia*" -q 2^>nul') do (
        echo   Removing image: %%i
        docker rmi %%i 2>nul
    )

    echo Done.
) else (
    echo Docker images preserved.
)

:: Final summary
echo.
echo ============================================================
echo                UNINSTALLATION COMPLETE
echo ============================================================
echo.
echo Claudia has been uninstalled from your system.
echo.
if /i not "!REMOVE_VOLUMES!"=="yes" (
    echo Note: Data volumes were preserved. To remove them manually:
    echo   docker volume ls --filter "name=claudia"
    echo   docker volume rm [volume_name]
    echo.
)
if /i not "!REMOVE_FILES!"=="yes" (
    if not "!FOUND_INSTALL!"=="" (
        echo Note: Installation directory was preserved at:
        echo   !FOUND_INSTALL!
        echo.
    )
)
echo Thank you for trying Claudia!
echo.

:end
echo Press any key to exit...
pause >nul
endlocal
