# Claudia Admin - Windows Installer

A complete local AI development environment for Windows. Get up and running in minutes with a single command.

---

## Quick Start

### One Command Installation

Open **PowerShell as Administrator** and run:

```powershell
.\install.bat
```

That's it! The installer handles everything automatically.

### What Gets Installed

- **Claudia Coder** - AI-powered coding assistant
- **GitLab CE** - Git repository management
- **n8n** - Workflow automation platform
- **Whisper** - Speech-to-text transcription
- **Ganesha2** - CLI tool for managing your environment

### System Requirements

| Requirement | Minimum |
|-------------|---------|
| Operating System | Windows 10 (version 1903+) or Windows 11 |
| RAM | 16 GB |
| Disk Space | 50 GB free |
| Processor | 64-bit with virtualization support |

---

## What Gets Installed

After installation, you'll have access to the following services:

| Service | URL | Description |
|---------|-----|-------------|
| Claudia Coder | http://localhost:3000 | AI coding assistant with code completion and chat |
| GitLab CE | http://localhost:8929 | Full-featured Git repository server |
| n8n | http://localhost:5678 | Visual workflow automation tool |
| Whisper | http://localhost:8000 | OpenAI Whisper for audio transcription |

### Ganesha2 CLI Tool

The `ganesha2` command-line tool is installed globally and provides quick access to manage your Claudia environment from any terminal.

---

## Prerequisites

The installer will check for and configure these automatically:

### Docker Desktop

- **Auto-installed** if not present on your system
- Required for running all containerized services
- The installer will download and install Docker Desktop for you

### Virtualization

One of the following must be enabled (the installer will guide you):

- **Hyper-V** - Built into Windows Pro/Enterprise/Education
- **WSL2** - Windows Subsystem for Linux 2 (recommended for Windows Home)

To check if virtualization is enabled, open PowerShell and run:

```powershell
systeminfo | findstr /i "Hyper-V"
```

### Administrator Rights

- The installer **must be run as Administrator**
- Right-click PowerShell and select "Run as administrator"
- Required for installing Docker and system services

---

## Post-Installation

### Default Login Credentials

#### GitLab CE

| Field | Value |
|-------|-------|
| Username | `root` |
| Password | Check the file `gitlab-initial-password.txt` in the installation directory |

*Note: You will be prompted to change the password on first login.*

#### n8n

| Field | Value |
|-------|-------|
| Username | `admin@localhost` |
| Password | `admin` |

*Note: Change these credentials immediately after first login.*

#### Claudia Coder

No login required for local access. The interface is accessible immediately at http://localhost:3000.

### Accessing Each Service

1. **Claudia Coder**: Open your browser and navigate to http://localhost:3000
2. **GitLab**: Navigate to http://localhost:8929 and log in with the root credentials
3. **n8n**: Navigate to http://localhost:5678 to access the workflow editor
4. **Whisper API**: Send audio files to http://localhost:8000/transcribe

### Configuring LM Studio Connection

Claudia Coder can connect to LM Studio for local LLM inference:

1. **Install LM Studio** from https://lmstudio.ai
2. **Download a model** in LM Studio (recommended: CodeLlama or similar coding model)
3. **Start the local server** in LM Studio:
   - Go to the "Local Server" tab
   - Click "Start Server" (default port: 1234)
4. **Configure Claudia Coder**:
   - Open Claudia Coder at http://localhost:3000
   - Go to Settings > LLM Configuration
   - Set the API endpoint to: `http://host.docker.internal:1234/v1`
   - Select your model from the dropdown
   - Click "Test Connection" to verify

---

## Commands

The following batch files are available in the installation directory:

### start-claudia.bat

Start all Claudia services:

```powershell
.\start-claudia.bat
```

This starts Docker containers for all services. First startup may take a few minutes.

### stop-claudia.bat

Stop all running services:

```powershell
.\stop-claudia.bat
```

Gracefully shuts down all containers while preserving your data.

### status.bat

Check the status of all services:

```powershell
.\status.bat
```

Shows which services are running and their health status.

### uninstall.bat

Remove Claudia Admin from your system:

```powershell
.\uninstall.bat
```

**Warning**: This will remove all containers and data. Back up any important projects first!

---

## Troubleshooting

### Common Issues and Fixes

#### "Docker is not running"

**Problem**: Services fail to start because Docker Desktop is not running.

**Solution**:
1. Open Docker Desktop from the Start menu
2. Wait for it to fully start (whale icon in system tray will stop animating)
3. Run `.\start-claudia.bat` again

#### "Port already in use"

**Problem**: Another application is using one of the required ports.

**Solution**:
1. Find what's using the port:
   ```powershell
   netstat -ano | findstr :3000
   ```
2. Stop the conflicting application, or
3. Edit the `.env` file to use different ports

#### "Virtualization not enabled"

**Problem**: Docker cannot start because virtualization is disabled in BIOS.

**Solution**:
1. Restart your computer and enter BIOS/UEFI settings
2. Find virtualization settings (Intel VT-x or AMD-V)
3. Enable virtualization
4. Save and restart

#### "WSL2 installation incomplete"

**Problem**: WSL2 is not fully installed or updated.

**Solution**:
```powershell
wsl --update
wsl --set-default-version 2
```

Then restart Docker Desktop.

#### "GitLab takes too long to start"

**Problem**: GitLab container health check fails or takes forever.

**Solution**: GitLab is resource-intensive and may take 5-10 minutes on first startup. Check its status with:
```powershell
docker logs claudia-gitlab
```

### How to Check Logs

View logs for any service:

```powershell
# All services
docker-compose logs

# Specific service
docker-compose logs claudia-coder
docker-compose logs gitlab
docker-compose logs n8n
docker-compose logs whisper

# Follow logs in real-time
docker-compose logs -f claudia-coder
```

### How to Reset

If you need to start fresh without reinstalling:

```powershell
# Stop all services
.\stop-claudia.bat

# Remove all containers and volumes (WARNING: deletes all data)
docker-compose down -v

# Start fresh
.\start-claudia.bat
```

To reset only a specific service:

```powershell
docker-compose rm -f -s -v claudia-coder
docker-compose up -d claudia-coder
```

---

## Updating

### Update to Latest Version

To update Claudia Admin to the latest version:

```powershell
# 1. Stop all services
.\stop-claudia.bat

# 2. Pull the latest images
docker-compose pull

# 3. Start services with new images
.\start-claudia.bat
```

### Checking for Updates

View your current versions:

```powershell
docker-compose images
```

### Major Version Updates

For major version updates, check the release notes first:

1. Visit the Claudia Admin releases page
2. Review any breaking changes or migration steps
3. Back up your data before updating
4. Follow any version-specific upgrade instructions

---

## Getting Help

If you encounter issues not covered in this guide:

1. Check the logs for error messages
2. Search existing issues in the project repository
3. Create a new issue with:
   - Your Windows version
   - Error messages from logs
   - Steps to reproduce the problem

---

## License

See the LICENSE file in the project root for licensing information.
