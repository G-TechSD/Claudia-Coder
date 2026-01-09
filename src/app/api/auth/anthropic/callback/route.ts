/**
 * Anthropic OAuth Callback
 * Handles the redirect after user authorizes with Google for Anthropic Max access
 */

import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  if (error) {
    // User denied access or other error
    return NextResponse.redirect(
      `${baseUrl}/settings?tab=ai-services&oauth_error=${encodeURIComponent(error)}&provider=anthropic`
    )
  }

  if (!code) {
    return NextResponse.redirect(
      `${baseUrl}/settings?tab=ai-services&oauth_error=no_code&provider=anthropic`
    )
  }

  // Redirect to settings page with the code
  // The client-side will exchange the code for tokens
  return NextResponse.redirect(
    `${baseUrl}/settings?tab=ai-services&oauth_code=${encodeURIComponent(code)}&oauth_state=${encodeURIComponent(state || "")}&provider=anthropic`
  )
}
