#!/bin/bash
# ============================================
# Claudia Coder - All-in-One Docker Run Script
# ============================================
# Usage: ./docker-run.sh [start|stop|restart|logs|status|build]
# ============================================

set -e

IMAGE_NAME="claudiacoder/allinone"
IMAGE_TAG="${IMAGE_TAG:-latest}"
CONTAINER_NAME="claudia"
DATA_VOLUME="claudia-data"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_banner() {
    echo -e "${BLUE}"
    echo "  ╔═══════════════════════════════════════════════════════════╗"
    echo "  ║     Claudia Coder - All-in-One Docker Container           ║"
    echo "  ╠═══════════════════════════════════════════════════════════╣"
    echo "  ║  Services:                                                ║"
    echo "  ║    - Claudia Coder    : http://localhost:3000             ║"
    echo "  ║    - Gitea (Git)      : http://localhost:8929             ║"
    echo "  ║    - n8n (Workflows)  : http://localhost:5678             ║"
    echo "  ║    - Whisper (STT)    : http://localhost:8000             ║"
    echo "  ╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker is not installed or not in PATH${NC}"
        echo "Please install Docker from https://docs.docker.com/get-docker/"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        echo -e "${RED}Error: Docker daemon is not running${NC}"
        echo "Please start Docker and try again"
        exit 1
    fi
}

build_image() {
    echo -e "${YELLOW}Building Claudia All-in-One image...${NC}"

    # Navigate to project root (3 levels up from installer/docker/)
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

    echo "Building from: $PROJECT_ROOT"

    docker build \
        -t "${IMAGE_NAME}:${IMAGE_TAG}" \
        -f "$SCRIPT_DIR/Dockerfile.allinone" \
        "$PROJECT_ROOT"

    echo -e "${GREEN}Build complete!${NC}"
}

start_container() {
    echo -e "${YELLOW}Starting Claudia All-in-One container...${NC}"

    # Check if container already exists
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
            echo -e "${YELLOW}Container '${CONTAINER_NAME}' is already running${NC}"
            return 0
        else
            echo "Removing stopped container..."
            docker rm "${CONTAINER_NAME}" > /dev/null
        fi
    fi

    # Create data volume if it doesn't exist
    docker volume create "${DATA_VOLUME}" > /dev/null 2>&1 || true

    # Run the container
    docker run -d \
        --name "${CONTAINER_NAME}" \
        -p 3000:3000 \
        -p 8929:8929 \
        -p 5678:5678 \
        -p 8000:8000 \
        -v "${DATA_VOLUME}:/data" \
        -e "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}" \
        -e "BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET:-$(openssl rand -hex 32)}" \
        -e "N8N_BASIC_AUTH_USER=${N8N_BASIC_AUTH_USER:-admin}" \
        -e "N8N_BASIC_AUTH_PASSWORD=${N8N_BASIC_AUTH_PASSWORD:-changeme}" \
        -e "POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-claudia_secure_password}" \
        --restart unless-stopped \
        "${IMAGE_NAME}:${IMAGE_TAG}"

    echo -e "${GREEN}Container started!${NC}"
    echo ""
    echo -e "${YELLOW}Note: Services may take 1-2 minutes to fully initialize.${NC}"
    echo ""
    print_banner
}

stop_container() {
    echo -e "${YELLOW}Stopping Claudia container...${NC}"

    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        docker stop "${CONTAINER_NAME}"
        echo -e "${GREEN}Container stopped.${NC}"
    else
        echo -e "${YELLOW}Container is not running.${NC}"
    fi
}

restart_container() {
    stop_container
    sleep 2
    start_container
}

show_logs() {
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        docker logs -f "${CONTAINER_NAME}"
    else
        echo -e "${RED}Container '${CONTAINER_NAME}' does not exist${NC}"
        exit 1
    fi
}

show_status() {
    echo -e "${BLUE}=== Claudia Container Status ===${NC}"
    echo ""

    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        echo -e "Container: ${GREEN}Running${NC}"
        echo ""

        # Get container info
        docker ps --filter "name=${CONTAINER_NAME}" --format "table {{.Status}}\t{{.Ports}}"
        echo ""

        # Check service health
        echo -e "${BLUE}Service Health Checks:${NC}"

        check_service() {
            local name=$1
            local url=$2
            if curl -sf "$url" > /dev/null 2>&1; then
                echo -e "  $name: ${GREEN}Healthy${NC}"
            else
                echo -e "  $name: ${YELLOW}Starting...${NC}"
            fi
        }

        check_service "Claudia Coder" "http://localhost:3000/api/health"
        check_service "Gitea" "http://localhost:8929/"
        check_service "n8n" "http://localhost:5678/healthz"
        check_service "Whisper" "http://localhost:8000/health"

    elif docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        echo -e "Container: ${YELLOW}Stopped${NC}"
    else
        echo -e "Container: ${RED}Not found${NC}"
    fi
}

remove_container() {
    echo -e "${YELLOW}Removing Claudia container...${NC}"

    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        docker stop "${CONTAINER_NAME}"
    fi

    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        docker rm "${CONTAINER_NAME}"
        echo -e "${GREEN}Container removed.${NC}"
    else
        echo -e "${YELLOW}Container does not exist.${NC}"
    fi
}

clean_all() {
    echo -e "${RED}WARNING: This will remove the container AND all data!${NC}"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        remove_container
        echo "Removing data volume..."
        docker volume rm "${DATA_VOLUME}" 2>/dev/null || true
        echo -e "${GREEN}Cleanup complete.${NC}"
    else
        echo "Cancelled."
    fi
}

show_help() {
    echo "Claudia Coder - All-in-One Docker Management Script"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  start     Start the Claudia container"
    echo "  stop      Stop the Claudia container"
    echo "  restart   Restart the Claudia container"
    echo "  logs      Show container logs (follow mode)"
    echo "  status    Show container and service status"
    echo "  build     Build the Docker image locally"
    echo "  remove    Remove the container (keeps data)"
    echo "  clean     Remove container AND all data"
    echo "  help      Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  IMAGE_TAG             Docker image tag (default: latest)"
    echo "  ANTHROPIC_API_KEY     Anthropic API key for AI features"
    echo "  N8N_BASIC_AUTH_USER   n8n admin username (default: admin)"
    echo "  N8N_BASIC_AUTH_PASSWORD  n8n admin password (default: changeme)"
    echo ""
}

# Main script
check_docker

case "${1:-start}" in
    start)
        start_container
        ;;
    stop)
        stop_container
        ;;
    restart)
        restart_container
        ;;
    logs)
        show_logs
        ;;
    status)
        show_status
        ;;
    build)
        build_image
        ;;
    remove)
        remove_container
        ;;
    clean)
        clean_all
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac
