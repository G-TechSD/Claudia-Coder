/**
 * Test API Key Endpoint
 * Validates API keys for cloud providers
 */

import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { provider, apiKey } = body

    if (!provider || !apiKey) {
      return NextResponse.json(
        { valid: false, error: "Provider and API key are required" },
        { status: 400 }
      )
    }

    let valid = false
    let error: string | undefined

    switch (provider) {
      case "anthropic":
        const anthropicResult = await testAnthropicKey(apiKey)
        valid = anthropicResult.valid
        error = anthropicResult.error
        break

      case "openai":
        const openaiResult = await testOpenAIKey(apiKey)
        valid = openaiResult.valid
        error = openaiResult.error
        break

      case "google":
        const googleResult = await testGoogleKey(apiKey)
        valid = googleResult.valid
        error = googleResult.error
        break

      default:
        return NextResponse.json(
          { valid: false, error: `Unknown provider: ${provider}` },
          { status: 400 }
        )
    }

    return NextResponse.json({ valid, error })
  } catch (err) {
    console.error("API key test error:", err)
    return NextResponse.json(
      { valid: false, error: "Failed to test API key" },
      { status: 500 }
    )
  }
}

async function testAnthropicKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      }
    })

    if (response.ok) {
      return { valid: true }
    }

    if (response.status === 401) {
      return { valid: false, error: "Invalid API key" }
    }

    if (response.status === 403) {
      return { valid: false, error: "API key lacks permission" }
    }

    return { valid: false, error: `API returned status ${response.status}` }
  } catch (err) {
    return { valid: false, error: "Connection failed" }
  }
}

async function testOpenAIKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    })

    if (response.ok) {
      return { valid: true }
    }

    if (response.status === 401) {
      return { valid: false, error: "Invalid API key" }
    }

    if (response.status === 403) {
      return { valid: false, error: "API key lacks permission" }
    }

    return { valid: false, error: `API returned status ${response.status}` }
  } catch (err) {
    return { valid: false, error: "Connection failed" }
  }
}

async function testGoogleKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    )

    if (response.ok) {
      return { valid: true }
    }

    if (response.status === 400 || response.status === 403) {
      return { valid: false, error: "Invalid API key" }
    }

    return { valid: false, error: `API returned status ${response.status}` }
  } catch (err) {
    return { valid: false, error: "Connection failed" }
  }
}
