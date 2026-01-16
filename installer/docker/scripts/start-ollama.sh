#!/bin/bash
# ============================================
# Ollama LLM Server Startup Script
# ============================================

set -e

OLLAMA_HOST="${OLLAMA_HOST:-0.0.0.0}"
OLLAMA_PORT="${OLLAMA_PORT:-11434}"
OLLAMA_MODELS_DIR="${OLLAMA_MODELS_DIR:-/data/ollama}"

# Create data directory
mkdir -p "$OLLAMA_MODELS_DIR"

# Set Ollama environment
export OLLAMA_HOST="$OLLAMA_HOST:$OLLAMA_PORT"
export OLLAMA_MODELS="$OLLAMA_MODELS_DIR"

echo "Starting Ollama server on ${OLLAMA_HOST}:${OLLAMA_PORT}..."
echo "Models directory: ${OLLAMA_MODELS_DIR}"

# Start Ollama server in the background first
/usr/local/bin/ollama serve &
OLLAMA_PID=$!

# Wait for server to be ready
echo "Waiting for Ollama server to start..."
MAX_RETRIES=30
RETRY_COUNT=0
while ! curl -s http://localhost:${OLLAMA_PORT}/api/tags > /dev/null 2>&1; do
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "ERROR: Ollama server failed to start within timeout"
        exit 1
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    sleep 1
done

echo "Ollama server is ready!"

# Check if tinyllama model exists, if not pull it
if ! /usr/local/bin/ollama list 2>/dev/null | grep -q "tinyllama"; then
    echo "Downloading tinyllama model (this may take a few minutes on first run)..."
    /usr/local/bin/ollama pull tinyllama
    echo "Model download complete!"
else
    echo "tinyllama model already available"
fi

# Keep the script running with the ollama process
wait $OLLAMA_PID
