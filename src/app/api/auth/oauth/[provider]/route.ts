/**
 * OAuth Initiation Handler
 * Redirects to provider's OAuth authorization page
 */

import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

// OAuth Configuration per provider
const OAUTH_CONFIG: Record<string, {
  authUrl: string
  scopes: string
  clientIdEnv: string
}> = {
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scopes: "openid email profile https://www.googleapis.com/auth/generative-language.retriever",
    clientIdEnv: "GOOGLE_CLIENT_ID"
  },
  openai: {
    authUrl: "https://auth.openai.com/authorize",
    scopes: "openid profile email",
    clientIdEnv: "OPENAI_CLIENT_ID"
  },
  anthropic: {
    authUrl: "https://console.anthropic.com/oauth/authorize",
    scopes: "read:models write:messages",
    clientIdEnv: "ANTHROPIC_CLIENT_ID"
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params
  const config = OAUTH_CONFIG[provider]

  if (!config) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 })
  }

  const clientId = process.env[config.clientIdEnv]
  if (!clientId) {
    return NextResponse.json(
      { error: `${provider} OAuth not configured. Set ${config.clientIdEnv} in environment.` },
      { status: 500 }
    )
  }

  // Generate state for CSRF protection
  const state = crypto.randomBytes(32).toString("hex")

  // Store state in cookie for verification
  const baseUrl = request.nextUrl.origin
  const redirectUri = `${baseUrl}/api/auth/callback/${provider}`

  // Build authorization URL
  const authUrl = new URL(config.authUrl)
  authUrl.searchParams.set("client_id", clientId)
  authUrl.searchParams.set("redirect_uri", redirectUri)
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("scope", config.scopes)
  authUrl.searchParams.set("state", state)
  authUrl.searchParams.set("access_type", "offline")
  authUrl.searchParams.set("prompt", "consent")

  // Set state cookie and redirect
  const response = NextResponse.redirect(authUrl.toString())
  response.cookies.set(`oauth_state_${provider}`, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10 // 10 minutes
  })

  return response
}
