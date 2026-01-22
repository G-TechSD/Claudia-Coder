import { NextRequest, NextResponse } from "next/server"

const UNDERSTANDING_SYSTEM_PROMPT = `You are an expert at understanding what people want to build or explore. Your job is to:
1. Deeply understand the user's input and intent
2. Identify the CORE concepts and opportunities (not generic categories)
3. Generate specific, relevant ideas based on what they actually wrote

IMPORTANT: Do NOT generate generic categories like "Quick Win", "Platform Play", "SaaS Model".
Instead, extract the ACTUAL concepts from their input.

For example, if someone writes about "LED video walls for trade shows with AI", you should identify:
- LED video walls (the product)
- Trade shows (the context/use case)
- AI integration (the technology angle)
- International sales (if mentioned)
- Interactive demos (if mentioned)

Return JSON only, no markdown.`

interface UnderstandingRequest {
  projectId: string
  input: string
  context?: {
    projectName?: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: UnderstandingRequest = await request.json()
    const { input, context } = body

    if (!input) {
      return NextResponse.json(
        { error: "Input is required" },
        { status: 400 }
      )
    }

    const prompt = `Analyze this input and help the user explore possibilities:

INPUT:
"""
${input}
"""

${context?.projectName ? `Project Name: ${context.projectName}` : ""}

IMPORTANT: Extract the ACTUAL concepts from their input. Do NOT use generic categories.

Return a JSON object with:
{
  "understanding": {
    "summary": "A 2-3 sentence summary that captures what the user ACTUALLY wants to explore. Be specific to their input.",
    "keyThemes": ["Specific theme from their input", "Another specific theme", ...], // 3-5 SPECIFIC themes
    "coreOpportunity": "The main thing they seem to want to accomplish",
    "questions": ["Clarifying question?", ...] // 3-4 questions to understand better
  },
  "initialIdeas": [
    {
      "id": "idea-1",
      "title": "Short, specific title based on their input (NOT generic like 'Quick Win')",
      "description": "2-3 sentence description specific to their context",
      "category": "Category based on THEIR content",
      "relevance": "high|medium" // How relevant to their core need
    },
    // Generate 12-18 ideas that are SPECIFIC to what they wrote
    // Cover different angles: the product/service, the technology, the use case, the audience, etc.
  ]
}

For the initialIdeas, generate concepts extracted FROM their input:
- Key nouns and products mentioned
- Technologies or approaches mentioned
- Use cases or contexts mentioned
- Goals or outcomes they want
- People or audiences mentioned
- Challenges or problems to solve

Do NOT generate generic startup/business categories. Every idea should be traceable to something in their input.`

    // Try local LLM first
    try {
      const localResponse = await fetch("http://localhost:1234/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "local-model",
          messages: [
            { role: "system", content: UNDERSTANDING_SYSTEM_PROMPT },
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 4000
        }),
        signal: AbortSignal.timeout(60000)
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
            max_tokens: 4000,
            system: UNDERSTANDING_SYSTEM_PROMPT,
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

    // Smart fallback - extract actual content from input
    return NextResponse.json(generateSmartUnderstanding(input))

  } catch (error) {
    console.error("[ideation/understand] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze input" },
      { status: 500 }
    )
  }
}

/**
 * Smart fallback that extracts actual content from the input
 * NOT generic categories - actual concepts from what they wrote
 */
function generateSmartUnderstanding(input: string) {
  // Parse the input to extract meaningful content
  const analysis = analyzeInput(input)

  // Generate understanding based on extracted content
  const understanding = {
    summary: generateSummary(analysis),
    keyThemes: analysis.mainTopics.slice(0, 5),
    coreOpportunity: analysis.coreGoal || "Explore and develop this concept",
    questions: generateQuestions(analysis)
  }

  // Generate ideas from extracted content - NOT generic categories
  const initialIdeas = generateIdeasFromAnalysis(analysis)

  return {
    understanding,
    initialIdeas
  }
}

interface InputAnalysis {
  // Extracted entities
  people: string[]
  places: string[]
  products: string[]
  technologies: string[]
  useCases: string[]
  goals: string[]
  challenges: string[]

  // Derived
  mainTopics: string[]
  coreGoal: string | null
  context: string
}

function analyzeInput(input: string): InputAnalysis {
  const text = input.toLowerCase()

  // Extract people (names at start of lines in conversation format, or capitalized names)
  const people: string[] = []
  const namePatterns = [
    /^([A-Z][a-z]+)(?:\s|:)/gm,  // "Charles Can we..."
    /\b(?:with|from|for|by)\s+([A-Z][a-z]+)\b/g,  // "with Charles"
  ]
  for (const pattern of namePatterns) {
    let match
    while ((match = pattern.exec(input)) !== null) {
      const name = match[1]
      // Filter out common non-names
      if (!["The", "This", "That", "What", "How", "Can", "You", "Yes", "Added", "Chat", "Active", "Passive"].includes(name)) {
        if (!people.includes(name)) people.push(name)
      }
    }
  }

  // Extract places
  const places: string[] = []
  const placePatterns = [
    /\b(China|Japan|Korea|Taiwan|Singapore|USA|America|Europe|Asia|Africa)\b/gi,
    /\b(Shenzhen|Beijing|Shanghai|Hong Kong|Tokyo|Seoul|Bangkok|Dubai|London|Paris|Berlin|New York|San Francisco|Los Angeles)\b/gi,
  ]
  for (const pattern of placePatterns) {
    const matches = input.match(pattern) || []
    for (const m of matches) {
      if (!places.map(p => p.toLowerCase()).includes(m.toLowerCase())) {
        places.push(m)
      }
    }
  }

  // Extract products/things being sold or built
  const products: string[] = []
  const productPatterns = [
    /\b(LED\s*(?:panel|wall|screen|display|sign)s?)\b/gi,
    /\b(video\s*walls?)\b/gi,
    /\b(display\s*(?:panel|screen|system)s?)\b/gi,
    /\b(screens?|monitors?|signage)\b/gi,
    /\b(drones?|flying\s*(?:screen|display|wall)s?)\b/gi,
  ]
  for (const pattern of productPatterns) {
    const matches = input.match(pattern) || []
    for (const m of matches) {
      const clean = m.trim()
      if (!products.map(p => p.toLowerCase()).includes(clean.toLowerCase())) {
        products.push(clean)
      }
    }
  }

  // Extract technologies
  const technologies: string[] = []
  const techPatterns = [
    /\b(AI|artificial intelligence|machine learning|ML)\b/gi,
    /\b(3D|three-?dimensional)\b/gi,
    /\b(VR|AR|virtual reality|augmented reality)\b/gi,
    /\b(interactive|touch\s*screen)\b/gi,
    /\b(generative|generation|generate)\b/gi,
    /\b(upscale|upscaling|resolution|HD|4K|8K)\b/gi,
  ]
  for (const pattern of techPatterns) {
    const matches = input.match(pattern) || []
    for (const m of matches) {
      if (!technologies.map(t => t.toLowerCase()).includes(m.toLowerCase())) {
        technologies.push(m)
      }
    }
  }

  // Extract use cases / contexts
  const useCases: string[] = []
  const useCasePatterns = [
    /\b(trade\s*shows?|roadshows?|exhibitions?|conventions?)\b/gi,
    /\b(presentations?|demos?|demonstrations?|showcases?)\b/gi,
    /\b(stages?|concerts?|events?|venues?)\b/gi,
    /\b(advertising|marketing|promotion)\b/gi,
    /\b(building\s*exteriors?|outdoor|facade)\b/gi,
    /\b(retail|stores?|shops?)\b/gi,
  ]
  for (const pattern of useCasePatterns) {
    const matches = input.match(pattern) || []
    for (const m of matches) {
      if (!useCases.map(u => u.toLowerCase()).includes(m.toLowerCase())) {
        useCases.push(m)
      }
    }
  }

  // Extract goals
  const goals: string[] = []
  if (/want to|need to|trying to|help (?:me|him|her|them)/i.test(input)) {
    // Look for goal statements
    const goalMatches = input.match(/(?:want to|need to|trying to|help (?:me|him|her|them))\s+([^.!?]+)/gi) || []
    for (const g of goalMatches) {
      const clean = g.replace(/^(?:want to|need to|trying to|help (?:me|him|her|them))\s+/i, "").trim()
      if (clean.length > 5 && clean.length < 100) {
        goals.push(clean)
      }
    }
  }

  // Extract challenges/problems
  const challenges: string[] = []
  if (/challenge|problem|difficult|issue|struggle/i.test(input)) {
    if (input.includes("different from others")) challenges.push("Stand out from competitors")
    if (input.includes("interactive")) challenges.push("Create interactive experiences")
    if (input.includes("resolution") || input.includes("adapt")) challenges.push("Handle different screen resolutions")
  }

  // Build main topics from extracted content
  const mainTopics: string[] = []

  // Add product-related topics
  if (products.length > 0) {
    mainTopics.push(products[0])
    if (products.length > 1) mainTopics.push(`${products[0]} varieties`)
  }

  // Add technology topics
  for (const tech of technologies.slice(0, 2)) {
    mainTopics.push(`${tech} integration`)
  }

  // Add use case topics
  for (const uc of useCases.slice(0, 2)) {
    mainTopics.push(uc)
  }

  // Add goal-based topics
  if (goals.length > 0) {
    mainTopics.push(goals[0].slice(0, 50))
  }

  // Determine core goal
  let coreGoal: string | null = null
  if (products.length > 0 && technologies.length > 0) {
    coreGoal = `Integrate ${technologies[0]} with ${products[0]}`
  } else if (products.length > 0 && useCases.length > 0) {
    coreGoal = `Showcase ${products[0]} at ${useCases[0]}`
  } else if (goals.length > 0) {
    coreGoal = goals[0]
  }

  // Build context summary
  let context = ""
  if (people.length > 0) context += `Involves ${people.join(", ")}. `
  if (places.length > 0) context += `Location: ${places.join(", ")}. `
  if (products.length > 0) context += `Products: ${products.join(", ")}. `

  return {
    people,
    places,
    products,
    technologies,
    useCases,
    goals,
    challenges,
    mainTopics,
    coreGoal,
    context
  }
}

function generateSummary(analysis: InputAnalysis): string {
  const parts: string[] = []

  if (analysis.people.length > 0) {
    parts.push(`Working with ${analysis.people.join(" and ")}`)
  }

  if (analysis.products.length > 0) {
    parts.push(`on ${analysis.products.join(", ")}`)
  }

  if (analysis.technologies.length > 0) {
    parts.push(`incorporating ${analysis.technologies.join(", ")}`)
  }

  if (analysis.useCases.length > 0) {
    parts.push(`for ${analysis.useCases.join(", ")}`)
  }

  if (analysis.places.length > 0) {
    parts.push(`based in ${analysis.places.join(", ")}`)
  }

  if (parts.length === 0) {
    return "Exploring a new concept or opportunity."
  }

  return parts.join(" ") + "."
}

function generateQuestions(analysis: InputAnalysis): string[] {
  const questions: string[] = []

  if (analysis.products.length > 0) {
    questions.push(`What specific features of ${analysis.products[0]} are most important?`)
  }

  if (analysis.useCases.length > 0) {
    questions.push(`What makes a successful ${analysis.useCases[0]} demonstration?`)
  }

  if (analysis.technologies.length > 0) {
    questions.push(`How should ${analysis.technologies[0]} be integrated?`)
  }

  questions.push("What's the primary goal you want to achieve?")
  questions.push("Who is the target audience?")

  return questions.slice(0, 4)
}

function generateIdeasFromAnalysis(analysis: InputAnalysis): Array<{
  id: string
  title: string
  description: string
  category: string
  relevance: "high" | "medium"
}> {
  const ideas: Array<{
    id: string
    title: string
    description: string
    category: string
    relevance: "high" | "medium"
  }> = []

  let id = 1

  // Generate ideas from products
  for (const product of analysis.products) {
    ideas.push({
      id: `idea-${id++}`,
      title: product,
      description: `Explore opportunities with ${product}`,
      category: "Product",
      relevance: "high"
    })
  }

  // Generate ideas from technologies
  for (const tech of analysis.technologies) {
    ideas.push({
      id: `idea-${id++}`,
      title: `${tech} solutions`,
      description: `Ways to apply ${tech} to the project`,
      category: "Technology",
      relevance: "high"
    })
  }

  // Generate ideas from use cases
  for (const uc of analysis.useCases) {
    ideas.push({
      id: `idea-${id++}`,
      title: uc,
      description: `Optimize for ${uc} context`,
      category: "Use Case",
      relevance: "high"
    })
  }

  // Generate ideas from goals
  for (const goal of analysis.goals) {
    ideas.push({
      id: `idea-${id++}`,
      title: goal.slice(0, 40),
      description: goal,
      category: "Goal",
      relevance: "high"
    })
  }

  // Generate ideas from challenges
  for (const challenge of analysis.challenges) {
    ideas.push({
      id: `idea-${id++}`,
      title: `Solve: ${challenge}`,
      description: `Address the challenge of ${challenge.toLowerCase()}`,
      category: "Challenge",
      relevance: "medium"
    })
  }

  // Cross-product ideas (product + technology)
  if (analysis.products.length > 0 && analysis.technologies.length > 0) {
    ideas.push({
      id: `idea-${id++}`,
      title: `${analysis.technologies[0]} for ${analysis.products[0]}`,
      description: `Integrate ${analysis.technologies[0]} capabilities with ${analysis.products[0]}`,
      category: "Integration",
      relevance: "high"
    })
  }

  // Cross-product ideas (product + use case)
  if (analysis.products.length > 0 && analysis.useCases.length > 0) {
    ideas.push({
      id: `idea-${id++}`,
      title: `${analysis.products[0]} for ${analysis.useCases[0]}`,
      description: `Optimize ${analysis.products[0]} specifically for ${analysis.useCases[0]}`,
      category: "Application",
      relevance: "high"
    })
  }

  // People/relationship ideas
  if (analysis.people.length > 0) {
    ideas.push({
      id: `idea-${id++}`,
      title: `${analysis.people[0]}'s business`,
      description: `Support and grow ${analysis.people[0]}'s business goals`,
      category: "Partnership",
      relevance: "medium"
    })
  }

  // Location-based ideas
  if (analysis.places.length > 0) {
    ideas.push({
      id: `idea-${id++}`,
      title: `${analysis.places[0]} market`,
      description: `Opportunities specific to the ${analysis.places[0]} market`,
      category: "Market",
      relevance: "medium"
    })
  }

  // Interactive/demo ideas if mentioned
  if (analysis.technologies.some(t => /interactive|3D|AI/i.test(t))) {
    ideas.push({
      id: `idea-${id++}`,
      title: "Interactive demonstrations",
      description: "Create engaging, interactive demos that wow audiences",
      category: "Experience",
      relevance: "high"
    })
  }

  // Content generation if AI mentioned
  if (analysis.technologies.some(t => /AI|generative|generation/i.test(t))) {
    ideas.push({
      id: `idea-${id++}`,
      title: "AI content generation",
      description: "Generate custom content that adapts to display specifications",
      category: "Content",
      relevance: "high"
    })
  }

  return ideas.slice(0, 18)
}
