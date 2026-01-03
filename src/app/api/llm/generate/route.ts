import { NextRequest, NextResponse } from "next/server"
import {
  generateWithLocalLLM,
  getConfiguredServers,
  checkServerStatus
} from "@/lib/llm/local-llm"

/**
 * Unified LLM generation endpoint
 * Uses local LLMs (LM Studio/Ollama) FIRST
 * Falls back to Anthropic only if explicitly requested and local unavailable
 */
export async function POST(request: NextRequest) {
  try {
    const {
      systemPrompt,
      userPrompt,
      temperature = 0.7,
      max_tokens = 1024,
      allowPaidFallback = false,
      preferredServer
    } = await request.json()

    if (!userPrompt) {
      return NextResponse.json(
        { error: "userPrompt is required" },
        { status: 400 }
      )
    }

    // Try local LLM first (always)
    const localResponse = await generateWithLocalLLM(
      systemPrompt || "You are a helpful assistant.",
      userPrompt,
      { temperature, max_tokens, preferredServer }
    )

    if (!localResponse.error) {
      return NextResponse.json({
        content: localResponse.content,
        source: "local",
        server: localResponse.server,
        model: localResponse.model
      })
    }

    // Local failed - try Anthropic only if allowed
    if (allowPaidFallback && process.env.ANTHROPIC_API_KEY) {
      try {
        const Anthropic = (await import("@anthropic-ai/sdk")).default
        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY
        })

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens,
          system: systemPrompt || "You are a helpful assistant.",
          messages: [{ role: "user", content: userPrompt }]
        })

        const content = response.content[0].type === "text"
          ? response.content[0].text
          : ""

        return NextResponse.json({
          content,
          source: "anthropic",
          model: "claude-sonnet-4-20250514",
          warning: "Using paid Anthropic API - local LLM was unavailable"
        })
      } catch (error) {
        console.error("Anthropic fallback failed:", error)
      }
    }

    // Everything failed
    return NextResponse.json({
      content: "",
      source: "none",
      error: localResponse.error || "No LLM servers available",
      suggestion: "Start LM Studio or Ollama to enable AI features"
    })
  } catch (error) {
    console.error("LLM generation error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    )
  }
}

// GET endpoint to check server status
export async function GET() {
  const servers = getConfiguredServers()
  const statusChecks = await Promise.all(servers.map(checkServerStatus))

  return NextResponse.json({
    servers: statusChecks,
    hasLocalAvailable: statusChecks.some(s => s.status === "online"),
    hasPaidConfigured: !!process.env.ANTHROPIC_API_KEY
  })
}
