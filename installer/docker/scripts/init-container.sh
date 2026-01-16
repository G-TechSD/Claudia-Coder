#!/bin/bash
# ============================================
# Container Initialization Script
# Runs before supervisor to set up environment
# ============================================

set -e

echo "============================================"
echo "Claudia Coder - Container Initialization"
echo "============================================"

# Create necessary directories
echo "Creating data directories..."
mkdir -p /data/claudia
mkdir -p /data/gitea/conf
mkdir -p /data/gitea/data
mkdir -p /data/gitea/log
mkdir -p /data/gitea/repositories
mkdir -p /data/n8n
mkdir -p /data/postgresql
mkdir -p /data/redis
mkdir -p /data/whisper/models
mkdir -p /data/ollama
mkdir -p /var/log/supervisor
mkdir -p /run/postgresql

# Set permissions
echo "Setting permissions..."
chown -R postgres:postgres /data/postgresql /run/postgresql
chown -R redis:redis /data/redis
chown -R git:git /data/gitea
chown -R claudia:claudia /data/n8n /data/claudia /app
chmod 700 /data/postgresql

# Ensure log directory is writable
chmod 755 /var/log/supervisor

echo "Initialization complete!"
echo "============================================"

# Execute the main command (supervisor)
exec "$@"
