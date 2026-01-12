@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: Claudia One-Click Installer for Windows
:: ============================================================================

title Claudia Installer

:: Colors and formatting
echo.
echo ============================================================
echo                    CLAUDIA INSTALLER
echo ============================================================
echo.

:: Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [WARNING] This installer works best with Administrator privileges.
    echo [WARNING] Some features may not work correctly without elevation.
    echo.
    echo Press any key to continue anyway, or close this window to cancel...
    pause >nul
)

:: Check if PowerShell is available
echo [1/4] Checking for PowerShell...
where powershell >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo [ERROR] PowerShell is not available on this system.
    echo [ERROR] Please install PowerShell and try again.
    echo.
    echo Download PowerShell from: https://aka.ms/powershell
    echo.
    goto :error
)
echo       PowerShell found.

:: Check PowerShell version
echo.
echo [2/4] Checking PowerShell version...
for /f "tokens=*" %%i in ('powershell -Command "$PSVersionTable.PSVersion.Major"') do set PS_VERSION=%%i
if !PS_VERSION! LSS 5 (
    echo.
    echo [ERROR] PowerShell version 5 or higher is required.
    echo [ERROR] Current version: !PS_VERSION!
    echo.
    echo Please update PowerShell and try again.
    goto :error
)
echo       PowerShell version !PS_VERSION! detected.

:: Check if install script exists
echo.
echo [3/4] Locating installation script...
set "SCRIPT_DIR=%~dp0"
set "INSTALL_SCRIPT=%SCRIPT_DIR%install-claudia.ps1"

if not exist "%INSTALL_SCRIPT%" (
    echo.
    echo [ERROR] Installation script not found: %INSTALL_SCRIPT%
    echo [ERROR] Please ensure install-claudia.ps1 is in the same directory.
    echo.
    goto :error
)
echo       Installation script found.

:: Run the PowerShell installer
echo.
echo [4/4] Starting installation...
echo.
echo ============================================================
echo               Running PowerShell Installer
echo ============================================================
echo.

:: Run PowerShell with execution policy bypass
powershell -ExecutionPolicy Bypass -NoProfile -File "%INSTALL_SCRIPT%"

if %errorLevel% neq 0 (
    echo.
    echo ============================================================
    echo                  INSTALLATION FAILED
    echo ============================================================
    echo.
    echo [ERROR] The installation script encountered an error.
    echo [ERROR] Exit code: %errorLevel%
    echo.
    echo Please check the error messages above and try again.
    echo If the problem persists, visit: https://github.com/claudia/support
    echo.
    goto :error
)

:: Success
echo.
echo ============================================================
echo              INSTALLATION COMPLETED SUCCESSFULLY
echo ============================================================
echo.
echo Claudia has been installed on your system.
echo.
echo Next steps:
echo   1. Run 'start-claudia.bat' to start all services
echo   2. Open http://localhost:3000 in your browser
echo   3. Follow the setup wizard to configure Claudia
echo.
echo For help, run 'status.bat' to check service status.
echo.
goto :end

:error
echo.
echo Installation was not completed. Please resolve the issues above.
echo.

:end
echo Press any key to exit...
pause >nul
endlocal
