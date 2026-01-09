# Claudia Coder - Docker Deployment

Complete local deployment stack for Claudia Coder with all dependencies.

**PRIVATE DEPLOYMENT ONLY** - This configuration is for local/private use.

## Services Included

| Service | Port | Description |
|---------|------|-------------|
| Claudia App | 3000 | Next.js admin panel |
| n8n | 5678 | Workflow automation |
| GitLab | 8080 | Source control (SSH: 2222) |
| Whisper | 8000 | Speech-to-text (faster-whisper) |
| PostgreSQL | 5432 | Database for n8n and GitLab |
| Redis | 6379 | Caching layer |
| LM Studio Proxy | 11434 | Optional LLM proxy |

## Prerequisites

### All Platforms

- Docker Desktop 4.0+ or Docker Engine 24.0+
- Docker Compose V2
- Git

### Memory Requirements

| Configuration | Minimum RAM | Recommended RAM |
|--------------|-------------|-----------------|
| Core services (no GitLab) | 8 GB | 12 GB |
| Full stack with GitLab | 12 GB | 16 GB |
| With larger Whisper models | 16 GB | 24 GB |

### Windows

1. Install [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)
2. Enable WSL2 backend (recommended)
3. In Docker Desktop Settings:
   - Resources > Advanced: Allocate at least 8GB RAM
   - Enable "Use the WSL 2 based engine"

### Linux

1. Install Docker Engine:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   ```
2. Install Docker Compose plugin:
   ```bash
   sudo apt install docker-compose-plugin
   ```
3. Log out and back in for group changes

### macOS

1. Install [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/)
2. In Docker Desktop Settings:
   - Resources > Advanced: Allocate at least 8GB RAM

#### Apple Silicon (M1/M2/M3/M4) Notes

Apple Silicon Macs have significant advantages for running this stack:

- **Unified Memory Architecture**: All RAM is shared between CPU and GPU, making it extremely efficient for AI workloads
- **Native ARM Support**: All images run natively without emulation
- **Memory Efficiency**: 16GB on Apple Silicon performs like 32GB on Intel due to unified memory
- **Recommended Settings**:
  - 8GB Mac: Run core services only (disable GitLab)
  - 16GB Mac: Full stack works great
  - 32GB+ Mac: Can run larger Whisper models (medium/large-v3)

For best performance on Apple Silicon:
- Use the `base` or `small` Whisper model
- Consider disabling GitLab if memory is tight
- Unified memory means AI inference is very efficient

## Quick Start

### One-Command Installation

**Linux/macOS:**
```bash
cd docker
chmod +x install.sh
./install.sh
```

**Windows (PowerShell as Administrator):**
```powershell
cd docker
.\install.ps1
```

### Manual Installation

1. **Copy and configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

2. **Generate secure secrets:**
   ```bash
   # Generate auth secret
   openssl rand -base64 32

   # Generate n8n encryption key
   openssl rand -hex 16
   ```

3. **Start services:**
   ```bash
   # Start core services (without GitLab)
   docker compose up -d claudia-app n8n whisper postgres redis

   # Or start everything
   docker compose up -d

   # Include LM Studio proxy
   docker compose --profile lmstudio up -d
   ```

4. **Access services:**
   - Claudia: http://localhost:3000
   - n8n: http://localhost:5678
   - GitLab: http://localhost:8080
   - Whisper: http://localhost:8000

## Configuration

### Environment Variables

Edit `.env` to customize:

| Variable | Description | Default |
|----------|-------------|---------|
| `BETTER_AUTH_SECRET` | Auth encryption key | (generate) |
| `POSTGRES_PASSWORD` | Database password | (generate) |
| `N8N_PASSWORD` | n8n admin password | changeme |
| `ANTHROPIC_API_KEY` | Claude API key | (optional) |
| `WHISPER_MODEL` | Whisper model size | base |

### Whisper Model Selection

| Model | VRAM/RAM | Speed | Accuracy |
|-------|----------|-------|----------|
| tiny | ~1GB | Fastest | Basic |
| base | ~1GB | Fast | Good |
| small | ~2GB | Medium | Better |
| medium | ~5GB | Slow | Great |
| large-v3 | ~10GB | Slowest | Best |

To change the model, update `WHISPER_MODEL` in `.env` and restart:
```bash
docker compose restart whisper
```

### LM Studio Integration

If you have LM Studio running on your host machine:

1. Start LM Studio and load a model
2. Enable the LM Studio proxy:
   ```bash
   docker compose --profile lmstudio up -d lmstudio-proxy
   ```
3. Access LM Studio from containers via `http://lmstudio-proxy:80`

## Management Commands

### View logs
```bash
docker compose logs -f                    # All services
docker compose logs -f claudia-app        # Specific service
```

### Restart services
```bash
docker compose restart                    # All services
docker compose restart claudia-app        # Specific service
```

### Stop services
```bash
docker compose down                       # Stop all
docker compose down -v                    # Stop and remove volumes (DATA LOSS!)
```

### Update images
```bash
docker compose pull                       # Pull latest images
docker compose up -d --build              # Rebuild and restart
```

### Check resource usage
```bash
docker stats
```

## GitLab Initial Setup

GitLab takes 3-5 minutes to start on first run.

1. Wait for GitLab to be healthy:
   ```bash
   docker compose logs -f gitlab
   # Wait for "gitlab Reconfigured!"
   ```

2. Get the initial root password:
   ```bash
   docker exec claudia-gitlab cat /etc/gitlab/initial_root_password
   ```

3. Login at http://localhost:8080 with:
   - Username: `root`
   - Password: (from step 2)

4. **Change the root password immediately!**

## Troubleshooting

### Services won't start

```bash
# Check Docker is running
docker info

# Check for port conflicts
netstat -tulpn | grep -E '3000|5678|8080|8000|5432|6379'

# View service logs
docker compose logs
```

### Out of memory

```bash
# Check memory usage
docker stats

# Reduce memory by disabling GitLab
docker compose stop gitlab

# Or use smaller Whisper model
# Edit WHISPER_MODEL in .env to 'tiny'
```

### GitLab issues

```bash
# GitLab needs time to initialize
docker compose logs gitlab | tail -50

# Restart GitLab if stuck
docker compose restart gitlab

# Check GitLab health
docker exec claudia-gitlab gitlab-ctl status
```

### Database connection issues

```bash
# Check PostgreSQL is healthy
docker compose ps postgres

# View PostgreSQL logs
docker compose logs postgres

# Connect to database
docker exec -it claudia-postgres psql -U claudia
```

### Reset everything

```bash
# Stop all services
docker compose down

# Remove all volumes (WARNING: deletes all data!)
docker volume rm $(docker volume ls -q | grep claudia)

# Start fresh
./install.sh
```

## Backup & Restore

### Backup all data

```bash
# Create backup directory
mkdir -p backups/$(date +%Y%m%d)

# Backup PostgreSQL
docker exec claudia-postgres pg_dumpall -U claudia > backups/$(date +%Y%m%d)/postgres.sql

# Backup volumes
for vol in claudia-data claudia-n8n-data claudia-gitlab-data; do
  docker run --rm -v ${vol}:/data -v $(pwd)/backups:/backup alpine \
    tar czf /backup/$(date +%Y%m%d)/${vol}.tar.gz /data
done
```

### Restore from backup

```bash
# Restore PostgreSQL
cat backups/YYYYMMDD/postgres.sql | docker exec -i claudia-postgres psql -U claudia

# Restore volumes
docker run --rm -v claudia-data:/data -v $(pwd)/backups:/backup alpine \
  tar xzf /backup/YYYYMMDD/claudia-data.tar.gz -C /
```

## Security Notes

1. **Change all default passwords** in `.env`
2. **Generate strong secrets** using `openssl rand`
3. **Do not expose to internet** without proper security
4. **Keep Docker updated** for security patches
5. **Backup regularly** - volumes contain all your data

## Support

This is a private deployment configuration. For issues:

1. Check the troubleshooting section above
2. Review Docker logs: `docker compose logs`
3. Ensure adequate system resources
4. Verify all environment variables are set
