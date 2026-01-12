# Claudia Coder - Installation Options

This guide covers the available installation methods for Claudia Coder and its dependencies.

## Overview

Claudia Coder is a comprehensive development environment that includes:

| Service | Description | Port |
|---------|-------------|------|
| **Claudia Coder** | Main Next.js application | 3000 |
| **Gitea** | Lightweight Git server (alternative to GitLab) | 8929 |
| **n8n** | Workflow automation platform | 5678 |
| **Whisper** | Speech-to-text API (faster-whisper) | 8000 |
| **PostgreSQL** | Database for n8n and Gitea | 5432 (internal) |
| **Redis** | Caching and session storage | 6379 (internal) |

---

## Installation Options

### Option A: Single Docker Image (Simple)

**Best for:** Developers familiar with Docker who want quick setup.

The all-in-one Docker image bundles everything into a single container managed by Supervisor.

#### Prerequisites

- Docker installed and running
- 8GB+ RAM recommended
- 10GB+ free disk space

#### Quick Start

**Linux/macOS:**
```bash
# Download and run
./docker-run.sh start

# Or using docker directly:
docker run -d --name claudia \
  -p 3000:3000 \
  -p 8929:8929 \
  -p 5678:5678 \
  -p 8000:8000 \
  -v claudia-data:/data \
  claudiacoder/allinone:latest
```

**Windows:**
```batch
REM Run the batch script
docker-run.bat start

REM Or using docker directly:
docker run -d --name claudia ^
  -p 3000:3000 ^
  -p 8929:8929 ^
  -p 5678:5678 ^
  -p 8000:8000 ^
  -v claudia-data:/data ^
  claudiacoder/allinone:latest
```

#### Building Locally

If you need to build the image yourself:

```bash
# Linux/macOS
./docker-run.sh build

# Windows
docker-run.bat build
```

#### Management Commands

| Command | Description |
|---------|-------------|
| `start` | Start the container |
| `stop` | Stop the container |
| `restart` | Restart the container |
| `logs` | View logs (follow mode) |
| `status` | Check service health |
| `build` | Build image locally |
| `remove` | Remove container (keeps data) |
| `clean` | Remove container and ALL data |

#### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | API key for Claude AI features | - |
| `BETTER_AUTH_SECRET` | Authentication secret | Auto-generated |
| `N8N_BASIC_AUTH_USER` | n8n admin username | `admin` |
| `N8N_BASIC_AUTH_PASSWORD` | n8n admin password | `changeme` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `claudia_secure_password` |

Example with environment variables:
```bash
ANTHROPIC_API_KEY=sk-ant-xxx N8N_BASIC_AUTH_PASSWORD=mysecret ./docker-run.sh start
```

---

### Option B: Windows Installer (No Docker Knowledge Needed)

**Best for:** Windows users who want a GUI-based installation without Docker experience.

See the `../windows/` directory for the Windows installer that:

- Automatically installs Docker Desktop if needed
- Provides a step-by-step installation wizard
- Creates desktop shortcuts
- Manages services through batch scripts

#### Using the Windows Installer

1. Navigate to `installer/windows/`
2. Run `install.bat` as Administrator
3. Follow the prompts
4. Access Claudia at http://localhost:3000

---

### Option C: Docker Compose (Multi-Container)

**Best for:** Production deployments or users who want separate containers per service.

See the `../../docker/` directory for docker-compose based deployment with:

- Separate containers for each service
- Better resource isolation
- Easier horizontal scaling
- GitLab CE option (heavier but more features)

```bash
cd ../../docker
docker-compose up -d
```

---

## Comparison of Options

| Feature | All-in-One Docker | Windows Installer | Docker Compose |
|---------|-------------------|-------------------|----------------|
| **Ease of Setup** | Simple | Very Simple | Moderate |
| **Docker Knowledge** | Basic | None | Intermediate |
| **Resource Usage** | Lower | Lowest | Higher |
| **Service Isolation** | No | No | Yes |
| **Git Server** | Gitea (~100MB) | Gitea | GitLab CE (~2GB+) |
| **Scalability** | Limited | Limited | Good |
| **Best For** | Development | Windows Beginners | Production |

---

## Service Access

Once running, access your services at:

| Service | URL | Default Credentials |
|---------|-----|---------------------|
| Claudia Coder | http://localhost:3000 | Create on first run |
| Gitea | http://localhost:8929 | Create on first run |
| n8n | http://localhost:5678 | `admin` / `changeme` |
| Whisper API | http://localhost:8000 | No auth required |

---

## Architecture

### All-in-One Container Architecture

```
+------------------------------------------------------------------+
|                    Claudia All-in-One Container                   |
+------------------------------------------------------------------+
|                                                                   |
|  +----------------+  +----------------+  +-------------------+   |
|  |    Claudia     |  |     Gitea      |  |        n8n        |   |
|  |   (Next.js)    |  |  (Git Server)  |  |    (Workflows)    |   |
|  |   Port 3000    |  |   Port 8929    |  |    Port 5678      |   |
|  +----------------+  +----------------+  +-------------------+   |
|                                                                   |
|  +----------------+  +----------------+  +-------------------+   |
|  |    Whisper     |  |   PostgreSQL   |  |      Redis        |   |
|  | (Speech-to-Text)|  |   (Database)   |  |     (Cache)       |   |
|  |   Port 8000    |  |   Port 5432    |  |    Port 6379      |   |
|  +----------------+  +----------------+  +-------------------+   |
|                                                                   |
|  +------------------------------------------------------------+ |
|  |                       Supervisor                            | |
|  |                   (Process Manager)                         | |
|  +------------------------------------------------------------+ |
|                                                                   |
+------------------------------------------------------------------+
                              |
                              v
                    +-------------------+
                    |   /data Volume    |
                    | (Persistent Data) |
                    +-------------------+
```

### Data Persistence

All data is stored in a Docker volume (`claudia-data`) mounted at `/data`:

```
/data/
├── claudia/          # Claudia app data
├── gitea/            # Git repositories and config
├── n8n/              # Workflow definitions
├── postgresql/       # Database files
├── redis/            # Redis persistence
└── whisper/          # Whisper model cache
```

---

## Troubleshooting

### Container won't start

1. Check Docker is running: `docker info`
2. Check available memory: At least 4GB free recommended
3. Check port availability: `netstat -an | grep -E "3000|8929|5678|8000"`

### Services not responding

Services take 1-2 minutes to initialize. Check status:

```bash
# Linux/macOS
./docker-run.sh status

# Windows
docker-run.bat status

# Or check logs
docker logs claudia
```

### Out of memory

Increase Docker memory allocation:
- Docker Desktop: Settings > Resources > Memory > 8GB+
- Linux: Ensure system has adequate RAM

### Reset everything

```bash
# Linux/macOS
./docker-run.sh clean

# Windows
docker-run.bat clean
```

---

## System Requirements

### Minimum
- CPU: 2 cores
- RAM: 4GB
- Disk: 10GB
- OS: Windows 10/11, macOS 10.15+, Linux (kernel 4.0+)

### Recommended
- CPU: 4+ cores
- RAM: 8GB+
- Disk: 20GB+ SSD
- GPU: Optional (for faster Whisper transcription)

---

## Security Notes

1. **Change default passwords** before deploying to any network:
   - `N8N_BASIC_AUTH_PASSWORD`
   - `POSTGRES_PASSWORD`

2. **Do not expose ports** to the public internet without proper authentication.

3. **Keep Docker updated** for latest security patches.

4. **Use HTTPS** in production with a reverse proxy (nginx, Traefik, etc.).

---

## Getting Help

- Check logs: `docker logs claudia`
- Supervisor logs: `docker exec claudia cat /var/log/supervisor/supervisord.log`
- Service-specific logs: `docker exec claudia cat /var/log/supervisor/<service>.log`

Replace `<service>` with: `postgresql`, `redis`, `gitea`, `n8n`, `whisper`, or `claudia`.
