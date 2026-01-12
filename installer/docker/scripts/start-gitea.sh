#!/bin/bash
# ============================================
# Gitea Startup Script
# ============================================

set -e

GITEA_WORK_DIR="${GITEA_WORK_DIR:-/data/gitea}"
GITEA_CUSTOM="${GITEA_CUSTOM:-/data/gitea}"

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
while ! nc -z localhost 5432; do
    sleep 1
done
echo "PostgreSQL is ready!"

# Create Gitea configuration if not exists
if [ ! -f "$GITEA_CUSTOM/conf/app.ini" ]; then
    echo "Creating Gitea configuration..."
    mkdir -p "$GITEA_CUSTOM/conf"

    cat > "$GITEA_CUSTOM/conf/app.ini" <<EOF
APP_NAME = Claudia Git
RUN_USER = git
RUN_MODE = prod
WORK_PATH = ${GITEA_WORK_DIR}

[server]
PROTOCOL = http
DOMAIN = localhost
ROOT_URL = http://localhost:8929/
HTTP_PORT = 8929
SSH_DOMAIN = localhost
SSH_PORT = 22
SSH_LISTEN_PORT = 22
DISABLE_SSH = false
START_SSH_SERVER = true
LFS_START_SERVER = true
OFFLINE_MODE = true

[database]
DB_TYPE = postgres
HOST = localhost:5432
NAME = gitea
USER = ${POSTGRES_USER:-claudia}
PASSWD = ${POSTGRES_PASSWORD:-claudia_secure_password}
SSL_MODE = disable
LOG_SQL = false

[repository]
ROOT = ${GITEA_WORK_DIR}/repositories
DEFAULT_BRANCH = main

[lfs]
PATH = ${GITEA_WORK_DIR}/lfs

[log]
ROOT_PATH = ${GITEA_WORK_DIR}/log
MODE = console
LEVEL = info

[security]
INSTALL_LOCK = true
SECRET_KEY = $(openssl rand -hex 32)
INTERNAL_TOKEN = $(openssl rand -hex 64)

[service]
DISABLE_REGISTRATION = false
REQUIRE_SIGNIN_VIEW = false
REGISTER_EMAIL_CONFIRM = false
ENABLE_NOTIFY_MAIL = false

[session]
PROVIDER = file
PROVIDER_CONFIG = ${GITEA_WORK_DIR}/sessions

[picture]
AVATAR_UPLOAD_PATH = ${GITEA_WORK_DIR}/avatars
REPOSITORY_AVATAR_UPLOAD_PATH = ${GITEA_WORK_DIR}/repo-avatars

[attachment]
PATH = ${GITEA_WORK_DIR}/attachments

[indexer]
ISSUE_INDEXER_PATH = ${GITEA_WORK_DIR}/indexers/issues.bleve
REPO_INDEXER_ENABLED = false

[queue]
DATADIR = ${GITEA_WORK_DIR}/queues

[admin]
DISABLE_REGULAR_ORG_CREATION = false

[openid]
ENABLE_OPENID_SIGNIN = false
ENABLE_OPENID_SIGNUP = false
EOF

    # Create necessary directories
    mkdir -p "$GITEA_WORK_DIR/repositories"
    mkdir -p "$GITEA_WORK_DIR/lfs"
    mkdir -p "$GITEA_WORK_DIR/log"
    mkdir -p "$GITEA_WORK_DIR/sessions"
    mkdir -p "$GITEA_WORK_DIR/avatars"
    mkdir -p "$GITEA_WORK_DIR/repo-avatars"
    mkdir -p "$GITEA_WORK_DIR/attachments"
    mkdir -p "$GITEA_WORK_DIR/indexers"
    mkdir -p "$GITEA_WORK_DIR/queues"

    chown -R git:git "$GITEA_WORK_DIR"

    echo "Gitea configuration created!"
fi

# Start Gitea
exec /usr/local/bin/gitea web --config "$GITEA_CUSTOM/conf/app.ini"
