#!/bin/bash
# ============================================
# PostgreSQL Startup Script
# ============================================

set -e

PGDATA="${PGDATA:-/data/postgresql}"
POSTGRES_USER="${POSTGRES_USER:-claudia}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-claudia_secure_password}"
POSTGRES_DB="${POSTGRES_DB:-claudia}"

# Initialize database if not exists
if [ ! -f "$PGDATA/PG_VERSION" ]; then
    echo "Initializing PostgreSQL database..."

    # Initialize the database cluster
    /usr/lib/postgresql/15/bin/initdb -D "$PGDATA" --auth-local=peer --auth-host=md5

    # Configure PostgreSQL
    echo "host all all 0.0.0.0/0 md5" >> "$PGDATA/pg_hba.conf"
    echo "listen_addresses = 'localhost'" >> "$PGDATA/postgresql.conf"
    echo "max_connections = 100" >> "$PGDATA/postgresql.conf"
    echo "shared_buffers = 256MB" >> "$PGDATA/postgresql.conf"

    # Start temporarily for setup
    /usr/lib/postgresql/15/bin/pg_ctl -D "$PGDATA" -w start

    # Create user and databases
    psql -v ON_ERROR_STOP=1 --username postgres <<-EOSQL
        CREATE USER ${POSTGRES_USER} WITH SUPERUSER PASSWORD '${POSTGRES_PASSWORD}';
        CREATE DATABASE ${POSTGRES_DB} OWNER ${POSTGRES_USER};
        CREATE DATABASE n8n OWNER ${POSTGRES_USER};
        CREATE DATABASE gitea OWNER ${POSTGRES_USER};
        GRANT ALL PRIVILEGES ON DATABASE ${POSTGRES_DB} TO ${POSTGRES_USER};
        GRANT ALL PRIVILEGES ON DATABASE n8n TO ${POSTGRES_USER};
        GRANT ALL PRIVILEGES ON DATABASE gitea TO ${POSTGRES_USER};
EOSQL

    # Stop the temporary server
    /usr/lib/postgresql/15/bin/pg_ctl -D "$PGDATA" -w stop

    echo "PostgreSQL initialized successfully!"
fi

# Start PostgreSQL in foreground
exec /usr/lib/postgresql/15/bin/postgres -D "$PGDATA"
