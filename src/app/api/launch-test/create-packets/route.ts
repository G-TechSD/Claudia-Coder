/**
 * Create Work Packets from Feedback API
 * POST /api/launch-test/create-packets
 *
 * Converts user feedback into structured work packets
 * that can be executed by the Claudia execution engine
 */

import { NextRequest, NextResponse } from "next/server"

interface FeedbackItem {
  id: string
  text: string
  screenshot?: string
  timestamp: string
}

interface WorkPacket {
  id: string
  feedbackId: string
  title: string
  description: string
  type: "bug_fix" | "ui_polish" | "enhancement" | "performance"
  priority: "low" | "medium" | "high" | "critical"
  tasks: Array<{
    id: string
    description: string
    completed: boolean
  }>
  acceptanceCriteria: string[]
}

// LLM Server config
const LLM_SERVERS = [
  { name: "Beast", url: process.env.NEXT_PUBLIC_LMSTUDIO_BEAST },
  { name: "Bedroom", url: process.env.NEXT_PUBLIC_LMSTUDIO_BEDROOM }
].filter(s => s.url)

// System prompt for converting feedback to work packets
const FEEDBACK_TO_PACKETS_PROMPT = `You are an expert software engineer converting user feedback into actionable work packets.

For each piece of feedback, analyze what the user is complaining about and create a structured work packet.

Output JSON format:
{
  "packets": [
    {
      "feedbackId": "original feedback id",
      "title": "Short descriptive title (under 60 chars)",
      "description": "Detailed description of what needs to be fixed",
      "type": "bug_fix | ui_polish | enhancement | performance",
      "priority": "low | medium | high | critical",
      "tasks": [
        { "id": "t1", "description": "First task to complete" },
        { "id": "t2", "description": "Second task to complete" }
      ],
      "acceptanceCriteria": [
        "First criterion for success",
        "Second criterion for success"
      ]
    }
  ]
}

Guidelines:
- bug_fix: Something is broken or not working as expected
- ui_polish: Visual/design issues (colors, fonts, spacing, etc.)
- enhancement: Feature requests or improvements
- performance: Speed or efficiency issues

- critical: App is broken/unusable
- high: Major functionality issue
- medium: Noticeable problem
- low: Minor improvement

Create specific, actionable tasks. Include relevant context from the feedback.`

/**
 * Try to get an available LLM server
 */
async function getAvailableLLMServer(): Promise<{ name: string; url: string } | null> {
  for (const server of LLM_SERVERS) {
    if (!server.url) continue
    try {
      const response = await fetch(`${server.url}/v1/models`, {
        method: "GET",
        signal: AbortSignal.timeout(5000)
      })
      if (response.ok) {
        return server as { name: string; url: string }
      }
    } catch {
      // Server not available
    }
  }
  return null
}

/**
 * Generate with LLM
 */
async function generateWithLLM(
  server: { name: string; url: string },
  systemPrompt: string,
  userPrompt: string
): Promise<{ content: string; error?: string }> {
  try {
    const response = await fetch(`${server.url}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 4096,
        stream: false
      }),
      signal: AbortSignal.timeout(120000)
    })

    if (!response.ok) {
      return { content: "", error: `Server error: ${response.status}` }
    }

    const data = await response.json()
    return { content: data.choices?.[0]?.message?.content || "" }
  } catch (error) {
    return { content: "", error: error instanceof Error ? error.message : "LLM error" }
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { projectId, projectName, feedbackItems } = body

  if (!feedbackItems || feedbackItems.length === 0) {
    return NextResponse.json(
      { error: "No feedback items provided" },
      { status: 400 }
    )
  }

  console.log(`[CreatePackets] Converting ${feedbackItems.length} feedback items for ${projectName}`)

  try {
    // Check if LLM is available for smart conversion
    const llmServer = await getAvailableLLMServer()

    let packets: WorkPacket[]

    if (llmServer) {
      // Use LLM for intelligent conversion
      console.log(`[CreatePackets] Using LLM (${llmServer.name}) for conversion`)

      const userPrompt = `Project: ${projectName}

User Feedback to Convert:
${feedbackItems.map((f: FeedbackItem, i: number) => `
${i + 1}. [ID: ${f.id}]
   Issue: ${f.text}
   ${f.screenshot ? "(Screenshot attached)" : ""}
   Reported: ${f.timestamp}
`).join("\n")}

Convert each feedback item into a work packet. Be specific about what needs to be fixed.`

      const response = await generateWithLLM(
        llmServer,
        FEEDBACK_TO_PACKETS_PROMPT,
        userPrompt
      )

      if (response.error) {
        console.warn(`[CreatePackets] LLM error, falling back to simple conversion:`, response.error)
        packets = simpleConversion(feedbackItems, projectId)
      } else {
        try {
          // Parse LLM response
          let jsonStr = response.content

          // Extract JSON from markdown code block if present
          const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
          if (jsonMatch) {
            jsonStr = jsonMatch[1]
          }

          const parsed = JSON.parse(jsonStr)
          packets = parsed.packets.map((p: Partial<WorkPacket>, idx: number) => ({
            id: `packet-${projectId}-${Date.now()}-${idx}`,
            feedbackId: p.feedbackId || feedbackItems[idx]?.id,
            title: p.title || `Fix: ${feedbackItems[idx]?.text.substring(0, 50)}`,
            description: p.description || feedbackItems[idx]?.text,
            type: p.type || "bug_fix",
            priority: p.priority || "medium",
            tasks: p.tasks || [
              { id: "t1", description: "Investigate the issue", completed: false },
              { id: "t2", description: "Implement fix", completed: false }
            ],
            acceptanceCriteria: p.acceptanceCriteria || ["Issue is resolved"]
          }))

          console.log(`[CreatePackets] LLM generated ${packets.length} packets`)
        } catch (parseErr) {
          console.warn(`[CreatePackets] Failed to parse LLM response:`, parseErr)
          packets = simpleConversion(feedbackItems, projectId)
        }
      }
    } else {
      // Simple rule-based conversion
      console.log(`[CreatePackets] No LLM available, using simple conversion`)
      packets = simpleConversion(feedbackItems, projectId)
    }

    return NextResponse.json({
      success: true,
      packets,
      count: packets.length,
      method: llmServer ? "llm" : "simple"
    })

  } catch (error) {
    console.error("[CreatePackets] Error:", error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to create packets",
      packets: simpleConversion(feedbackItems, projectId)
    })
  }
}

/**
 * Simple rule-based conversion when LLM is not available
 */
function simpleConversion(feedbackItems: FeedbackItem[], projectId?: string): WorkPacket[] {
  return feedbackItems.map((feedback, index) => {
    const text = feedback.text.toLowerCase()

    // Detect type from keywords
    let type: WorkPacket["type"] = "enhancement"
    let priority: WorkPacket["priority"] = "medium"

    // Bug indicators
    if (
      text.includes("error") ||
      text.includes("broken") ||
      text.includes("crash") ||
      text.includes("doesn't work") ||
      text.includes("bug") ||
      text.includes("fail") ||
      text.includes("wrong")
    ) {
      type = "bug_fix"
      priority = "high"
    }

    // Critical indicators
    if (
      text.includes("crash") ||
      text.includes("can't use") ||
      text.includes("completely broken") ||
      text.includes("nothing works")
    ) {
      priority = "critical"
    }

    // UI/Style indicators
    if (
      text.includes("color") ||
      text.includes("font") ||
      text.includes("size") ||
      text.includes("spacing") ||
      text.includes("layout") ||
      text.includes("design") ||
      text.includes("look") ||
      text.includes("ugly") ||
      text.includes("style") ||
      text.includes("align")
    ) {
      type = "ui_polish"
      if (priority !== "critical") priority = "medium"
    }

    // Performance indicators
    if (
      text.includes("slow") ||
      text.includes("lag") ||
      text.includes("freeze") ||
      text.includes("performance") ||
      text.includes("loading")
    ) {
      type = "performance"
    }

    return {
      id: `packet-${projectId || "unknown"}-${Date.now()}-${index}`,
      feedbackId: feedback.id,
      title: `Fix: ${feedback.text.substring(0, 50)}${feedback.text.length > 50 ? "..." : ""}`,
      description: `User reported issue:\n\n"${feedback.text}"\n\n${feedback.screenshot ? "A screenshot was provided for reference." : ""}`,
      type,
      priority,
      tasks: [
        {
          id: "t1",
          description: `Investigate: "${feedback.text.substring(0, 100)}"`,
          completed: false
        },
        {
          id: "t2",
          description: "Implement the necessary fix",
          completed: false
        },
        {
          id: "t3",
          description: "Test to verify the issue is resolved",
          completed: false
        }
      ],
      acceptanceCriteria: [
        `The reported issue "${feedback.text.substring(0, 50)}..." is resolved`,
        "No new issues are introduced",
        "The fix passes visual verification"
      ]
    }
  })
}
