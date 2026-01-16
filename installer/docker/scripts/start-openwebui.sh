#!/bin/bash
# ============================================
# OpenWebUI Startup Script
# Pre-configured to connect to Claudia's API
# ============================================

set -e

OPENWEBUI_PORT="${PORT_OPENWEBUI:-8080}"
OPENWEBUI_DATA_DIR="${DATA_DIR:-/data/openwebui}"

# Wait for PostgreSQL to be ready first
echo "Waiting for PostgreSQL..."
while ! nc -z localhost 5432; do
    sleep 1
done
echo "PostgreSQL is ready!"

# Wait for Claudia to be ready (it provides the API)
echo "Waiting for Claudia API..."
while ! nc -z localhost 3000; do
    sleep 1
done
echo "Claudia API is ready!"

# Create data directory
mkdir -p "$OPENWEBUI_DATA_DIR"

# Set database connection for OpenWebUI (using PostgreSQL)
export DATABASE_URL="${DATABASE_URL:-postgresql://claudia:claudia_secure_password@localhost:5432/openwebui}"

# Set environment variables for OpenWebUI
# Connect to Claudia's model router API
export OPENAI_API_BASE_URL="${OPENAI_API_BASE_URL:-http://localhost:3000/api/v1}"
export OPENAI_API_KEY="${OPENAI_API_KEY:-claudia-internal}"

# Disable Ollama integration (we use Claudia's API)
export ENABLE_OLLAMA_API="${ENABLE_OLLAMA_API:-false}"
export OLLAMA_BASE_URL=""

# Disable authentication for internal use
export WEBUI_AUTH="${WEBUI_AUTH:-false}"

# Data persistence
export DATA_DIR="$OPENWEBUI_DATA_DIR"

# Port configuration
export PORT="$OPENWEBUI_PORT"

# Additional settings for seamless integration
export WEBUI_NAME="Claudia Chat"
export ENABLE_SIGNUP=false
export DEFAULT_USER_ROLE="admin"
export ENABLE_COMMUNITY_SHARING=false

# Start OpenWebUI
exec /opt/openwebui-venv/bin/open-webui serve --host 0.0.0.0 --port "$OPENWEBUI_PORT"
