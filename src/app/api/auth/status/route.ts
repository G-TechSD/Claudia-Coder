/**
 * OAuth Status Check
 * Returns which providers are connected via OAuth
 */

import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const providers = ["google", "openai", "anthropic"]
  const status: Record<string, {
    connected: boolean
    hasToken: boolean
    configured: boolean
  }> = {}

  for (const provider of providers) {
    const accessToken = request.cookies.get(`${provider}_access_token`)?.value
    const refreshToken = request.cookies.get(`${provider}_refresh_token`)?.value

    // Check if OAuth is configured for this provider
    let configured = false
    if (provider === "google") {
      configured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
    } else if (provider === "openai") {
      configured = !!(process.env.OPENAI_CLIENT_ID && process.env.OPENAI_CLIENT_SECRET)
    } else if (provider === "anthropic") {
      configured = !!(process.env.ANTHROPIC_CLIENT_ID && process.env.ANTHROPIC_CLIENT_SECRET)
    }

    status[provider] = {
      connected: !!accessToken,
      hasToken: !!accessToken || !!refreshToken,
      configured
    }
  }

  return NextResponse.json({ status })
}
