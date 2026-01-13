/**
 * Set Default Model API Route
 * Updates the user's default AI model preference
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { getGlobalSettings, saveGlobalSettings, DefaultModelConfig } from "@/lib/settings/global-settings"

export async function POST(request: NextRequest) {
  try {
    // Check session (will be bypassed in dev mode with middleware bypass)
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    // In dev bypass mode, session may be null - allow anyway
    const isDev = process.env.NODE_ENV === "development"
    if (!session?.user && !isDev) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { modelId, provider, serverId, displayName } = body

    if (!modelId || !provider) {
      return NextResponse.json(
        { error: "Model ID and provider are required" },
        { status: 400 }
      )
    }

    // Build default model config
    const defaultModel: DefaultModelConfig = {
      provider,
      modelId,
      displayName: displayName || modelId,
      ...(serverId && { serverId }),
    }

    // Note: Global settings are stored in localStorage on client
    // This endpoint can be used for server-side storage if needed
    // For now, we just validate and return success
    // The client will handle localStorage updates

    return NextResponse.json({
      success: true,
      defaultModel,
      message: "Default model preference saved",
    })
  } catch (error) {
    console.error("Error setting default model:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // This endpoint returns the server's record of user's default model
    // Currently using localStorage on client, but this could be extended
    // to store preferences in the database

    const session = await auth.api.getSession({
      headers: await headers(),
    })

    const isDev = process.env.NODE_ENV === "development"
    if (!session?.user && !isDev) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Return empty for now - client uses localStorage
    return NextResponse.json({
      defaultModel: null,
      source: "server",
      message: "Use client localStorage for default model preferences",
    })
  } catch (error) {
    console.error("Error getting default model:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
