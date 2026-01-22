import { NextRequest, NextResponse } from "next/server"

const NARROW_SYSTEM_PROMPT = `You help people narrow down their ideas by generating more focused options based on their selections.
Generate 10-15 more specific options that explore different aspects of what they selected.

IMPORTANT: Generate ideas that are RELEVANT to the original context AND their selections.
Do NOT just repeat their selections or generate generic categories.
Each option should be a concrete direction they could take.

Return JSON only, no markdown.`

interface NarrowRequest {
  projectId: string
  selectedIdeas: string[]
  previousSelections: string[]
  originalContext: string
  stageNumber: number
}

export async function POST(request: NextRequest) {
  try {
    const body: NarrowRequest = await request.json()
    const { selectedIdeas, previousSelections, originalContext, stageNumber } = body

    if (!selectedIdeas || selectedIdeas.length === 0) {
      return NextResponse.json(
        { error: "Selected ideas are required" },
        { status: 400 }
      )
    }

    const prompt = `The user is exploring ideas and has made these selections:

ORIGINAL CONTEXT:
"""
${originalContext.slice(0, 800)}
"""

PREVIOUS SELECTIONS: ${previousSelections.join(", ") || "None yet"}

LATEST SELECTIONS: ${selectedIdeas.join(", ")}

This is stage ${stageNumber} of their exploration.

Generate 10-15 more focused/specific options that:
1. Are RELEVANT to both the original context AND their selections
2. Explore different aspects of what they've chosen
3. Help them clarify what they actually want to build or explore
4. Are progressively more specific than the previous stage

IMPORTANT: Do NOT just repeat words from their selections.
Generate actual ideas and directions, not word combinations.

Return JSON:
{
  "title": "Stage title like 'Exploring [their main interest]...' or 'Focusing on [key theme]...'",
  "instruction": "Brief instruction for the user",
  "ideas": [
    {
      "id": "narrow-1",
      "label": "Short, descriptive label (3-8 words)",
      "description": "Brief description of this direction",
      "category": "Category"
    },
    // 10-15 ideas total
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
            { role: "system", content: NARROW_SYSTEM_PROMPT },
            { role: "user", content: prompt }
          ],
          temperature: 0.8,
          max_tokens: 2000
        }),
        signal: AbortSignal.timeout(30000)
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
            max_tokens: 2000,
            system: NARROW_SYSTEM_PROMPT,
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

    // Smart fallback based on context analysis
    return NextResponse.json(generateSmartNarrowedIdeas(selectedIdeas, originalContext, stageNumber))

  } catch (error) {
    console.error("[ideation/narrow] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to narrow ideas" },
      { status: 500 }
    )
  }
}

/**
 * Generate narrowed ideas by analyzing BOTH selections AND original context
 * This is smarter than just combining words
 */
function generateSmartNarrowedIdeas(selections: string[], originalContext: string, stageNumber: number) {
  // Analyze what's in the selections
  const selectionText = selections.join(" ").toLowerCase()
  const contextText = originalContext.toLowerCase()

  // Detect key themes from CONTEXT (not just selections)
  const themes = {
    hasAI: /\b(ai|artificial intelligence|machine learning|generative)\b/i.test(contextText),
    hasLED: /\b(led|display|panel|screen|video wall)\b/i.test(contextText),
    hasTradeShow: /\b(trade show|exhibition|roadshow|demo|showcase|presentation)\b/i.test(contextText),
    hasInteractive: /\b(interactive|audience|engagement|touch)\b/i.test(contextText),
    hasContent: /\b(content|video|photo|image|visual|resolution)\b/i.test(contextText),
    hasBusiness: /\b(sell|customer|business|market|international)\b/i.test(contextText),
    hasTech: /\b(technology|software|app|platform|system)\b/i.test(contextText)
  }

  const ideas: Array<{ id: string; label: string; description: string; category: string }> = []
  let id = 1

  // Generate ideas based on detected themes AND selections
  if (themes.hasAI && themes.hasLED) {
    ideas.push(
      { id: `narrow-${id++}`, label: "AI-generated visuals for displays", description: "Create custom AI content that matches display specs", category: "Content" },
      { id: `narrow-${id++}`, label: "Real-time content adaptation", description: "AI that adjusts content to different screen sizes", category: "Technology" },
      { id: `narrow-${id++}`, label: "Interactive AI demonstrations", description: "Let audiences interact with AI-powered displays", category: "Experience" }
    )
  }

  if (themes.hasTradeShow) {
    ideas.push(
      { id: `narrow-${id++}`, label: "Trade show booth design", description: "Create an impressive display setup for events", category: "Physical" },
      { id: `narrow-${id++}`, label: "Product demonstration app", description: "Interactive software to showcase capabilities", category: "Software" },
      { id: `narrow-${id++}`, label: "Lead capture integration", description: "Connect demos to customer data collection", category: "Business" }
    )
  }

  if (themes.hasInteractive) {
    ideas.push(
      { id: `narrow-${id++}`, label: "Touch-enabled displays", description: "Allow direct audience interaction", category: "Hardware" },
      { id: `narrow-${id++}`, label: "Motion/gesture control", description: "Control displays with body movements", category: "Technology" },
      { id: `narrow-${id++}`, label: "Audience participation games", description: "Interactive experiences that engage crowds", category: "Experience" }
    )
  }

  if (themes.hasContent) {
    ideas.push(
      { id: `narrow-${id++}`, label: "Content management system", description: "Easy way to manage and schedule display content", category: "Software" },
      { id: `narrow-${id++}`, label: "Resolution-aware upscaling", description: "Automatically optimize content for any screen", category: "Technology" },
      { id: `narrow-${id++}`, label: "Template library", description: "Pre-built content templates for quick customization", category: "Content" }
    )
  }

  if (themes.hasBusiness) {
    ideas.push(
      { id: `narrow-${id++}`, label: "Sales presentation tool", description: "Professional tool to showcase products to buyers", category: "Sales" },
      { id: `narrow-${id++}`, label: "ROI calculator", description: "Help customers understand the value proposition", category: "Business" },
      { id: `narrow-${id++}`, label: "Comparison showcase", description: "Demonstrate advantages over competitors", category: "Marketing" }
    )
  }

  // Add selection-specific refinements
  for (const selection of selections.slice(0, 3)) {
    const cleanSelection = selection.replace(/\s+/g, " ").trim()
    if (cleanSelection.length > 3 && cleanSelection.length < 50) {
      ideas.push({
        id: `narrow-${id++}`,
        label: `Deep dive: ${cleanSelection}`,
        description: `Explore ${cleanSelection} in more detail`,
        category: "Focus"
      })
    }
  }

  // Generic but useful fallbacks if we don't have enough
  const fallbacks = [
    { label: "Simple MVP version", description: "Start with the core functionality only", category: "Approach" },
    { label: "Full-featured solution", description: "Build a comprehensive system", category: "Approach" },
    { label: "Mobile companion app", description: "Control and preview from smartphones", category: "Platform" },
    { label: "Cloud-based service", description: "Manage everything from the web", category: "Platform" },
    { label: "Documentation and training", description: "Create guides and tutorials", category: "Content" }
  ]

  while (ideas.length < 10 && fallbacks.length > 0) {
    const fb = fallbacks.shift()!
    ideas.push({ id: `narrow-${id++}`, ...fb })
  }

  // Determine title based on what was selected
  let title = "Exploring further..."
  if (themes.hasAI) title = "Exploring AI integration..."
  else if (themes.hasTradeShow) title = "Focusing on trade show presence..."
  else if (themes.hasContent) title = "Exploring content options..."
  else if (themes.hasInteractive) title = "Exploring interactive features..."

  return {
    title,
    instruction: `Based on your interest in ${selections.slice(0, 2).join(" and ")}, which of these directions appeal to you?`,
    ideas: ideas.slice(0, 15)
  }
}
