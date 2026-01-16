#!/bin/bash
#
# Claudia Coder - Mac Installer
# https://claudiacoder.com
#
set -e

# Configuration
CONTAINER_NAME="claudia-coder"
IMAGE_NAME="claudiacoder/allinone"
VOLUME_NAME="claudia-data"
APP_PORT=3000
GIT_PORT=8929
N8N_PORT=5678
WHISPER_PORT=8000
SILENT=false
ACTION="install"

# Colors
RED='\033[0;31m' GREEN='\033[0;32m' YELLOW='\033[1;33m'
BLUE='\033[0;34m' PURPLE='\033[0;35m' CYAN='\033[0;36m'
WHITE='\033[1;37m' NC='\033[0m'

# Print functions
print_banner() {
    echo -e "${PURPLE}"
    echo "  ╔═══════════════════════════════════════════════════════════╗"
    echo "  ║       ██████╗██╗      █████╗ ██╗   ██╗██████╗ ██╗ █████╗  ║"
    echo "  ║      ██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██║██╔══██╗ ║"
    echo "  ║      ██║     ██║     ███████║██║   ██║██║  ██║██║███████║ ║"
    echo "  ║      ██║     ██║     ██╔══██║██║   ██║██║  ██║██║██╔══██║ ║"
    echo "  ║      ╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝██║██║  ██║ ║"
    echo "  ║       ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝╚═╝  ╚═╝ ║"
    echo "  ║                        CODER                              ║"
    echo "  ║           AI-Powered Development Platform                 ║"
    echo "  ╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; }
step()    { echo -e "${CYAN}>>>${NC} $1"; }

show_help() {
    echo "Claudia Coder Installer for macOS"
    echo ""
    echo "Usage: ./install.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  (none)       Install Claudia Coder"
    echo "  --update     Update to latest version"
    echo "  --stop       Stop the container"
    echo "  --start      Start existing container"
    echo "  --status     Show container status"
    echo "  --uninstall  Remove container and optionally data"
    echo "  --silent     Non-interactive mode"
    echo "  --help       Show this help message"
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --update)    ACTION="update"; shift ;;
            --stop)      ACTION="stop"; shift ;;
            --start)     ACTION="start"; shift ;;
            --status)    ACTION="status"; shift ;;
            --uninstall) ACTION="uninstall"; shift ;;
            --silent)    SILENT=true; shift ;;
            --help|-h)   show_help; exit 0 ;;
            *) error "Unknown option: $1"; show_help; exit 1 ;;
        esac
    done
}

wait_for_docker() {
    local max_wait=$1; local waited=0
    while ! docker info &> /dev/null; do
        sleep 2; waited=$((waited + 2))
        [ $waited -ge $max_wait ] && return 1
        echo -n "."
    done
    echo ""; return 0
}

check_docker() {
    step "Checking Docker Desktop..."
    if ! command -v docker &> /dev/null; then
        warn "Docker Desktop is not installed."
        if ! command -v brew &> /dev/null; then
            error "Homebrew is required to install Docker. Visit: https://brew.sh"
            exit 1
        fi
        local response="Y"
        [ "$SILENT" = false ] && { echo -e "${YELLOW}Install Docker Desktop via Homebrew? [Y/n]${NC}"; read -r response; response=${response:-Y}; }
        if [[ "$response" =~ ^[Yy]$ ]]; then
            info "Installing Docker Desktop..."
            brew install --cask docker
            info "Starting Docker Desktop..."
            open -a Docker
            echo -e "${YELLOW}Waiting for Docker to start...${NC}"
            wait_for_docker 120 || { error "Docker failed to start. Please start it manually."; exit 1; }
            success "Docker Desktop is running!"
        else
            error "Docker Desktop is required."; exit 1
        fi
    fi
    if ! docker info &> /dev/null; then
        warn "Docker is installed but not running."
        open -a Docker
        echo -e "${YELLOW}Waiting for Docker...${NC}"
        wait_for_docker 60 || { error "Docker failed to start."; exit 1; }
    fi
    success "Docker Desktop is ready!"
}

container_exists() { docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; }
container_running() { docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; }

start_container() {
    docker run -d \
        --name "$CONTAINER_NAME" \
        --restart unless-stopped \
        -p ${APP_PORT}:3000 \
        -p ${GIT_PORT}:3001 \
        -p ${N8N_PORT}:5678 \
        -p ${WHISPER_PORT}:8000 \
        -v ${VOLUME_NAME}:/data \
        "$IMAGE_NAME"
}

wait_for_health() {
    step "Waiting for services to start..."
    local max_wait=90; local waited=0
    while ! curl -s "http://localhost:${APP_PORT}" &> /dev/null; do
        sleep 2; waited=$((waited + 2))
        [ $waited -ge $max_wait ] && { warn "Health check timed out. Check: docker logs ${CONTAINER_NAME}"; return; }
        echo -n "."
    done
    echo ""; success "All services are running!"
}

show_access_info() {
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
    echo -e "${WHITE}              Claudia Coder is Ready!${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${CYAN}Access URLs:${NC}"
    echo -e "    Main App:     ${WHITE}http://localhost:${APP_PORT}${NC}"
    echo -e "    Git Server:   ${WHITE}http://localhost:${GIT_PORT}${NC}"
    echo -e "    n8n:          ${WHITE}http://localhost:${N8N_PORT}${NC}"
    echo -e "    Whisper API:  ${WHITE}http://localhost:${WHISPER_PORT}${NC}"
    echo ""
    echo -e "  ${CYAN}Default Credentials:${NC}"
    echo -e "    n8n:          ${WHITE}admin / changeme${NC}"
    echo ""
    echo -e "  ${CYAN}Commands:${NC}  --stop | --start | --update | --status"
    echo ""
}

do_install() {
    print_banner
    info "Installing Claudia Coder..."
    check_docker
    if container_exists; then
        warn "Claudia Coder is already installed."
        if [ "$SILENT" = false ]; then
            echo -e "${YELLOW}Update instead? [Y/n]${NC}"; read -r response; response=${response:-Y}
            [[ "$response" =~ ^[Yy]$ ]] && { do_update; return; }
        fi
        info "Use --update to update or --uninstall first."; exit 0
    fi
    step "Pulling Claudia Coder image..."
    docker pull "$IMAGE_NAME"
    step "Creating persistent volume..."
    docker volume create "$VOLUME_NAME" &> /dev/null || true
    step "Starting container..."
    start_container
    success "Container started!"
    wait_for_health
    show_access_info
    [ "$SILENT" = false ] && { sleep 2; open "http://localhost:${APP_PORT}" 2>/dev/null || true; }
}

do_update() {
    print_banner
    info "Updating Claudia Coder..."
    check_docker
    step "Pulling latest image..."
    docker pull "$IMAGE_NAME"
    if container_exists; then
        step "Stopping existing container..."
        docker stop "$CONTAINER_NAME" &> /dev/null || true
        docker rm "$CONTAINER_NAME" &> /dev/null || true
    fi
    step "Starting updated container..."
    start_container
    success "Container updated!"
    wait_for_health
    show_access_info
}

do_stop() {
    if container_running; then
        docker stop "$CONTAINER_NAME"
        success "Claudia Coder stopped."
    else
        warn "Claudia Coder is not running."
    fi
}

do_start() {
    if ! container_exists; then
        error "Claudia Coder is not installed. Run without flags to install."; exit 1
    fi
    if container_running; then
        warn "Claudia Coder is already running."
    else
        docker start "$CONTAINER_NAME"
        success "Claudia Coder started!"
        wait_for_health
        show_access_info
    fi
}

do_status() {
    echo ""
    echo -e "${CYAN}══════════════════════════════════════════════${NC}"
    echo -e "${WHITE}         Claudia Coder Status${NC}"
    echo -e "${CYAN}══════════════════════════════════════════════${NC}"
    echo ""
    if ! container_exists; then
        echo -e "  Status: ${RED}Not Installed${NC}"; echo ""; return
    fi
    local status=$(docker inspect -f '{{.State.Status}}' "$CONTAINER_NAME" 2>/dev/null)
    if [ "$status" = "running" ]; then
        echo -e "  Status: ${GREEN}Running${NC}"
        echo ""
        echo -e "  ${CYAN}Services:${NC}"
        echo "    App:      http://localhost:${APP_PORT}"
        echo "    Git:      http://localhost:${GIT_PORT}"
        echo "    n8n:      http://localhost:${N8N_PORT}"
        echo "    Whisper:  http://localhost:${WHISPER_PORT}"
    else
        echo -e "  Status: ${YELLOW}${status}${NC}"
    fi
    echo ""
}

do_uninstall() {
    print_banner
    warn "Uninstalling Claudia Coder..."
    if ! container_exists; then
        warn "Claudia Coder is not installed."; return
    fi
    step "Stopping container..."
    docker stop "$CONTAINER_NAME" &> /dev/null || true
    step "Removing container..."
    docker rm "$CONTAINER_NAME" &> /dev/null || true
    success "Container removed."
    local response="N"
    [ "$SILENT" = false ] && { echo -e "${YELLOW}Remove all data (projects, settings)? [y/N]${NC}"; read -r response; }
    if [[ "$response" =~ ^[Yy]$ ]]; then
        docker volume rm "$VOLUME_NAME" &> /dev/null || true
        success "Data volume removed."
    else
        info "Data volume '${VOLUME_NAME}' preserved."
    fi
    echo ""; success "Claudia Coder has been uninstalled."
}

# Main
parse_args "$@"
case $ACTION in
    install)   do_install ;;
    update)    do_update ;;
    stop)      do_stop ;;
    start)     do_start ;;
    status)    do_status ;;
    uninstall) do_uninstall ;;
esac
