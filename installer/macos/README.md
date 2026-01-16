# Claudia Coder - macOS Installer

The easiest way to run Claudia Coder on your Mac.

## Quick Start

```bash
# Download and run
curl -fsSL https://claudiacoder.com/install-mac.sh | bash

# Or clone and run locally
./install.sh
```

## Requirements

- **macOS 10.15+** (Catalina or newer)
- **Docker Desktop** (installer will offer to install via Homebrew)
- **4GB RAM minimum** (8GB recommended)

## What Gets Installed

Claudia Coder runs as a single Docker container that includes:

| Service | Port | Description |
|---------|------|-------------|
| Main App | 3000 | Claudia Coder web interface |
| Git Server | 8929 | Gitea git hosting (pre-configured) |
| n8n | 5678 | Workflow automation |
| Whisper | 8000 | Speech-to-text API |

All data is stored in a Docker volume (`claudia-data`) for persistence.

## Commands

```bash
# Install Claudia Coder
./install.sh

# Update to latest version
./install.sh --update

# Stop the container
./install.sh --stop

# Start the container
./install.sh --start

# Check status
./install.sh --status

# Uninstall (keeps data by default)
./install.sh --uninstall

# Non-interactive install
./install.sh --silent
```

## Default Credentials

| Service | Username | Password |
|---------|----------|----------|
| n8n | admin | changeme |

## Ports

Make sure these ports are available:

- `3000` - Main application
- `8929` - Git server
- `5678` - n8n workflows
- `8000` - Whisper API

## Troubleshooting

### Docker not starting

```bash
# Start Docker Desktop manually
open -a Docker

# Wait a moment, then retry
./install.sh
```

### Port already in use

Check what's using the port:
```bash
lsof -i :3000
```

### View container logs

```bash
docker logs claudia-coder
```

### Reset everything

```bash
./install.sh --uninstall  # Choose 'y' to remove data
./install.sh              # Fresh install
```

## Data Location

Your data is stored in a Docker volume:
```bash
docker volume inspect claudia-data
```

## Support

- Website: https://claudiacoder.com
- Documentation: https://docs.claudiacoder.com
- Issues: https://github.com/claudiacoder/claudia-coder/issues
