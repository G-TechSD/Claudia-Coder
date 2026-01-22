import { NextRequest, NextResponse } from "next/server"

const DETECTION_SYSTEM_PROMPT = `You analyze user input to understand what they're exploring and extract key insights.
Return structured JSON with a proper understanding of their input - not just word extraction.
Be intelligent about parsing conversational context, chat logs, and free-form descriptions.

Return JSON only, no markdown.`

interface DetectionRequest {
  input: string
  projectName?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: DetectionRequest = await request.json()
    const { input, projectName } = body

    if (!input) {
      return NextResponse.json(
        { error: "Input is required" },
        { status: 400 }
      )
    }

    const prompt = `Analyze this user input and create a comprehensive understanding report.

INPUT:
"""
${input}
"""

${projectName ? `Project Name: ${projectName}` : ""}

Return a JSON object with:
{
  "title": "A clear, descriptive title for this exploration (5-10 words)",
  "summary": "A 2-3 sentence summary that captures what the user is exploring. Don't just truncate their input - actually summarize and interpret it.",
  "keyPoints": [
    "Key insight or element from the input (be specific and meaningful)",
    "Another key point that captures important context",
    "Continue with 3-5 total meaningful points"
  ],
  "entities": {
    "people": ["Names of people mentioned"],
    "places": ["Locations mentioned"],
    "technologies": ["Technologies or technical concepts"],
    "businesses": ["Companies or business concepts"],
    "products": ["Products or product types mentioned"]
  },
  "questions": [
    "Clarifying question based on what's unclear in the input",
    "Another relevant question to help narrow focus"
  ],
  "type": "ideation or build",
  "confidence": 0.0-1.0,
  "suggestedApproach": "Brief description of recommended next steps"
}

Be intelligent about:
- Parsing chat logs and conversation format
- Identifying business opportunities
- Understanding technical requirements
- Recognizing people, places, and products mentioned
- Summarizing rather than just truncating`

    // Try local LLM first
    try {
      const localResponse = await fetch("http://localhost:1234/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "local-model",
          messages: [
            { role: "system", content: DETECTION_SYSTEM_PROMPT },
            { role: "user", content: prompt }
          ],
          temperature: 0.3,
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
            return NextResponse.json(formatResponse(parsed, input))
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
            system: DETECTION_SYSTEM_PROMPT,
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
              return NextResponse.json(formatResponse(parsed, input))
            }
          } catch (parseError) {
            console.warn("Failed to parse Anthropic response:", parseError)
          }
        }
      } catch (anthropicError) {
        console.warn("Anthropic API failed:", anthropicError)
      }
    }

    // Fallback to intelligent local generation
    return NextResponse.json(generateSmartFallback(input))

  } catch (error) {
    console.error("[ideation/detect] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze input" },
      { status: 500 }
    )
  }
}

// Format LLM response into expected structure
function formatResponse(parsed: Record<string, unknown>, input: string) {
  return {
    title: parsed.title || "Exploration",
    summary: parsed.summary || input.slice(0, 300),
    keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
    entities: parsed.entities || {},
    questions: Array.isArray(parsed.questions) ? parsed.questions : [],
    type: parsed.type === "build" ? "build" : "ideation",
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    suggestedApproach: parsed.suggestedApproach || "Explore options",
    suggestedPackets: generateSuggestedPackets(input, parsed)
  }
}

// Generate suggested research packets based on context
function generateSuggestedPackets(input: string, analysis: Record<string, unknown>) {
  const packets = []
  const entities = analysis.entities as Record<string, string[]> || {}

  // Core ideation packet
  packets.push({
    id: `ideation-${Date.now()}-1`,
    title: "Generate Ideas List",
    description: "Brainstorm 10-15 viable approaches based on the context",
    type: "brainstorm",
    outputFormat: "list",
    prompt: `Based on the following context, generate a comprehensive list of 10-15 viable ideas or approaches. For each idea, include:
- A clear title
- 2-3 sentence description
- Key benefits
- Potential challenges

Context:
${input}

Output as a well-formatted markdown list.`
  })

  // Market analysis if business-related
  if (/\b(market|business|customer|revenue|sell|monetize|trade show|distributor|reseller)\b/i.test(input)) {
    packets.push({
      id: `ideation-${Date.now()}-2`,
      title: "Market Opportunity Analysis",
      description: "Analyze market potential and competitive landscape",
      type: "analysis",
      outputFormat: "markdown",
      prompt: `Analyze the market opportunity for the following concept. Include:
- Target market segments
- Competitive landscape
- Potential revenue models
- Key success factors

Context:
${input}`
    })
  }

  // Technical approaches if tech-related
  if (/\b(ai|technology|software|system|platform|app|led|3d|resolution|interactive)\b/i.test(input)) {
    packets.push({
      id: `ideation-${Date.now()}-3`,
      title: "Technical Approaches",
      description: "Explore technical implementation options",
      type: "research",
      outputFormat: "comparison",
      prompt: `For the following concept, outline 3-5 different technical approaches. For each approach:
- Describe the technical solution
- List required technologies/skills
- Estimate complexity (low/medium/high)
- Note pros and cons

Context:
${input}`
    })
  }

  return packets
}

// Intelligent fallback without LLM
function generateSmartFallback(input: string) {
  // Parse conversation format
  const lines = input.split(/\n/).filter(l => l.trim())

  // Extract actual content sentences (not UI text)
  const meaningfulLines = lines.filter(line => {
    const l = line.trim().toLowerCase()
    // Filter out UI elements and short lines
    return l.length > 20 &&
           !l.startsWith("click") &&
           !l.startsWith("what direction") &&
           !l.includes("quick win") &&
           !l.includes("core solution")
  })

  // Extract people (names in conversation format like "Charles Can we do")
  const people: string[] = []
  const namePattern = /^([A-Z][a-z]+)(?:\s|:)/gm
  let match
  while ((match = namePattern.exec(input)) !== null) {
    const name = match[1]
    if (!["You", "The", "This", "That", "What", "How", "Can", "Quick", "Core", "Ideas"].includes(name)) {
      if (!people.includes(name)) people.push(name)
    }
  }

  // Extract places
  const places: string[] = []
  const placePatterns = [
    /\b(Shenzhen|Beijing|Shanghai|Hong Kong|China|Japan|Korea|Taiwan|Singapore|USA|UK|Europe|Asia)\b/gi,
    /\b([A-Z][a-z]+ City|[A-Z][a-z]+ Province)\b/g
  ]
  for (const pattern of placePatterns) {
    const matches = input.match(pattern) || []
    for (const m of matches) {
      if (!places.includes(m)) places.push(m)
    }
  }

  // Extract technologies/products
  const technologies: string[] = []
  const techPatterns = /\b(LED|AI|3D|HD|4K|software|app|platform|technology|resolution|interactive|panels?|displays?|screens?|drones?|walls?)\b/gi
  const techMatches = input.match(techPatterns) || []
  for (const t of techMatches) {
    const clean = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
    if (!technologies.includes(clean)) technologies.push(clean)
  }

  // Generate intelligent title
  let title = "Ideas Exploration"
  if (people.length > 0 && technologies.length > 0) {
    title = `${people[0]}'s ${technologies[0]} Project`
  } else if (people.length > 0 && places.length > 0) {
    title = `${people[0]} in ${places[0]}`
  } else if (technologies.length > 0) {
    title = `${technologies[0]} Exploration`
  }

  // Generate intelligent summary
  let summary = ""
  if (people.length > 0) {
    summary += `This involves ${people.join(" and ")}. `
  }
  if (places.length > 0) {
    summary += `Location context: ${places.join(", ")}. `
  }
  if (technologies.length > 0) {
    summary += `Technologies mentioned: ${technologies.join(", ")}. `
  }

  // Add context from first meaningful line
  if (meaningfulLines.length > 0) {
    const firstLine = meaningfulLines[0].slice(0, 150)
    summary += firstLine + (meaningfulLines[0].length > 150 ? "..." : "")
  }

  // Generate meaningful key points (not just word extraction)
  const keyPoints: string[] = []
  if (people.length > 0) {
    keyPoints.push(`Involves collaboration with ${people.join(", ")}`)
  }
  if (places.length > 0) {
    keyPoints.push(`Geographic context: ${places.join(", ")}`)
  }
  if (technologies.length > 0) {
    keyPoints.push(`Technologies: ${technologies.join(", ")}`)
  }
  if (/trade show|roadshow|exhibition|demo|showcase/i.test(input)) {
    keyPoints.push("Trade show/exhibition context - interactive demos needed")
  }
  if (/reseller|distributor|sell|customer/i.test(input)) {
    keyPoints.push("Business/sales context")
  }
  if (/interactive|audience|engagement/i.test(input)) {
    keyPoints.push("Interactive/audience engagement focus")
  }

  return {
    title,
    summary: summary || input.slice(0, 300),
    keyPoints: keyPoints.length > 0 ? keyPoints : ["Exploration project - needs further clarification"],
    entities: {
      people,
      places,
      technologies,
      businesses: [],
      products: []
    },
    questions: [
      "What specific outcome are you hoping to achieve?",
      "What's the timeline or deadline?",
      "What resources are available?"
    ],
    type: "ideation" as const,
    confidence: 0.6,
    suggestedApproach: "Generate ideas and explore options",
    suggestedPackets: generateSuggestedPackets(input, { entities: { people, places, technologies } })
  }
}
