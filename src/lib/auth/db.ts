/**
 * Auth Database Configuration
 * SQLite database setup with schema initialization
 */

import Database from "better-sqlite3"
import path from "path"
import fs from "fs"

// Database path - stored in project's .local-storage directory
const DB_DIR = path.join(process.cwd(), ".local-storage")
const DB_PATH = path.join(DB_DIR, "auth.db")

// Ensure directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true })
}

// Initialize SQLite database
export const db = new Database(DB_PATH)

// Enable WAL mode for better performance
db.pragma("journal_mode = WAL")

/**
 * Initialize the database schema for Better Auth
 * This creates all required tables if they don't exist
 */
export function initializeAuthDatabase() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      emailVerified INTEGER DEFAULT 0,
      image TEXT,
      role TEXT DEFAULT 'user',
      avatarUrl TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY,
      expiresAt TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      ipAddress TEXT,
      userAgent TEXT,
      userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Accounts table (for OAuth providers)
  db.exec(`
    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      providerId TEXT NOT NULL,
      userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      accessToken TEXT,
      refreshToken TEXT,
      idToken TEXT,
      accessTokenExpiresAt TEXT,
      refreshTokenExpiresAt TEXT,
      scope TEXT,
      password TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(providerId, accountId)
    )
  `)

  // Verification tokens table
  db.exec(`
    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Note: Beta invites table (beta_invite) is now managed by src/lib/data/invites.ts
  // The old beta_invites table schema has been removed to avoid conflicts

  // NDA signatures table
  db.exec(`
    CREATE TABLE IF NOT EXISTS nda_signatures (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      version TEXT NOT NULL,
      signed_at TEXT NOT NULL DEFAULT (datetime('now')),
      ip_address TEXT,
      user_agent TEXT,
      signature_data TEXT NOT NULL
    )
  `)

  // Create indexes for performance
  // Note: beta_invite indexes are created in src/lib/data/invites.ts
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_email ON user(email);
    CREATE INDEX IF NOT EXISTS idx_session_token ON session(token);
    CREATE INDEX IF NOT EXISTS idx_session_userId ON session(userId);
    CREATE INDEX IF NOT EXISTS idx_account_userId ON account(userId);
    CREATE INDEX IF NOT EXISTS idx_account_provider ON account(providerId, accountId);
    CREATE INDEX IF NOT EXISTS idx_nda_signatures_user_id ON nda_signatures(user_id);
    CREATE INDEX IF NOT EXISTS idx_nda_signatures_version ON nda_signatures(version);
  `)

  console.log("[Auth] Database initialized at:", DB_PATH)
}

// Initialize on import
initializeAuthDatabase()

export { DB_PATH }
