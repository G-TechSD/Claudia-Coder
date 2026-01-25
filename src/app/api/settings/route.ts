/**
 * User Settings API
 * Server-side storage for user settings with encrypted API keys
 *
 * GET /api/settings - Fetch user settings
 * PUT /api/settings - Update user settings
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyApiAuth, unauthorizedResponse } from "@/lib/auth/api-helpers"
import {
  getUserSettingsFromDb,
  saveUserSettingsToDb,
  getSettingsLastUpdated,
  hasUserSettingsInDb
} from "@/lib/settings/settings-db"
import type { GlobalSettings } from "@/lib/settings/global-settings"

/**
 * GET /api/settings
 * Fetch user settings from the database
 *
 * Response:
 * - 200: { appSettings, globalSettings, lastUpdated }
 * - 401: Unauthorized
 * - 404: No settings found
 * - 500: Server error
 */
export async function GET(): Promise<Response> {
  try {
    // Verify authentication
    const auth = await verifyApiAuth()
    console.log("[Settings API] GET - auth result:", auth ? `user ${auth.user.id}` : "null")

    if (!auth) {
      console.log("[Settings API] GET - unauthorized")
      return unauthorizedResponse()
    }

    const userId = auth.user.id
    console.log("[Settings API] GET - userId:", userId)

    // Check if settings exist
    const hasSettings = hasUserSettingsInDb(userId)
    console.log("[Settings API] GET - hasSettings:", hasSettings)

    if (!hasSettings) {
      console.log("[Settings API] GET - no settings found for user")
      return NextResponse.json({
        success: true,
        exists: false,
        appSettings: {},
        globalSettings: null,
        lastUpdated: null
      })
    }

    // Get settings from database
    const settings = getUserSettingsFromDb(userId)
    console.log("[Settings API] GET - settings loaded, defaultLaunchHost:", settings?.globalSettings?.defaultLaunchHost)

    if (!settings) {
      return NextResponse.json({
        success: false,
        error: "Failed to fetch settings"
      }, { status: 500 })
    }

    const lastUpdated = getSettingsLastUpdated(userId)

    return NextResponse.json({
      success: true,
      exists: true,
      appSettings: settings.appSettings,
      globalSettings: settings.globalSettings,
      lastUpdated
    })
  } catch (error) {
    console.error("[Settings API] GET error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error"
    }, { status: 500 })
  }
}

/**
 * PUT /api/settings
 * Update user settings in the database
 *
 * Request body:
 * - appSettings?: Record<string, unknown> - Application settings
 * - globalSettings?: GlobalSettings - Global settings including cloud providers
 *
 * Response:
 * - 200: { success: true, lastUpdated }
 * - 400: Invalid request body
 * - 401: Unauthorized
 * - 500: Server error
 */
export async function PUT(request: NextRequest): Promise<Response> {
  try {
    // Verify authentication
    const auth = await verifyApiAuth()
    console.log("[Settings API] PUT - auth result:", auth ? `user ${auth.user.id}` : "null")

    if (!auth) {
      console.log("[Settings API] PUT - unauthorized")
      return unauthorizedResponse()
    }

    const userId = auth.user.id
    console.log("[Settings API] PUT - userId:", userId)

    // Parse request body
    let body: {
      appSettings?: Record<string, unknown>
      globalSettings?: GlobalSettings
    }

    try {
      body = await request.json()
    } catch {
      return NextResponse.json({
        success: false,
        error: "Invalid JSON body"
      }, { status: 400 })
    }

    const { appSettings, globalSettings } = body

    // Validate that at least one type of settings is provided
    if (!appSettings && !globalSettings) {
      return NextResponse.json({
        success: false,
        error: "No settings provided"
      }, { status: 400 })
    }

    // Get existing settings to merge
    const existing = getUserSettingsFromDb(userId)
    const existingApp = existing?.appSettings || {}
    const existingGlobal = existing?.globalSettings || getDefaultGlobalSettings()

    // Merge settings
    const mergedAppSettings = appSettings
      ? { ...existingApp, ...appSettings }
      : existingApp

    const mergedGlobalSettings = globalSettings
      ? mergeGlobalSettings(existingGlobal, globalSettings)
      : existingGlobal

    // Save to database
    console.log("[Settings API] PUT - saving settings for user:", userId)
    console.log("[Settings API] PUT - globalSettings.defaultLaunchHost:", mergedGlobalSettings.defaultLaunchHost)

    const saved = saveUserSettingsToDb(userId, mergedAppSettings, mergedGlobalSettings)
    console.log("[Settings API] PUT - save result:", saved)

    if (!saved) {
      console.error("[Settings API] PUT - save failed")
      return NextResponse.json({
        success: false,
        error: "Failed to save settings"
      }, { status: 500 })
    }

    const lastUpdated = getSettingsLastUpdated(userId)
    console.log("[Settings API] PUT - success, lastUpdated:", lastUpdated)

    return NextResponse.json({
      success: true,
      lastUpdated
    })
  } catch (error) {
    console.error("[Settings API] PUT error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error"
    }, { status: 500 })
  }
}

/**
 * Get default global settings
 */
function getDefaultGlobalSettings(): GlobalSettings {
  return {
    setupComplete: false,
    localServers: [],
    cloudProviders: [
      { provider: "anthropic", enabled: false, enabledModels: [] },
      { provider: "openai", enabled: false, enabledModels: [] },
      { provider: "google", enabled: false, enabledModels: [] },
      { provider: "claude-code", enabled: false, enabledModels: [] }
    ],
    preferLocalModels: true,
    autoRouteByTaskType: true
  }
}

/**
 * Deep merge global settings, preserving existing values where not overwritten
 */
function mergeGlobalSettings(
  existing: GlobalSettings,
  updates: Partial<GlobalSettings>
): GlobalSettings {
  const merged: GlobalSettings = {
    ...existing,
    ...updates
  }

  // Special handling for localServers - merge by id
  if (updates.localServers) {
    const existingMap = new Map(existing.localServers.map(s => [s.id, s]))
    for (const server of updates.localServers) {
      existingMap.set(server.id, server)
    }
    merged.localServers = Array.from(existingMap.values())
  }

  // Special handling for cloudProviders - merge by provider
  if (updates.cloudProviders) {
    const existingMap = new Map(existing.cloudProviders.map(p => [p.provider, p]))
    for (const provider of updates.cloudProviders) {
      const existingProvider = existingMap.get(provider.provider)
      if (existingProvider) {
        // Merge, keeping existing API key if not provided
        existingMap.set(provider.provider, {
          ...existingProvider,
          ...provider,
          // Don't clear API key if not explicitly set
          apiKey: provider.apiKey !== undefined ? provider.apiKey : existingProvider.apiKey,
          oauthTokens: provider.oauthTokens !== undefined ? provider.oauthTokens : existingProvider.oauthTokens
        })
      } else {
        existingMap.set(provider.provider, provider)
      }
    }
    merged.cloudProviders = Array.from(existingMap.values())
  }

  return merged
}
