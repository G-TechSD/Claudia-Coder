/**
 * Server-side Settings Encryption
 * Uses AES-256-GCM for encrypting sensitive data like API keys
 *
 * This provides proper cryptographic security for settings stored in the database.
 * The encryption key should be stored in SETTINGS_ENCRYPTION_KEY environment variable.
 *
 * Generate a key with: openssl rand -hex 32
 */

import crypto from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12 // 96 bits for GCM
const AUTH_TAG_LENGTH = 16 // 128 bits
const ENCRYPTION_VERSION = "v1"

/**
 * Get the encryption key from environment
 * Key must be 64 hex characters (32 bytes)
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.SETTINGS_ENCRYPTION_KEY

  if (!keyHex) {
    // In development, use a fallback key (NOT for production!)
    console.warn("[encryption] SETTINGS_ENCRYPTION_KEY not set, using development fallback key")
    // Development-only fallback - a deterministic key derived from a fixed string
    return crypto.scryptSync("claudia-dev-key-not-for-production", "claudia-salt", 32)
  }

  if (keyHex.length !== 64) {
    throw new Error(`SETTINGS_ENCRYPTION_KEY must be 64 hex characters (32 bytes), got ${keyHex.length}`)
  }

  return Buffer.from(keyHex, "hex")
}

/**
 * Encrypt sensitive settings data
 *
 * @param data - Object containing sensitive data to encrypt
 * @returns Encrypted string in format: v1:iv:authTag:ciphertext (base64 encoded)
 */
export function encryptSettings(data: object): string {
  if (!data || Object.keys(data).length === 0) {
    return ""
  }

  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH
  })

  const plaintext = JSON.stringify(data)
  let ciphertext = cipher.update(plaintext, "utf8", "base64")
  ciphertext += cipher.final("base64")

  const authTag = cipher.getAuthTag()

  // Format: version:iv:authTag:ciphertext
  return `${ENCRYPTION_VERSION}:${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext}`
}

/**
 * Decrypt sensitive settings data
 *
 * @param encrypted - Encrypted string from encryptSettings()
 * @returns Decrypted object, or empty object if decryption fails
 */
export function decryptSettings(encrypted: string): object {
  if (!encrypted) {
    return {}
  }

  try {
    const parts = encrypted.split(":")

    if (parts.length !== 4) {
      console.error("[encryption] Invalid encrypted format - expected 4 parts")
      return {}
    }

    const [version, ivBase64, authTagBase64, ciphertext] = parts

    if (version !== ENCRYPTION_VERSION) {
      console.error(`[encryption] Unsupported encryption version: ${version}`)
      return {}
    }

    const key = getEncryptionKey()
    const iv = Buffer.from(ivBase64, "base64")
    const authTag = Buffer.from(authTagBase64, "base64")

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH
    })
    decipher.setAuthTag(authTag)

    let plaintext = decipher.update(ciphertext, "base64", "utf8")
    plaintext += decipher.final("utf8")

    return JSON.parse(plaintext)
  } catch (error) {
    console.error("[encryption] Decryption failed:", error instanceof Error ? error.message : error)
    return {}
  }
}

/**
 * Check if the encryption key is properly configured
 */
export function isEncryptionConfigured(): boolean {
  const keyHex = process.env.SETTINGS_ENCRYPTION_KEY
  return !!keyHex && keyHex.length === 64
}

/**
 * Extract sensitive fields from settings that should be encrypted
 * These fields contain API keys and tokens that must be protected
 */
export interface SensitiveSettings {
  // API Keys
  anthropicApiKey?: string
  openaiApiKey?: string
  googleApiKey?: string
  n8nApiKey?: string

  // OAuth tokens
  oauthTokens?: {
    provider: string
    accessToken: string
    refreshToken?: string
    expiresAt?: number
    idToken?: string
  }[]

  // Other sensitive data
  [key: string]: unknown
}

/**
 * Helper to check if a settings object contains any sensitive data
 */
export function hasSensitiveData(settings: SensitiveSettings): boolean {
  const sensitiveKeys = [
    "anthropicApiKey",
    "openaiApiKey",
    "googleApiKey",
    "n8nApiKey",
    "oauthTokens"
  ]

  return sensitiveKeys.some(key => {
    const value = settings[key]
    if (Array.isArray(value)) return value.length > 0
    return !!value
  })
}

/**
 * Extract sensitive data from global/user settings for encryption
 * Returns an object containing only the sensitive fields
 */
export function extractSensitiveData(settings: {
  cloudProviders?: Array<{
    provider: string
    apiKey?: string
    oauthTokens?: {
      accessToken: string
      refreshToken?: string
      expiresAt?: number
      idToken?: string
    }
  }>
  apiKeys?: {
    anthropic?: string
    openai?: string
    google?: string
    n8n?: string
  }
  n8n?: {
    personalInstance?: {
      apiKey?: string
    }
  }
}): SensitiveSettings {
  const sensitive: SensitiveSettings = {}

  // Extract API keys from cloudProviders
  if (settings.cloudProviders) {
    for (const provider of settings.cloudProviders) {
      if (provider.apiKey) {
        switch (provider.provider) {
          case "anthropic":
            sensitive.anthropicApiKey = provider.apiKey
            break
          case "openai":
            sensitive.openaiApiKey = provider.apiKey
            break
          case "google":
            sensitive.googleApiKey = provider.apiKey
            break
        }
      }

      if (provider.oauthTokens) {
        if (!sensitive.oauthTokens) sensitive.oauthTokens = []
        sensitive.oauthTokens.push({
          provider: provider.provider,
          ...provider.oauthTokens
        })
      }
    }
  }

  // Extract API keys from user settings format
  if (settings.apiKeys) {
    if (settings.apiKeys.anthropic) sensitive.anthropicApiKey = settings.apiKeys.anthropic
    if (settings.apiKeys.openai) sensitive.openaiApiKey = settings.apiKeys.openai
    if (settings.apiKeys.google) sensitive.googleApiKey = settings.apiKeys.google
    if (settings.apiKeys.n8n) sensitive.n8nApiKey = settings.apiKeys.n8n
  }

  // Extract n8n personal instance API key
  if (settings.n8n?.personalInstance?.apiKey) {
    sensitive.n8nApiKey = settings.n8n.personalInstance.apiKey
  }

  return sensitive
}

/**
 * Merge decrypted sensitive data back into settings
 */
export function mergeSensitiveData<T extends {
  cloudProviders?: Array<{
    provider: string
    apiKey?: string
    oauthTokens?: {
      accessToken: string
      refreshToken?: string
      expiresAt?: number
      idToken?: string
    }
  }>
  apiKeys?: {
    anthropic?: string
    openai?: string
    google?: string
    n8n?: string
  }
  n8n?: {
    personalInstance?: {
      apiKey?: string
      baseUrl?: string
    }
  }
}>(settings: T, sensitive: SensitiveSettings): T {
  const merged = { ...settings }

  // Merge API keys into cloudProviders
  if (merged.cloudProviders) {
    for (const provider of merged.cloudProviders) {
      switch (provider.provider) {
        case "anthropic":
          if (sensitive.anthropicApiKey) provider.apiKey = sensitive.anthropicApiKey
          break
        case "openai":
          if (sensitive.openaiApiKey) provider.apiKey = sensitive.openaiApiKey
          break
        case "google":
          if (sensitive.googleApiKey) provider.apiKey = sensitive.googleApiKey
          break
      }

      // Merge OAuth tokens
      if (sensitive.oauthTokens) {
        const oauthToken = sensitive.oauthTokens.find(t => t.provider === provider.provider)
        if (oauthToken) {
          provider.oauthTokens = {
            accessToken: oauthToken.accessToken,
            refreshToken: oauthToken.refreshToken,
            expiresAt: oauthToken.expiresAt,
            idToken: oauthToken.idToken
          }
        }
      }
    }
  }

  // Merge into apiKeys format
  if (merged.apiKeys || sensitive.anthropicApiKey || sensitive.openaiApiKey || sensitive.googleApiKey || sensitive.n8nApiKey) {
    if (!merged.apiKeys) merged.apiKeys = {}
    if (sensitive.anthropicApiKey) merged.apiKeys.anthropic = sensitive.anthropicApiKey
    if (sensitive.openaiApiKey) merged.apiKeys.openai = sensitive.openaiApiKey
    if (sensitive.googleApiKey) merged.apiKeys.google = sensitive.googleApiKey
    if (sensitive.n8nApiKey) merged.apiKeys.n8n = sensitive.n8nApiKey
  }

  // Merge n8n API key
  if (sensitive.n8nApiKey && merged.n8n?.personalInstance) {
    merged.n8n.personalInstance.apiKey = sensitive.n8nApiKey
  }

  return merged
}
