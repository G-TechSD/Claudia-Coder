/**
 * Create Default Admin Script
 *
 * Creates a default admin user for fresh installations.
 * Uses the same hashing parameters as Better Auth.
 *
 * Usage:
 *   node scripts/create-default-admin.js [email] [password]
 *
 * Environment variables:
 *   DEFAULT_ADMIN_EMAIL - Admin email (default: admin@localhost)
 *   DEFAULT_ADMIN_PASSWORD - Admin password (auto-generated if not provided)
 *
 * This script can be run manually or called by the Docker install scripts.
 */

import { scryptAsync } from '@noble/hashes/scrypt';
import { bytesToHex, randomBytes } from '@noble/hashes/utils';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get current directory for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration matching Better Auth
const SCRYPT_CONFIG = {
  N: 16384,
  r: 16,
  p: 1,
  dkLen: 64
};

/**
 * Generate a secure random password
 */
function generatePassword(length = 20) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const bytes = randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

/**
 * Hash a password using Better Auth's scrypt configuration
 */
async function hashPassword(password) {
  // Generate 16-byte random salt
  const saltBytes = randomBytes(16);
  const salt = bytesToHex(saltBytes);

  // Hash the password using scrypt
  const key = await scryptAsync(
    password.normalize('NFKC'),
    salt,
    {
      N: SCRYPT_CONFIG.N,
      r: SCRYPT_CONFIG.r,
      p: SCRYPT_CONFIG.p,
      dkLen: SCRYPT_CONFIG.dkLen,
      maxmem: 128 * SCRYPT_CONFIG.N * SCRYPT_CONFIG.r * 2
    }
  );

  // Return in Better Auth format: salt:hash
  return `${salt}:${bytesToHex(key)}`;
}

/**
 * Find the database path
 */
function findDbPath() {
  // Try various possible locations
  const possiblePaths = [
    path.join(__dirname, '..', '.local-storage', 'auth.db'),
    path.join(process.cwd(), '.local-storage', 'auth.db'),
    '/app/.local-storage/auth.db',
    path.join(__dirname, '..', 'data', 'auth.db'),
  ];

  for (const p of possiblePaths) {
    const dir = path.dirname(p);
    if (fs.existsSync(dir)) {
      return p;
    }
  }

  // Create default path
  const defaultPath = path.join(__dirname, '..', '.local-storage', 'auth.db');
  const dir = path.dirname(defaultPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return defaultPath;
}

/**
 * Initialize database tables if they don't exist
 */
function initializeDatabase(db) {
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
      twoFactorEnabled INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Accounts table (for OAuth providers and credentials)
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
  `);

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
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_email ON user(email);
    CREATE INDEX IF NOT EXISTS idx_account_userId ON account(userId);
    CREATE INDEX IF NOT EXISTS idx_account_provider ON account(providerId, accountId);
  `);
}

async function main() {
  console.log('='.repeat(60));
  console.log('Create Default Admin Script');
  console.log('='.repeat(60));

  // Get credentials from args or environment
  const args = process.argv.slice(2);
  const email = args[0] || process.env.DEFAULT_ADMIN_EMAIL || 'admin@localhost';
  let password = args[1] || process.env.DEFAULT_ADMIN_PASSWORD;
  const passwordGenerated = !password;

  if (!password) {
    password = generatePassword(20);
    console.log('\nNo password provided, generating secure password...');
  }

  // Database path
  const dbPath = findDbPath();
  console.log(`\nDatabase path: ${dbPath}`);

  // Open database
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  console.log('Database opened successfully');

  // Initialize tables
  initializeDatabase(db);

  try {
    // Check if user already exists
    const existingUser = db.prepare('SELECT id FROM user WHERE email = ?').get(email);

    let userId;

    if (existingUser) {
      console.log(`\nUser ${email} already exists, updating...`);
      userId = existingUser.id;

      // Update user to admin role
      db.prepare(`
        UPDATE user SET role = 'admin', updatedAt = datetime('now')
        WHERE id = ?
      `).run(userId);
    } else {
      // Create new user
      console.log(`\nCreating new admin user: ${email}`);
      userId = randomUUID();

      db.prepare(`
        INSERT INTO user (id, name, email, emailVerified, role, createdAt, updatedAt)
        VALUES (?, ?, ?, 1, 'admin', datetime('now'), datetime('now'))
      `).run(userId, 'Admin', email);
    }

    // Hash the password
    console.log('Hashing password with scrypt...');
    const hashedPassword = await hashPassword(password);

    // Check if credential account exists
    const existingAccount = db.prepare(
      'SELECT id FROM account WHERE providerId = ? AND accountId = ?'
    ).get('credential', email);

    if (existingAccount) {
      // Update password
      console.log('Updating existing credential account...');
      db.prepare(`
        UPDATE account
        SET password = ?, updatedAt = datetime('now')
        WHERE providerId = ? AND accountId = ?
      `).run(hashedPassword, 'credential', email);
    } else {
      // Create credential account
      console.log('Creating credential account...');
      const accountId = randomUUID();
      db.prepare(`
        INSERT INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(accountId, email, 'credential', userId, hashedPassword);
    }

    // Verify
    const verifyUser = db.prepare(`
      SELECT u.id, u.email, u.role, a.providerId
      FROM user u
      JOIN account a ON a.userId = u.id
      WHERE u.email = ? AND a.providerId = 'credential'
    `).get(email);

    console.log('\n' + '='.repeat(60));
    console.log('SUCCESS - Admin Account Ready');
    console.log('='.repeat(60));
    console.log(`\nEmail:    ${email}`);
    console.log(`Password: ${passwordGenerated ? password : '(as provided)'}`);
    console.log(`Role:     ${verifyUser?.role || 'admin'}`);

    if (passwordGenerated) {
      console.log('\n' + '!'.repeat(60));
      console.log('IMPORTANT: Save this password securely!');
      console.log('You will not be able to see it again.');
      console.log('!'.repeat(60));
    }

    console.log('\n' + '*'.repeat(60));
    console.log('SECURITY WARNING:');
    console.log('Change this password after your first login!');
    console.log('Enable Two-Factor Authentication (2FA) in Settings > Security');
    console.log('*'.repeat(60));

  } catch (error) {
    console.error('\nError:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    db.close();
    console.log('\nDatabase connection closed');
  }
}

main();
