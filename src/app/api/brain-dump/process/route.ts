/**
 * Brain Dump Processing API
 * Uses local LLM to structure transcripts into actionable content
 */

import { NextRequest, NextResponse } from "next/server"

const LMSTUDIO_SERVER_1 = process.env.NEXT_PUBLIC_LMSTUDIO_SERVER_1
const LMSTUDIO_SERVER_2 = process.env.NEXT_PUBLIC_LMSTUDIO_SERVER_2
const OLLAMA_URL = process.env.NEXT_PUBLIC_OLLAMA_URL

const SYSTEM_PROMPT = `You are an expert project analyst processing a voice recording transcript.
Your job is to extract structured, actionable information while preserving the speaker's intent and nuance.

Structure your output with:
1. A concise summary (2-3 sentences)
2. Organized sections by topic
3. Clear action items with priorities
4. Key decisions and their rationale
5. Questions that need answers
6. Raw insights worth preserving

Be thorough but not verbose. Capture the essence, not every word.
Return ONLY valid JSON matching the schema below. No markdown, no explanation.`

function buildUserPrompt(transcript: string, projectName?: string, projectDescription?: string): string {
  return `Process this brain dump transcript${projectName ? ` for project: ${projectName}` : ""}.

${projectDescription ? `Project context: ${projectDescription}\n` : ""}
TRANSCRIPT:
${transcript}

Extract and structure into this exact JSON format:
{
  "summary": "Brief 2-3 sentence summary of the brain dump",
  "sections": [
    {
      "id": "unique-id",
      "title": "Section title",
      "content": "Section content",
      "type": "overview|feature|technical|requirement|idea|concern|decision"
    }
  ],
  "actionItems": [
    {
      "id": "unique-id",
      "description": "What needs to be done",
      "priority": "high|medium|low",
      "category": "task|research|decision|question"
    }
  ],
  "ideas": ["List of ideas mentioned"],
  "decisions": [
    {
      "id": "unique-id",
      "description": "What was decided",
      "rationale": "Why this decision was made"
    }
  ],
  "questions": ["Questions that need answers"],
  "rawInsights": ["Other valuable insights or observations"]
}

Return ONLY the JSON, no markdown code blocks.`
}

async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  // Try endpoints in order
  const endpoints = [
    LMSTUDIO_SERVER_1,
    LMSTUDIO_SERVER_2,
    OLLAMA_URL
  ].filter(Boolean) as string[]

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${endpoint}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "local-model",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 4096
        }),
        signal: AbortSignal.timeout(60000) // 60 second timeout
      })

      if (response.ok) {
        const data = await response.json()
        return data.choices?.[0]?.message?.content || ""
      }
    } catch (error) {
      console.log(`Endpoint ${endpoint} failed:`, error)
      continue
    }
  }

  throw new Error("No LLM endpoint available")
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function parseResponse(content: string): {
  summary: string
  sections: Array<{ id: string; title: string; content: string; type: string; approved: boolean }>
  actionItems: Array<{ id: string; description: string; priority: string; category: string; approved: boolean }>
  ideas: string[]
  decisions: Array<{ id: string; description: string; rationale: string; approved: boolean }>
  questions: string[]
  rawInsights: string[]
} {
  // Try to extract JSON from the response
  let jsonStr = content.trim()

  // Remove markdown code blocks if present
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
  }

  try {
    const parsed = JSON.parse(jsonStr)

    // Ensure all arrays exist and items have IDs and approved flags
    return {
      summary: parsed.summary || "",
      sections: (parsed.sections || []).map((s: { id?: string; title: string; content: string; type: string }) => ({
        id: s.id || generateId(),
        title: s.title || "Untitled",
        content: s.content || "",
        type: s.type || "overview",
        approved: false
      })),
      actionItems: (parsed.actionItems || []).map((a: { id?: string; description: string; priority: string; category: string }) => ({
        id: a.id || generateId(),
        description: a.description || "",
        priority: a.priority || "medium",
        category: a.category || "task",
        approved: false
      })),
      ideas: parsed.ideas || [],
      decisions: (parsed.decisions || []).map((d: { id?: string; description: string; rationale: string }) => ({
        id: d.id || generateId(),
        description: d.description || "",
        rationale: d.rationale || "",
        approved: false
      })),
      questions: parsed.questions || [],
      rawInsights: parsed.rawInsights || []
    }
  } catch (error) {
    console.error("Failed to parse LLM response:", error)
    console.error("Raw content:", content)

    // Return a minimal structure with the raw content
    return {
      summary: "Failed to parse brain dump. Raw content preserved.",
      sections: [{
        id: generateId(),
        title: "Raw Content",
        content: content,
        type: "overview",
        approved: false
      }],
      actionItems: [],
      ideas: [],
      decisions: [],
      questions: [],
      rawInsights: [content]
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transcript, projectName, projectDescription } = body

    if (!transcript) {
      return NextResponse.json(
        { error: "No transcript provided" },
        { status: 400 }
      )
    }

    // Call LLM to process the transcript
    const userPrompt = buildUserPrompt(transcript, projectName, projectDescription)
    const llmResponse = await callLLM(SYSTEM_PROMPT, userPrompt)

    // Parse the response
    const processed = parseResponse(llmResponse)

    // Build the full processed brain dump structure
    const result = {
      summary: processed.summary,
      structuredMarkdown: generateMarkdown(processed),
      sections: processed.sections,
      actionItems: processed.actionItems,
      ideas: processed.ideas,
      decisions: processed.decisions,
      questions: processed.questions,
      rawInsights: processed.rawInsights,
      processedAt: new Date().toISOString(),
      processedBy: "local-llm"
    }

    return NextResponse.json({
      success: true,
      processedContent: result
    })

  } catch (error) {
    console.error("Brain dump processing error:", error)

    return NextResponse.json({
      error: error instanceof Error ? error.message : "Processing failed"
    }, { status: 500 })
  }
}

function generateMarkdown(processed: ReturnType<typeof parseResponse>): string {
  const lines: string[] = []

  lines.push("# Brain Dump Summary\n")
  lines.push(processed.summary + "\n")

  if (processed.sections.length > 0) {
    lines.push("## Sections\n")
    for (const section of processed.sections) {
      lines.push(`### ${section.title}\n`)
      lines.push(section.content + "\n")
    }
  }

  if (processed.actionItems.length > 0) {
    lines.push("## Action Items\n")
    for (const item of processed.actionItems) {
      const priority = item.priority === "high" ? "🔴" : item.priority === "medium" ? "🟡" : "🟢"
      lines.push(`- ${priority} **[${item.category}]** ${item.description}`)
    }
    lines.push("")
  }

  if (processed.decisions.length > 0) {
    lines.push("## Decisions\n")
    for (const decision of processed.decisions) {
      lines.push(`- **${decision.description}**`)
      lines.push(`  - Rationale: ${decision.rationale}`)
    }
    lines.push("")
  }

  if (processed.ideas.length > 0) {
    lines.push("## Ideas\n")
    for (const idea of processed.ideas) {
      lines.push(`- ${idea}`)
    }
    lines.push("")
  }

  if (processed.questions.length > 0) {
    lines.push("## Questions to Answer\n")
    for (const question of processed.questions) {
      lines.push(`- ${question}`)
    }
    lines.push("")
  }

  return lines.join("\n")
}
