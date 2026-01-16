#!/bin/bash
#
# Claudia Coder - Linux Installer
# All-in-one AI development platform
# https://claudiacoder.com
#
# Usage: ./install.sh [options]
#   --update     Update to latest version
#   --stop       Stop Claudia Coder
#   --start      Start Claudia Coder
#   --status     Show status
#   --uninstall  Remove Claudia Coder
#   --silent     Non-interactive mode
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

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Flags
SILENT=false
ACTION="install"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --update)   ACTION="update"; shift ;;
        --stop)     ACTION="stop"; shift ;;
        --start)    ACTION="start"; shift ;;
        --status)   ACTION="status"; shift ;;
        --uninstall) ACTION="uninstall"; shift ;;
        --silent)   SILENT=true; shift ;;
        --help|-h)  ACTION="help"; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Helper functions
print_banner() {
    echo -e "${PURPLE}"
    echo '   ____  _                   _  _         ____            _             '
    echo '  / ___|| |  __ _  _   _  __| |(_)  __ _ / ___|___   __| | ___  _ __  '
    echo ' | |    | | / _` || | | |/ _` || | / _` | |   / _ \ / _` |/ _ \| `__|'
    echo ' | |___ | || (_| || |_| | (_| || || (_| | |__| (_) | (_| |  __/| |   '
    echo '  \____||_| \__,_| \__,_|\__,_||_| \__,_|\____\___/ \__,_|\___||_|   '
    echo -e "${NC}"
    echo -e "${CYAN}        All-in-One AI Development Platform${NC}"
    echo -e "${WHITE}        https://claudiacoder.com${NC}"
    echo ""
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "\n${BOLD}${WHITE}>>> $1${NC}"
}

confirm() {
    if [ "$SILENT" = true ]; then
        return 0
    fi
    read -p "$1 [y/N] " response
    case "$response" in
        [yY][eE][sS]|[yY]) return 0 ;;
        *) return 1 ;;
    esac
}

detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        DISTRO=$ID
        DISTRO_FAMILY=$ID_LIKE
    elif [ -f /etc/debian_version ]; then
        DISTRO="debian"
        DISTRO_FAMILY="debian"
    elif [ -f /etc/redhat-release ]; then
        DISTRO="rhel"
        DISTRO_FAMILY="rhel"
    else
        DISTRO="unknown"
        DISTRO_FAMILY="unknown"
    fi

    log_info "Detected distribution: ${BOLD}$DISTRO${NC}"
}

check_root() {
    if [ "$EUID" -eq 0 ]; then
        IS_ROOT=true
        SUDO=""
    else
        IS_ROOT=false
        SUDO="sudo"
        if ! command -v sudo &> /dev/null; then
            log_error "sudo is required for non-root installation"
            exit 1
        fi
    fi
}

check_docker() {
    if command -v docker &> /dev/null; then
        log_success "Docker is installed"
        return 0
    else
        return 1
    fi
}

install_docker() {
    log_step "Installing Docker"

    log_info "Downloading Docker installation script..."
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh

    log_info "Running Docker installer..."
    $SUDO sh /tmp/get-docker.sh

    rm -f /tmp/get-docker.sh

    # Add current user to docker group if not root
    if [ "$IS_ROOT" = false ]; then
        log_info "Adding user to docker group..."
        $SUDO usermod -aG docker "$USER"
        log_warn "You may need to log out and back in for group changes to take effect"
    fi

    log_success "Docker installed successfully"
}

start_docker_service() {
    log_step "Checking Docker Service"

    if ! $SUDO systemctl is-active --quiet docker 2>/dev/null; then
        log_info "Starting Docker service..."
        $SUDO systemctl start docker
        $SUDO systemctl enable docker
        log_success "Docker service started"
    else
        log_success "Docker service is running"
    fi
}

pull_image() {
    log_step "Pulling Claudia Coder Image"

    log_info "Downloading ${IMAGE_NAME}..."
    docker pull ${IMAGE_NAME}
    log_success "Image downloaded successfully"
}

create_volume() {
    log_step "Creating Persistent Storage"

    if docker volume inspect ${VOLUME_NAME} &> /dev/null; then
        log_info "Volume ${VOLUME_NAME} already exists"
    else
        docker volume create ${VOLUME_NAME}
        log_success "Volume ${VOLUME_NAME} created"
    fi
}

run_container() {
    log_step "Starting Claudia Coder Container"

    # Remove existing container if it exists
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        log_info "Removing existing container..."
        docker rm -f ${CONTAINER_NAME} > /dev/null 2>&1 || true
    fi

    log_info "Creating and starting container..."
    docker run -d \
        --name ${CONTAINER_NAME} \
        --restart unless-stopped \
        -p ${APP_PORT}:3000 \
        -p ${GIT_PORT}:3001 \
        -p ${N8N_PORT}:5678 \
        -p ${WHISPER_PORT}:8000 \
        -v ${VOLUME_NAME}:/data \
        ${IMAGE_NAME}

    log_success "Container started"
}

wait_for_health() {
    log_step "Waiting for Services to Start"

    local max_attempts=60
    local attempt=1

    echo -n "Starting services"
    while [ $attempt -le $max_attempts ]; do
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:${APP_PORT} | grep -q "200\|302"; then
            echo ""
            log_success "Services are ready!"
            return 0
        fi
        echo -n "."
        sleep 2
        ((attempt++))
    done

    echo ""
    log_warn "Services may still be starting. Check status with: $0 --status"
    return 1
}

open_browser() {
    if command -v xdg-open &> /dev/null; then
        log_info "Opening browser..."
        xdg-open "http://localhost:${APP_PORT}" &> /dev/null &
    fi
}

show_success() {
    echo ""
    echo -e "${GREEN}${BOLD}=============================================${NC}"
    echo -e "${GREEN}${BOLD}   Claudia Coder Installed Successfully!    ${NC}"
    echo -e "${GREEN}${BOLD}=============================================${NC}"
    echo ""
    echo -e "${WHITE}${BOLD}Access URLs:${NC}"
    echo -e "  ${CYAN}Main App:${NC}    http://localhost:${APP_PORT}"
    echo -e "  ${CYAN}Git (Gitea):${NC} http://localhost:${GIT_PORT}"
    echo -e "  ${CYAN}n8n:${NC}         http://localhost:${N8N_PORT}"
    echo -e "  ${CYAN}Whisper:${NC}     http://localhost:${WHISPER_PORT}"
    echo ""
    echo -e "${WHITE}${BOLD}Default Credentials:${NC}"
    echo -e "  ${CYAN}n8n:${NC}         admin / changeme"
    echo ""
    echo -e "${WHITE}${BOLD}Management Commands:${NC}"
    echo -e "  ${YELLOW}$0 --status${NC}     Show status"
    echo -e "  ${YELLOW}$0 --stop${NC}       Stop Claudia Coder"
    echo -e "  ${YELLOW}$0 --start${NC}      Start Claudia Coder"
    echo -e "  ${YELLOW}$0 --update${NC}     Update to latest"
    echo -e "  ${YELLOW}$0 --uninstall${NC}  Remove Claudia Coder"
    echo ""
}

# Action functions
do_install() {
    print_banner

    log_step "Preparing Installation"
    detect_distro
    check_root

    if ! check_docker; then
        if confirm "Docker is not installed. Install it now?"; then
            install_docker
        else
            log_error "Docker is required. Exiting."
            exit 1
        fi
    fi

    start_docker_service
    pull_image
    create_volume
    run_container
    wait_for_health
    show_success

    if [ "$SILENT" = false ]; then
        open_browser
    fi
}

do_update() {
    print_banner
    log_step "Updating Claudia Coder"

    check_root

    log_info "Pulling latest image..."
    docker pull ${IMAGE_NAME}

    log_info "Recreating container with latest image..."
    run_container
    wait_for_health

    log_success "Update complete!"
    show_success
}

do_stop() {
    log_step "Stopping Claudia Coder"

    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        docker stop ${CONTAINER_NAME}
        log_success "Claudia Coder stopped"
    else
        log_warn "Container is not running"
    fi
}

do_start() {
    log_step "Starting Claudia Coder"

    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        docker start ${CONTAINER_NAME}
        log_success "Claudia Coder started"
        wait_for_health
    else
        log_error "Container does not exist. Run install first."
        exit 1
    fi
}

do_status() {
    print_banner
    log_step "Claudia Coder Status"

    echo ""
    echo -e "${WHITE}${BOLD}Container:${NC}"
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        echo -e "  Status: ${GREEN}Running${NC}"
        echo -e "  Uptime: $(docker ps --format '{{.Status}}' -f name=${CONTAINER_NAME})"
    elif docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        echo -e "  Status: ${YELLOW}Stopped${NC}"
    else
        echo -e "  Status: ${RED}Not installed${NC}"
        return
    fi

    echo ""
    echo -e "${WHITE}${BOLD}Volume:${NC}"
    if docker volume inspect ${VOLUME_NAME} &> /dev/null; then
        local size=$(docker system df -v 2>/dev/null | grep ${VOLUME_NAME} | awk '{print $3}' || echo "N/A")
        echo -e "  ${VOLUME_NAME}: ${GREEN}Exists${NC} (${size})"
    else
        echo -e "  ${VOLUME_NAME}: ${RED}Not found${NC}"
    fi

    echo ""
    echo -e "${WHITE}${BOLD}Services:${NC}"
    for port in $APP_PORT $GIT_PORT $N8N_PORT $WHISPER_PORT; do
        if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${port}" 2>/dev/null | grep -q "200\|302"; then
            echo -e "  Port ${port}: ${GREEN}Responding${NC}"
        else
            echo -e "  Port ${port}: ${RED}Not responding${NC}"
        fi
    done
    echo ""
}

do_uninstall() {
    print_banner
    log_step "Uninstalling Claudia Coder"

    check_root

    if ! confirm "Are you sure you want to uninstall Claudia Coder?"; then
        log_info "Uninstall cancelled"
        exit 0
    fi

    # Stop and remove container
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        log_info "Removing container..."
        docker rm -f ${CONTAINER_NAME}
        log_success "Container removed"
    fi

    # Ask about data volume
    if docker volume inspect ${VOLUME_NAME} &> /dev/null; then
        if confirm "Remove persistent data volume? (This will delete all data!)"; then
            docker volume rm ${VOLUME_NAME}
            log_success "Data volume removed"
        else
            log_info "Data volume preserved"
        fi
    fi

    # Ask about image
    if docker images --format '{{.Repository}}' | grep -q "^${IMAGE_NAME}$"; then
        if confirm "Remove Docker image?"; then
            docker rmi ${IMAGE_NAME}
            log_success "Image removed"
        fi
    fi

    log_success "Claudia Coder uninstalled"
}

do_help() {
    print_banner
    echo -e "${WHITE}${BOLD}Usage:${NC} $0 [OPTIONS]"
    echo ""
    echo -e "${WHITE}${BOLD}Options:${NC}"
    echo -e "  ${CYAN}--update${NC}      Update to the latest version"
    echo -e "  ${CYAN}--stop${NC}        Stop Claudia Coder"
    echo -e "  ${CYAN}--start${NC}       Start Claudia Coder"
    echo -e "  ${CYAN}--status${NC}      Show current status"
    echo -e "  ${CYAN}--uninstall${NC}   Remove Claudia Coder"
    echo -e "  ${CYAN}--silent${NC}      Non-interactive mode"
    echo -e "  ${CYAN}--help, -h${NC}    Show this help message"
    echo ""
    echo -e "${WHITE}${BOLD}Examples:${NC}"
    echo -e "  ${YELLOW}$0${NC}              Install Claudia Coder"
    echo -e "  ${YELLOW}$0 --silent${NC}     Install without prompts"
    echo -e "  ${YELLOW}$0 --update${NC}     Update to latest version"
    echo ""
}

# Main
case $ACTION in
    install)    do_install ;;
    update)     do_update ;;
    stop)       do_stop ;;
    start)      do_start ;;
    status)     do_status ;;
    uninstall)  do_uninstall ;;
    help)       do_help ;;
esac
