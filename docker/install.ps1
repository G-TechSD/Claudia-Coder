# ============================================
# Claudia Coder - Windows PowerShell Installation Script
# ============================================
# PRIVATE DEPLOYMENT ONLY
# Run this script as Administrator

#Requires -Version 5.1

$ErrorActionPreference = "Stop"

# Script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Colors
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "          Claudia Coder Docker Installation" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

# ============================================
# Prerequisites Check
# ============================================

Write-Host "Checking prerequisites..." -ForegroundColor Yellow

# Check if running as Administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Warning: Not running as Administrator. Some features may not work." -ForegroundColor Yellow
}

# Check Docker
try {
    $dockerVersion = docker --version
    Write-Host "  Docker: $($dockerVersion -replace 'Docker version ', '' -replace ',.*', '')" -ForegroundColor Green
} catch {
    Write-Host "Error: Docker is not installed or not in PATH." -ForegroundColor Red
    Write-Host ""
    Write-Host "Install Docker Desktop from:"
    Write-Host "  https://docs.docker.com/desktop/install/windows-install/"
    exit 1
}

# Check Docker is running
try {
    docker info 2>&1 | Out-Null
} catch {
    Write-Host "Error: Docker is not running." -ForegroundColor Red
    Write-Host "Please start Docker Desktop."
    exit 1
}

# Check Docker Compose
try {
    $composeVersion = docker compose version --short
    Write-Host "  Docker Compose: $composeVersion" -ForegroundColor Green
    $ComposeCmd = "docker compose"
} catch {
    Write-Host "Error: Docker Compose is not available." -ForegroundColor Red
    Write-Host "Please update Docker Desktop to get Docker Compose V2."
    exit 1
}

# Check available memory
$totalMemGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB)
Write-Host "  System RAM: ${totalMemGB}GB" -ForegroundColor Green

if ($totalMemGB -lt 8) {
    Write-Host "Warning: Less than 8GB RAM detected. Consider disabling GitLab." -ForegroundColor Yellow
}

# ============================================
# Environment Setup
# ============================================

Write-Host ""
Write-Host "Setting up environment..." -ForegroundColor Yellow

if (-not (Test-Path ".env")) {
    Write-Host "Creating .env from .env.example..."
    Copy-Item ".env.example" ".env"

    # Generate secure secrets
    Write-Host "Generating secure secrets..."

    # Generate random strings
    function Get-RandomString {
        param([int]$Length = 32)
        $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        $random = 1..$Length | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] }
        return -join $random
    }

    function Get-RandomBase64 {
        param([int]$Bytes = 32)
        $randomBytes = New-Object byte[] $Bytes
        [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($randomBytes)
        return [Convert]::ToBase64String($randomBytes)
    }

    $AuthSecret = Get-RandomBase64 -Bytes 32
    $PostgresPassword = Get-RandomString -Length 24
    $N8nPassword = Get-RandomString -Length 16
    $N8nEncryption = Get-RandomString -Length 32

    # Update .env file
    $envContent = Get-Content ".env" -Raw
    $envContent = $envContent -replace "BETTER_AUTH_SECRET=.*", "BETTER_AUTH_SECRET=$AuthSecret"
    $envContent = $envContent -replace "POSTGRES_PASSWORD=.*", "POSTGRES_PASSWORD=$PostgresPassword"
    $envContent = $envContent -replace "N8N_PASSWORD=.*", "N8N_PASSWORD=$N8nPassword"
    $envContent = $envContent -replace "N8N_ENCRYPTION_KEY=.*", "N8N_ENCRYPTION_KEY=$N8nEncryption"
    $envContent | Set-Content ".env" -NoNewline

    Write-Host "  Secure secrets generated and saved to .env" -ForegroundColor Green
} else {
    Write-Host "  Using existing .env file" -ForegroundColor Green
}

# ============================================
# Pull Images
# ============================================

Write-Host ""
Write-Host "Pulling Docker images (this may take a while)..." -ForegroundColor Yellow

Invoke-Expression "$ComposeCmd pull postgres redis n8n whisper"

if ($totalMemGB -ge 12) {
    Write-Host "Pulling GitLab image..."
    Invoke-Expression "$ComposeCmd pull gitlab"
} else {
    Write-Host "Skipping GitLab (insufficient memory). You can enable it later." -ForegroundColor Yellow
}

Write-Host "  Images pulled successfully" -ForegroundColor Green

# ============================================
# Build Claudia App
# ============================================

Write-Host ""
Write-Host "Building Claudia app..." -ForegroundColor Yellow

Invoke-Expression "$ComposeCmd build claudia-app"

Write-Host "  Claudia app built successfully" -ForegroundColor Green

# ============================================
# Start Services
# ============================================

Write-Host ""
Write-Host "Starting services..." -ForegroundColor Yellow

# Start core services first
Invoke-Expression "$ComposeCmd up -d postgres redis"

Write-Host "Waiting for database to be ready..."
Start-Sleep -Seconds 10

# Check PostgreSQL health
$retries = 30
while ($retries -gt 0) {
    try {
        $result = docker exec claudia-postgres pg_isready -U claudia 2>&1
        if ($LASTEXITCODE -eq 0) {
            break
        }
    } catch {}
    Write-Host "  Waiting for PostgreSQL..."
    Start-Sleep -Seconds 2
    $retries--
}

Write-Host "  PostgreSQL ready" -ForegroundColor Green

# Start remaining services
Invoke-Expression "$ComposeCmd up -d claudia-app n8n whisper"

if ($totalMemGB -ge 12) {
    Write-Host "Starting GitLab (this takes 3-5 minutes)..."
    Invoke-Expression "$ComposeCmd up -d gitlab"
}

# ============================================
# Wait for Services
# ============================================

Write-Host ""
Write-Host "Waiting for services to be ready..." -ForegroundColor Yellow

# Function to check URL
function Test-ServiceReady {
    param([string]$Url, [string]$Name)
    Write-Host -NoNewline "  ${Name}: "
    $retries = 60
    while ($retries -gt 0) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Host " Ready" -ForegroundColor Green
                return $true
            }
        } catch {}
        Write-Host -NoNewline "."
        Start-Sleep -Seconds 2
        $retries--
    }
    Write-Host " Timeout" -ForegroundColor Red
    return $false
}

Test-ServiceReady -Url "http://localhost:3000" -Name "Claudia"
Test-ServiceReady -Url "http://localhost:5678/healthz" -Name "n8n"
Test-ServiceReady -Url "http://localhost:8000/health" -Name "Whisper"

# ============================================
# Print Access Information
# ============================================

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "               Installation Complete!" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Access your services:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Claudia App:     http://localhost:3000" -ForegroundColor Green
Write-Host "  n8n Workflows:   http://localhost:5678" -ForegroundColor Green
Write-Host "  Whisper STT:     http://localhost:8000" -ForegroundColor Green

if ($totalMemGB -ge 12) {
    Write-Host "  GitLab:          http://localhost:8080" -ForegroundColor Green
    Write-Host ""
    Write-Host "GitLab Note:" -ForegroundColor Yellow
    Write-Host "  GitLab takes 3-5 minutes to fully start."
    Write-Host "  Get initial root password with:"
    Write-Host "    docker exec claudia-gitlab cat /etc/gitlab/initial_root_password"
}

# Read n8n credentials from .env
$envContent = Get-Content ".env"
$n8nUser = ($envContent | Where-Object { $_ -match "^N8N_USER=" }) -replace "N8N_USER=", ""
$n8nPass = ($envContent | Where-Object { $_ -match "^N8N_PASSWORD=" }) -replace "N8N_PASSWORD=", ""

Write-Host ""
Write-Host "n8n Credentials:" -ForegroundColor Cyan
Write-Host "  Username: $n8nUser"
Write-Host "  Password: $n8nPass"
Write-Host ""
Write-Host "Useful Commands:" -ForegroundColor Cyan
Write-Host "  View logs:      $ComposeCmd logs -f"
Write-Host "  Stop services:  $ComposeCmd down"
Write-Host "  Restart:        $ComposeCmd restart"
Write-Host ""
Write-Host "Important: Review and update .env with your API keys." -ForegroundColor Yellow
Write-Host ""
