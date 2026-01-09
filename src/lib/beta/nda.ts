/**
 * NDA Signature Management
 * Functions for managing NDA signatures for beta testers
 */

import { db } from "../auth/db"
import { randomBytes } from "crypto"
import type { NDASignature } from "../data/types"

// Current NDA version - increment when NDA terms change
const CURRENT_NDA_VERSION = "1.0.0"

/**
 * Generate a unique ID
 */
function generateId(): string {
  return randomBytes(12).toString("hex")
}

/**
 * Convert database row to NDASignature type
 */
function rowToSignature(row: Record<string, unknown>): NDASignature {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    version: row.version as string,
    signedAt: row.signed_at as string,
    ipAddress: row.ip_address as string | undefined,
    userAgent: row.user_agent as string | undefined,
    signatureData: row.signature_data as string,
  }
}

/**
 * Get the current NDA version that users must sign
 * @returns The current NDA version string
 */
export function getCurrentNDAVersion(): string {
  return CURRENT_NDA_VERSION
}

/**
 * Check if a user has signed the current NDA version
 * @param userId - The user ID to check
 * @returns True if the user has signed the current NDA version
 */
export function hasSignedNDA(userId: string): boolean {
  const stmt = db.prepare(`
    SELECT id FROM nda_signatures
    WHERE user_id = ? AND version = ?
    LIMIT 1
  `)

  const row = stmt.get(userId, CURRENT_NDA_VERSION)

  return !!row
}

/**
 * Record an NDA signature
 * @param userId - The user ID signing the NDA
 * @param signatureData - The signature data (could be typed name, drawn signature base64, etc.)
 * @param ipAddress - The IP address of the signer
 * @param userAgent - The user agent string
 * @returns The created NDA signature record
 */
export function signNDA(
  userId: string,
  signatureData: string,
  ipAddress?: string,
  userAgent?: string
): NDASignature {
  // Check if already signed current version
  if (hasSignedNDA(userId)) {
    const existing = getNDASignature(userId)
    if (existing) {
      return existing
    }
  }

  const id = generateId()

  const stmt = db.prepare(`
    INSERT INTO nda_signatures (id, user_id, version, ip_address, user_agent, signature_data)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  stmt.run(id, userId, CURRENT_NDA_VERSION, ipAddress, userAgent, signatureData)

  const signature = db
    .prepare("SELECT * FROM nda_signatures WHERE id = ?")
    .get(id) as Record<string, unknown>

  return rowToSignature(signature)
}

/**
 * Get a user's NDA signature for the current version
 * @param userId - The user ID
 * @returns The NDA signature or null if not signed
 */
export function getNDASignature(userId: string): NDASignature | null {
  const stmt = db.prepare(`
    SELECT * FROM nda_signatures
    WHERE user_id = ? AND version = ?
    LIMIT 1
  `)

  const row = stmt.get(userId, CURRENT_NDA_VERSION) as Record<string, unknown> | undefined

  if (!row) {
    return null
  }

  return rowToSignature(row)
}

/**
 * Get all NDA signatures for a user (all versions)
 * @param userId - The user ID
 * @returns Array of all NDA signatures
 */
export function getAllNDASignatures(userId: string): NDASignature[] {
  const stmt = db.prepare(`
    SELECT * FROM nda_signatures
    WHERE user_id = ?
    ORDER BY signed_at DESC
  `)

  const rows = stmt.all(userId) as Record<string, unknown>[]

  return rows.map(rowToSignature)
}

/**
 * Check if a user needs to sign a new NDA version
 * (has signed before but not the current version)
 * @param userId - The user ID
 * @returns True if user needs to sign new version
 */
export function needsNDAUpdate(userId: string): boolean {
  const allSignatures = getAllNDASignatures(userId)

  if (allSignatures.length === 0) {
    return false // Never signed, not an "update"
  }

  return !hasSignedNDA(userId)
}
