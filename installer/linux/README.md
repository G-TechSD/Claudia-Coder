# Claudia Coder - Linux Installer

One-command installer for Claudia Coder on Linux systems.

## Quick Install

```bash
curl -fsSL https://claudiacoder.com/install.sh | bash
```

Or download and run manually:

```bash
wget https://claudiacoder.com/install.sh
chmod +x install.sh
./install.sh
```

## Supported Distributions

- Ubuntu / Debian
- Fedora / RHEL / CentOS
- Arch Linux
- Any distro with Docker support

## What Gets Installed

Claudia Coder is a single all-in-one Docker container that includes:

| Service | Port | Description |
|---------|------|-------------|
| Main App | 3000 | Claudia Coder web interface |
| Gitea | 8929 | Git server (pre-configured) |
| n8n | 5678 | Workflow automation |
| Whisper | 8000 | Speech-to-text API |

All services are managed by supervisord inside the container.

## Requirements

- Linux (64-bit)
- Docker (installed automatically if missing)
- 4GB RAM minimum
- 10GB disk space

## Usage

### Install

```bash
./install.sh
```

### Update to Latest Version

```bash
./install.sh --update
```

### Stop Services

```bash
./install.sh --stop
```

### Start Services

```bash
./install.sh --start
```

### Check Status

```bash
./install.sh --status
```

### Uninstall

```bash
./install.sh --uninstall
```

### Silent Install (Non-interactive)

```bash
./install.sh --silent
```

## Default Credentials

| Service | Username | Password |
|---------|----------|----------|
| n8n | admin | changeme |

Gitea is pre-configured with `INSTALL_LOCK=true` - no setup wizard required.

## Data Persistence

All data is stored in a Docker volume named `claudia-data`. This includes:

- Git repositories
- n8n workflows
- Database data
- Configuration files

The volume persists across container updates.

## Ports

| Port | Service |
|------|---------|
| 3000 | Main Application |
| 8929 | Git (SSH/HTTP) |
| 5678 | n8n |
| 8000 | Whisper API |

## Troubleshooting

### Docker permission denied

If you get permission errors after installation, log out and back in for group changes to take effect:

```bash
newgrp docker
```

### Services not responding

Check container logs:

```bash
docker logs claudia-coder
```

### Port conflicts

If ports are in use, stop conflicting services or modify the install script.

### Reset everything

```bash
./install.sh --uninstall  # Choose to remove data volume
./install.sh              # Fresh install
```

## Support

- Website: https://claudiacoder.com
- Documentation: https://docs.claudiacoder.com
- Issues: https://github.com/claudiacoder/claudia-admin/issues

---
