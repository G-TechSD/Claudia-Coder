import { NextRequest, NextResponse } from "next/server"

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

// Scopes needed for Gemini API
const SCOPES = [
  "https://www.googleapis.com/auth/generative-language.retriever",
  "https://www.googleapis.com/auth/cloud-platform",
  "openid",
  "email",
  "profile"
].join(" ")

export async function GET(request: NextRequest) {
  // Return auth URL for user to visit
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gemini/callback`

  if (!clientId) {
    return NextResponse.json({
      error: "Google OAuth not configured",
      setup: "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local"
    }, { status: 400 })
  }

  const state = crypto.randomUUID()

  const authUrl = new URL(GOOGLE_AUTH_URL)
  authUrl.searchParams.set("client_id", clientId)
  authUrl.searchParams.set("redirect_uri", redirectUri)
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("scope", SCOPES)
  authUrl.searchParams.set("access_type", "offline")
  authUrl.searchParams.set("prompt", "consent")
  authUrl.searchParams.set("state", state)

  return NextResponse.json({
    authUrl: authUrl.toString(),
    state,
    instructions: "Visit the authUrl in your browser, authorize, and paste the code back"
  })
}

export async function POST(request: NextRequest) {
  // Exchange code for tokens
  const { code } = await request.json()

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gemini/callback`

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Google OAuth not configured" }, { status: 400 })
  }

  try {
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    })

    const tokens = await tokenResponse.json()

    if (tokens.error) {
      return NextResponse.json({ error: tokens.error_description || tokens.error }, { status: 400 })
    }

    // Get user info
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    })
    const userInfo = await userInfoResponse.json()

    return NextResponse.json({
      success: true,
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        token_type: tokens.token_type
      },
      user: {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture
      }
    })
  } catch (error) {
    return NextResponse.json({ error: "Token exchange failed" }, { status: 500 })
  }
}
