/**
 * Development endpoint to disable authentication
 * This sets a cookie that the middleware checks to bypass auth
 *
 * Usage: Navigate to /api/dev/disable-auth in your browser
 */

import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  // Use the request's origin for the redirect to support proxied access
  const url = new URL("/", request.url)
  const response = NextResponse.redirect(url)

  // Set the auth disable cookie
  response.cookies.set("claudia-disable-auth", "true", {
    path: "/",
    httpOnly: false,
    secure: false, // Allow on HTTP for local dev
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })

  return response
}
