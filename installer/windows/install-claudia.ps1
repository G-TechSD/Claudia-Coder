#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Claudia Coder Windows Installer
.DESCRIPTION
    Comprehensive installer for Claudia Coder development environment.
    Installs all prerequisites, builds components, and configures services.
.NOTES
    Version:        1.0.0
    Author:         Claudia Coder Team
    Requires:       Windows 10/11, PowerShell 5.1+, Administrator privileges
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
    Version = "1.0.0"
    InstallDir = $InstallDir
    GitLabDomain = $GitLabDomain
    N8nDomain = $N8nDomain

    # Repository URLs
    ClaudiaCoderRepo = "https://github.com/claudia-coder/claudia-coder.git"
    Ganesha2Repo = "https://github.com/claudia-coder/ganesha2.git"

    # Download URLs
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

function Get-ClaudiaCoderSource {
    Write-Step "Getting Claudia Coder Source"

    $srcDir = Join-Path $Script:Config.InstallDir "src"
    $claudiaDir = Join-Path $srcDir "claudia-coder"

    if (Test-Path $claudiaDir) {
        Write-Info "Claudia Coder source exists, pulling latest changes..."
        Push-Location $claudiaDir
        try {
            git pull --quiet
            Write-Success "Updated Claudia Coder source"
        }
        catch {
            Write-Warning "Failed to update, using existing source"
        }
        finally {
            Pop-Location
        }
    }
    else {
        Write-Info "Cloning Claudia Coder repository..."
        git clone --depth 1 $Script:Config.ClaudiaCoderRepo $claudiaDir
        Write-Success "Cloned Claudia Coder source"
    }

    # Install npm dependencies
    Write-Info "Installing npm dependencies..."
    Push-Location $claudiaDir
    try {
        npm install --quiet
        Write-Success "Installed npm dependencies"
    }
    finally {
        Pop-Location
    }
}

function Get-Ganesha2Source {
    Write-Step "Getting Ganesha2 Source"

    $srcDir = Join-Path $Script:Config.InstallDir "src"
    $ganeshaDir = Join-Path $srcDir "ganesha2"

    if (Test-Path $ganeshaDir) {
        Write-Info "Ganesha2 source exists, pulling latest changes..."
        Push-Location $ganeshaDir
        try {
            git pull --quiet
            Write-Success "Updated Ganesha2 source"
        }
        catch {
            Write-Warning "Failed to update, using existing source"
        }
        finally {
            Pop-Location
        }
    }
    else {
        Write-Info "Cloning Ganesha2 repository..."
        git clone --depth 1 $Script:Config.Ganesha2Repo $ganeshaDir
        Write-Success "Cloned Ganesha2 source"
    }
}

function Build-Ganesha2 {
    Write-Step "Building Ganesha2"

    $srcDir = Join-Path $Script:Config.InstallDir "src"
    $ganeshaDir = Join-Path $srcDir "ganesha2"
    $binDir = Join-Path $Script:Config.InstallDir "bin"
    $targetBinary = Join-Path $binDir "ganesha2.exe"

    if (Test-Path $targetBinary) {
        Write-Info "Ganesha2 binary already exists"
        $rebuild = Read-Host "Rebuild Ganesha2? (y/N)"
        if ($rebuild -ne "y" -and $rebuild -ne "Y") {
            Write-Success "Skipping Ganesha2 build"
            return
        }
    }

    Write-Info "Building Ganesha2 (this may take several minutes)..."

    Push-Location $ganeshaDir
    try {
        cargo build --release

        $builtBinary = Join-Path $ganeshaDir "target\release\ganesha2.exe"
        if (Test-Path $builtBinary) {
            Copy-Item $builtBinary $targetBinary -Force
            Write-Success "Ganesha2 built and installed to: $targetBinary"
        }
        else {
            throw "Build completed but binary not found"
        }
    }
    finally {
        Pop-Location
    }
}

function New-DockerCompose {
    Write-Step "Creating Docker Compose Configuration"

    $configDir = Join-Path $Script:Config.InstallDir "config"
    $composeFile = Join-Path $configDir "docker-compose.yml"

    $dockerCompose = @"
version: '3.8'

services:
  # PostgreSQL for GitLab
  postgresql:
    image: postgres:15-alpine
    container_name: claudia-postgresql
    restart: unless-stopped
    environment:
      POSTGRES_USER: gitlab
      POSTGRES_PASSWORD: gitlab_password
      POSTGRES_DB: gitlabhq_production
    volumes:
      - postgresql_data:/var/lib/postgresql/data
    networks:
      - claudia-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U gitlab"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis for GitLab
  redis:
    image: redis:7-alpine
    container_name: claudia-redis
    restart: unless-stopped
    volumes:
      - redis_data:/data
    networks:
      - claudia-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # GitLab CE
  gitlab:
    image: gitlab/gitlab-ce:latest
    container_name: claudia-gitlab
    restart: unless-stopped
    hostname: $($Script:Config.GitLabDomain)
    environment:
      GITLAB_OMNIBUS_CONFIG: |
        external_url 'http://$($Script:Config.GitLabDomain):$($Script:Config.Ports.GitLab)'
        gitlab_rails['gitlab_shell_ssh_port'] = $($Script:Config.Ports.GitLabSSH)

        # Disable built-in PostgreSQL
        postgresql['enable'] = false
        gitlab_rails['db_adapter'] = 'postgresql'
        gitlab_rails['db_encoding'] = 'utf8'
        gitlab_rails['db_host'] = 'postgresql'
        gitlab_rails['db_port'] = 5432
        gitlab_rails['db_username'] = 'gitlab'
        gitlab_rails['db_password'] = 'gitlab_password'
        gitlab_rails['db_database'] = 'gitlabhq_production'

        # Disable built-in Redis
        redis['enable'] = false
        gitlab_rails['redis_host'] = 'redis'
        gitlab_rails['redis_port'] = 6379

        # Performance optimizations
        puma['worker_processes'] = 2
        sidekiq['concurrency'] = 5
        prometheus_monitoring['enable'] = false
        grafana['enable'] = false
    ports:
      - "$($Script:Config.Ports.GitLab):$($Script:Config.Ports.GitLab)"
      - "$($Script:Config.Ports.GitLabSSH):22"
    volumes:
      - gitlab_config:/etc/gitlab
      - gitlab_logs:/var/log/gitlab
      - gitlab_data:/var/opt/gitlab
    networks:
      - claudia-network
    depends_on:
      postgresql:
        condition: service_healthy
      redis:
        condition: service_healthy
    shm_size: '256m'

  # n8n Workflow Automation
  n8n:
    image: n8nio/n8n:latest
    container_name: claudia-n8n
    restart: unless-stopped
    environment:
      - N8N_HOST=$($Script:Config.N8nDomain)
      - N8N_PORT=$($Script:Config.Ports.N8n)
      - N8N_PROTOCOL=http
      - WEBHOOK_URL=http://$($Script:Config.N8nDomain):$($Script:Config.Ports.N8n)/
      - GENERIC_TIMEZONE=America/New_York
      - N8N_ENCRYPTION_KEY=claudia-coder-n8n-encryption-key
    ports:
      - "$($Script:Config.Ports.N8n):$($Script:Config.Ports.N8n)"
    volumes:
      - n8n_data:/home/node/.n8n
    networks:
      - claudia-network

  # Whisper Speech-to-Text
  whisper:
    image: onerahmet/openai-whisper-asr-webservice:latest
    container_name: claudia-whisper
    restart: unless-stopped
    environment:
      - ASR_MODEL=base
      - ASR_ENGINE=openai_whisper
    ports:
      - "$($Script:Config.Ports.Whisper):9000"
    volumes:
      - whisper_data:/root/.cache/whisper
    networks:
      - claudia-network
    deploy:
      resources:
        limits:
          memory: 4G

networks:
  claudia-network:
    driver: bridge

volumes:
  postgresql_data:
  redis_data:
  gitlab_config:
  gitlab_logs:
  gitlab_data:
  n8n_data:
  whisper_data:
"@

    $dockerCompose | Out-File -FilePath $composeFile -Encoding UTF8 -Force
    Write-Success "Created docker-compose.yml"
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

# GitLab Configuration
GITLAB_URL=http://$($Script:Config.GitLabDomain):$($Script:Config.Ports.GitLab)
GITLAB_SSH_PORT=$($Script:Config.Ports.GitLabSSH)

# n8n Configuration
N8N_URL=http://$($Script:Config.N8nDomain):$($Script:Config.Ports.N8n)

# Whisper Configuration
WHISPER_URL=http://localhost:$($Script:Config.Ports.Whisper)

# Ganesha2 Configuration
GANESHA2_PATH=$($Script:Config.InstallDir)\bin\ganesha2.exe

# Database (for future use)
DATABASE_URL=postgresql://gitlab:gitlab_password@localhost:$($Script:Config.Ports.PostgreSQL)/claudia_coder

# Logging
LOG_LEVEL=info
LOG_DIR=$($Script:Config.InstallDir)\logs
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

# Start Docker Compose services
Set-Location "$($Script:Config.InstallDir)\config"
docker-compose up -d

Write-Host ""
Write-Host "Services starting..." -ForegroundColor Green
Write-Host "GitLab: http://$($Script:Config.GitLabDomain):$($Script:Config.Ports.GitLab) (may take 2-5 minutes to fully start)"
Write-Host "n8n: http://$($Script:Config.N8nDomain):$($Script:Config.Ports.N8n)"
Write-Host "Whisper: http://localhost:$($Script:Config.Ports.Whisper)"
Write-Host ""

# Start Claudia Coder
Set-Location "$($Script:Config.InstallDir)\src\claudia-coder"
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
Set-Location "$($Script:Config.InstallDir)\config"
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

    $configDir = Join-Path $Script:Config.InstallDir "config"

    Write-Info "Starting Docker Compose services..."
    Push-Location $configDir
    try {
        docker-compose up -d
        Write-Success "Docker services started"
    }
    finally {
        Pop-Location
    }

    # Wait for services to be ready
    Write-Info "Waiting for services to initialize..."
    Write-Info "(GitLab may take 2-5 minutes on first start)"

    # Check n8n (usually starts faster)
    $n8nReady = Wait-ForService -Url "http://localhost:$($Script:Config.Ports.N8n)" -TimeoutSeconds 60
    if ($n8nReady) {
        Write-Host ""
        Write-Success "n8n is ready"
    }

    # Check Whisper
    $whisperReady = Wait-ForService -Url "http://localhost:$($Script:Config.Ports.Whisper)/health" -TimeoutSeconds 120
    if ($whisperReady) {
        Write-Host ""
        Write-Success "Whisper is ready"
    }

    Write-Info "GitLab is starting in the background (check http://$($Script:Config.GitLabDomain):$($Script:Config.Ports.GitLab))"
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
    $configDir = Join-Path $Script:Config.InstallDir "config"
    if (Test-Path (Join-Path $configDir "docker-compose.yml")) {
        Write-Info "Stopping Docker services..."
        Push-Location $configDir
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

    $shortcutNames = @("Claudia Coder", "GitLab", "n8n Workflows", "Start Claudia Services", "Stop Claudia Services")
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
    Write-Info "Note: Docker Desktop, Node.js, Git, and Rust were not removed."
}

function Show-CompletionSummary {
    Write-Step "Installation Complete!"

    Write-Host @"

Claudia Coder has been installed successfully!

Install Directory: $($Script:Config.InstallDir)

Services:
  - Claudia Coder:  http://localhost:$($Script:Config.Ports.ClaudiaCoder)
  - GitLab:         http://$($Script:Config.GitLabDomain):$($Script:Config.Ports.GitLab)
  - n8n:            http://$($Script:Config.N8nDomain):$($Script:Config.Ports.N8n)
  - Whisper:        http://localhost:$($Script:Config.Ports.Whisper)

Shortcuts have been added to your Desktop and Start Menu.

Quick Commands:
  - Start services:  $($Script:Config.InstallDir)\scripts\start-services.ps1
  - Stop services:   $($Script:Config.InstallDir)\scripts\stop-services.ps1
  - Check status:    $($Script:Config.InstallDir)\scripts\status.ps1

GitLab Initial Setup:
  1. Wait for GitLab to fully start (2-5 minutes on first run)
  2. Navigate to http://$($Script:Config.GitLabDomain):$($Script:Config.Ports.GitLab)
  3. Get initial root password: docker exec -it claudia-gitlab grep 'Password:' /etc/gitlab/initial_root_password

For help, visit: https://github.com/claudia-coder/claudia-coder

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
        # WSL2 check (required for Docker Desktop)
        $rebootNeeded = Enable-WSL2
        if ($rebootNeeded) {
            Request-RebootForWSL
            return  # Will not reach here if user chose to reboot
        }

        # Prerequisites
        Install-DockerDesktop
        Install-NodeJS
        Install-Git
        Install-Rust

        # Installation
        New-InstallDirectory
        Get-ClaudiaCoderSource
        Get-Ganesha2Source
        Build-Ganesha2

        # Configuration
        New-DockerCompose
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
