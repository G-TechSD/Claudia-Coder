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
      accessRevoked INTEGER DEFAULT 0,
      revokedAt TEXT,
      revokedReason TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Add security columns if they don't exist (for migration)
  try {
    db.exec(`ALTER TABLE user ADD COLUMN accessRevoked INTEGER DEFAULT 0`)
  } catch {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE user ADD COLUMN revokedAt TEXT`)
  } catch {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE user ADD COLUMN revokedReason TEXT`)
  } catch {
    // Column already exists
  }

  // Add twoFactorEnabled column if it doesn't exist (for 2FA migration)
  try {
    db.exec(`ALTER TABLE user ADD COLUMN twoFactorEnabled INTEGER DEFAULT 0`)
  } catch {
    // Column already exists
  }

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

  // Two-Factor Authentication table (for Better Auth twoFactor plugin)
  db.exec(`
    CREATE TABLE IF NOT EXISTS twoFactor (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      secret TEXT NOT NULL,
      backupCodes TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Passkey/WebAuthn credentials table (for Better Auth passkey plugin)
  // Note: Passkey plugin requires @better-auth/passkey package to be installed
  db.exec(`
    CREATE TABLE IF NOT EXISTS passkey (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      name TEXT,
      publicKey TEXT NOT NULL,
      credentialId TEXT NOT NULL UNIQUE,
      counter INTEGER NOT NULL DEFAULT 0,
      deviceType TEXT,
      backedUp INTEGER DEFAULT 0,
      transports TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
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
    CREATE INDEX IF NOT EXISTS idx_twoFactor_userId ON twoFactor(userId);
    CREATE INDEX IF NOT EXISTS idx_passkey_userId ON passkey(userId);
    CREATE INDEX IF NOT EXISTS idx_passkey_credentialId ON passkey(credentialId);
  `)

  console.log("[Auth] Database initialized at:", DB_PATH)
}

// Initialize on import
initializeAuthDatabase()

// Import and run admin role check after database is ready
// This ensures bill@gtechsd.com always has admin role
import("./roles").then(({ ensureAdminRole }) => {
  ensureAdminRole()
}).catch(() => {
  // Silent fail - roles module may have circular dependency issues during initial load
})

export { DB_PATH }
