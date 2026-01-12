#!/bin/bash
# ============================================
# Claudia Coder Startup Script
# ============================================

set -e

# Wait for all dependent services
echo "Waiting for PostgreSQL..."
while ! nc -z localhost 5432; do
    sleep 1
done
echo "PostgreSQL is ready!"

echo "Waiting for Redis..."
while ! nc -z localhost 6379; do
    sleep 1
done
echo "Redis is ready!"

echo "Waiting for Gitea..."
while ! nc -z localhost 8929; do
    sleep 1
done
echo "Gitea is ready!"

echo "Waiting for n8n..."
while ! nc -z localhost 5678; do
    sleep 1
done
echo "n8n is ready!"

echo "Waiting for Whisper..."
while ! nc -z localhost 8000; do
    sleep 1
done
echo "Whisper is ready!"

echo "All services are ready! Starting Claudia Coder..."

# Set environment variables
export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-3000}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export NEXT_TELEMETRY_DISABLED=1

# Service URLs
export NEXT_PUBLIC_WHISPER_URL="${NEXT_PUBLIC_WHISPER_URL:-http://localhost:8000}"
export NEXT_PUBLIC_N8N_URL="${NEXT_PUBLIC_N8N_URL:-http://localhost:5678}"
export NEXT_PUBLIC_GITEA_URL="${NEXT_PUBLIC_GITEA_URL:-http://localhost:8929}"
export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"

# Database connection (for future use if Claudia needs PostgreSQL)
export DATABASE_URL="${DATABASE_URL:-postgresql://claudia:claudia_secure_password@localhost:5432/claudia}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"

# Create local storage directories if needed
mkdir -p /app/.local-storage
mkdir -p /app/data

cd /app

# Start the Next.js server
exec node server.js
