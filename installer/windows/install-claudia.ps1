#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Claudia Coder Windows Installer (Offline/Local)
.DESCRIPTION
    Installer for Claudia Coder that works from a locally downloaded repository.
    No internet cloning required - copies files from the downloaded repo to the
    install location (C:\ClaudiaCoder by default).

    Usage:
    1. Download the claudia-admin repository (zip from GitLab or git clone)
    2. Navigate to installer/windows/
    3. Run: .\install-claudia.ps1

    The installer will:
    - Detect the repo root (looks for package.json)
    - Copy the repo to the install directory
    - Install npm dependencies
    - Set up Docker services from local docker-compose.yml
    - Create shortcuts and service scripts
.NOTES
    Version:        1.1.0
    Author:         Claudia Coder Team
    Requires:       Windows 10/11, PowerShell 5.1+, Administrator privileges
    Prerequisites:  Downloaded claudia-admin repository
#>

[CmdletBinding()]
param(
    [string]$InstallDir = "C:\ClaudiaCoder",
    [string]$GitLabDomain = "gitlab.claudia.local",
    [string]$N8nDomain = "n8n.claudia.local",
    [switch]$SkipBrowserOpen,
    [switch]$Uninstall
)

# ============================================================================
# Configuration
# ============================================================================
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"  # Faster downloads

$Script:Config = @{
    Version = "1.1.0"
    InstallDir = $InstallDir
    GitLabDomain = $GitLabDomain
    N8nDomain = $N8nDomain

    # Local repo detection (no remote cloning needed)
    RepoRoot = $null  # Will be detected at runtime

    # Download URLs (only for prerequisites)
    DockerDesktopUrl = "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe"
    RustupUrl = "https://win.rustup.rs/x86_64"
    NodeInstallerUrl = "https://nodejs.org/dist/v20.10.0/node-v20.10.0-x64.msi"

    # Ports
    Ports = @{
        GitLab = 8929
        GitLabSSH = 2224
        N8n = 5678
        Whisper = 9000
        PostgreSQL = 5432
        Redis = 6379
        ClaudiaCoder = 3000
    }

    # Colors for output
    Colors = @{
        Success = "Green"
        Warning = "Yellow"
        Error = "Red"
        Info = "Cyan"
        Step = "Magenta"
    }
}

# ============================================================================
# Logging Functions
# ============================================================================
function Write-Step {
    param([string]$Message)
    Write-Host "`n========================================" -ForegroundColor $Script:Config.Colors.Step
    Write-Host " $Message" -ForegroundColor $Script:Config.Colors.Step
    Write-Host "========================================" -ForegroundColor $Script:Config.Colors.Step
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $Script:Config.Colors.Info
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor $Script:Config.Colors.Success
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor $Script:Config.Colors.Warning
}

function Write-ErrorMsg {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $Script:Config.Colors.Error
}

function Write-Progress-Custom {
    param(
        [string]$Activity,
        [int]$PercentComplete
    )
    $width = 50
    $completed = [math]::Round($width * $PercentComplete / 100)
    $remaining = $width - $completed
    $bar = "[" + ("=" * $completed) + (" " * $remaining) + "]"
    Write-Host "`r$Activity $bar $PercentComplete%" -NoNewline -ForegroundColor $Script:Config.Colors.Info
}

# ============================================================================
# Utility Functions
# ============================================================================
function Test-AdminPrivileges {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-CommandExists {
    param([string]$Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

function Get-InstalledVersion {
    param([string]$Command, [string]$VersionArg = "--version")
    try {
        $version = & $Command $VersionArg 2>&1 | Select-Object -First 1
        return $version
    }
    catch {
        return $null
    }
}

function Add-ToPath {
    param([string]$PathToAdd)
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    if ($currentPath -notlike "*$PathToAdd*") {
        [Environment]::SetEnvironmentVariable("Path", "$currentPath;$PathToAdd", "Machine")
        $env:Path = "$env:Path;$PathToAdd"
        Write-Info "Added $PathToAdd to system PATH"
    }
}

function Test-PortInUse {
    param([int]$Port)
    $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    return $null -ne $connection
}

function Test-WSLEnabled {
    # Check if WSL feature is enabled
    $wslFeature = Get-WindowsOptionalFeature -Online -FeatureName "Microsoft-Windows-Subsystem-Linux" -ErrorAction SilentlyContinue
    $vmFeature = Get-WindowsOptionalFeature -Online -FeatureName "VirtualMachinePlatform" -ErrorAction SilentlyContinue

    if ($wslFeature.State -ne "Enabled" -or $vmFeature.State -ne "Enabled") {
        return $false
    }

    # Check if wsl.exe exists and responds
    if (-not (Test-Path "$env:SystemRoot\System32\wsl.exe")) {
        return $false
    }

    # Try running wsl --status to verify it works
    try {
        $null = wsl --status 2>&1
        return $true
    }
    catch {
        return $false
    }
}

function Enable-WSL2 {
    Write-Step "Checking WSL2"

    if (Test-WSLEnabled) {
        Write-Success "WSL2 is already enabled"
        return $false  # No reboot needed
    }

    Write-Info "Enabling WSL2 (required for Docker)..."

    $rebootRequired = $false

    # Enable Windows Subsystem for Linux
    $wslFeature = Get-WindowsOptionalFeature -Online -FeatureName "Microsoft-Windows-Subsystem-Linux" -ErrorAction SilentlyContinue
    if ($wslFeature.State -ne "Enabled") {
        Write-Info "Enabling Windows Subsystem for Linux..."
        $result = dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart 2>&1
        if ($LASTEXITCODE -eq 3010 -or $result -match "restart") {
            $rebootRequired = $true
        }
    }

    # Enable Virtual Machine Platform
    $vmFeature = Get-WindowsOptionalFeature -Online -FeatureName "VirtualMachinePlatform" -ErrorAction SilentlyContinue
    if ($vmFeature.State -ne "Enabled") {
        Write-Info "Enabling Virtual Machine Platform..."
        $result = dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart 2>&1
        if ($LASTEXITCODE -eq 3010 -or $result -match "restart") {
            $rebootRequired = $true
        }
    }

    # Download and install WSL2 kernel update if needed (only if no reboot required yet)
    if (-not $rebootRequired) {
        $wslUpdateUrl = "https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi"
        $wslUpdatePath = Join-Path $env:TEMP "wsl_update_x64.msi"

        Write-Info "Installing WSL2 kernel update..."
        try {
            if (Download-File -Url $wslUpdateUrl -Destination $wslUpdatePath) {
                $process = Start-Process -FilePath "msiexec.exe" -ArgumentList "/i", $wslUpdatePath, "/quiet", "/norestart" -Wait -PassThru
                Remove-Item $wslUpdatePath -Force -ErrorAction SilentlyContinue
            }
        }
        catch {
            Write-Warning "WSL2 kernel update download failed, will be installed on next run"
        }

        # Set WSL2 as default version
        Write-Info "Setting WSL2 as default version..."
        wsl --set-default-version 2 2>&1 | Out-Null
    }

    if ($rebootRequired) {
        return $true  # Reboot needed
    }

    Write-Success "WSL2 enabled successfully"
    return $false  # No reboot needed
}

function Request-RebootForWSL {
    Write-Host ""
    Write-Host "WSL2 has been enabled. A restart is required to continue." -ForegroundColor Yellow
    Write-Host ""

    $response = Read-Host "Restart now? (The installer will resume after restart) [Y/N]"

    if ($response -eq "Y" -or $response -eq "y") {
        # Create RunOnce registry entry to resume installer after reboot
        $scriptPath = $MyInvocation.PSCommandPath
        if (-not $scriptPath) {
            $scriptPath = $PSCommandPath
        }

        $runOnceCommand = "powershell.exe -ExecutionPolicy Bypass -File `"$scriptPath`""

        # Add parameters if they were provided
        if ($InstallDir -ne "C:\ClaudiaCoder") {
            $runOnceCommand += " -InstallDir `"$InstallDir`""
        }
        if ($GitLabDomain -ne "gitlab.claudia.local") {
            $runOnceCommand += " -GitLabDomain `"$GitLabDomain`""
        }
        if ($N8nDomain -ne "n8n.claudia.local") {
            $runOnceCommand += " -N8nDomain `"$N8nDomain`""
        }
        if ($SkipBrowserOpen) {
            $runOnceCommand += " -SkipBrowserOpen"
        }

        Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce" -Name "ClaudiaCoderInstaller" -Value $runOnceCommand

        Write-Info "Restarting in 5 seconds..."
        Start-Sleep -Seconds 5
        Restart-Computer -Force
    }
    else {
        Write-Host ""
        Write-Info "Please restart your computer manually, then run this installer again."
        exit 0
    }
}

function Wait-ForService {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 300,
        [int]$IntervalSeconds = 5
    )

    $elapsed = 0
    while ($elapsed -lt $TimeoutSeconds) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                return $true
            }
        }
        catch {
            # Service not ready yet
        }
        Start-Sleep -Seconds $IntervalSeconds
        $elapsed += $IntervalSeconds
        Write-Progress-Custom -Activity "Waiting for $Url" -PercentComplete ([math]::Min(100, [int]($elapsed / $TimeoutSeconds * 100)))
    }
    Write-Host ""
    return $false
}

function Download-File {
    param(
        [string]$Url,
        [string]$Destination
    )

    Write-Info "Downloading: $Url"

    try {
        # Use BITS for better download handling
        Start-BitsTransfer -Source $Url -Destination $Destination -DisplayName "Downloading $(Split-Path $Destination -Leaf)"
    }
    catch {
        # Fallback to WebClient
        Write-Warning "BITS transfer failed, using WebClient..."
        $webClient = New-Object System.Net.WebClient
        $webClient.DownloadFile($Url, $Destination)
    }

    if (Test-Path $Destination) {
        Write-Success "Downloaded: $(Split-Path $Destination -Leaf)"
        return $true
    }
    return $false
}

function Find-RepoRoot {
    <#
    .SYNOPSIS
        Detects the repo root by looking for package.json starting from the installer directory.
    .DESCRIPTION
        The installer is expected to be run from installer/windows/ within the claudia-admin repo.
        This function walks up the directory tree to find the repo root (containing package.json).
    #>
    Write-Step "Detecting Repository Location"

    # Get the directory where this script is located
    $scriptDir = $PSScriptRoot
    if (-not $scriptDir) {
        # Fallback if PSScriptRoot is not available
        $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    }

    Write-Info "Script location: $scriptDir"

    # Walk up the directory tree looking for package.json
    $currentDir = $scriptDir
    $maxLevels = 5  # Don't search more than 5 levels up
    $level = 0

    while ($level -lt $maxLevels) {
        $packageJsonPath = Join-Path $currentDir "package.json"

        if (Test-Path $packageJsonPath) {
            # Verify this is the claudia-admin package.json
            $packageContent = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
            if ($packageContent.name -eq "claudia-admin-panel") {
                Write-Success "Found repo root: $currentDir"
                $Script:Config.RepoRoot = $currentDir
                return $currentDir
            }
        }

        # Go up one level
        $parentDir = Split-Path -Parent $currentDir
        if ($parentDir -eq $currentDir) {
            # Reached filesystem root
            break
        }
        $currentDir = $parentDir
        $level++
    }

    # Repo not found
    Write-ErrorMsg "Could not find the claudia-admin repository root."
    Write-ErrorMsg "Please ensure you are running this script from within the claudia-admin repository."
    Write-ErrorMsg "Expected structure: claudia-admin/installer/windows/install-claudia.ps1"
    throw "Repository root not found. Ensure the script is run from within the claudia-admin repo."
}

# ============================================================================
# Prerequisite Installation Functions
# ============================================================================
function Install-DockerDesktop {
    Write-Step "Checking Docker Desktop"

    if (Test-CommandExists "docker") {
        $version = Get-InstalledVersion "docker" "--version"
        Write-Success "Docker is already installed: $version"

        # Check if Docker is running
        try {
            docker info 2>&1 | Out-Null
            Write-Success "Docker daemon is running"
        }
        catch {
            Write-Warning "Docker is installed but not running. Please start Docker Desktop."
            Write-Info "Waiting for Docker to start..."

            # Try to start Docker Desktop
            $dockerPath = "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe"
            if (Test-Path $dockerPath) {
                Start-Process $dockerPath
                Start-Sleep -Seconds 30
            }
        }
        return
    }

    Write-Info "Docker Desktop not found. Installing..."

    $installerPath = Join-Path $env:TEMP "DockerDesktopInstaller.exe"

    if (-not (Download-File -Url $Script:Config.DockerDesktopUrl -Destination $installerPath)) {
        throw "Failed to download Docker Desktop installer"
    }

    Write-Info "Running Docker Desktop installer (this may take several minutes)..."
    $process = Start-Process -FilePath $installerPath -ArgumentList "install", "--quiet", "--accept-license" -Wait -PassThru

    if ($process.ExitCode -ne 0) {
        throw "Docker Desktop installation failed with exit code: $($process.ExitCode)"
    }

    Remove-Item $installerPath -Force -ErrorAction SilentlyContinue

    Write-Success "Docker Desktop installed successfully"
    Write-Warning "A system restart may be required. Please restart and run this script again if Docker doesn't start."
}

function Install-NodeJS {
    Write-Step "Checking Node.js"

    if (Test-CommandExists "node") {
        $version = Get-InstalledVersion "node" "--version"
        $majorVersion = [int]($version -replace "v(\d+)\..*", '$1')

        if ($majorVersion -ge 20) {
            Write-Success "Node.js is already installed: $version"
            return
        }
        Write-Warning "Node.js version $version is too old. Installing Node.js 20+..."
    }
    else {
        Write-Info "Node.js not found. Installing..."
    }

    # Try winget first
    if (Test-CommandExists "winget") {
        Write-Info "Installing Node.js via winget..."
        try {
            winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent

            # Refresh PATH
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

            if (Test-CommandExists "node") {
                $version = Get-InstalledVersion "node" "--version"
                Write-Success "Node.js installed via winget: $version"
                return
            }
        }
        catch {
            Write-Warning "winget installation failed, trying direct download..."
        }
    }

    # Direct MSI download
    $installerPath = Join-Path $env:TEMP "node-installer.msi"

    if (-not (Download-File -Url $Script:Config.NodeInstallerUrl -Destination $installerPath)) {
        throw "Failed to download Node.js installer"
    }

    Write-Info "Running Node.js installer..."
    $process = Start-Process -FilePath "msiexec.exe" -ArgumentList "/i", $installerPath, "/quiet", "/norestart" -Wait -PassThru

    if ($process.ExitCode -ne 0 -and $process.ExitCode -ne 3010) {
        throw "Node.js installation failed with exit code: $($process.ExitCode)"
    }

    Remove-Item $installerPath -Force -ErrorAction SilentlyContinue

    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

    $version = Get-InstalledVersion "node" "--version"
    Write-Success "Node.js installed: $version"
}

function Install-Git {
    Write-Step "Checking Git"

    if (Test-CommandExists "git") {
        $version = Get-InstalledVersion "git" "--version"
        Write-Success "Git is already installed: $version"
        return
    }

    Write-Info "Git not found. Installing..."

    if (Test-CommandExists "winget") {
        Write-Info "Installing Git via winget..."
        winget install Git.Git --accept-source-agreements --accept-package-agreements --silent

        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

        if (Test-CommandExists "git") {
            $version = Get-InstalledVersion "git" "--version"
            Write-Success "Git installed via winget: $version"
            return
        }
    }

    throw "Failed to install Git. Please install Git manually from https://git-scm.com/"
}

function Install-Rust {
    Write-Step "Checking Rust/Cargo"

    if (Test-CommandExists "cargo") {
        $version = Get-InstalledVersion "cargo" "--version"
        Write-Success "Rust/Cargo is already installed: $version"
        return
    }

    Write-Info "Rust not found. Installing via rustup..."

    $rustupPath = Join-Path $env:TEMP "rustup-init.exe"

    if (-not (Download-File -Url $Script:Config.RustupUrl -Destination $rustupPath)) {
        throw "Failed to download rustup installer"
    }

    Write-Info "Running rustup installer..."
    $process = Start-Process -FilePath $rustupPath -ArgumentList "-y", "--default-toolchain", "stable" -Wait -PassThru -NoNewWindow

    if ($process.ExitCode -ne 0) {
        throw "Rust installation failed with exit code: $($process.ExitCode)"
    }

    Remove-Item $rustupPath -Force -ErrorAction SilentlyContinue

    # Add Cargo to PATH
    $cargoPath = Join-Path $env:USERPROFILE ".cargo\bin"
    Add-ToPath $cargoPath
    $env:Path = "$env:Path;$cargoPath"

    $version = Get-InstalledVersion "cargo" "--version"
    Write-Success "Rust/Cargo installed: $version"
}

# ============================================================================
# Installation Functions
# ============================================================================
function New-InstallDirectory {
    Write-Step "Creating Install Directory"

    if (Test-Path $Script:Config.InstallDir) {
        Write-Info "Install directory already exists: $($Script:Config.InstallDir)"
    }
    else {
        New-Item -ItemType Directory -Path $Script:Config.InstallDir -Force | Out-Null
        Write-Success "Created install directory: $($Script:Config.InstallDir)"
    }

    # Create subdirectories
    $subDirs = @("src", "data", "logs", "config", "bin")
    foreach ($dir in $subDirs) {
        $fullPath = Join-Path $Script:Config.InstallDir $dir
        if (-not (Test-Path $fullPath)) {
            New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
            Write-Info "Created subdirectory: $dir"
        }
    }
}

function Copy-RepoToInstallDir {
    <#
    .SYNOPSIS
        Copies the local repository to the install directory.
    .DESCRIPTION
        This function copies the entire claudia-admin repository from its local location
        to the install directory (C:\ClaudiaCoder by default). No internet connection required.
    #>
    Write-Step "Copying Repository to Install Location"

    $repoRoot = $Script:Config.RepoRoot
    if (-not $repoRoot) {
        throw "Repository root not set. Run Find-RepoRoot first."
    }

    $targetDir = $Script:Config.InstallDir

    Write-Info "Source: $repoRoot"
    Write-Info "Target: $targetDir"

    # Define what to exclude from copy
    $excludeDirs = @(
        ".git",
        ".next",
        "node_modules",
        ".local-storage"
    )

    $excludeFiles = @(
        ".env.local",
        "localhost.key",
        "localhost.crt",
        "*.log"
    )

    # Check if target already has files
    if (Test-Path $targetDir) {
        $existingFiles = Get-ChildItem -Path $targetDir -Force -ErrorAction SilentlyContinue
        if ($existingFiles) {
            Write-Warning "Install directory already contains files."
            $response = Read-Host "Overwrite existing installation? (y/N)"
            if ($response -ne "y" -and $response -ne "Y") {
                Write-Info "Keeping existing installation. Skipping copy."
                return
            }
            Write-Info "Removing existing files..."
            Get-ChildItem -Path $targetDir -Exclude @(".env", "data", "logs") | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
    else {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }

    # Copy files using robocopy for better performance and control
    Write-Info "Copying files (this may take a moment)..."

    # Build exclude directory argument
    $excludeDirArgs = ($excludeDirs | ForEach-Object { $_ }) -join " "

    # Use robocopy for efficient copying
    $robocopyArgs = @(
        $repoRoot,
        $targetDir,
        "/E",           # Copy subdirectories including empty ones
        "/NP",          # No progress percentage
        "/NFL",         # No file list
        "/NDL",         # No directory list
        "/XD", ".git", ".next", "node_modules", ".local-storage",  # Exclude directories
        "/XF", ".env.local", "localhost.key", "localhost.crt", "*.log"  # Exclude files
    )

    try {
        $result = robocopy @robocopyArgs
        # Robocopy exit codes 0-7 are success
        if ($LASTEXITCODE -gt 7) {
            throw "Robocopy failed with exit code: $LASTEXITCODE"
        }
        Write-Success "Files copied successfully"
    }
    catch {
        Write-Warning "Robocopy failed, falling back to PowerShell copy..."

        # Fallback to PowerShell copy
        Get-ChildItem -Path $repoRoot -Force | Where-Object {
            $_.Name -notin $excludeDirs
        } | ForEach-Object {
            $destPath = Join-Path $targetDir $_.Name
            if ($_.PSIsContainer) {
                Copy-Item -Path $_.FullName -Destination $destPath -Recurse -Force -ErrorAction SilentlyContinue
            }
            else {
                if ($_.Name -notin $excludeFiles -and $_.Name -notlike "*.log") {
                    Copy-Item -Path $_.FullName -Destination $destPath -Force -ErrorAction SilentlyContinue
                }
            }
        }
        Write-Success "Files copied successfully (PowerShell method)"
    }

    # Verify critical files exist
    $criticalFiles = @("package.json", "docker-compose.yml", "src")
    foreach ($file in $criticalFiles) {
        $path = Join-Path $targetDir $file
        if (-not (Test-Path $path)) {
            throw "Critical file/directory missing after copy: $file"
        }
    }

    Write-Success "Repository copied to $targetDir"
}

function Install-NpmDependencies {
    Write-Step "Installing npm Dependencies"

    $installDir = $Script:Config.InstallDir
    Write-Info "Running npm install in $installDir..."
    Write-Info "(This may take several minutes on first run)"

    try {
        # Find npm
        $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
        if (-not $npmCmd) {
            $npmPath = "$env:ProgramFiles\nodejs\npm.cmd"
            if (-not (Test-Path $npmPath)) {
                throw "npm not found. Please ensure Node.js is installed."
            }
        } else {
            $npmPath = $npmCmd.Source
        }

        Write-Info "Using npm from: $npmPath"

        # Use cmd.exe to execute npm.cmd (fixes Win32 application error)
        $process = Start-Process -FilePath "cmd.exe" `
            -ArgumentList "/c", "`"$npmPath`"", "install" `
            -WorkingDirectory $installDir `
            -NoNewWindow `
            -Wait `
            -PassThru

        if ($process.ExitCode -ne 0) {
            throw "npm install failed with exit code $($process.ExitCode)"
        }

        Write-Success "npm dependencies installed"
    }
    catch {
        throw "npm install failed: $_"
    }
}

function Setup-DockerServices {
    <#
    .SYNOPSIS
        Sets up Docker services using the local docker-compose.yml.
    .DESCRIPTION
        Uses the docker-compose.yml from the copied repository to configure services.
        No need to generate a new compose file - just use what's in the repo.
    #>
    Write-Step "Setting Up Docker Services"

    $targetDir = $Script:Config.InstallDir
    $composeFile = Join-Path $targetDir "docker-compose.yml"

    if (-not (Test-Path $composeFile)) {
        # Check if there's one in the docker subdirectory
        $dockerComposeFile = Join-Path $targetDir "docker\docker-compose.yml"
        if (Test-Path $dockerComposeFile) {
            $composeFile = $dockerComposeFile
        }
        else {
            throw "docker-compose.yml not found in $targetDir or $targetDir\docker"
        }
    }

    Write-Success "Found docker-compose.yml at: $composeFile"
    Write-Info "Docker services will be started from this configuration"

    # Store the compose file location for later use
    $Script:DockerComposeFile = $composeFile
}


function New-EnvironmentFile {
    Write-Step "Creating Environment Configuration"

    $envFile = Join-Path $Script:Config.InstallDir ".env"

    # Generate random secrets if this is a new install
    $jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
    $sessionSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object { [char]$_ })

    if (Test-Path $envFile) {
        Write-Info "Environment file exists, preserving existing values..."
        # Load existing values
        $existingEnv = Get-Content $envFile | Where-Object { $_ -match "=" }
        foreach ($line in $existingEnv) {
            $parts = $line -split "=", 2
            if ($parts[0] -eq "JWT_SECRET") { $jwtSecret = $parts[1] }
            if ($parts[0] -eq "SESSION_SECRET") { $sessionSecret = $parts[1] }
        }
    }

    $envContent = @"
# Claudia Coder Environment Configuration
# Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

# Application Settings
NODE_ENV=development
PORT=$($Script:Config.Ports.ClaudiaCoder)
HOST=localhost

# Security
JWT_SECRET=$jwtSecret
SESSION_SECRET=$sessionSecret

# GitLab Configuration (optional, for GitLab integration)
GITLAB_URL=http://$($Script:Config.GitLabDomain):$($Script:Config.Ports.GitLab)
GITLAB_SSH_PORT=$($Script:Config.Ports.GitLabSSH)

# n8n Configuration (optional, for workflow automation)
N8N_URL=http://$($Script:Config.N8nDomain):$($Script:Config.Ports.N8n)

# Logging
LOG_LEVEL=info
"@

    $envContent | Out-File -FilePath $envFile -Encoding UTF8 -Force
    Write-Success "Created .env file"
}

function Update-HostsFile {
    Write-Step "Updating Hosts File"

    $hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
    $hostsContent = Get-Content $hostsPath -Raw

    $entries = @(
        @{ Domain = $Script:Config.GitLabDomain; IP = "127.0.0.1" },
        @{ Domain = $Script:Config.N8nDomain; IP = "127.0.0.1" }
    )

    $modified = $false

    foreach ($entry in $entries) {
        if ($hostsContent -notmatch [regex]::Escape($entry.Domain)) {
            Add-Content -Path $hostsPath -Value "`n$($entry.IP)`t$($entry.Domain)"
            Write-Info "Added $($entry.Domain) to hosts file"
            $modified = $true
        }
        else {
            Write-Info "$($entry.Domain) already in hosts file"
        }
    }

    if ($modified) {
        # Flush DNS cache
        ipconfig /flushdns | Out-Null
        Write-Success "Updated hosts file and flushed DNS cache"
    }
}

function New-WindowsShortcuts {
    Write-Step "Creating Windows Shortcuts"

    $desktopPath = [Environment]::GetFolderPath("Desktop")
    $startMenuPath = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Claudia Coder"

    # Create Start Menu folder
    if (-not (Test-Path $startMenuPath)) {
        New-Item -ItemType Directory -Path $startMenuPath -Force | Out-Null
    }

    $shell = New-Object -ComObject WScript.Shell

    # Main application shortcut
    $shortcuts = @(
        @{
            Name = "Claudia Coder"
            Target = "http://localhost:$($Script:Config.Ports.ClaudiaCoder)"
            Description = "Open Claudia Coder in browser"
            Icon = "shell32.dll,14"
        },
        @{
            Name = "GitLab"
            Target = "http://$($Script:Config.GitLabDomain):$($Script:Config.Ports.GitLab)"
            Description = "Open GitLab in browser"
            Icon = "shell32.dll,14"
        },
        @{
            Name = "n8n Workflows"
            Target = "http://$($Script:Config.N8nDomain):$($Script:Config.Ports.N8n)"
            Description = "Open n8n in browser"
            Icon = "shell32.dll,14"
        },
        @{
            Name = "Start Claudia Services"
            Target = "powershell.exe"
            Arguments = "-ExecutionPolicy Bypass -File `"$($Script:Config.InstallDir)\scripts\start-services.ps1`""
            Description = "Start all Claudia Coder services"
            Icon = "shell32.dll,137"
        },
        @{
            Name = "Stop Claudia Services"
            Target = "powershell.exe"
            Arguments = "-ExecutionPolicy Bypass -File `"$($Script:Config.InstallDir)\scripts\stop-services.ps1`""
            Description = "Stop all Claudia Coder services"
            Icon = "shell32.dll,27"
        }
    )

    foreach ($shortcut in $shortcuts) {
        foreach ($location in @($desktopPath, $startMenuPath)) {
            $lnkPath = Join-Path $location "$($shortcut.Name).lnk"

            if ($shortcut.Target -match "^http") {
                # URL shortcut
                $urlPath = Join-Path $location "$($shortcut.Name).url"
                "[InternetShortcut]`nURL=$($shortcut.Target)" | Out-File $urlPath -Encoding ASCII
            }
            else {
                # Regular shortcut
                $wshShortcut = $shell.CreateShortcut($lnkPath)
                $wshShortcut.TargetPath = $shortcut.Target
                if ($shortcut.Arguments) {
                    $wshShortcut.Arguments = $shortcut.Arguments
                }
                $wshShortcut.Description = $shortcut.Description
                $wshShortcut.WorkingDirectory = $Script:Config.InstallDir
                $wshShortcut.Save()
            }
        }
        Write-Info "Created shortcut: $($shortcut.Name)"
    }

    # Create desktop shortcuts for batch files with Run as Administrator
    $batchShortcuts = @(
        @{
            Name = "Start Claudia Coder"
            BatchFile = "start-claudia.bat"
            Description = "Start Claudia Coder services and open the application"
            Icon = "%SystemRoot%\System32\shell32.dll,137"  # Play/green arrow icon
        },
        @{
            Name = "Stop Claudia Coder"
            BatchFile = "stop-claudia.bat"
            Description = "Stop all Claudia Coder services"
            Icon = "%SystemRoot%\System32\shell32.dll,131"  # Stop/square icon
        },
        @{
            Name = "Uninstall Claudia Coder"
            BatchFile = "uninstall.bat"
            Description = "Remove Claudia Coder from this computer"
            Icon = "%SystemRoot%\System32\shell32.dll,32"   # Warning/trash icon
            RunAsAdmin = $true
        }
    )

    foreach ($shortcut in $batchShortcuts) {
        $batchPath = Join-Path $Script:Config.InstallDir $shortcut.BatchFile

        foreach ($location in @($desktopPath, $startMenuPath)) {
            $lnkPath = Join-Path $location "$($shortcut.Name).lnk"

            $wshShortcut = $shell.CreateShortcut($lnkPath)
            $wshShortcut.TargetPath = $batchPath
            $wshShortcut.Description = $shortcut.Description
            $wshShortcut.WorkingDirectory = $Script:Config.InstallDir
            $wshShortcut.IconLocation = $shortcut.Icon
            $wshShortcut.Save()

            # Set Run as Administrator flag if needed
            if ($shortcut.RunAsAdmin) {
                $bytes = [System.IO.File]::ReadAllBytes($lnkPath)
                # Set byte 21 (0x15) bit 5 to enable "Run as Administrator"
                $bytes[0x15] = $bytes[0x15] -bor 0x20
                [System.IO.File]::WriteAllBytes($lnkPath, $bytes)
            }
        }
        Write-Info "Created shortcut: $($shortcut.Name)"
    }

    Write-Success "Created desktop and Start Menu shortcuts"
}

function New-ServiceScripts {
    Write-Step "Creating Service Scripts"

    $scriptsDir = Join-Path $Script:Config.InstallDir "scripts"
    if (-not (Test-Path $scriptsDir)) {
        New-Item -ItemType Directory -Path $scriptsDir -Force | Out-Null
    }

    # Start services script
    $startScript = @"
# Start Claudia Coder Services
`$ErrorActionPreference = "Continue"

Write-Host "Starting Claudia Coder Services..." -ForegroundColor Cyan

# Start Docker Desktop if not running
`$dockerProcess = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
if (-not `$dockerProcess) {
    Write-Host "Starting Docker Desktop..."
    Start-Process "`$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
    Start-Sleep -Seconds 30
}

# Wait for Docker to be ready
`$maxWait = 60
`$waited = 0
while (`$waited -lt `$maxWait) {
    try {
        docker info 2>&1 | Out-Null
        break
    }
    catch {
        Start-Sleep -Seconds 5
        `$waited += 5
        Write-Host "Waiting for Docker... (`$waited/`$maxWait seconds)"
    }
}

# Start Docker Compose services from the install directory
Set-Location "$($Script:Config.InstallDir)"
docker-compose up -d

Write-Host ""
Write-Host "Services starting..." -ForegroundColor Green
Write-Host "n8n: http://$($Script:Config.N8nDomain):$($Script:Config.Ports.N8n) (optional, requires --profile automation)"
Write-Host ""

# Start Claudia Coder (Next.js app)
Set-Location "$($Script:Config.InstallDir)"
Start-Process -FilePath "npm" -ArgumentList "start" -WindowStyle Hidden

Write-Host "Claudia Coder: http://localhost:$($Script:Config.Ports.ClaudiaCoder)"
Write-Host ""
Write-Host "Press any key to exit..."
`$null = `$Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
"@

    $startScript | Out-File -FilePath (Join-Path $scriptsDir "start-services.ps1") -Encoding UTF8 -Force

    # Stop services script
    $stopScript = @"
# Stop Claudia Coder Services
`$ErrorActionPreference = "Continue"

Write-Host "Stopping Claudia Coder Services..." -ForegroundColor Cyan

# Stop Claudia Coder Node process
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Stop Docker Compose services
Set-Location "$($Script:Config.InstallDir)"
docker-compose down

Write-Host ""
Write-Host "All services stopped." -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to exit..."
`$null = `$Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
"@

    $stopScript | Out-File -FilePath (Join-Path $scriptsDir "stop-services.ps1") -Encoding UTF8 -Force

    # Status script
    $statusScript = @"
# Claudia Coder Service Status
`$ErrorActionPreference = "Continue"

Write-Host "Claudia Coder Service Status" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan
Write-Host ""

# Docker status
try {
    docker info 2>&1 | Out-Null
    Write-Host "[OK] Docker is running" -ForegroundColor Green
}
catch {
    Write-Host "[X] Docker is not running" -ForegroundColor Red
}

# Container status
Write-Host ""
Write-Host "Container Status:" -ForegroundColor Yellow
docker ps --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}" --filter "name=claudia-"

Write-Host ""
Write-Host "Press any key to exit..."
`$null = `$Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
"@

    $statusScript | Out-File -FilePath (Join-Path $scriptsDir "status.ps1") -Encoding UTF8 -Force

    Write-Success "Created service scripts"
}

function Start-ClaudiaServices {
    Write-Step "Starting Claudia Services"

    # Check Docker
    try {
        docker info 2>&1 | Out-Null
    }
    catch {
        Write-Warning "Docker is not running. Please start Docker Desktop first."
        return
    }

    $installDir = $Script:Config.InstallDir

    # Check if docker-compose.yml exists
    $composeFile = Join-Path $installDir "docker-compose.yml"
    if (-not (Test-Path $composeFile)) {
        Write-Warning "docker-compose.yml not found. Skipping Docker services."
        return
    }

    Write-Info "Starting Docker Compose services..."
    Push-Location $installDir
    try {
        docker-compose up -d
        Write-Success "Docker services started"
    }
    finally {
        Pop-Location
    }

    # Wait for the main application to be ready
    Write-Info "Waiting for services to initialize..."
    $appReady = Wait-ForService -Url "http://localhost:$($Script:Config.Ports.ClaudiaCoder)" -TimeoutSeconds 60
    if ($appReady) {
        Write-Host ""
        Write-Success "Claudia Coder is ready"
    }
}

function Open-Browser {
    if (-not $SkipBrowserOpen) {
        Write-Step "Opening Browser"
        Start-Process "http://localhost:$($Script:Config.Ports.ClaudiaCoder)"
        Write-Success "Opened browser to Claudia Coder"
    }
}

function Invoke-Uninstall {
    Write-Step "Uninstalling Claudia Coder"

    # Stop services
    $installDir = $Script:Config.InstallDir
    if (Test-Path (Join-Path $installDir "docker-compose.yml")) {
        Write-Info "Stopping Docker services..."
        Push-Location $installDir
        try {
            docker-compose down -v
        }
        catch {
            Write-Warning "Failed to stop Docker services"
        }
        finally {
            Pop-Location
        }
    }

    # Remove shortcuts
    Write-Info "Removing shortcuts..."
    $desktopPath = [Environment]::GetFolderPath("Desktop")
    $startMenuPath = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Claudia Coder"

    $shortcutNames = @("Claudia Coder", "GitLab", "n8n Workflows", "Start Claudia Services", "Stop Claudia Services", "Start Claudia Coder", "Stop Claudia Coder", "Uninstall Claudia Coder")
    foreach ($name in $shortcutNames) {
        Remove-Item (Join-Path $desktopPath "$name.lnk") -Force -ErrorAction SilentlyContinue
        Remove-Item (Join-Path $desktopPath "$name.url") -Force -ErrorAction SilentlyContinue
    }
    Remove-Item $startMenuPath -Recurse -Force -ErrorAction SilentlyContinue

    # Remove hosts entries
    Write-Info "Cleaning hosts file..."
    $hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
    $hostsContent = Get-Content $hostsPath | Where-Object {
        $_ -notmatch [regex]::Escape($Script:Config.GitLabDomain) -and
        $_ -notmatch [regex]::Escape($Script:Config.N8nDomain)
    }
    $hostsContent | Set-Content $hostsPath -Force

    # Remove install directory
    $confirm = Read-Host "Remove install directory $($Script:Config.InstallDir)? (y/N)"
    if ($confirm -eq "y" -or $confirm -eq "Y") {
        Remove-Item $Script:Config.InstallDir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Success "Removed install directory"
    }

    Write-Success "Claudia Coder uninstalled"
    Write-Info "Note: Docker Desktop and Node.js were not removed."
}

function Show-CompletionSummary {
    Write-Step "Installation Complete!"

    Write-Host @"

Claudia Coder has been installed successfully!

Install Directory: $($Script:Config.InstallDir)

Application:
  - Claudia Coder:  http://localhost:$($Script:Config.Ports.ClaudiaCoder)

Optional Services (via Docker Compose profiles):
  - n8n Workflows:  http://localhost:$($Script:Config.Ports.N8n)
    Start with: docker-compose --profile automation up -d

Shortcuts have been added to your Desktop and Start Menu.

Quick Commands:
  - Start services:  $($Script:Config.InstallDir)\scripts\start-services.ps1
  - Stop services:   $($Script:Config.InstallDir)\scripts\stop-services.ps1
  - Check status:    $($Script:Config.InstallDir)\scripts\status.ps1

To run in development mode:
  cd $($Script:Config.InstallDir)
  npm run dev

To build for production:
  cd $($Script:Config.InstallDir)
  npm run build
  npm start

"@ -ForegroundColor White
}

# ============================================================================
# Main Installation Flow
# ============================================================================
function Invoke-Installation {
    $startTime = Get-Date

    Write-Host @"

   _____ _                 _ _          _____          _
  / ____| |               | (_)        / ____|        | |
 | |    | | __ _ _   _  __| |_  __ _  | |     ___   __| | ___ _ __
 | |    | |/ _`` | | | |/ _`` | |/ _`` | | |    / _ \ / _`` |/ _ \ '__|
 | |____| | (_| | |_| | (_| | | (_| | | |___| (_) | (_| |  __/ |
  \_____|_|\__,_|\__,_|\__,_|_|\__,_|  \_____\___/ \__,_|\___|_|

                    Windows Installer v$($Script:Config.Version)

"@ -ForegroundColor Cyan

    # Check admin privileges
    if (-not (Test-AdminPrivileges)) {
        Write-ErrorMsg "This installer must be run as Administrator."
        Write-Info "Right-click PowerShell and select 'Run as Administrator'"
        exit 1
    }

    Write-Success "Running with Administrator privileges"
    Write-Info "Install directory: $($Script:Config.InstallDir)"
    Write-Host ""

    if ($Uninstall) {
        Invoke-Uninstall
        return
    }

    try {
        # Step 1: Detect the local repository
        Find-RepoRoot

        # WSL2 check (required for Docker Desktop)
        $rebootNeeded = Enable-WSL2
        if ($rebootNeeded) {
            Request-RebootForWSL
            return  # Will not reach here if user chose to reboot
        }

        # Prerequisites (only Docker and Node.js needed for local install)
        Install-DockerDesktop
        Install-NodeJS

        # Installation: Copy local repo to install directory
        Copy-RepoToInstallDir

        # Install npm dependencies in the copied location
        Install-NpmDependencies

        # Configuration
        Setup-DockerServices
        New-EnvironmentFile
        Update-HostsFile
        New-ServiceScripts
        New-WindowsShortcuts

        # Start services
        Start-ClaudiaServices

        # Finish
        Show-CompletionSummary
        Open-Browser

        $elapsed = (Get-Date) - $startTime
        Write-Info "Total installation time: $($elapsed.Minutes) minutes $($elapsed.Seconds) seconds"
    }
    catch {
        Write-ErrorMsg "Installation failed: $($_.Exception.Message)"
        Write-ErrorMsg "Stack trace: $($_.ScriptStackTrace)"
        exit 1
    }
}

# Run the installation
Invoke-Installation
