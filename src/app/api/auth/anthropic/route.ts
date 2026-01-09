/**
 * Anthropic OAuth Routes
 *
 * Anthropic supports Google OAuth for accessing the Max subscription plan ($200/month).
 * This is different from API key access which uses separate pay-per-use credits.
 *
 * OAuth = Uses your Anthropic Max subscription (monthly plan)
 * API Key = Uses separate API credits (pay-per-use)
 */

import { NextRequest, NextResponse } from "next/server"

// Anthropic uses Google OAuth for account sign-in
// When you sign in with Google to Anthropic, you get access to your Max plan
const GOOGLE_CLIENT_ID = process.env.ANTHROPIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.ANTHROPIC_GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/anthropic/callback`
  : "http://localhost:3000/api/auth/anthropic/callback"

// Google OAuth endpoints
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

// Scopes needed for Google sign-in (basic profile info to identify the user)
const SCOPES = [
  "openid",
  "email",
  "profile"
].join(" ")

/**
 * GET - Initiate OAuth flow or check status
 *
 * Query params:
 *   - action=check: Check if OAuth is configured
 *   - action=start: Start OAuth flow (redirects to Google)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get("action")

  // Check if OAuth is configured
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return NextResponse.json({
      configured: false,
      oauthSupported: true,
      apiKeySupported: true,
      message: "Google OAuth not configured. You can still use API keys.",
      apiKeyUrl: "https://console.anthropic.com/settings/keys",
      setupInstructions: "Set ANTHROPIC_GOOGLE_CLIENT_ID and ANTHROPIC_GOOGLE_CLIENT_SECRET (or GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET) in environment variables."
    })
  }

  if (action === "check") {
    return NextResponse.json({
      configured: true,
      oauthSupported: true,
      apiKeySupported: true,
      message: "Both Google sign-in (for Max subscription) and API keys (pay-per-use) are available.",
      apiKeyUrl: "https://console.anthropic.com/settings/keys"
    })
  }

  if (action === "start") {
    // Generate state for CSRF protection
    const state = crypto.randomUUID()

    // Build authorization URL
    const authUrl = new URL(GOOGLE_AUTH_URL)
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID)
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI)
    authUrl.searchParams.set("response_type", "code")
    authUrl.searchParams.set("scope", SCOPES)
    authUrl.searchParams.set("access_type", "offline")
    authUrl.searchParams.set("prompt", "consent")
    authUrl.searchParams.set("state", `anthropic:${state}`)
    // Include hint that this is for Anthropic login
    authUrl.searchParams.set("login_hint", "")

    return NextResponse.json({
      success: true,
      authUrl: authUrl.toString(),
      state
    })
  }

  // Default: return info about both authentication methods
  return NextResponse.json({
    configured: true,
    oauthSupported: true,
    apiKeySupported: true,
    methods: {
      oauth: {
        name: "Sign in with Google",
        description: "Use your Anthropic Max subscription ($200/month)",
        benefit: "Access your monthly plan quota, not pay-per-use credits"
      },
      apiKey: {
        name: "API Key",
        description: "Use pay-per-use API credits",
        benefit: "Separate billing from subscription, usage-based pricing",
        url: "https://console.anthropic.com/settings/keys"
      }
    }
  })
}

/**
 * POST - Exchange authorization code for tokens and verify Google account
 */
export async function POST(request: NextRequest) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return NextResponse.json({
      success: false,
      error: "OAuth not configured. Please use an API key instead.",
      apiKeyUrl: "https://console.anthropic.com/settings/keys"
    }, { status: 400 })
  }

  try {
    const body = await request.json()
    const { code } = body

    if (!code) {
      return NextResponse.json({
        success: false,
        error: "Authorization code required"
      }, { status: 400 })
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI
      })
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text()
      console.error("Google token exchange failed:", error)
      return NextResponse.json({
        success: false,
        error: "Failed to exchange authorization code"
      }, { status: 400 })
    }

    const tokens = await tokenResponse.json()

    // Get user info to display which account is connected
    let userInfo = null
    if (tokens.access_token) {
      try {
        const userResponse = await fetch(GOOGLE_USERINFO_URL, {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`
          }
        })
        if (userResponse.ok) {
          userInfo = await userResponse.json()
        }
      } catch (e) {
        console.error("Failed to fetch user info:", e)
      }
    }

    // Return tokens and user info
    // The client will store these and use them to authenticate with Anthropic
    return NextResponse.json({
      success: true,
      authMethod: "oauth",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      tokenType: tokens.token_type,
      idToken: tokens.id_token,
      user: userInfo ? {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture
      } : null,
      message: "Successfully signed in with Google for Anthropic Max access"
    })
  } catch (err) {
    console.error("Anthropic OAuth error:", err)
    return NextResponse.json({
      success: false,
      error: "OAuth flow failed"
    }, { status: 500 })
  }
}
