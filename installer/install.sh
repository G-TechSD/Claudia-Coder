#!/bin/bash
#
# Claudia Admin Installer
# One-command installation for Mac, Linux, and Windows (WSL)
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/your-org/claudia-admin/main/install.sh | bash
#
# Or download and run:
#   ./install.sh
#

set -e

# Configuration
CLAUDIA_VERSION="${CLAUDIA_VERSION:-main}"
INSTALL_DIR="${CLAUDIA_INSTALL_DIR:-$HOME/.claudia}"
REPO_URL="${CLAUDIA_REPO:-https://github.com/your-org/claudia-admin.git}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Detect OS
detect_os() {
    case "$(uname -s)" in
        Darwin*)    OS="macos" ;;
        Linux*)     OS="linux" ;;
        MINGW*|CYGWIN*|MSYS*) OS="windows" ;;
        *)          OS="unknown" ;;
    esac
    info "Detected OS: $OS"
}

# Check dependencies
check_dependencies() {
    info "Checking dependencies..."

    # Check for Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is required but not installed.\n  Please install Docker: https://docs.docker.com/get-docker/"
    fi
    success "Docker found: $(docker --version | head -n1)"

    # Check Docker is running
    if ! docker info &> /dev/null; then
        error "Docker is installed but not running. Please start Docker."
    fi
    success "Docker is running"

    # Check for Docker Compose
    if docker compose version &> /dev/null; then
        DOCKER_COMPOSE="docker compose"
        success "Docker Compose found: $(docker compose version)"
    elif command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
        success "Docker Compose found: $(docker-compose --version)"
    else
        error "Docker Compose is required but not installed."
    fi

    # Check for Git
    if ! command -v git &> /dev/null; then
        error "Git is required but not installed."
    fi
    success "Git found: $(git --version)"
}

# Install Claudia
install_claudia() {
    info "Installing Claudia to $INSTALL_DIR..."

    # Create installation directory
    if [ -d "$INSTALL_DIR" ]; then
        warn "Installation directory already exists. Updating..."
        cd "$INSTALL_DIR"
        git fetch origin
        git checkout "$CLAUDIA_VERSION"
        git pull origin "$CLAUDIA_VERSION" || true
    else
        mkdir -p "$INSTALL_DIR"
        git clone --depth 1 --branch "$CLAUDIA_VERSION" "$REPO_URL" "$INSTALL_DIR"
        cd "$INSTALL_DIR"
    fi

    success "Source code ready"
}

# Configure environment
configure_env() {
    info "Configuring environment..."

    ENV_FILE="$INSTALL_DIR/.env.local"

    if [ ! -f "$ENV_FILE" ]; then
        # Create default environment file
        cat > "$ENV_FILE" << 'EOF'
# Claudia Admin Configuration
# Edit this file to configure your Claudia installation

# LM Studio endpoints (local LLM servers)
NEXT_PUBLIC_LMSTUDIO_SERVER_1=http://localhost:1234
NEXT_PUBLIC_LMSTUDIO_SERVER_2=http://localhost:1235

# Ollama endpoint (alternative local LLM)
NEXT_PUBLIC_OLLAMA_URL=http://localhost:11434

# GitLab configuration (for code application)
NEXT_PUBLIC_GITLAB_URL=https://your-gitlab-instance

# Linear API key (for project import)
LINEAR_API_KEY=

# NextAuth configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-change-in-production

# OAuth providers (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
EOF
        info "Created default .env.local file"
        warn "Please edit $ENV_FILE with your configuration"
    else
        info "Using existing .env.local configuration"
    fi
}

# Build and start
start_claudia() {
    info "Building and starting Claudia..."

    cd "$INSTALL_DIR"

    # Pull latest images if using pre-built
    $DOCKER_COMPOSE pull 2>/dev/null || true

    # Build
    $DOCKER_COMPOSE build

    # Start
    $DOCKER_COMPOSE up -d

    success "Claudia is starting..."
}

# Create convenience commands
create_commands() {
    info "Creating convenience commands..."

    # Create claudia command
    CLAUDIA_BIN="$HOME/.local/bin/claudia"
    mkdir -p "$HOME/.local/bin"

    cat > "$CLAUDIA_BIN" << EOF
#!/bin/bash
# Claudia Admin CLI wrapper
INSTALL_DIR="$INSTALL_DIR"
cd "\$INSTALL_DIR"
case "\$1" in
    start)
        $DOCKER_COMPOSE up -d
        echo "Claudia started at http://localhost:3000"
        ;;
    stop)
        $DOCKER_COMPOSE down
        echo "Claudia stopped"
        ;;
    restart)
        $DOCKER_COMPOSE restart
        echo "Claudia restarted"
        ;;
    logs)
        $DOCKER_COMPOSE logs -f \${2:-claudia}
        ;;
    status)
        $DOCKER_COMPOSE ps
        ;;
    update)
        git pull origin $CLAUDIA_VERSION
        $DOCKER_COMPOSE build
        $DOCKER_COMPOSE up -d
        echo "Claudia updated"
        ;;
    config)
        \${EDITOR:-nano} "$INSTALL_DIR/.env.local"
        ;;
    *)
        echo "Claudia Admin CLI"
        echo ""
        echo "Usage: claudia <command>"
        echo ""
        echo "Commands:"
        echo "  start    Start Claudia"
        echo "  stop     Stop Claudia"
        echo "  restart  Restart Claudia"
        echo "  logs     View logs (claudia logs [service])"
        echo "  status   Show container status"
        echo "  update   Update to latest version"
        echo "  config   Edit configuration"
        ;;
esac
EOF
    chmod +x "$CLAUDIA_BIN"

    # Add to PATH if needed
    if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
        warn "Add this to your shell profile to use 'claudia' command:"
        echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
    fi

    success "Created 'claudia' command"
}

# Wait for service
wait_for_service() {
    info "Waiting for Claudia to start..."

    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            success "Claudia is ready!"
            return 0
        fi
        sleep 2
        attempt=$((attempt + 1))
    done

    warn "Service may still be starting. Check with: claudia logs"
}

# Print completion message
print_complete() {
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}              Claudia Installation Complete!              ${GREEN}║${NC}"
    echo -e "${GREEN}╠══════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║${NC}                                                          ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  Open Claudia:     ${BLUE}http://localhost:3000${NC}                ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                          ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  Commands:                                               ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}    claudia start   - Start Claudia                       ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}    claudia stop    - Stop Claudia                        ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}    claudia logs    - View logs                           ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}    claudia config  - Edit configuration                  ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                          ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  Next steps:                                             ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}    1. Configure your GitLab token                        ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}    2. Set up LM Studio or Ollama                         ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}    3. Import a project from Linear                       ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                          ${GREEN}║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Main installation
main() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}                 Claudia Admin Installer                   ${BLUE}║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""

    detect_os
    check_dependencies
    install_claudia
    configure_env
    start_claudia
    create_commands
    wait_for_service
    print_complete
}

# Run main
main "$@"
