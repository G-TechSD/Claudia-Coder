-- ============================================
-- Claudia Coder - PostgreSQL Initialization
-- ============================================
-- This script runs automatically on first container start
-- Creates databases for n8n and future services

-- Create n8n database
CREATE DATABASE n8n;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE n8n TO claudia;
GRANT ALL PRIVILEGES ON DATABASE claudia TO claudia;

-- Create extensions (if needed)
\c claudia
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c n8n
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Claudia databases initialized successfully';
END $$;
