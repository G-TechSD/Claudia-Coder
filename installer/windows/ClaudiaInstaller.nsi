; =============================================================================
; Claudia Coder Windows Installer - NSIS Script
; =============================================================================
; Professional installer with full Windows integration
;
; Build with: makensis ClaudiaInstaller.nsi
; Output: ClaudiaCoderSetup.exe
; =============================================================================

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "WinVer.nsh"

; =============================================================================
; Installer Configuration
; =============================================================================
!define PRODUCT_NAME "Claudia Coder"
!define PRODUCT_VERSION "1.0.0"
!define PRODUCT_PUBLISHER "Claudia Coder Team"
!define PRODUCT_WEB_SITE "https://github.com/claudia-coder/claudia-coder"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\ClaudiaCoder"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKLM"
!define INSTALL_DIR "$PROGRAMFILES64\ClaudiaCoder"

; Installer output
Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "ClaudiaCoderSetup.exe"
InstallDir "${INSTALL_DIR}"
InstallDirRegKey HKLM "${PRODUCT_DIR_REGKEY}" ""
ShowInstDetails show
ShowUnInstDetails show
RequestExecutionLevel admin

; Compression
SetCompressor /SOLID lzma
SetCompressorDictSize 64

; =============================================================================
; Modern UI Configuration
; =============================================================================
!define MUI_ABORTWARNING
!define MUI_UNABORTWARNING

; Branding Colors and Icon
!define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
!define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall.ico"

; Header Image (150x57 pixels)
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
; !define MUI_HEADERIMAGE_BITMAP "header.bmp"

; Welcome/Finish Page Image (164x314 pixels)
!define MUI_WELCOMEFINISHPAGE_BITMAP "${NSISDIR}\Contrib\Graphics\Wizard\win.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "${NSISDIR}\Contrib\Graphics\Wizard\win.bmp"

; =============================================================================
; Installer Pages
; =============================================================================

; Welcome Page
!define MUI_WELCOMEPAGE_TITLE "Welcome to ${PRODUCT_NAME} Setup"
!define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through the installation of ${PRODUCT_NAME}.$\r$\n$\r$\n${PRODUCT_NAME} is a complete local AI development environment that includes:$\r$\n$\r$\n  - AI-powered coding assistant$\r$\n  - GitLab CE for source control$\r$\n  - n8n for workflow automation$\r$\n  - Whisper for speech-to-text$\r$\n$\r$\nClick Next to continue."
!insertmacro MUI_PAGE_WELCOME

; License Page
!define MUI_LICENSEPAGE_CHECKBOX
!insertmacro MUI_PAGE_LICENSE "LICENSE.txt"

; Components Page
!insertmacro MUI_PAGE_COMPONENTS

; Directory Page
!define MUI_DIRECTORYPAGE_TEXT_TOP "Setup will install ${PRODUCT_NAME} in the following folder.$\r$\n$\r$\nTo install in a different folder, click Browse and select another folder."
!insertmacro MUI_PAGE_DIRECTORY

; Installation Page
!insertmacro MUI_PAGE_INSTFILES

; Finish Page
!define MUI_FINISHPAGE_TITLE "Installation Complete"
!define MUI_FINISHPAGE_TEXT "${PRODUCT_NAME} has been installed on your computer.$\r$\n$\r$\nClick Finish to close this wizard."
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "Start Claudia Coder Services"
!define MUI_FINISHPAGE_RUN_FUNCTION "LaunchApplication"
!define MUI_FINISHPAGE_SHOWREADME "$INSTDIR\README.md"
!define MUI_FINISHPAGE_SHOWREADME_TEXT "View README"
!define MUI_FINISHPAGE_LINK "Visit Claudia Coder Website"
!define MUI_FINISHPAGE_LINK_LOCATION "${PRODUCT_WEB_SITE}"
!insertmacro MUI_PAGE_FINISH

; Uninstaller Pages
!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; =============================================================================
; Languages
; =============================================================================
!insertmacro MUI_LANGUAGE "English"

; =============================================================================
; Version Information
; =============================================================================
VIProductVersion "${PRODUCT_VERSION}.0"
VIAddVersionKey /LANG=${LANG_ENGLISH} "ProductName" "${PRODUCT_NAME}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "ProductVersion" "${PRODUCT_VERSION}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "CompanyName" "${PRODUCT_PUBLISHER}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "FileDescription" "${PRODUCT_NAME} Installer"
VIAddVersionKey /LANG=${LANG_ENGLISH} "FileVersion" "${PRODUCT_VERSION}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "LegalCopyright" "Copyright (c) 2024 ${PRODUCT_PUBLISHER}"

; =============================================================================
; Installer Sections
; =============================================================================

Section "!Core Application (Required)" SEC_CORE
    SectionIn RO  ; Read-only, always installed

    SetOutPath "$INSTDIR"
    SetOverwrite on

    ; Create directories
    CreateDirectory "$INSTDIR\config"
    CreateDirectory "$INSTDIR\data"
    CreateDirectory "$INSTDIR\logs"
    CreateDirectory "$INSTDIR\scripts"

    ; Install main files
    File "docker-compose.yml"
    File "config.json"
    File ".env.template"
    File "README.md"

    ; Install batch scripts
    File "install.bat"
    File "install-claudia.ps1"
    File "start-claudia.bat"
    File "stop-claudia.bat"
    File "status.bat"
    File "uninstall.bat"

    ; Copy .env.template to .env if .env doesn't exist
    IfFileExists "$INSTDIR\.env" +2 0
        CopyFiles "$INSTDIR\.env.template" "$INSTDIR\.env"

    ; Create version file
    FileOpen $0 "$INSTDIR\version.txt" w
    FileWrite $0 "${PRODUCT_VERSION}"
    FileClose $0

    ; Write installation info to registry
    WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR"
    WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "Path" "$INSTDIR"

SectionEnd

Section "Desktop Shortcuts" SEC_DESKTOP
    SetOutPath "$INSTDIR"

    ; Create desktop shortcuts
    CreateShortCut "$DESKTOP\Claudia Coder.lnk" "$INSTDIR\start-claudia.bat" "" \
        "$SYSDIR\shell32.dll" 137 SW_SHOWNORMAL "" "Start Claudia Coder"

    CreateShortCut "$DESKTOP\Stop Claudia.lnk" "$INSTDIR\stop-claudia.bat" "" \
        "$SYSDIR\shell32.dll" 27 SW_SHOWNORMAL "" "Stop Claudia Services"

SectionEnd

Section "Start Menu Shortcuts" SEC_STARTMENU
    SetOutPath "$INSTDIR"

    ; Create Start Menu folder
    CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"

    ; Application shortcuts
    CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\Start Claudia Coder.lnk" \
        "$INSTDIR\start-claudia.bat" "" "$SYSDIR\shell32.dll" 137

    CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\Stop Claudia Coder.lnk" \
        "$INSTDIR\stop-claudia.bat" "" "$SYSDIR\shell32.dll" 27

    CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\Service Status.lnk" \
        "$INSTDIR\status.bat" "" "$SYSDIR\shell32.dll" 166

    ; URL shortcuts
    WriteINIStr "$SMPROGRAMS\${PRODUCT_NAME}\Claudia Web Interface.url" \
        "InternetShortcut" "URL" "http://localhost:3000"

    WriteINIStr "$SMPROGRAMS\${PRODUCT_NAME}\GitLab.url" \
        "InternetShortcut" "URL" "http://localhost:8929"

    WriteINIStr "$SMPROGRAMS\${PRODUCT_NAME}\n8n Workflows.url" \
        "InternetShortcut" "URL" "http://localhost:5678"

    ; Documentation
    CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\README.lnk" \
        "$INSTDIR\README.md" "" "$SYSDIR\shell32.dll" 70

    ; Uninstaller
    CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\Uninstall.lnk" \
        "$INSTDIR\Uninstall.exe" "" "$SYSDIR\shell32.dll" 32

SectionEnd

Section "Add to PATH" SEC_PATH
    ; Add install directory to system PATH
    EnVar::SetHKLM
    EnVar::AddValue "PATH" "$INSTDIR"

SectionEnd

; =============================================================================
; Uninstaller Section
; =============================================================================

Section "Uninstall"
    ; Stop services first
    SetOutPath "$INSTDIR"
    nsExec::ExecToLog '"$INSTDIR\stop-claudia.bat"'

    ; Remove registry entries
    DeleteRegKey HKLM "${PRODUCT_UNINST_KEY}"
    DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"

    ; Remove from PATH
    EnVar::SetHKLM
    EnVar::DeleteValue "PATH" "$INSTDIR"

    ; Remove Start Menu shortcuts
    RMDir /r "$SMPROGRAMS\${PRODUCT_NAME}"

    ; Remove Desktop shortcuts
    Delete "$DESKTOP\Claudia Coder.lnk"
    Delete "$DESKTOP\Stop Claudia.lnk"

    ; Remove installation directory
    ; First, ask about data preservation
    MessageBox MB_YESNO|MB_ICONQUESTION \
        "Do you want to remove all Claudia data including configurations?$\r$\n$\r$\nSelect 'No' to keep your data for a future reinstall." \
        IDYES RemoveAll IDNO KeepData

RemoveAll:
    RMDir /r "$INSTDIR\data"
    RMDir /r "$INSTDIR\logs"
    RMDir /r "$INSTDIR\config"

KeepData:
    ; Remove program files
    Delete "$INSTDIR\docker-compose.yml"
    Delete "$INSTDIR\config.json"
    Delete "$INSTDIR\.env.template"
    Delete "$INSTDIR\.env"
    Delete "$INSTDIR\README.md"
    Delete "$INSTDIR\install.bat"
    Delete "$INSTDIR\install-claudia.ps1"
    Delete "$INSTDIR\start-claudia.bat"
    Delete "$INSTDIR\stop-claudia.bat"
    Delete "$INSTDIR\status.bat"
    Delete "$INSTDIR\uninstall.bat"
    Delete "$INSTDIR\version.txt"
    Delete "$INSTDIR\Uninstall.exe"

    RMDir /r "$INSTDIR\scripts"
    RMDir "$INSTDIR"

    ; Ask about Docker volumes
    MessageBox MB_YESNO|MB_ICONQUESTION \
        "Do you want to remove Docker volumes (database, gitlab data, etc)?$\r$\n$\r$\nThis will delete all your project data stored in Docker." \
        IDNO SkipDockerCleanup

    ; Clean up Docker volumes
    nsExec::ExecToLog 'docker volume rm claudia-coder-data claudia-coder-storage claudia-gitlab-config claudia-gitlab-logs claudia-gitlab-data claudia-postgres-data claudia-redis-data claudia-n8n-data claudia-whisper-models'

SkipDockerCleanup:

SectionEnd

; =============================================================================
; Section Descriptions
; =============================================================================
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
    !insertmacro MUI_DESCRIPTION_TEXT ${SEC_CORE} \
        "Core application files including Docker configuration and management scripts. (Required)"
    !insertmacro MUI_DESCRIPTION_TEXT ${SEC_DESKTOP} \
        "Create shortcuts on your desktop for quick access."
    !insertmacro MUI_DESCRIPTION_TEXT ${SEC_STARTMENU} \
        "Create shortcuts in the Start Menu for easy navigation."
    !insertmacro MUI_DESCRIPTION_TEXT ${SEC_PATH} \
        "Add Claudia Coder to system PATH for command-line access."
!insertmacro MUI_FUNCTION_DESCRIPTION_END

; =============================================================================
; Callback Functions
; =============================================================================

Function .onInit
    ; Check for Windows 10 or later
    ${IfNot} ${AtLeastWin10}
        MessageBox MB_OK|MB_ICONSTOP "Windows 10 or later is required."
        Abort
    ${EndIf}

    ; Check for 64-bit Windows
    ${IfNot} ${RunningX64}
        MessageBox MB_OK|MB_ICONSTOP "64-bit Windows is required."
        Abort
    ${EndIf}

    ; Check for admin privileges
    UserInfo::GetAccountType
    Pop $0
    ${If} $0 != "admin"
        MessageBox MB_OK|MB_ICONSTOP "Administrator privileges are required to install ${PRODUCT_NAME}."
        Abort
    ${EndIf}

    ; Check if already installed
    ReadRegStr $0 HKLM "${PRODUCT_DIR_REGKEY}" ""
    ${If} $0 != ""
        MessageBox MB_YESNO|MB_ICONQUESTION \
            "${PRODUCT_NAME} is already installed at:$\r$\n$0$\r$\n$\r$\nDo you want to reinstall?" \
            IDYES ContinueInstall
        Abort
ContinueInstall:
    ${EndIf}

FunctionEnd

Function LaunchApplication
    ; Run start-claudia.bat
    ExecShell "" "$INSTDIR\start-claudia.bat"

    ; Wait a moment then open browser
    Sleep 3000
    ExecShell "open" "http://localhost:3000"
FunctionEnd

Function un.onInit
    MessageBox MB_YESNO|MB_ICONQUESTION \
        "Are you sure you want to uninstall ${PRODUCT_NAME}?" \
        IDYES +2
    Abort
FunctionEnd

; =============================================================================
; Post-Install Actions
; =============================================================================

Section -Post
    ; Create uninstaller
    WriteUninstaller "$INSTDIR\Uninstall.exe"

    ; Add to Windows Add/Remove Programs
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" \
        "DisplayName" "$(^Name)"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" \
        "UninstallString" "$INSTDIR\Uninstall.exe"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" \
        "DisplayIcon" "$INSTDIR\Uninstall.exe"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" \
        "DisplayVersion" "${PRODUCT_VERSION}"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" \
        "URLInfoAbout" "${PRODUCT_WEB_SITE}"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" \
        "Publisher" "${PRODUCT_PUBLISHER}"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" \
        "InstallLocation" "$INSTDIR"

    ; Calculate installed size
    ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
    IntFmt $0 "0x%08X" $0
    WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" \
        "EstimatedSize" "$0"

    ; Check for Docker Desktop
    nsExec::ExecToStack 'docker --version'
    Pop $0
    ${If} $0 != 0
        MessageBox MB_YESNO|MB_ICONQUESTION \
            "Docker Desktop was not detected.$\r$\n$\r$\nDocker is required for Claudia Coder to function.$\r$\n$\r$\nWould you like to download Docker Desktop now?" \
            IDNO SkipDocker
        ExecShell "open" "https://www.docker.com/products/docker-desktop"
SkipDocker:
    ${EndIf}

SectionEnd
