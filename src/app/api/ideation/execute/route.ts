import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

const IDEATION_SYSTEM_PROMPT = `You are an expert research assistant and creative thinker. Your job is to generate comprehensive, well-organized content based on the user's request.

Guidelines:
- Be thorough and detailed
- Use clear markdown formatting with headers, lists, and sections
- Provide actionable insights and specific examples
- Consider multiple perspectives and approaches
- Include pros/cons where relevant
- Be practical and realistic

Your output should be professional, well-structured markdown that can be saved as a document.`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      projectId: _projectId,
      packetId,
      prompt,
      outputFormat = "markdown",
      workingDirectory,
      context
    } = body

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      )
    }

    // Build the full prompt with context
    const fullPrompt = `# Task
${prompt}

# Context
- Project: ${context?.projectName || "Unknown"}
- Description: ${context?.projectDescription || "N/A"}
- Task Type: ${context?.packetType || "research"}

# Output Format
Generate well-structured ${outputFormat} content. Use appropriate headers, lists, and formatting.`

    // Try to call the LLM API
    let content: string

    try {
      // First try local LLM
      const localResponse = await fetch("http://localhost:1234/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "local-model",
          messages: [
            { role: "system", content: IDEATION_SYSTEM_PROMPT },
            { role: "user", content: fullPrompt }
          ],
          temperature: 0.7,
          max_tokens: 4000
        }),
        signal: AbortSignal.timeout(120000) // 2 minute timeout
      })

      if (localResponse.ok) {
        const data = await localResponse.json()
        content = data.choices?.[0]?.message?.content || ""
      } else {
        throw new Error("Local LLM not available")
      }
    } catch (localError) {
      // Fallback to Anthropic if available
      const anthropicKey = process.env.ANTHROPIC_API_KEY
      if (anthropicKey) {
        const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: "claude-3-haiku-20240307",
            max_tokens: 4000,
            system: IDEATION_SYSTEM_PROMPT,
            messages: [
              { role: "user", content: fullPrompt }
            ]
          })
        })

        if (anthropicResponse.ok) {
          const data = await anthropicResponse.json()
          content = data.content?.[0]?.text || ""
        } else {
          throw new Error("Anthropic API failed")
        }
      } else {
        // Generate a placeholder if no LLM available
        content = generatePlaceholderContent(prompt, context)
      }
    }

    // Save to project folder if working directory is provided
    if (workingDirectory && content) {
      try {
        const expandedPath = workingDirectory.replace(/^~/, process.env.HOME || "")
        const docsDir = path.join(expandedPath, ".claudia", "ideas")
        await mkdir(docsDir, { recursive: true })

        const filename = `${context?.packetTitle?.toLowerCase().replace(/\s+/g, "-") || packetId}.md`
        const filePath = path.join(docsDir, filename)

        await writeFile(filePath, content, "utf-8")
        console.log(`[ideation/execute] Saved to ${filePath}`)
      } catch (saveError) {
        console.warn("[ideation/execute] Failed to save to disk:", saveError)
        // Non-fatal - continue with response
      }
    }

    return NextResponse.json({
      success: true,
      content,
      packetId,
      generatedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error("[ideation/execute] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate content" },
      { status: 500 }
    )
  }
}

// Generate placeholder content when no LLM is available
function generatePlaceholderContent(prompt: string, context?: Record<string, unknown>): string {
  const title = context?.packetTitle || "Research Output"
  const type = context?.packetType || "research"

  return `# ${title}

> **Note:** This is placeholder content. Connect an LLM (local or Anthropic) for AI-generated research.

## Original Request

${prompt}

## Suggested Structure

Based on the request type (${type}), here's a suggested structure:

${type === "brainstorm" ? `
### Ideas to Explore

1. **Idea 1** - [Description needed]
2. **Idea 2** - [Description needed]
3. **Idea 3** - [Description needed]
...

### Evaluation Criteria

- Feasibility
- Impact
- Resources Required
- Timeline
` : ""}

${type === "analysis" ? `
### Current State

[Analysis of current situation]

### Market/Technical Landscape

[Overview of relevant landscape]

### Opportunities

1. [Opportunity 1]
2. [Opportunity 2]

### Challenges

1. [Challenge 1]
2. [Challenge 2]

### Recommendations

[Key recommendations]
` : ""}

${type === "research" ? `
### Background

[Research context]

### Key Findings

1. [Finding 1]
2. [Finding 2]

### Implications

[What this means]

### Next Steps

- [ ] [Action item 1]
- [ ] [Action item 2]
` : ""}

---

*Generated: ${new Date().toISOString()}*
*Project: ${context?.projectName || "Unknown"}*
`
}
