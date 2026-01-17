# Claudia Coder Deployment Guide

This guide explains how to deploy Claudia Coder on different platforms. Whether you're a developer setting up a local environment or deploying to production, this guide covers all the options.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Environment Variables](#2-environment-variables)
3. [Docker Deployment (Recommended)](#3-docker-deployment-recommended)
4. [Local Development Setup](#4-local-development-setup)
5. [Production Deployment](#5-production-deployment)
6. [Platform-Specific Notes](#6-platform-specific-notes)
7. [Hosted/Cloud Deployment](#7-hostedcloud-deployment)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Prerequisites

Before deploying Claudia Coder, ensure you have the following installed:

### Required Software

| Software | Minimum Version | Purpose |
|----------|-----------------|---------|
| Node.js | 20.x or higher | Runtime environment |
| npm | 10.x or higher | Package manager (comes with Node.js) |
| Docker | 24.x or higher | Container runtime (for Docker deployment) |
| Docker Compose | 2.x or higher | Multi-container orchestration |
| Git | 2.x or higher | Version control |

### System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| RAM | 8 GB | 16 GB |
| Disk Space | 20 GB | 50 GB |
| CPU | 4 cores | 8 cores |

### Checking Your Versions

```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# Check Docker version
docker --version

# Check Docker Compose version
docker compose version

# Check Git version
git --version
```

---

## 2. Environment Variables

Claudia Coder uses environment variables for configuration. Create a `.env.local` file in the project root.

### Quick Setup

```bash
# Copy the example file
cp .env.example .env.local

# Edit with your values
nano .env.local
```

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `BETTER_AUTH_SECRET` | Secret key for authentication (generate with `openssl rand -base64 32`) | `your-32-char-secret-key` |
| `NEXT_PUBLIC_APP_URL` | Your application URL | `http://localhost:3000` |

### Optional Variables

#### API Keys (for AI features)
```env
# Anthropic Claude API (for AI features)
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

#### Bundled Services (auto-configured in Docker)
```env
# These are pre-configured for Docker deployment
NEXT_PUBLIC_WHISPER_URL=http://localhost:8000
NEXT_PUBLIC_N8N_URL=http://localhost:5678
NEXT_PUBLIC_OLLAMA_URL=http://localhost:11434
```

#### Email Configuration (for invitations)
```env
# Option 1: Resend (recommended)
RESEND_API_KEY=re_xxxxx

# Option 2: SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
EMAIL_FROM=Claudia <noreply@claudiacoder.com>
```

#### OAuth (optional)
```env
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxx
GITHUB_CLIENT_ID=xxxxx
GITHUB_CLIENT_SECRET=xxxxx
```

### Generating Secrets

```bash
# Generate a secure authentication secret
openssl rand -base64 32
```

---

## 3. Docker Deployment (Recommended)

Docker is the easiest way to deploy Claudia Coder. Choose one of these methods:

### Method A: One-Command All-in-One Install (Easiest)

The all-in-one installer sets up everything automatically.

**Linux:**
```bash
curl -fsSL https://claudiacoder.com/install.sh | bash
```

**Or download and run manually:**
```bash
# Download the installer
wget https://github.com/claudiacoder/claudia-admin/raw/main/installer/linux/install.sh

# Make it executable
chmod +x install.sh

# Run it
./install.sh
```

**macOS:**
```bash
# Download the installer
curl -O https://github.com/claudiacoder/claudia-admin/raw/main/installer/macos/install.sh

# Make it executable
chmod +x install.sh

# Run it
./install.sh
```

**Windows:**
1. Download `installer/windows/install-claudia.ps1`
2. Right-click and select "Run with PowerShell" (as Administrator)
3. Follow the prompts

### Method B: Docker Compose

For more control, use Docker Compose:

```bash
# Clone the repository
git clone https://github.com/claudiacoder/claudia-admin.git
cd claudia-admin

# Copy environment file
cp docker/.env.example docker/.env

# Edit your settings
nano docker/.env

# Start all services
docker compose -f docker/docker-compose.yml up -d
```

### Method C: Simple Docker Run

For a minimal setup:

```bash
# Create a data volume
docker volume create claudia-data

# Run the container
docker run -d \
  --name claudia-coder \
  --restart unless-stopped \
  -p 3000:3000 \
  -v claudia-data:/data \
  -e BETTER_AUTH_SECRET=$(openssl rand -hex 32) \
  claudiacoder/allinone
```

### Docker Service URLs

After deployment, access these services:

| Service | URL | Description |
|---------|-----|-------------|
| Claudia Coder | http://localhost:3000 | Main application |
| n8n | http://localhost:5678 | Workflow automation |
| Gitea | http://localhost:8929 | Git server |
| Whisper | http://localhost:8000 | Speech-to-text |

### Docker Management Commands

```bash
# View running containers
docker ps

# View logs
docker logs claudia-coder -f

# Stop services
docker stop claudia-coder

# Start services
docker start claudia-coder

# Restart services
docker restart claudia-coder

# Remove container (keeps data)
docker rm claudia-coder

# Remove container AND data
docker rm claudia-coder
docker volume rm claudia-data
```

---

## 4. Local Development Setup

For developers who want to modify the code:

### Step 1: Clone the Repository

```bash
git clone https://github.com/claudiacoder/claudia-admin.git
cd claudia-admin
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment

```bash
cp .env.example .env.local
# Edit .env.local with your settings
```

### Step 4: Run Development Server

```bash
# Standard development mode
npm run dev

# With HTTPS (requires SSL certificates)
npm run claudia

# Accessible on local network
npm run claudia:lan
```

### Step 5: Access the Application

Open http://localhost:3000 in your browser.

### Available npm Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run end-to-end tests |

---

## 5. Production Deployment

### Build for Production

```bash
# Install dependencies
npm ci

# Build the application
npm run build

# Start the production server
npm start
```

### Using the Standalone Build

Next.js creates a standalone build optimized for Docker:

```bash
# Build
npm run build

# The standalone output is in .next/standalone/
# Copy static files
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static

# Run
node .next/standalone/server.js
```

### Production Environment Variables

Set these additional variables for production:

```env
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
BETTER_AUTH_SECRET=<generate-strong-secret>
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Running Behind a Reverse Proxy

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/ssl/certs/your-cert.pem;
    ssl_certificate_key /etc/ssl/private/your-key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 6. Platform-Specific Notes

### Linux (Ubuntu/Debian)

**Installing Prerequisites:**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# Log out and back in for group changes
```

**Using the Linux Installer:**

```bash
cd installer/linux
chmod +x install.sh
./install.sh
```

**Options:**
- `./install.sh --status` - Check status
- `./install.sh --stop` - Stop services
- `./install.sh --start` - Start services
- `./install.sh --update` - Update to latest
- `./install.sh --uninstall` - Remove

### Windows (WSL Recommended)

**Option 1: WSL2 (Recommended)**

1. Enable WSL2:
   ```powershell
   wsl --install
   ```
2. Install Ubuntu from Microsoft Store
3. Follow Linux instructions inside WSL

**Option 2: Native Windows with Docker Desktop**

1. Install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop)
2. Enable WSL2 backend in Docker Desktop settings
3. Run the Windows installer:
   ```powershell
   # In PowerShell (Administrator)
   Set-ExecutionPolicy Bypass -Scope Process
   .\installer\windows\install-claudia.ps1
   ```

**Important Windows Notes:**
- Virtualization must be enabled in BIOS
- Windows 10 version 1903+ or Windows 11 required
- 16 GB RAM recommended

### macOS

**Installing Prerequisites:**

```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node@20

# Install Docker Desktop
brew install --cask docker
```

**Using the macOS Installer:**

```bash
cd installer/macos
chmod +x install.sh
./install.sh
```

**Notes:**
- Docker Desktop is required (not Docker Engine)
- Apple Silicon (M1/M2/M3) is fully supported
- Rosetta 2 not required

---

## 7. Hosted/Cloud Deployment

### Vercel (Easiest for Next.js)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push

**Note:** Vercel is for the Next.js app only. You'll need separate hosting for databases and services.

### DigitalOcean App Platform

1. Create a new App from GitHub
2. Select the repository
3. Configure environment variables
4. Deploy

### AWS (Elastic Beanstalk)

```bash
# Install EB CLI
pip install awsebcli

# Initialize
eb init claudia-coder --platform node.js

# Create environment
eb create production

# Deploy
eb deploy
```

### Self-Hosted VPS (General Steps)

1. Provision a VPS (Ubuntu 22.04 recommended)
2. Install Docker and Docker Compose
3. Clone the repository
4. Configure environment variables
5. Run with Docker Compose
6. Set up SSL with Let's Encrypt
7. Configure firewall (allow ports 80, 443)

**Quick VPS Setup:**
```bash
# SSH into your server
ssh user@your-server-ip

# Run the installer
curl -fsSL https://claudiacoder.com/install.sh | bash
```

### Resource Recommendations by Platform

| Platform | Instance Type | Cost (approx) |
|----------|--------------|---------------|
| DigitalOcean | 4GB Droplet | $24/month |
| AWS | t3.medium | $30/month |
| Google Cloud | e2-medium | $25/month |
| Linode | 4GB Linode | $24/month |

---

## 8. Troubleshooting

### Common Issues

#### "Docker is not running"

**Problem:** Services fail to start.

**Solution:**
```bash
# Linux
sudo systemctl start docker
sudo systemctl enable docker

# macOS/Windows
# Open Docker Desktop application
```

#### "Port already in use"

**Problem:** Error about port 3000 being in use.

**Solution:**
```bash
# Find what's using the port
lsof -i :3000  # Linux/macOS
netstat -ano | findstr :3000  # Windows

# Kill the process or use a different port
docker run -p 3001:3000 ...
```

#### "Permission denied"

**Problem:** Docker permission errors on Linux.

**Solution:**
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Log out and back in, then verify
groups  # Should show 'docker'
```

#### "Cannot connect to localhost"

**Problem:** Application not accessible.

**Solution:**
```bash
# Check if container is running
docker ps

# Check container logs
docker logs claudia-coder

# Verify port mapping
docker port claudia-coder
```

#### "Build fails with memory error"

**Problem:** npm install or build runs out of memory.

**Solution:**
```bash
# Increase Node memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

#### "Database connection failed"

**Problem:** SQLite or PostgreSQL connection errors.

**Solution:**
```bash
# Ensure data volume exists
docker volume ls

# Check file permissions
ls -la .local-storage/

# For Docker, ensure volume is mounted
docker inspect claudia-coder | grep Mounts
```

### Getting Help

If you encounter issues not listed here:

1. **Check the logs:**
   ```bash
   docker logs claudia-coder
   npm run dev  # Check terminal output
   ```

2. **Search existing issues** on GitHub

3. **Create a new issue** with:
   - Your operating system and version
   - Docker/Node.js versions
   - Complete error message
   - Steps to reproduce

### Reset Everything

If all else fails, start fresh:

```bash
# Stop all containers
docker stop $(docker ps -q)

# Remove Claudia containers
docker rm claudia-coder claudia-n8n claudia-whisper

# Remove volumes (WARNING: deletes data)
docker volume rm claudia-data

# Reinstall
./installer/linux/install.sh
```

---

## Quick Reference

### One-Line Install Commands

| Platform | Command |
|----------|---------|
| Linux | `curl -fsSL https://claudiacoder.com/install.sh \| bash` |
| macOS | `./installer/macos/install.sh` |
| Windows | `powershell -ExecutionPolicy Bypass -File install-claudia.ps1` |

### Default Ports

| Service | Port |
|---------|------|
| Claudia Coder | 3000 |
| n8n | 5678 |
| Gitea | 8929 |
| Whisper | 8000 |
| PostgreSQL | 5432 |
| Redis | 6379 |

### Default Credentials

| Service | Username | Password |
|---------|----------|----------|
| n8n | admin | changeme |

**Important:** Change all default passwords immediately after installation!

---

## Need More Help?

- Website: https://claudiacoder.com
- Documentation: https://docs.claudiacoder.com
- GitHub Issues: https://github.com/claudiacoder/claudia-admin/issues
