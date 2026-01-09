# ============================================
# Claudia Coder - Production Dockerfile
# Multi-stage build for optimal image size
# ============================================
# PRIVATE DEPLOYMENT ONLY - DO NOT PUSH TO PUBLIC REGISTRY

# ============================================
# Stage 1: Dependencies
# Install all npm dependencies
# ============================================
FROM node:20-alpine AS deps

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3, node-pty)
RUN apk add --no-cache \
    libc6-compat \
    python3 \
    make \
    g++ \
    linux-headers

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies with clean cache
RUN npm ci --ignore-scripts && \
    npm rebuild better-sqlite3 && \
    npm cache clean --force

# ============================================
# Stage 2: Builder
# Build the Next.js application
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache libc6-compat python3 make g++

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Remove any existing .env files to prevent leaking secrets into build
RUN rm -f .env .env.local .env.production .env.development

# Set build-time environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the application with standalone output
# Note: next.config.ts should have output: 'standalone'
RUN npm run build

# ============================================
# Stage 3: Runner
# Minimal production image
# ============================================
FROM node:20-alpine AS runner

WORKDIR /app

# Set runtime environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install runtime dependencies only
RUN apk add --no-cache \
    libc6-compat \
    curl \
    wget \
    tini

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Create necessary directories
RUN mkdir -p .next/cache .local-storage data && \
    chown -R nextjs:nodejs .next .local-storage data

# Copy public assets
COPY --from=builder /app/public ./public

# Copy standalone build output
# This requires output: 'standalone' in next.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy database schemas if they exist
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/db ./src/lib/db 2>/dev/null || true

# Switch to non-root user
USER nextjs

# Expose the application port
EXPOSE 3000

# Set hostname to listen on all interfaces
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Use tini as init system for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the server
CMD ["node", "server.js"]
