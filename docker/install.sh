#!/bin/bash
# ============================================
# Claudia Coder - Linux/macOS Installation Script
# ============================================
# PRIVATE DEPLOYMENT ONLY

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║              Claudia Coder Docker Installation                ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ============================================
# Prerequisites Check
# ============================================

echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed.${NC}"
    echo ""
    echo "Install Docker:"
    echo "  - Linux: curl -fsSL https://get.docker.com | sh"
    echo "  - macOS: https://docs.docker.com/desktop/install/mac-install/"
    exit 1
fi

# Check Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}Error: Docker is not running.${NC}"
    echo "Please start Docker Desktop or the Docker daemon."
    exit 1
fi

echo -e "${GREEN}  Docker: $(docker --version | cut -d' ' -f3 | tr -d ',')${NC}"

# Check Docker Compose
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
    COMPOSE_VERSION=$(docker compose version --short)
elif command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
    COMPOSE_VERSION=$(docker-compose version --short)
else
    echo -e "${RED}Error: Docker Compose is not installed.${NC}"
    echo "Install with: sudo apt install docker-compose-plugin"
    exit 1
fi

echo -e "${GREEN}  Docker Compose: ${COMPOSE_VERSION}${NC}"

# Check available memory
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    TOTAL_MEM_GB=$(sysctl -n hw.memsize | awk '{print int($1/1024/1024/1024)}')
    # Check for Apple Silicon
    if [[ $(uname -m) == "arm64" ]]; then
        echo -e "${GREEN}  Apple Silicon detected - unified memory architecture${NC}"
    fi
else
    # Linux
    TOTAL_MEM_GB=$(free -g | awk '/^Mem:/{print $2}')
fi

echo -e "${GREEN}  System RAM: ${TOTAL_MEM_GB}GB${NC}"

if [ "$TOTAL_MEM_GB" -lt 8 ]; then
    echo -e "${YELLOW}Warning: Less than 8GB RAM detected. Consider disabling GitLab.${NC}"
fi

# ============================================
# Environment Setup
# ============================================

echo ""
echo -e "${YELLOW}Setting up environment...${NC}"

if [ ! -f .env ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env

    # Generate secure secrets
    echo "Generating secure secrets..."

    AUTH_SECRET=$(openssl rand -base64 32)
    POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
    N8N_PASSWORD=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 16)
    N8N_ENCRYPTION=$(openssl rand -hex 16)

    # Generate default admin credentials
    DEFAULT_ADMIN_EMAIL=${DEFAULT_ADMIN_EMAIL:-"admin@localhost"}
    DEFAULT_ADMIN_PASSWORD=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9!@#$%' | head -c 20)

    # Update .env with generated secrets
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS sed
        sed -i '' "s|BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=${AUTH_SECRET}|" .env
        sed -i '' "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASSWORD}|" .env
        sed -i '' "s|N8N_PASSWORD=.*|N8N_PASSWORD=${N8N_PASSWORD}|" .env
        sed -i '' "s|N8N_ENCRYPTION_KEY=.*|N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION}|" .env
        # Add admin credentials to .env if not present
        if ! grep -q "DEFAULT_ADMIN_EMAIL" .env; then
            echo "" >> .env
            echo "# Default Admin Credentials" >> .env
            echo "DEFAULT_ADMIN_EMAIL=${DEFAULT_ADMIN_EMAIL}" >> .env
            echo "DEFAULT_ADMIN_PASSWORD=${DEFAULT_ADMIN_PASSWORD}" >> .env
        fi
    else
        # Linux sed
        sed -i "s|BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=${AUTH_SECRET}|" .env
        sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASSWORD}|" .env
        sed -i "s|N8N_PASSWORD=.*|N8N_PASSWORD=${N8N_PASSWORD}|" .env
        sed -i "s|N8N_ENCRYPTION_KEY=.*|N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION}|" .env
        # Add admin credentials to .env if not present
        if ! grep -q "DEFAULT_ADMIN_EMAIL" .env; then
            echo "" >> .env
            echo "# Default Admin Credentials" >> .env
            echo "DEFAULT_ADMIN_EMAIL=${DEFAULT_ADMIN_EMAIL}" >> .env
            echo "DEFAULT_ADMIN_PASSWORD=${DEFAULT_ADMIN_PASSWORD}" >> .env
        fi
    fi

    echo -e "${GREEN}  Secure secrets generated and saved to .env${NC}"
else
    echo -e "${GREEN}  Using existing .env file${NC}"
fi

# ============================================
# Create Directories
# ============================================

echo ""
echo -e "${YELLOW}Creating directories...${NC}"

# Directories are handled by Docker volumes, but we need the script dir
mkdir -p "$SCRIPT_DIR"

echo -e "${GREEN}  Directories ready${NC}"

# ============================================
# Pull Images
# ============================================

echo ""
echo -e "${YELLOW}Pulling Docker images (this may take a while)...${NC}"

$COMPOSE_CMD pull postgres redis n8n whisper

if [ "$TOTAL_MEM_GB" -ge 12 ]; then
    echo "Pulling GitLab image..."
    $COMPOSE_CMD pull gitlab
else
    echo -e "${YELLOW}Skipping GitLab (insufficient memory). You can enable it later.${NC}"
fi

echo -e "${GREEN}  Images pulled successfully${NC}"

# ============================================
# Build Claudia App
# ============================================

echo ""
echo -e "${YELLOW}Building Claudia app...${NC}"

$COMPOSE_CMD build claudia-app

echo -e "${GREEN}  Claudia app built successfully${NC}"

# ============================================
# Start Services
# ============================================

echo ""
echo -e "${YELLOW}Starting services...${NC}"

# Start core services first
$COMPOSE_CMD up -d postgres redis

echo "Waiting for database to be ready..."
sleep 10

# Check PostgreSQL health
until docker exec claudia-postgres pg_isready -U claudia &> /dev/null; do
    echo "  Waiting for PostgreSQL..."
    sleep 2
done

echo -e "${GREEN}  PostgreSQL ready${NC}"

# Start remaining services
$COMPOSE_CMD up -d claudia-app n8n whisper

if [ "$TOTAL_MEM_GB" -ge 12 ]; then
    echo "Starting GitLab (this takes 3-5 minutes)..."
    $COMPOSE_CMD up -d gitlab
fi

# ============================================
# Wait for Services
# ============================================

echo ""
echo -e "${YELLOW}Waiting for services to be ready...${NC}"

# Wait for Claudia
echo -n "  Claudia: "
until curl -sf http://localhost:3000 &> /dev/null; do
    echo -n "."
    sleep 2
done
echo -e " ${GREEN}Ready${NC}"

# Wait for n8n
echo -n "  n8n: "
until curl -sf http://localhost:5678/healthz &> /dev/null; do
    echo -n "."
    sleep 2
done
echo -e " ${GREEN}Ready${NC}"

# Wait for Whisper
echo -n "  Whisper: "
until curl -sf http://localhost:8000/health &> /dev/null; do
    echo -n "."
    sleep 2
done
echo -e " ${GREEN}Ready${NC}"

# ============================================
# Create Default Admin User
# ============================================

echo ""
echo -e "${YELLOW}Creating default admin account...${NC}"

# Read admin credentials from .env
DEFAULT_ADMIN_EMAIL=$(grep DEFAULT_ADMIN_EMAIL .env | cut -d= -f2)
DEFAULT_ADMIN_PASSWORD=$(grep DEFAULT_ADMIN_PASSWORD .env | cut -d= -f2)

# Create admin user via API or direct DB script
if [ -n "$DEFAULT_ADMIN_EMAIL" ] && [ -n "$DEFAULT_ADMIN_PASSWORD" ]; then
    # Execute the create-default-admin script inside the container
    docker exec claudia-app node /app/scripts/create-default-admin.js "$DEFAULT_ADMIN_EMAIL" "$DEFAULT_ADMIN_PASSWORD" 2>/dev/null || \
    docker exec -e DEFAULT_ADMIN_EMAIL="$DEFAULT_ADMIN_EMAIL" -e DEFAULT_ADMIN_PASSWORD="$DEFAULT_ADMIN_PASSWORD" claudia-app node /app/scripts/create-default-admin.js 2>/dev/null || \
    echo -e "${YELLOW}  Note: Default admin will be created on first access${NC}"

    echo -e "${GREEN}  Default admin account configured${NC}"
fi

# ============================================
# Print Access Information
# ============================================

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    Installation Complete!                      ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Access your services:${NC}"
echo ""
echo -e "  ${GREEN}Claudia App:${NC}     http://localhost:3000"
echo -e "  ${GREEN}n8n Workflows:${NC}   http://localhost:5678"
echo -e "  ${GREEN}Whisper STT:${NC}     http://localhost:8000"

if [ "$TOTAL_MEM_GB" -ge 12 ]; then
    echo -e "  ${GREEN}GitLab:${NC}          http://localhost:8080"
    echo ""
    echo -e "${YELLOW}GitLab Note:${NC}"
    echo "  GitLab takes 3-5 minutes to fully start."
    echo "  Get initial root password with:"
    echo "    docker exec claudia-gitlab cat /etc/gitlab/initial_root_password"
fi

echo ""
echo -e "${BLUE}n8n Credentials:${NC}"
echo "  Username: $(grep N8N_USER .env | cut -d= -f2)"
echo "  Password: $(grep N8N_PASSWORD .env | cut -d= -f2)"
echo ""
echo -e "${BLUE}Claudia Admin Credentials:${NC}"
echo "  Email:    $(grep DEFAULT_ADMIN_EMAIL .env | cut -d= -f2)"
echo "  Password: $(grep DEFAULT_ADMIN_PASSWORD .env | cut -d= -f2)"
echo ""
echo -e "${RED}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║  SECURITY WARNING: Change these default credentials ASAP!     ║${NC}"
echo -e "${RED}║  Go to Settings > Security in Claudia to update your password ║${NC}"
echo -e "${RED}║  and enable Two-Factor Authentication (2FA) for protection.   ║${NC}"
echo -e "${RED}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "  View logs:      $COMPOSE_CMD logs -f"
echo "  Stop services:  $COMPOSE_CMD down"
echo "  Restart:        $COMPOSE_CMD restart"
echo ""
echo -e "${YELLOW}Important:${NC} Review and update .env with your API keys."
echo ""
