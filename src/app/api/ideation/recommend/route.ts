import { NextRequest, NextResponse } from "next/server"

const RECOMMEND_SYSTEM_PROMPT = `You are an expert at synthesizing exploration journeys into concrete, actionable recommendations.
Based on the user's exploration path, generate final recommendations for projects they could build.
Each recommendation should be specific, achievable, and aligned with their selections.

Return JSON only, no markdown.`

interface RecommendRequest {
  projectId: string
  explorationHistory: string[]
  originalContext: string
  confidence: number
}

export async function POST(request: NextRequest) {
  try {
    const body: RecommendRequest = await request.json()
    const { explorationHistory, originalContext, confidence } = body

    if (!explorationHistory || explorationHistory.length === 0) {
      return NextResponse.json(
        { error: "Exploration history is required" },
        { status: 400 }
      )
    }

    const prompt = `The user has explored ideas through multiple stages and made these selections:

ORIGINAL CONTEXT: "${originalContext.slice(0, 500)}"

EXPLORATION PATH (from broad to specific):
${explorationHistory.map((selection, i) => `Stage ${i + 1}: ${selection}`).join("\n")}

CONFIDENCE LEVEL: ${confidence}%

Based on this exploration journey, generate 3-5 concrete project recommendations.
Each should be:
1. Specific and actionable (not vague)
2. Achievable (consider complexity)
3. Directly aligned with their exploration path
4. Unique from each other (different scales/approaches)

Return JSON:
{
  "summary": "A synthesis of what the user is looking for (2-3 sentences)",
  "recommendations": [
    {
      "id": "rec-1",
      "title": "Clear, specific project title",
      "description": "3-4 sentence description of what this project would be",
      "whyThisWorks": "Why this recommendation fits their exploration (1-2 sentences)",
      "complexity": "simple|moderate|complex",
      "timeEstimate": "A rough timeframe (e.g., '2-4 weeks', '1-2 months')",
      "keyFeatures": ["Feature 1", "Feature 2", "Feature 3"],
      "techStack": ["Tech 1", "Tech 2"],
      "category": "app|tool|platform|service|game|research|creative"
    }
  ],
  "nextSteps": [
    "Suggested next step 1",
    "Suggested next step 2",
    "Suggested next step 3"
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
            { role: "system", content: RECOMMEND_SYSTEM_PROMPT },
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
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
            system: RECOMMEND_SYSTEM_PROMPT,
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
    return NextResponse.json(generateLocalRecommendations(explorationHistory, originalContext))

  } catch (error) {
    console.error("[ideation/recommend] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate recommendations" },
      { status: 500 }
    )
  }
}

function generateLocalRecommendations(history: string[], context: string) {
  const lastSelections = history.slice(-3)
  const themes = lastSelections.join(" + ")

  const recommendations = [
    {
      id: "rec-1",
      title: `MVP: ${themes.slice(0, 40)}`,
      description: `A minimal viable product focused on the core value of ${themes}. Start small, validate quickly, and iterate based on feedback.`,
      whyThisWorks: "Based on your selections, starting simple lets you test assumptions before building complex features.",
      complexity: "simple" as const,
      timeEstimate: "2-4 weeks",
      keyFeatures: ["Core functionality", "Basic UI", "Essential integrations"],
      techStack: ["React", "Node.js", "SQLite"],
      category: "app" as const
    },
    {
      id: "rec-2",
      title: `Full Platform: ${themes.slice(0, 30)}`,
      description: `A comprehensive platform that brings together all aspects of ${themes}. Includes user accounts, data persistence, and rich features.`,
      whyThisWorks: "Your exploration suggests you're thinking big - this recommendation gives you room to grow.",
      complexity: "complex" as const,
      timeEstimate: "2-3 months",
      keyFeatures: ["User authentication", "Dashboard", "API", "Admin panel", "Analytics"],
      techStack: ["Next.js", "PostgreSQL", "Redis", "Docker"],
      category: "platform" as const
    },
    {
      id: "rec-3",
      title: `Tool/Utility: ${themes.slice(0, 35)}`,
      description: `A focused tool that solves one specific problem well within ${themes}. Easy to use, does one thing excellently.`,
      whyThisWorks: "Sometimes a sharp tool is more valuable than a swiss army knife.",
      complexity: "moderate" as const,
      timeEstimate: "3-6 weeks",
      keyFeatures: ["Focused functionality", "Clean UX", "Export capabilities"],
      techStack: ["TypeScript", "Electron or Web"],
      category: "tool" as const
    }
  ]

  return {
    summary: `Based on your exploration of "${context.slice(0, 100)}...", you've narrowed your focus to ${themes}. Here are concrete project recommendations that match your journey.`,
    recommendations,
    nextSteps: [
      "Pick the recommendation that excites you most",
      "Define 3-5 must-have features for v1",
      "Sketch out the main user flows",
      "Start building the core functionality"
    ]
  }
}
