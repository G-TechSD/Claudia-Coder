#!/bin/bash
# ============================================
# n8n Startup Script
# ============================================

set -e

N8N_USER_FOLDER="${N8N_USER_FOLDER:-/data/n8n}"

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
while ! nc -z localhost 5432; do
    sleep 1
done
echo "PostgreSQL is ready!"

# Create n8n data directory
mkdir -p "$N8N_USER_FOLDER"

# Set environment variables for n8n
export N8N_HOST="${N8N_HOST:-0.0.0.0}"
export N8N_PORT="${N8N_PORT:-5678}"
export N8N_PROTOCOL="${N8N_PROTOCOL:-http}"
export N8N_USER_FOLDER="$N8N_USER_FOLDER"
export NODE_ENV=production
export WEBHOOK_URL="${WEBHOOK_URL:-http://localhost:5678/}"
export GENERIC_TIMEZONE="${TIMEZONE:-UTC}"

# Database configuration
export DB_TYPE=postgresdb
export DB_POSTGRESDB_HOST="${DB_POSTGRESDB_HOST:-localhost}"
export DB_POSTGRESDB_PORT="${DB_POSTGRESDB_PORT:-5432}"
export DB_POSTGRESDB_DATABASE="${DB_POSTGRESDB_DATABASE:-n8n}"
export DB_POSTGRESDB_USER="${DB_POSTGRESDB_USER:-claudia}"
export DB_POSTGRESDB_PASSWORD="${DB_POSTGRESDB_PASSWORD:-claudia_secure_password}"

# Authentication settings
export N8N_BASIC_AUTH_ACTIVE="${N8N_BASIC_AUTH_ACTIVE:-true}"
export N8N_BASIC_AUTH_USER="${N8N_BASIC_AUTH_USER:-admin}"
export N8N_BASIC_AUTH_PASSWORD="${N8N_BASIC_AUTH_PASSWORD:-changeme}"

# Encryption key (generate if not provided)
if [ -z "$N8N_ENCRYPTION_KEY" ]; then
    if [ -f "$N8N_USER_FOLDER/.encryption_key" ]; then
        export N8N_ENCRYPTION_KEY=$(cat "$N8N_USER_FOLDER/.encryption_key")
    else
        export N8N_ENCRYPTION_KEY=$(openssl rand -hex 32)
        echo "$N8N_ENCRYPTION_KEY" > "$N8N_USER_FOLDER/.encryption_key"
        chmod 600 "$N8N_USER_FOLDER/.encryption_key"
    fi
fi

# Start n8n
exec n8n start
