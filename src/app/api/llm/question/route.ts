import { NextRequest, NextResponse } from "next/server"
import { generateWithLocalLLM } from "@/lib/llm/local-llm"

/**
 * Interview question generation endpoint - LOCAL LLM FIRST
 */
export async function POST(request: NextRequest) {
  try {
    const { systemPrompt, messages, context, allowPaidFallback = false } = await request.json()

    // Build conversation history as a single prompt
    const conversationHistory = messages
      .map((m: { role: string; content: string }) =>
        `${m.role.toUpperCase()}: ${m.content}`
      )
      .join("\n\n")

    const userPrompt = `Based on this interview conversation, generate the next thoughtful follow-up question:

${conversationHistory}

${context ? `\nContext: ${JSON.stringify(context)}` : ""}

Generate a single, natural follow-up question that:
1. Builds on what the user has shared
2. Explores areas not yet discussed
3. Helps gather more project details
4. Is conversational and friendly

Respond with ONLY the question, no prefix or explanation.`

    // Try local LLM first
    const localResponse = await generateWithLocalLLM(
      systemPrompt || "You are a friendly project interviewer helping gather requirements.",
      userPrompt,
      { temperature: 0.7, max_tokens: 256 }
    )

    if (!localResponse.error) {
      return NextResponse.json({
        question: localResponse.content.trim(),
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

        // Build conversation for Claude in its native format
        const claudeMessages = messages.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content
        }))

        // Add instruction for next question
        claudeMessages.push({
          role: "user" as const,
          content: "Based on our conversation so far, ask the next most relevant question. Be conversational and natural. Just respond with the question, nothing else."
        })

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 256,
          system: systemPrompt,
          messages: claudeMessages
        })

        const question = response.content[0].type === "text"
          ? response.content[0].text.trim()
          : ""

        return NextResponse.json({
          question,
          source: "anthropic",
          model: "claude-sonnet-4-20250514",
          warning: "Using paid API - local LLM unavailable"
        })
      } catch (error) {
        console.error("Anthropic fallback failed:", error)
      }
    }

    // All failed
    return NextResponse.json({
      question: "",
      error: localResponse.error || "No LLM servers available",
      suggestion: "Start LM Studio or Ollama to enable AI features",
      source: "none"
    })

  } catch (error) {
    console.error("LLM question generation error:", error)
    return NextResponse.json(
      {
        question: "",
        error: error instanceof Error ? error.message : "Failed to generate question"
      },
      { status: 500 }
    )
  }
}
