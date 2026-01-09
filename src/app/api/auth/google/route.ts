/**
 * Google OAuth Routes
 * Handles OAuth flow for Google AI (Gemini) API access
 */

import { NextRequest, NextResponse } from "next/server"

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
  : "http://localhost:3000/api/auth/google/callback"

// Google OAuth endpoints
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

// Scopes needed for Google AI access
const SCOPES = [
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/generative-language.retriever"
].join(" ")

/**
 * GET - Initiate OAuth flow
 * Returns authorization URL or error if not configured
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get("action")

  // Check if OAuth is configured
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return NextResponse.json({
      configured: false,
      error: "OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment."
    }, { status: 400 })
  }

  if (action === "check") {
    // Just check if OAuth is configured
    return NextResponse.json({ configured: true })
  }

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
  authUrl.searchParams.set("state", state)

  return NextResponse.json({
    configured: true,
    authUrl: authUrl.toString(),
    state
  })
}

/**
 * POST - Exchange authorization code for tokens
 */
export async function POST(request: NextRequest) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return NextResponse.json({
      success: false,
      error: "OAuth not configured"
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

    // Return tokens (client will store them)
    return NextResponse.json({
      success: true,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      tokenType: tokens.token_type
    })
  } catch (err) {
    console.error("Google OAuth error:", err)
    return NextResponse.json({
      success: false,
      error: "OAuth flow failed"
    }, { status: 500 })
  }
}
