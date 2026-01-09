/**
 * Google OAuth Callback
 * Handles the redirect after user authorizes
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
      `${baseUrl}/settings?tab=connections&oauth_error=${encodeURIComponent(error)}&provider=google`
    )
  }

  if (!code) {
    return NextResponse.redirect(
      `${baseUrl}/settings?tab=connections&oauth_error=no_code&provider=google`
    )
  }

  // Redirect to settings page with the code
  // The client-side will exchange the code for tokens
  return NextResponse.redirect(
    `${baseUrl}/settings?tab=connections&oauth_code=${encodeURIComponent(code)}&oauth_state=${encodeURIComponent(state || "")}&provider=google`
  )
}
