import { NextRequest, NextResponse } from "next/server"

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models"

export async function POST(request: NextRequest) {
  const { prompt, model = "gemini-2.5-flash", accessToken } = await request.json()

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
  }

  // Use OAuth token if provided, otherwise fall back to API key
  let authHeader: string
  if (accessToken) {
    authHeader = `Bearer ${accessToken}`
  } else if (process.env.GOOGLE_AI_API_KEY) {
    // API key auth uses query param, not header
    const apiKey = process.env.GOOGLE_AI_API_KEY
    const url = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      })

      const data = await response.json()

      if (data.error) {
        return NextResponse.json({ error: data.error.message }, { status: 400 })
      }

      return NextResponse.json({
        response: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
        model,
        source: "api_key"
      })
    } catch (error) {
      return NextResponse.json({ error: "Gemini API call failed" }, { status: 500 })
    }
  } else {
    return NextResponse.json({
      error: "No authentication provided",
      hint: "Either provide an accessToken (OAuth) or configure GOOGLE_AI_API_KEY"
    }, { status: 401 })
  }

  // OAuth token flow
  try {
    const url = `${GEMINI_API_URL}/${model}:generateContent`

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    })

    const data = await response.json()

    if (data.error) {
      return NextResponse.json({
        error: data.error.message,
        code: data.error.code
      }, { status: data.error.code || 400 })
    }

    return NextResponse.json({
      response: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
      model,
      source: "oauth"
    })
  } catch (error) {
    return NextResponse.json({ error: "Gemini API call failed" }, { status: 500 })
  }
}
