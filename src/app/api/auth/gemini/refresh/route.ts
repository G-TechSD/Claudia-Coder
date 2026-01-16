import { NextRequest, NextResponse } from "next/server"

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

export async function POST(request: NextRequest) {
  const { refresh_token } = await request.json()

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret || !refresh_token) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 })
  }

  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token"
      })
    })

    const tokens = await response.json()

    if (tokens.error) {
      return NextResponse.json({ error: tokens.error }, { status: 400 })
    }

    return NextResponse.json({
      access_token: tokens.access_token,
      expires_in: tokens.expires_in
    })
  } catch (error) {
    return NextResponse.json({ error: "Token refresh failed" }, { status: 500 })
  }
}
