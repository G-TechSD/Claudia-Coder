/**
 * OAuth Callback Handler
 * Exchanges authorization code for access token and stores it
 */

import { NextRequest, NextResponse } from "next/server"

// Token endpoint configuration per provider
const TOKEN_CONFIG: Record<string, {
  tokenUrl: string
  clientIdEnv: string
  clientSecretEnv: string
}> = {
  google: {
    tokenUrl: "https://oauth2.googleapis.com/token",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET"
  },
  openai: {
    tokenUrl: "https://auth.openai.com/oauth/token",
    clientIdEnv: "OPENAI_CLIENT_ID",
    clientSecretEnv: "OPENAI_CLIENT_SECRET"
  },
  anthropic: {
    tokenUrl: "https://api.anthropic.com/oauth/token",
    clientIdEnv: "ANTHROPIC_CLIENT_ID",
    clientSecretEnv: "ANTHROPIC_CLIENT_SECRET"
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params
  const config = TOKEN_CONFIG[provider]

  if (!config) {
    return NextResponse.redirect(new URL("/settings?error=unknown_provider", request.url))
  }

  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  // Handle OAuth errors
  if (error) {
    const errorDesc = searchParams.get("error_description") || error
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(errorDesc)}&provider=${provider}`, request.url)
    )
  }

  if (!code) {
    return NextResponse.redirect(new URL("/settings?error=no_code", request.url))
  }

  // Verify state
  const storedState = request.cookies.get(`oauth_state_${provider}`)?.value
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(new URL("/settings?error=invalid_state", request.url))
  }

  const clientId = process.env[config.clientIdEnv]
  const clientSecret = process.env[config.clientSecretEnv]

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/settings?error=not_configured", request.url))
  }

  const baseUrl = request.nextUrl.origin
  const redirectUri = `${baseUrl}/api/auth/callback/${provider}`

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret
      })
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error(`Token exchange failed for ${provider}:`, errorData)
      return NextResponse.redirect(
        new URL(`/settings?error=token_exchange_failed&provider=${provider}`, request.url)
      )
    }

    const tokens = await tokenResponse.json()

    // Store tokens in a secure cookie (encrypted in production)
    // In a real app, you'd store this in a database linked to the user
    const response = NextResponse.redirect(
      new URL(`/settings?success=connected&provider=${provider}`, request.url)
    )

    // Store the access token securely
    response.cookies.set(`${provider}_access_token`, tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: tokens.expires_in || 3600
    })

    // Store refresh token if available
    if (tokens.refresh_token) {
      response.cookies.set(`${provider}_refresh_token`, tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30 // 30 days
      })
    }

    // Clear state cookie
    response.cookies.delete(`oauth_state_${provider}`)

    return response
  } catch (error) {
    console.error(`OAuth callback error for ${provider}:`, error)
    return NextResponse.redirect(
      new URL(`/settings?error=callback_failed&provider=${provider}`, request.url)
    )
  }
}
