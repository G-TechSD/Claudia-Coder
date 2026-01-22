import { NextRequest, NextResponse } from "next/server"

const EXPAND_SYSTEM_PROMPT = `You are helping someone explore variations and sub-ideas of a concept they selected.
Generate 8-12 diverse variations that branch out from the selected idea.
Include different angles: narrower focus, broader scope, different audiences, tech variations, business models, etc.

Return JSON only, no markdown.`

interface ExpandRequest {
  projectId: string
  parentIdea: {
    id: string
    title: string
    description: string
    category: string
    complexity: string
    tags: string[]
  }
  context?: {
    projectName?: string
    projectDescription?: string
    selectedPath?: string[]
    understanding?: unknown
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ExpandRequest = await request.json()
    const { parentIdea, context } = body

    if (!parentIdea) {
      return NextResponse.json(
        { error: "Parent idea is required" },
        { status: 400 }
      )
    }

    const prompt = `The user selected this idea to explore further:

SELECTED IDEA:
Title: ${parentIdea.title}
Description: ${parentIdea.description}
Category: ${parentIdea.category}
Complexity: ${parentIdea.complexity}

${context?.selectedPath ? `EXPLORATION PATH SO FAR:\n${context.selectedPath.join(" → ")}` : ""}

${context?.projectDescription ? `ORIGINAL CONTEXT:\n${context.projectDescription}` : ""}

Generate 8-12 diverse sub-ideas that branch from this selection. Include:
- Narrower, more focused versions
- Broader, more ambitious versions
- Different target audiences
- Different technical approaches
- Different business/delivery models
- Simplified/MVP versions
- Enhanced/premium versions
- Unconventional twists

Return JSON:
{
  "ideas": [
    {
      "id": "${parentIdea.id}-sub-1",
      "title": "Clear, specific title",
      "description": "2-3 sentence description of this variation",
      "category": "Category describing the variation type",
      "complexity": "simple|moderate|complex",
      "tags": ["relevant", "tags"]
    },
    // ... more ideas
  ]
}`

    // Try local LLM first
    try {
      const localResponse = await fetch("http://localhost:1234/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "local-model",
          messages: [
            { role: "system", content: EXPAND_SYSTEM_PROMPT },
            { role: "user", content: prompt }
          ],
          temperature: 0.9,
          max_tokens: 3000
        }),
        signal: AbortSignal.timeout(45000)
      })

      if (localResponse.ok) {
        const data = await localResponse.json()
        const content = data.choices?.[0]?.message?.content || ""

        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            return NextResponse.json(parsed)
          }
        } catch (parseError) {
          console.warn("Failed to parse local LLM response:", parseError)
        }
      }
    } catch (localError) {
      console.warn("Local LLM not available:", localError)
    }

    // Try Anthropic API
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (anthropicKey) {
      try {
        const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: "claude-3-haiku-20240307",
            max_tokens: 3000,
            system: EXPAND_SYSTEM_PROMPT,
            messages: [{ role: "user", content: prompt }]
          })
        })

        if (anthropicResponse.ok) {
          const data = await anthropicResponse.json()
          const content = data.content?.[0]?.text || ""

          try {
            const jsonMatch = content.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0])
              return NextResponse.json(parsed)
            }
          } catch (parseError) {
            console.warn("Failed to parse Anthropic response:", parseError)
          }
        }
      } catch (anthropicError) {
        console.warn("Anthropic API failed:", anthropicError)
      }
    }

    // Fallback to local generation
    return NextResponse.json(generateLocalExpansion(parentIdea))

  } catch (error) {
    console.error("[ideation/expand] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to expand idea" },
      { status: 500 }
    )
  }
}

function generateLocalExpansion(parentIdea: ExpandRequest["parentIdea"]) {
  const variations = [
    { name: "Narrower Focus", desc: "A more focused, specific version targeting a niche" },
    { name: "Broader Scope", desc: "A more comprehensive platform with expanded capabilities" },
    { name: "For Individuals", desc: "Tailored for individual users and personal use" },
    { name: "For Businesses", desc: "Designed for business and enterprise needs" },
    { name: "Mobile-First", desc: "Optimized for mobile devices and on-the-go usage" },
    { name: "AI-Enhanced", desc: "With artificial intelligence powering key features" },
    { name: "Simplified MVP", desc: "The absolute minimum to test the core value" },
    { name: "Premium Version", desc: "Full-featured with premium capabilities" },
    { name: "Community Model", desc: "Built around community engagement and collaboration" },
    { name: "Marketplace Angle", desc: "As a marketplace connecting buyers and sellers" },
    { name: "Subscription Service", desc: "Delivered as an ongoing subscription service" },
    { name: "Open Source", desc: "As an open source project with community contributions" }
  ]

  const baseTitle = parentIdea.title.length > 30
    ? parentIdea.title.slice(0, 30) + "..."
    : parentIdea.title

  const ideas = variations.map((v, i) => ({
    id: `${parentIdea.id}-sub-${i + 1}`,
    title: `${v.name}: ${baseTitle}`,
    description: `${v.desc}. Building on "${parentIdea.title}" with a ${v.name.toLowerCase()} approach.`,
    category: v.name,
    complexity: i < 4 ? "simple" : i < 8 ? "moderate" : "complex" as "simple" | "moderate" | "complex",
    tags: [v.name.toLowerCase().replace(/\s+/g, "-"), parentIdea.complexity, ...parentIdea.tags.slice(0, 2)]
  }))

  return { ideas }
}
