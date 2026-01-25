/**
 * Settings Migration API
 * One-time migration from localStorage to server-side storage
 *
 * POST /api/settings/migrate - Migrate localStorage settings to database
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyApiAuth, unauthorizedResponse } from "@/lib/auth/api-helpers"
import {
  migrateFromLocalStorage,
  hasUserSettingsInDb
} from "@/lib/settings/settings-db"
import type { GlobalSettings } from "@/lib/settings/global-settings"

/**
 * POST /api/settings/migrate
 * Migrate settings from localStorage to server-side database storage
 *
 * This endpoint accepts the client's localStorage settings and stores them
 * securely in the database with proper encryption for sensitive data like API keys.
 *
 * Request body:
 * - appSettings?: Record<string, unknown> - App settings from localStorage
 * - globalSettings?: GlobalSettings - Global settings including cloud providers
 * - userSettings?: { apiKeys?: {...}, n8n?: {...} } - User-specific settings
 * - force?: boolean - Force migration even if settings already exist
 *
 * Response:
 * - 200: { success: true, migrated: boolean, alreadyExists?: boolean }
 * - 400: Invalid request body
 * - 401: Unauthorized
 * - 500: Server error
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Verify authentication
    const auth = await verifyApiAuth()
    if (!auth) {
      return unauthorizedResponse()
    }

    const userId = auth.user.id

    // Parse request body
    let body: {
      appSettings?: Record<string, unknown>
      globalSettings?: GlobalSettings
      userSettings?: {
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
      }
      force?: boolean
    }

    try {
      body = await request.json()
    } catch {
      return NextResponse.json({
        success: false,
        error: "Invalid JSON body"
      }, { status: 400 })
    }

    const { appSettings, globalSettings, userSettings, force = false } = body

    // Check if settings already exist (unless force is set)
    if (!force && hasUserSettingsInDb(userId)) {
      console.log(`[Settings Migration] Settings already exist for user ${userId.slice(0, 8)}..., skipping`)
      return NextResponse.json({
        success: true,
        migrated: false,
        alreadyExists: true,
        message: "Settings already exist in the database. Use force=true to overwrite."
      })
    }

    // Log migration info
    console.log(`[Settings Migration] Starting migration for user ${userId.slice(0, 8)}...`)
    console.log(`[Settings Migration]   appSettings: ${appSettings ? "provided" : "not provided"}`)
    console.log(`[Settings Migration]   globalSettings: ${globalSettings ? "provided" : "not provided"}`)
    console.log(`[Settings Migration]   userSettings: ${userSettings ? "provided" : "not provided"}`)
    console.log(`[Settings Migration]   force: ${force}`)

    // Count sensitive data being migrated (for logging only, not exposing values)
    if (globalSettings?.cloudProviders) {
      const providersWithKeys = globalSettings.cloudProviders.filter(p => p.apiKey).length
      console.log(`[Settings Migration]   Cloud providers with API keys: ${providersWithKeys}`)
    }
    if (userSettings?.apiKeys) {
      const keyCount = Object.values(userSettings.apiKeys).filter(Boolean).length
      console.log(`[Settings Migration]   User API keys: ${keyCount}`)
    }

    // Perform migration
    const result = migrateFromLocalStorage(
      userId,
      appSettings,
      globalSettings,
      userSettings
    )

    if (!result.success) {
      console.error(`[Settings Migration] Failed for user ${userId.slice(0, 8)}...: ${result.error}`)
      return NextResponse.json({
        success: false,
        error: result.error || "Migration failed"
      }, { status: 500 })
    }

    console.log(`[Settings Migration] Completed for user ${userId.slice(0, 8)}..., migrated: ${result.migrated}`)

    return NextResponse.json({
      success: true,
      migrated: result.migrated,
      message: result.migrated
        ? "Settings migrated successfully"
        : "Settings already existed, no migration needed"
    })
  } catch (error) {
    console.error("[Settings Migration] Error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error"
    }, { status: 500 })
  }
}

/**
 * GET /api/settings/migrate
 * Check migration status
 *
 * Response:
 * - 200: { needsMigration: boolean, hasServerSettings: boolean }
 * - 401: Unauthorized
 */
export async function GET(): Promise<Response> {
  try {
    // Verify authentication
    const auth = await verifyApiAuth()
    if (!auth) {
      return unauthorizedResponse()
    }

    const userId = auth.user.id
    const hasSettings = hasUserSettingsInDb(userId)

    return NextResponse.json({
      success: true,
      hasServerSettings: hasSettings,
      needsMigration: !hasSettings
    })
  } catch (error) {
    console.error("[Settings Migration] Check error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error"
    }, { status: 500 })
  }
}
