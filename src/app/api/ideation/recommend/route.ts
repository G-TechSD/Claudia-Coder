import { NextRequest, NextResponse } from "next/server"
import { generate, parseLLMJson } from "@/lib/llm"

const RECOMMEND_SYSTEM_PROMPT = `You are an expert at synthesizing exploration journeys into concrete, actionable project recommendations.
Based on the user's exploration path and ALL their selections, generate final recommendations for projects they could build.

CRITICAL: Each recommendation MUST explicitly explain how EACH of the user's selected options will be incorporated into the project.
If they selected 5 different things, each recommendation should address how all 5 will be included.

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

ALL USER SELECTIONS (they expect ALL of these to be incorporated):
${explorationHistory.map((selection, i) => `${i + 1}. ${selection}`).join("\n")}

CONFIDENCE LEVEL: ${confidence}%

IMPORTANT: The user selected EACH of these items because they want them in their project.
Your recommendations MUST explain how EACH selection will be incorporated.

Generate 3-5 concrete project recommendations. Each recommendation should:
1. Be specific and actionable (not vague)
2. Explain how EVERY selection above fits into the project
3. Include a "howSelectionsIncorporated" field that maps each selection to how it's used
4. Offer different scales/approaches (simple to complex)

Return JSON:
{
  "summary": "A synthesis of what the user is looking for, mentioning their key selections (2-3 sentences)",
  "recommendations": [
    {
      "id": "rec-1",
      "title": "Clear, specific project title",
      "description": "3-4 sentence description of what this project would be",
      "howSelectionsIncorporated": {
        "Selection 1": "How this selection is implemented in the project",
        "Selection 2": "How this selection is implemented in the project"
      },
      "whyThisWorks": "Why this recommendation fits their exploration (1-2 sentences)",
      "complexity": "simple|moderate|complex",
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

    // Use unified LLM service (local first, then paid if allowed)
    console.log("[ideation/recommend] Calling unified LLM service...")
    const llmResponse = await generate({
      systemPrompt: RECOMMEND_SYSTEM_PROMPT,
      userPrompt: prompt,
      temperature: 0.7,
      max_tokens: 4000,
      allowPaidFallback: true
    })

    if (llmResponse.content && !llmResponse.error) {
      console.log(`[ideation/recommend] LLM responded via ${llmResponse.source}`)
      const parsed = parseLLMJson<{
        summary?: string
        recommendations?: Array<{
          id: string
          title: string
          description: string
          howSelectionsIncorporated?: Record<string, string>
          whyThisWorks?: string
          complexity?: string
          keyFeatures?: string[]
          techStack?: string[]
          category?: string
        }>
        nextSteps?: string[]
      }>(llmResponse.content)

      if (parsed && parsed.recommendations && parsed.recommendations.length > 0) {
        return NextResponse.json({
          ...parsed,
          llmSource: llmResponse.source,
          llmServer: llmResponse.server,
          llmModel: llmResponse.model
        })
      } else {
        console.warn("[ideation/recommend] LLM response missing required fields, using fallback")
      }
    } else {
      console.log("[ideation/recommend] LLM failed:", llmResponse.error || "No content")
    }

    // Fallback - only used when ALL LLM backends fail
    console.log("[ideation/recommend] Using fallback generation")
    return NextResponse.json({ ...generateLocalRecommendations(explorationHistory, originalContext), llmSource: "fallback" })

  } catch (error) {
    console.error("[ideation/recommend] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate recommendations" },
      { status: 500 }
    )
  }
}

function generateLocalRecommendations(history: string[], context: string) {
  const allText = (context + " " + history.join(" ")).toLowerCase()

  // Detect project type from context and selections
  const themes = {
    hasLED: /\b(led|light|rgb|neopixel|ws2812|strip|addressable)\b/i.test(allText),
    hasESP: /\b(esp32|esp8266|arduino|raspberry|microcontroller)\b/i.test(allText),
    hasMusic: /\b(music|audio|sound|reactive|beat|spectrum|fft)\b/i.test(allText),
    hasMatrix: /\b(matrix|display|panel|grid|pixel|text|clock)\b/i.test(allText),
    hasAmbient: /\b(ambient|mood|room|home|smart|sunrise|circadian)\b/i.test(allText),
    hasHoliday: /\b(holiday|christmas|decoration|festive)\b/i.test(allText),
    hasWLED: /\b(wled)\b/i.test(allText),
    hasApp: /\b(app|mobile|phone|control|remote)\b/i.test(allText),
    hasWeb: /\b(web|browser|dashboard|interface)\b/i.test(allText),
  }

  const recommendations: Array<{
    id: string
    title: string
    description: string
    whyThisWorks: string
    complexity: "simple" | "moderate" | "complex"
    timeEstimate: string
    keyFeatures: string[]
    techStack: string[]
    category: string
  }> = []

  // LED + ESP32 project recommendations
  if (themes.hasLED && themes.hasESP) {
    if (themes.hasMusic) {
      recommendations.push({
        id: "rec-1",
        title: "Music-Reactive LED Controller",
        description: "Build an ESP32-based LED controller that reacts to music in real-time. Uses FFT analysis to create stunning visualizations that pulse, flash, and flow with the beat. Control via web interface or dedicated app.",
        whyThisWorks: "Your interest in music-reactive lighting makes this a perfect fit - it's visually impressive and technically rewarding.",
        complexity: "moderate",
        timeEstimate: "2-3 weeks",
        keyFeatures: [
          "Real-time FFT audio analysis",
          "Multiple visualization modes (spectrum, beat, volume)",
          "Web-based control panel",
          "Microphone or line-in input",
          "Save and recall presets"
        ],
        techStack: ["ESP32", "WS2812B LEDs", "INMP441 microphone", "AsyncWebServer"],
        category: "hardware"
      })
    }

    if (themes.hasMatrix) {
      recommendations.push({
        id: "rec-2",
        title: "WiFi LED Matrix Display",
        description: "Create a programmable LED matrix display controlled by ESP32. Show scrolling text, time, weather, notifications, and custom animations. Perfect for desk or wall mounting.",
        whyThisWorks: "You selected matrix and display options - this project gives you a versatile pixel canvas for creative expression.",
        complexity: "moderate",
        timeEstimate: "2-4 weeks",
        keyFeatures: [
          "16x16 or 32x8 LED matrix",
          "Scrolling text and messages",
          "Clock with NTP sync",
          "Weather display integration",
          "Custom animation upload",
          "Web UI for configuration"
        ],
        techStack: ["ESP32", "WS2812B matrix", "FastLED library", "WiFiManager"],
        category: "hardware"
      })
    }

    if (themes.hasAmbient) {
      recommendations.push({
        id: "rec-3",
        title: "Smart Ambient Lighting System",
        description: "Build a home ambient lighting system with ESP32. Features include circadian rhythm color temperature, sunrise alarm, TV ambilight sync, and smart home integration. Control via app or voice.",
        whyThisWorks: "Your selections around ambient and smart home lighting lead naturally to this comprehensive home lighting solution.",
        complexity: "moderate",
        timeEstimate: "3-4 weeks",
        keyFeatures: [
          "Circadian rhythm color temperature",
          "Sunrise/sunset simulation",
          "Ambilight TV sync (Hyperion)",
          "Home Assistant integration",
          "Voice control via Alexa/Google",
          "Scheduled scenes and routines"
        ],
        techStack: ["ESP32", "SK6812 RGBW LEDs", "WLED firmware", "Home Assistant"],
        category: "smart-home"
      })
    }

    if (themes.hasHoliday) {
      recommendations.push({
        id: "rec-4",
        title: "Holiday Light Show Controller",
        description: "Create a WiFi-controlled holiday light display with music synchronization, scheduling, and multiple effect modes. Perfect for Christmas, Halloween, or any celebration.",
        whyThisWorks: "You showed interest in holiday and decorative lighting - this project makes impressive seasonal displays easy.",
        complexity: "simple",
        timeEstimate: "1-2 weeks",
        keyFeatures: [
          "Multiple holiday theme presets",
          "Music sync capability",
          "Automatic scheduling",
          "Weather-based effects",
          "Easy web control",
          "Multiple zone support"
        ],
        techStack: ["ESP32", "WS2812B strips", "WLED firmware", "Relay module"],
        category: "hardware"
      })
    }

    if (themes.hasWLED) {
      recommendations.push({
        id: "rec-5",
        title: "Custom WLED Installation",
        description: "Set up WLED firmware on ESP32 for professional-grade LED control. Includes custom segments, sync groups, presets, and optional sensor integration.",
        whyThisWorks: "WLED is the gold standard for LED control - this gets you running quickly with room to customize.",
        complexity: "simple",
        timeEstimate: "1 week",
        keyFeatures: [
          "WLED installation and configuration",
          "Custom segments and zones",
          "Effect presets and playlists",
          "Multi-device sync",
          "Sound reactive (with mod)",
          "Home Assistant auto-discovery"
        ],
        techStack: ["ESP32", "WS2812B/SK6812 LEDs", "WLED firmware", "ESPHome (optional)"],
        category: "firmware"
      })
    }

    // Always include a basic project option
    if (!recommendations.some(r => r.complexity === "simple")) {
      recommendations.push({
        id: "rec-basic",
        title: "Basic LED Strip Controller",
        description: "Start simple with an ESP32 web-controlled LED strip. Features solid colors, basic animations, and brightness control. Great first project to learn the fundamentals.",
        whyThisWorks: "This simple starting point lets you learn ESP32 and LEDs before tackling more complex features.",
        complexity: "simple",
        timeEstimate: "1 week",
        keyFeatures: [
          "Web-based color picker",
          "Brightness control",
          "Basic effects (rainbow, chase, fade)",
          "Save favorite colors",
          "WiFi setup portal"
        ],
        techStack: ["ESP32", "WS2812B strip", "FastLED", "ESPAsyncWebServer"],
        category: "hardware"
      })
    }
  }

  // If no specific recommendations, generate generic ones based on selections
  if (recommendations.length === 0) {
    const keyTopics = history.slice(-3).filter(h => h.length < 40).join(", ")

    recommendations.push(
      {
        id: "rec-1",
        title: "Simple Prototype",
        description: `Start with a basic prototype exploring ${keyTopics || "your selected concepts"}. Focus on core functionality first, then iterate based on what you learn.`,
        whyThisWorks: "Building a prototype helps validate your ideas quickly.",
        complexity: "simple",
        timeEstimate: "1-2 weeks",
        keyFeatures: ["Core functionality", "Basic interface", "Proof of concept"],
        techStack: ["Python or JavaScript", "Simple hardware if needed"],
        category: "prototype"
      },
      {
        id: "rec-2",
        title: "Full Featured Project",
        description: `A complete implementation of ${keyTopics || "your concept"} with all the features you'd want in a finished product.`,
        whyThisWorks: "For when you want to build something comprehensive from the start.",
        complexity: "complex",
        timeEstimate: "1-2 months",
        keyFeatures: ["Complete feature set", "Polished UI", "Documentation"],
        techStack: ["Based on your requirements"],
        category: "full-project"
      }
    )
  }

  // Generate contextual summary
  let summary = "Based on your exploration, here are concrete project recommendations."
  if (themes.hasLED && themes.hasESP) {
    summary = "You've explored LED lighting with ESP32 microcontroller. Here are specific projects you can build with these technologies."
  } else if (themes.hasMusic) {
    summary = "Your interest in audio-reactive features leads to these music-synchronized project ideas."
  }

  return {
    summary,
    recommendations: recommendations.slice(0, 4),
    nextSteps: [
      "Choose the project that excites you most",
      "Gather the required hardware components",
      "Set up your development environment",
      "Start with the basic functionality first"
    ]
  }
}
