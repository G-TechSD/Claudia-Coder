/**
 * OpenAI OAuth Routes
 * Note: OpenAI doesn't have a traditional OAuth flow for API access
 * API keys must be obtained from the OpenAI dashboard
 * This endpoint provides info and fallback handling
 */

import { NextRequest, NextResponse } from "next/server"

/**
 * GET - Check OAuth status for OpenAI
 * OpenAI uses API keys, not OAuth, so this returns guidance
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get("action")

  if (action === "check") {
    // OpenAI doesn't support OAuth - API keys only
    return NextResponse.json({
      configured: false,
      oauthSupported: false,
      message: "OpenAI requires API keys. OAuth is not available.",
      apiKeyUrl: "https://platform.openai.com/api-keys"
    })
  }

  return NextResponse.json({
    configured: false,
    oauthSupported: false,
    error: "OpenAI does not support OAuth authentication. Please use an API key.",
    apiKeyUrl: "https://platform.openai.com/api-keys"
  })
}

/**
 * POST - Not supported for OpenAI
 */
export async function POST() {
  return NextResponse.json({
    success: false,
    error: "OpenAI does not support OAuth. Use an API key instead.",
    apiKeyUrl: "https://platform.openai.com/api-keys"
  }, { status: 400 })
}
