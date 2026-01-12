@echo off
setlocal enabledelayedexpansion

:: =============================================================================
:: Claudia Coder Installer Builder
:: =============================================================================
:: This script builds ClaudiaCoderSetup.exe using NSIS
::
:: Usage:
::   build-installer.bat           - Build the installer
::   build-installer.bat --clean   - Clean build artifacts
::   build-installer.bat --help    - Show help
:: =============================================================================

title Claudia Coder - Build Installer

set "SCRIPT_DIR=%~dp0"
set "NSIS_SCRIPT=%SCRIPT_DIR%ClaudiaInstaller.nsi"
set "OUTPUT_FILE=%SCRIPT_DIR%ClaudiaCoderSetup.exe"
set "NSIS_VERSION=3.09"
set "NSIS_DOWNLOAD_URL=https://sourceforge.net/projects/nsis/files/NSIS%%203/%NSIS_VERSION%/nsis-%NSIS_VERSION%-setup.exe/download"

echo.
echo ============================================================
echo          CLAUDIA CODER INSTALLER BUILDER
echo ============================================================
echo.

:: Parse arguments
if "%1"=="--help" goto :show_help
if "%1"=="-h" goto :show_help
if "%1"=="--clean" goto :clean

:: Check for NSIS script
if not exist "%NSIS_SCRIPT%" (
    echo [ERROR] NSIS script not found: %NSIS_SCRIPT%
    echo.
    echo Please ensure ClaudiaInstaller.nsi is in the same directory.
    goto :error
)

:: Check for required files
echo [1/5] Checking required files...
set "MISSING_FILES="
for %%f in (docker-compose.yml config.json .env.template README.md install.bat install-claudia.ps1 start-claudia.bat stop-claudia.bat status.bat uninstall.bat LICENSE.txt) do (
    if not exist "%SCRIPT_DIR%%%f" (
        set "MISSING_FILES=!MISSING_FILES! %%f"
    )
)

if not "!MISSING_FILES!"=="" (
    echo [ERROR] Missing required files:!MISSING_FILES!
    echo.
    echo Please ensure all required files are present before building.
    goto :error
)
echo       All required files present.

:: Check for NSIS
echo.
echo [2/5] Checking for NSIS compiler...
set "NSIS_PATH="

:: Store program files paths (avoid parentheses issues in IF statements)
set "PF86=%ProgramFiles(x86)%"
set "PF=%ProgramFiles%"

:: Check common installation paths
if exist "%PF86%\NSIS\makensis.exe" set "NSIS_PATH=%PF86%\NSIS\makensis.exe"
if "!NSIS_PATH!"=="" if exist "%PF%\NSIS\makensis.exe" set "NSIS_PATH=%PF%\NSIS\makensis.exe"

:: Check PATH if not found
if "!NSIS_PATH!"=="" (
    where makensis.exe >nul 2>&1
    if !errorlevel! equ 0 (
        for /f "tokens=*" %%i in ('where makensis.exe') do set "NSIS_PATH=%%i"
    )
)

if "!NSIS_PATH!"=="" (
    echo [WARNING] NSIS compiler not found.
    echo.
    echo NSIS (Nullsoft Scriptable Install System) is required to build the installer.
    echo.
    echo Options:
    echo   1. Install NSIS manually from: https://nsis.sourceforge.io/Download
    echo   2. Use winget: winget install NSIS.NSIS
    echo   3. Use chocolatey: choco install nsis
    echo.

    :: Check if winget is available
    where winget.exe >nul 2>&1
    if !errorLevel! equ 0 (
        echo.
        set /p "INSTALL_NSIS=Install NSIS using winget? (Y/n): "
        if /i not "!INSTALL_NSIS!"=="n" (
            echo.
            echo Installing NSIS via winget...
            winget install NSIS.NSIS --accept-source-agreements --accept-package-agreements

            :: Refresh PATH and check again
            set "PATH=%PATH%;%PF86%\NSIS;%PF%\NSIS"

            if exist "%PF86%\NSIS\makensis.exe" set "NSIS_PATH=%PF86%\NSIS\makensis.exe"
            if "!NSIS_PATH!"=="" if exist "%PF%\NSIS\makensis.exe" set "NSIS_PATH=%PF%\NSIS\makensis.exe"

            if "!NSIS_PATH!"=="" (
                echo.
                echo [WARNING] NSIS was installed but may require a new terminal.
                echo Please close this window and run build-installer.bat again.
                goto :error
            )
        ) else (
            goto :error
        )
    ) else (
        :: Try chocolatey
        where choco.exe >nul 2>&1
        if !errorLevel! equ 0 (
            echo.
            set /p "INSTALL_NSIS=Install NSIS using chocolatey? (Y/n): "
            if /i not "!INSTALL_NSIS!"=="n" (
                echo.
                echo Installing NSIS via chocolatey...
                choco install nsis -y

                set "PATH=%PATH%;%PF86%\NSIS;%PF%\NSIS"

                if exist "%PF86%\NSIS\makensis.exe" set "NSIS_PATH=%PF86%\NSIS\makensis.exe"
                if "!NSIS_PATH!"=="" if exist "%PF%\NSIS\makensis.exe" set "NSIS_PATH=%PF%\NSIS\makensis.exe"

                if "!NSIS_PATH!"=="" (
                    echo.
                    echo [WARNING] NSIS was installed but may require a new terminal.
                    goto :error
                )
            ) else (
                goto :error
            )
        ) else (
            echo.
            echo Neither winget nor chocolatey is available for automatic installation.
            echo Please install NSIS manually from: https://nsis.sourceforge.io/Download
            goto :error
        )
    )
)

echo       Found NSIS: !NSIS_PATH!

:: Check NSIS version
echo.
echo [3/5] Checking NSIS version...
for /f "tokens=*" %%i in ('"!NSIS_PATH!" /VERSION 2^>^&1') do set "NSIS_VER=%%i"
echo       NSIS version: !NSIS_VER!

:: Install required NSIS plugins
echo.
echo [4/5] Checking NSIS plugins...

:: Check for EnVar plugin (for PATH manipulation)
set "NSIS_PLUGINS=%PF86%\NSIS\Plugins"
if not exist "!NSIS_PLUGINS!\x86-unicode\EnVar.dll" (
    echo [INFO] EnVar plugin not found - PATH modification may not work
    echo        Download from: https://nsis.sourceforge.io/EnVar_plug-in
)

:: Build the installer
echo.
echo [5/5] Building installer...
echo.
echo       Compiling: %NSIS_SCRIPT%
echo       Output:    %OUTPUT_FILE%
echo.
echo ------------------------------------------------------------

cd /d "%SCRIPT_DIR%"

"!NSIS_PATH!" "%NSIS_SCRIPT%"

if %errorLevel% neq 0 (
    echo.
    echo ------------------------------------------------------------
    echo [ERROR] NSIS compilation failed with exit code: %errorLevel%
    echo.
    echo Common issues:
    echo   - Missing NSIS plugins (check errors above)
    echo   - Syntax errors in .nsi script
    echo   - Missing referenced files
    echo.
    goto :error
)

:: Verify output
if not exist "%OUTPUT_FILE%" (
    echo.
    echo [ERROR] Build appeared to succeed but output file not found:
    echo        %OUTPUT_FILE%
    goto :error
)

:: Get file size
for %%f in ("%OUTPUT_FILE%") do set "FILE_SIZE=%%~zf"
set /a FILE_SIZE_KB=%FILE_SIZE% / 1024
set /a FILE_SIZE_MB=%FILE_SIZE% / 1048576

echo.
echo ------------------------------------------------------------
echo.
echo ============================================================
echo              BUILD COMPLETED SUCCESSFULLY
echo ============================================================
echo.
echo Installer created: %OUTPUT_FILE%
echo File size: %FILE_SIZE_KB% KB (%FILE_SIZE_MB% MB)
echo.
echo Distribution checklist:
echo   [X] Single-file .exe installer
echo   [X] No external dependencies
echo   [X] Ready for distribution
echo.
echo To test the installer:
echo   1. Run ClaudiaCoderSetup.exe as Administrator
echo   2. Follow the installation wizard
echo   3. Start Claudia Coder from the desktop shortcut
echo.
goto :end

:show_help
echo Usage: build-installer.bat [OPTIONS]
echo.
echo Options:
echo   --help, -h     Show this help message
echo   --clean        Remove build artifacts
echo.
echo This script builds ClaudiaCoderSetup.exe using NSIS.
echo NSIS will be automatically installed if not present.
echo.
echo Required files:
echo   - ClaudiaInstaller.nsi (NSIS script)
echo   - docker-compose.yml
echo   - config.json
echo   - .env.template
echo   - README.md
echo   - LICENSE.txt
echo   - install.bat
echo   - install-claudia.ps1
echo   - start-claudia.bat
echo   - stop-claudia.bat
echo   - status.bat
echo   - uninstall.bat
echo.
goto :end

:clean
echo Cleaning build artifacts...
if exist "%OUTPUT_FILE%" (
    del /f "%OUTPUT_FILE%"
    echo   Deleted: ClaudiaCoderSetup.exe
)
if exist "%SCRIPT_DIR%*.log" (
    del /f "%SCRIPT_DIR%*.log"
    echo   Deleted: *.log files
)
echo Done.
goto :end

:error
echo.
echo Build failed.
echo.
pause
exit /b 1

:end
echo.
if "%1"=="" (
    pause
)
endlocal
exit /b 0
