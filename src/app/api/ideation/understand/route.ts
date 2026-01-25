import { NextRequest, NextResponse } from "next/server"
import { generate, parseLLMJson } from "@/lib/llm"

const UNDERSTANDING_SYSTEM_PROMPT = `You are an expert at helping people figure out what SOFTWARE to build.
Your job is to generate 25 creative, specific SOFTWARE/CODING project ideas based on their input.

CRITICAL: Focus on SOFTWARE they can CODE, not hardware advice or business strategy.
- Web apps, mobile apps, APIs, dashboards, tools, automation scripts
- Firmware for microcontrollers (ESP32, Arduino code)
- Control interfaces, visualizations, data processing

Do NOT suggest:
- Buying hardware or components
- Business strategy or marketing
- Generic categories like "MVP" or "Platform"

Return JSON only, no markdown.`

interface UnderstandingRequest {
  projectId: string
  input: string
  context?: {
    projectName?: string
  }
  regenerate?: boolean  // If true, generate different options
  mode?: "technical" | "nontechnical"  // Technical for developers, Non-technical for everyone else
}

export async function POST(request: NextRequest) {
  try {
    const body: UnderstandingRequest = await request.json()
    const { input, context, regenerate, mode = "nontechnical" } = body

    if (!input) {
      return NextResponse.json(
        { error: "Input is required" },
        { status: 400 }
      )
    }

    const prompt = `The user wants to figure out what SOFTWARE to build. Analyze their input and generate TWO sets of project ideas.

USER INPUT:
"""
${input}
"""

${context?.projectName ? `Project context: ${context.projectName}` : ""}
${regenerate ? "\nIMPORTANT: Generate COMPLETELY DIFFERENT ideas than before - be creative and explore new angles!" : ""}

Generate TWO sets of EXACTLY 25 ideas each:

IMPORTANT STRUCTURE (for each set of 25):
- ~18-20 ideas that directly relate to what the user described
- ~5-7 "creative wildcard" ideas that aren't directly related but would complement their project or spark new directions
  - These wildcards should still be SOFTWARE features, not unrelated tangents
  - Examples: "Undo/Redo history", "Import/Export presets", "Community sharing", "Achievement badges", "Tutorial mode"

1. NON-TECHNICAL IDEAS (for people who don't code):
   - Simple, friendly names describing what the app/tool DOES
   - Focus on user experiences and benefits
   - NO technical jargon: NO "API", "WebSocket", "firmware", "backend", "React", "MQTT", "OAuth"
   - YES: "Control from your phone", "Reacts to music", "Voice commands", "Automatic scheduling"
   - Examples: "Smart Color Picker", "Music Beat Visualizer", "Sunrise Alarm Clock"

2. TECHNICAL IDEAS (for developers):
   - Specific technologies, frameworks, architectures
   - Use technical terminology: "WebRTC sync", "FastAPI + Redis", "MQTT pub-sub", "OTA updates"
   - Examples: "React Native BLE Controller", "WebSocket Real-time Dashboard", "FastLED Firmware"

Return JSON:
{
  "understanding": {
    "summary": "2-3 sentences about what software they could build",
    "keyThemes": ["theme1", "theme2", "theme3"],
    "coreOpportunity": "The main software project opportunity",
    "questions": ["Clarifying question about the software they want?"]
  },
  "nonTechnicalIdeas": [
    {
      "id": "nt-1",
      "title": "Friendly name (3-6 words)",
      "description": "What this does for the user",
      "category": "control|visual|automation|social|utility"
    }
    // ... exactly 25 non-technical ideas
  ],
  "technicalIdeas": [
    {
      "id": "tech-1",
      "title": "Technical project name",
      "description": "Implementation details",
      "category": "web|mobile|api|firmware|tool|dashboard"
    }
    // ... exactly 25 technical ideas
  ]
}

Make each idea:
1. A specific SOFTWARE project they could code
2. Directly related to their input
3. Creative and genuinely useful
4. Different from generic suggestions

Do NOT include: hardware shopping, business advice, or vague categories.`

    // Use higher temperature for regenerate to get different results
    const temperature = regenerate ? 0.95 : 0.7

    // Use unified LLM service (local first, then paid if allowed)
    console.log("[ideation/understand] Calling unified LLM service...")
    const llmResponse = await generate({
      systemPrompt: UNDERSTANDING_SYSTEM_PROMPT,
      userPrompt: prompt,
      temperature,
      max_tokens: 4000,
      allowPaidFallback: true  // Allow paid fallback for ideation
    })

    if (llmResponse.content && !llmResponse.error) {
      console.log(`[ideation/understand] LLM responded via ${llmResponse.source}`)
      const parsed = parseLLMJson<{
        understanding?: {
          summary?: string
          keyThemes?: string[]
          coreOpportunity?: string
          questions?: string[]
        }
        nonTechnicalIdeas?: Array<{
          id: string
          title: string
          description: string
          category?: string
        }>
        technicalIdeas?: Array<{
          id: string
          title: string
          description: string
          category?: string
        }>
        // Legacy format support
        initialIdeas?: Array<{
          id: string
          title: string
          description: string
          category?: string
          relevance?: string
        }>
      }>(llmResponse.content)

      // Check if we got the new dual-format or legacy single format
      if (parsed && (parsed.nonTechnicalIdeas?.length || parsed.technicalIdeas?.length || parsed.initialIdeas?.length)) {
        return NextResponse.json({
          understanding: parsed.understanding,
          nonTechnicalIdeas: parsed.nonTechnicalIdeas || parsed.initialIdeas || [],
          technicalIdeas: parsed.technicalIdeas || parsed.initialIdeas || [],
          llmSource: llmResponse.source,
          llmServer: llmResponse.server,
          llmModel: llmResponse.model
        })
      } else {
        console.warn("[ideation/understand] LLM response missing required fields, using fallback")
      }
    } else {
      console.log("[ideation/understand] LLM failed:", llmResponse.error || "No content")
    }

    // Fallback - only used when ALL LLM backends fail
    console.log("[ideation/understand] Using fallback generation")
    const fallbackResult = generateSmartUnderstanding(input, regenerate)
    return NextResponse.json({ ...fallbackResult, llmSource: "fallback" })

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
 * This should only be used when LLM is unavailable
 * Returns BOTH non-technical and technical ideas for instant toggle switching
 */
function generateSmartUnderstanding(input: string, regenerate?: boolean) {
  // Parse the input to extract meaningful content
  const analysis = analyzeInput(input)

  // Generate understanding based on extracted content
  const understanding = {
    summary: generateSummary(analysis),
    keyThemes: analysis.mainTopics.slice(0, 5),
    coreOpportunity: analysis.coreGoal || "Explore and develop this concept",
    questions: generateQuestions(analysis)
  }

  // Generate BOTH sets of ideas for instant toggle switching
  const nonTechnicalIdeas = generateIdeasFromAnalysis(analysis, "nontechnical")
  const technicalIdeas = generateIdeasFromAnalysis(analysis, "technical")

  return {
    understanding,
    nonTechnicalIdeas,
    technicalIdeas
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
    /^([A-Z][a-z]+)(?:\s|:)/gm,
    /\b(?:with|from|for|by)\s+([A-Z][a-z]+)\b/g,
  ]
  for (const pattern of namePatterns) {
    let match
    while ((match = pattern.exec(input)) !== null) {
      const name = match[1]
      if (!["The", "This", "That", "What", "How", "Can", "You", "Yes", "Added", "Chat", "Active", "Passive", "I'm", "It", "Not"].includes(name)) {
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

  // Extract products/things - EXPANDED list
  const products: string[] = []
  const productPatterns = [
    /\b(LED\s*(?:panel|wall|screen|display|sign|strip|bulb|light)s?)\b/gi,
    /\b(video\s*walls?)\b/gi,
    /\b(display\s*(?:panel|screen|system)s?)\b/gi,
    /\b(screens?|monitors?|signage)\b/gi,
    /\b(drones?|flying\s*(?:screen|display|wall)s?)\b/gi,
    /\b(light(?:ing)?|lamp|fixture)s?\b/gi,
    /\b(strip lights?|led strips?|neopixels?|ws2812)\b/gi,
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

  // Extract technologies - EXPANDED list with electronics/IoT
  const technologies: string[] = []
  const techPatterns = [
    /\b(AI|artificial intelligence|machine learning|ML)\b/gi,
    /\b(3D|three-?dimensional)\b/gi,
    /\b(VR|AR|virtual reality|augmented reality)\b/gi,
    /\b(interactive|touch\s*screen)\b/gi,
    /\b(generative|generation|generate)\b/gi,
    /\b(upscale|upscaling|resolution|HD|4K|8K)\b/gi,
    // Electronics and IoT
    /\b(ESP32|ESP8266|Arduino|Raspberry Pi|STM32|PIC|AVR)\b/gi,
    /\b(microcontroller|MCU|SoC|dev board)\b/gi,
    /\b(IoT|internet of things|smart home|home automation)\b/gi,
    /\b(WiFi|Bluetooth|BLE|Zigbee|Z-Wave|MQTT|HTTP)\b/gi,
    /\b(PWM|GPIO|I2C|SPI|UART|serial)\b/gi,
    /\b(sensor|accelerometer|gyroscope|temperature|humidity|motion|proximity)\b/gi,
    /\b(RGB|RGBW|addressable|WS2812|SK6812|APA102)\b/gi,
    /\b(dimmer|dimming|brightness|color temperature)\b/gi,
    /\b(controller|driver|power supply|voltage|current)\b/gi,
    /\b(app|mobile app|web app|dashboard|interface|API)\b/gi,
  ]
  for (const pattern of techPatterns) {
    const matches = input.match(pattern) || []
    for (const m of matches) {
      if (!technologies.map(t => t.toLowerCase()).includes(m.toLowerCase())) {
        technologies.push(m)
      }
    }
  }

  // Extract technical acronyms
  const acronyms = input.match(/\b[A-Z][A-Z0-9]{1,6}\b/g) || []
  for (const acr of acronyms) {
    if (!["I", "A", "THE", "AND", "OR", "FOR", "BUT", "NOT", "LED", "AI"].includes(acr)) {
      if (!technologies.map(t => t.toUpperCase()).includes(acr)) {
        technologies.push(acr)
      }
    }
  }

  // Extract "about X and Y" patterns - only single words to avoid capturing phrases
  const aboutMatches = input.match(/\babout\s+(\w+)(?:\s+and\s+(\w+))?(?:\s+and\s+(\w+))?/gi) || []
  for (const m of aboutMatches) {
    const words = m.replace(/^about\s+/i, "").split(/\s+and\s+/i)
    for (const word of words) {
      const clean = word.trim()
      // Only add single words (not phrases), at least 2 chars, and not common words
      if (clean.length >= 2 && clean.length <= 20 && !/^(a|an|the|it|its|this|that|some|any|be|is|are|was|were)$/i.test(clean)) {
        if (!technologies.map(t => t.toLowerCase()).includes(clean.toLowerCase())) {
          technologies.push(clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase())
        }
      }
    }
  }

  // Extract use cases / contexts - EXPANDED
  const useCases: string[] = []
  const useCasePatterns = [
    /\b(trade\s*shows?|roadshows?|exhibitions?|conventions?)\b/gi,
    /\b(presentations?|demos?|demonstrations?|showcases?)\b/gi,
    /\b(stages?|concerts?|events?|venues?)\b/gi,
    /\b(advertising|marketing|promotion)\b/gi,
    /\b(building\s*exteriors?|outdoor|facade)\b/gi,
    /\b(retail|stores?|shops?)\b/gi,
    // Home/personal
    /\b(home|house|room|bedroom|living room|kitchen|garage|office)\b/gi,
    /\b(garden|backyard|patio|outdoor|landscape)\b/gi,
    /\b(party|christmas|holiday|decoration|ambient)\b/gi,
    /\b(mood lighting|accent lighting|task lighting)\b/gi,
  ]
  for (const pattern of useCasePatterns) {
    const matches = input.match(pattern) || []
    for (const m of matches) {
      if (!useCases.map(u => u.toLowerCase()).includes(m.toLowerCase())) {
        useCases.push(m)
      }
    }
  }

  // Extract goals - but filter out vague or uncertain patterns
  const goals: string[] = []
  if (/want to|need to|trying to|help (?:me|him|her|them)/i.test(input)) {
    const goalMatches = input.match(/(?:want to|need to|trying to|help (?:me|him|her|them))\s+([^.!?]+)/gi) || []
    for (const g of goalMatches) {
      const clean = g.replace(/^(?:want to|need to|trying to|help (?:me|him|her|them))\s+/i, "").trim()
      // Filter out patterns that indicate uncertainty or vagueness
      if (clean.length > 10 && clean.length < 100) {
        // Skip if it starts with "about" or contains uncertainty markers
        if (/^about\s+/i.test(clean)) continue
        // Skip if the verb is immediately followed by "but", "however", "or", "maybe" - indicates uncertainty
        if (/^(build|create|make)\s+(but|however|or|maybe|something)/i.test(clean)) continue
        // Skip if it contains "not sure", "don't know"
        if (/not sure|don't know|unsure|uncertain/i.test(clean)) continue
        // Make sure it's actually a goal statement with a clear action (verb + object pattern)
        if (/\b(build|create|make|develop|design|implement|set up|control|manage|connect|automate)\s+\w+/i.test(clean)) {
          // Check that there's actually a meaningful object after the verb (at least 3 more words)
          const afterVerb = clean.replace(/^.*?\b(build|create|make|develop|design|implement|set up|control|manage|connect|automate)\s+/i, "")
          if (afterVerb.split(/\s+/).length >= 2 && !/^\s*(but|however|or)\b/i.test(afterVerb)) {
            goals.push(clean)
          }
        }
      }
    }
  }

  // Extract challenges/problems - only add meaningful, actionable items
  const challenges: string[] = []
  if (/challenge|problem|difficult|issue|struggle/i.test(input)) {
    if (/different from others|unique|stand out/i.test(input)) challenges.push("Stand out from competitors")
    if (/interactive/i.test(input)) challenges.push("Create interactive experiences")
    if (/resolution|adapt|scale/i.test(input)) challenges.push("Handle different sizes")
    if (/control|automat/i.test(input)) challenges.push("Automation systems")
  }
  // Don't add "clarify requirements" as a chip - that's what the whole flow does

  // Build main topics from ALL extracted content
  const mainTopics: string[] = []

  // Add technologies first (most specific)
  for (const tech of technologies.slice(0, 4)) {
    if (!mainTopics.includes(tech)) mainTopics.push(tech)
  }

  // Add products
  for (const product of products.slice(0, 2)) {
    if (!mainTopics.includes(product)) mainTopics.push(product)
  }

  // Add use cases
  for (const uc of useCases.slice(0, 2)) {
    if (!mainTopics.includes(uc)) mainTopics.push(uc)
  }

  // Add goals
  if (goals.length > 0) {
    mainTopics.push(goals[0].slice(0, 50))
  }

  // Determine core goal
  let coreGoal: string | null = null
  if (technologies.length > 0 && products.length > 0) {
    coreGoal = `Create ${products[0]} project with ${technologies[0]}`
  } else if (technologies.length >= 2) {
    coreGoal = `Explore ${technologies.slice(0, 2).join(" and ")} possibilities`
  } else if (technologies.length > 0) {
    coreGoal = `Build something with ${technologies[0]}`
  } else if (goals.length > 0) {
    coreGoal = goals[0]
  } else if (products.length > 0) {
    coreGoal = `Create ${products[0]} project`
  }

  // Build context summary
  let context = ""
  if (people.length > 0) context += `Involves ${people.join(", ")}. `
  if (places.length > 0) context += `Location: ${places.join(", ")}. `
  if (technologies.length > 0) context += `Technologies: ${technologies.slice(0, 4).join(", ")}. `
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
  // Build a natural summary sentence
  const allTopics = [...analysis.technologies, ...analysis.products].filter((v, i, a) => a.indexOf(v) === i)

  if (allTopics.length === 0 && analysis.goals.length === 0) {
    return "You're exploring a new project idea. Let's figure out what you want to build."
  }

  let summary = ""

  // Start with what they want to build
  if (analysis.coreGoal) {
    summary = analysis.coreGoal + ". "
  } else if (allTopics.length > 0) {
    summary = `Exploring project ideas involving ${allTopics.slice(0, 4).join(", ")}. `
  }

  // Add use case context
  if (analysis.useCases.length > 0) {
    summary += `Use case: ${analysis.useCases.slice(0, 2).join(", ")}. `
  }

  // Add people/collaboration
  if (analysis.people.length > 0) {
    summary += `Working with ${analysis.people.join(" and ")}. `
  }

  // Add location context
  if (analysis.places.length > 0) {
    summary += `Based in ${analysis.places.join(", ")}. `
  }

  // Add challenges
  if (analysis.challenges.length > 0) {
    summary += `Key focus: ${analysis.challenges[0].toLowerCase()}. `
  }

  return summary.trim() || "Exploring project possibilities. Select concepts below to narrow down."
}

function generateQuestions(analysis: InputAnalysis): string[] {
  const questions: string[] = []

  // Check for specific technology combinations
  const hasLED = analysis.technologies.some(t => /led|light|rgb|neopixel|ws2812|strip/i.test(t))
  const hasESP = analysis.technologies.some(t => /esp32|esp8266|arduino|raspberry|microcontroller/i.test(t))
  const hasIoT = analysis.technologies.some(t => /iot|wifi|bluetooth|smart|automation/i.test(t))

  // LED-specific questions
  if (hasLED) {
    questions.push("What type of LED effects do you want? (solid color, animations, music reactive, etc.)")
    questions.push("How many LEDs/strips are you planning to use?")
    questions.push("Where will the LEDs be installed? (indoor, outdoor, portable)")
  }

  // ESP32/microcontroller questions
  if (hasESP) {
    questions.push("Do you need WiFi/Bluetooth control, or standalone operation?")
    questions.push("What's your experience level with Arduino/ESP programming?")
    if (!hasLED) {
      questions.push("What sensors or outputs will the microcontroller control?")
    }
  }

  // IoT/smart home questions
  if (hasIoT) {
    questions.push("Should it integrate with existing smart home systems (Home Assistant, etc.)?")
    questions.push("Do you want mobile app control or just web-based control?")
  }

  // Generic questions if not enough specific ones
  if (questions.length < 3) {
    if (analysis.products.length > 0) {
      questions.push(`What specific features of ${analysis.products[0]} are most important?`)
    }

    if (analysis.useCases.length > 0) {
      questions.push(`What makes a successful ${analysis.useCases[0]} implementation?`)
    }

    if (analysis.technologies.length > 0 && questions.length < 4) {
      questions.push(`How should ${analysis.technologies[0]} be integrated?`)
    }
  }

  // Always add these if we have room
  if (questions.length < 4) {
    questions.push("What's the primary goal you want to achieve with this project?")
  }
  if (questions.length < 4) {
    questions.push("Is this for personal use, a gift, or a commercial project?")
  }

  return questions.slice(0, 4)
}

function generateIdeasFromAnalysis(analysis: InputAnalysis, mode: "technical" | "nontechnical" = "nontechnical"): Array<{
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

  // Helper to add unique idea
  const addIdea = (title: string, description: string, category: string, relevance: "high" | "medium" = "high") => {
    if (!ideas.some(i => i.title.toLowerCase() === title.toLowerCase())) {
      ideas.push({ id: `idea-${id++}`, title, description, category, relevance })
    }
  }

  // Check for specific technology combinations
  const hasLED = analysis.technologies.some(t => /led|light|rgb|neopixel|ws2812|strip/i.test(t))
  const hasESP = analysis.technologies.some(t => /esp32|esp8266|arduino|raspberry|microcontroller/i.test(t))
  const hasIoT = analysis.technologies.some(t => /iot|wifi|bluetooth|smart|automation/i.test(t))
  const hasAI = analysis.technologies.some(t => /ai|ml|machine learning|generative/i.test(t))

  // Generate specific LED/ESP32 ideas if detected
  if (hasLED && hasESP) {
    addIdea("LED Strip Controller", "Build an ESP32-based controller for addressable LED strips with WiFi control", "Project", "high")
    addIdea("Music Reactive LEDs", "Create sound-reactive lighting that pulses to music using microphone input", "Project", "high")
    addIdea("Smart Home Lighting", "Build a home automation lighting system with app control", "Project", "high")
    addIdea("Ambient Display", "Create ambient lighting that responds to screen colors or notifications", "Project", "high")
    addIdea("Holiday Light Controller", "WiFi-enabled holiday light controller with patterns and scheduling", "Project", "high")
    addIdea("LED Matrix Display", "Build a programmable LED matrix for text and animations", "Project", "high")
    addIdea("WLED Installation", "Set up WLED firmware for easy LED control with web interface", "Technology", "high")
  } else if (hasLED) {
    addIdea("LED Lighting Project", "Explore different ways to use LEDs for lighting effects", "Core", "high")
    addIdea("Color Mixing", "Experiment with RGB color mixing and color temperature", "Concept", "medium")
    addIdea("Light Patterns", "Create animated light patterns and effects", "Feature", "high")
    addIdea("Brightness Control", "Implement dimming and brightness adjustment", "Feature", "medium")
    addIdea("Mood Lighting", "Create ambient mood lighting for different settings", "Application", "high")
  }

  if (hasESP && !hasLED) {
    addIdea("WiFi Sensor Hub", "Build a sensor data collection system with web dashboard", "Project", "high")
    addIdea("Home Automation", "Create smart home controls with ESP32", "Project", "high")
    addIdea("Remote Monitoring", "Set up remote monitoring with notifications", "Project", "medium")
    addIdea("IoT Gateway", "Build a gateway for connecting multiple devices", "Project", "medium")
  }

  // Generate ideas from detected technologies
  for (const tech of analysis.technologies.slice(0, 6)) {
    // Skip if we already generated specific ideas for this tech
    if (hasLED && /led|light|rgb|neopixel|ws2812|strip/i.test(tech)) continue
    if (hasESP && /esp32|esp8266|arduino|raspberry|microcontroller/i.test(tech)) continue

    addIdea(tech, `Explore ${tech} capabilities and applications`, "Technology", "high")
  }

  // Generate ideas from products
  for (const product of analysis.products.slice(0, 3)) {
    addIdea(product, `Work with ${product} for your project`, "Product", "high")
  }

  // Generate ideas from use cases
  for (const uc of analysis.useCases.slice(0, 3)) {
    addIdea(uc, `Optimize for ${uc} application`, "Use Case", "high")
  }

  // Generate ideas from goals
  for (const goal of analysis.goals.slice(0, 2)) {
    addIdea(goal.slice(0, 40), goal, "Goal", "high")
  }

  // Generate ideas from challenges - use clean labels, no "Solve:" prefix
  for (const challenge of analysis.challenges.slice(0, 2)) {
    // Make labels concise and actionable
    const cleanLabel = challenge.length > 25 ? challenge.slice(0, 25) + "..." : challenge
    addIdea(cleanLabel, challenge, "Challenge", "medium")
  }

  // Cross-product ideas (technology + use case)
  if (analysis.technologies.length > 0 && analysis.useCases.length > 0) {
    addIdea(
      `${analysis.technologies[0]} for ${analysis.useCases[0]}`,
      `Apply ${analysis.technologies[0]} specifically for ${analysis.useCases[0]}`,
      "Integration",
      "high"
    )
  }

  // AI-related ideas
  if (hasAI) {
    addIdea("AI-Powered Automation", "Use AI to make intelligent decisions and automation", "AI", "high")
    addIdea("Smart Adaptation", "System that learns and adapts to usage patterns", "AI", "high")
  }

  // IoT-related ideas
  if (hasIoT) {
    addIdea("Mobile App Control", "Build a smartphone app to control your project", "Interface", "high")
    addIdea("Voice Control", "Add voice assistant integration (Alexa/Google)", "Feature", "medium")
    addIdea("Web Dashboard", "Create a web-based control panel", "Interface", "high")
  }

  // Location-based ideas
  if (analysis.places.length > 0) {
    addIdea(`${analysis.places[0]} market`, `Opportunities specific to ${analysis.places[0]}`, "Market", "medium")
  }

  // Feature-focused ideas (user-friendly, no technical jargon) - 30 options
  const featureIdeas = [
    { title: "Control from your phone", desc: "Manage everything from a smartphone app anywhere you go", cat: "Control" },
    { title: "Voice commands", desc: "Control with Alexa, Google, or Siri voice assistants", cat: "Control" },
    { title: "Automatic scheduling", desc: "Set it and forget it - runs on your schedule", cat: "Automation" },
    { title: "Reacts to music", desc: "Syncs and pulses with the beat of your music", cat: "Reactive" },
    { title: "One-tap presets", desc: "Save your favorite settings and recall them instantly", cat: "Convenience" },
    { title: "Works offline", desc: "Keeps working even without internet connection", cat: "Reliability" },
    { title: "Share with friends", desc: "Share your creations and settings with others", cat: "Social" },
    { title: "Syncs across devices", desc: "Changes on one device appear on all your devices", cat: "Sync" },
    { title: "Beautiful animations", desc: "Smooth, eye-catching visual effects and transitions", cat: "Visual" },
    { title: "Color themes", desc: "Pre-designed color palettes for any mood or occasion", cat: "Visual" },
    { title: "Timer and alarms", desc: "Automatic actions at specific times", cat: "Automation" },
    { title: "Remote access", desc: "Control from anywhere in the world", cat: "Control" },
    { title: "Activity history", desc: "See what happened and when", cat: "Tracking" },
    { title: "Smart notifications", desc: "Get alerts when something important happens", cat: "Alerts" },
    { title: "Easy setup wizard", desc: "Get started in minutes with guided setup", cat: "Ease of use" },
    { title: "Customizable controls", desc: "Arrange and personalize your control interface", cat: "Personalization" },
    { title: "Sunrise wake-up mode", desc: "Gentle light that wakes you naturally in the morning", cat: "Wellness" },
    { title: "Party mode", desc: "Exciting dynamic effects perfect for celebrations", cat: "Fun" },
    { title: "Movie watching mode", desc: "Perfect ambient lighting for watching films", cat: "Entertainment" },
    { title: "Focus mode", desc: "Lighting optimized to help concentration and productivity", cat: "Productivity" },
    { title: "Sleep mode", desc: "Relaxing colors that help you wind down for bed", cat: "Wellness" },
    { title: "Weather display", desc: "Shows current weather conditions through colors", cat: "Info" },
    { title: "Energy saving mode", desc: "Automatically dims and turns off to save power", cat: "Efficiency" },
    { title: "Guest access", desc: "Let visitors control without giving full access", cat: "Sharing" },
    { title: "Backup and restore", desc: "Never lose your settings - save and restore anytime", cat: "Reliability" },
    { title: "Multiple rooms", desc: "Control different areas separately or together", cat: "Organization" },
    { title: "Scene buttons", desc: "Physical buttons for quick scene changes", cat: "Convenience" },
    { title: "Calendar integration", desc: "Automatically changes based on your calendar events", cat: "Automation" },
    { title: "Mood lighting", desc: "Colors that match and enhance how you feel", cat: "Wellness" },
    { title: "Game room mode", desc: "Dynamic reactive lighting for gaming sessions", cat: "Entertainment" },
  ]

  // Technical ideas (for developers who want implementation details) - 30 options
  const technicalIdeas = [
    { title: "REST API endpoints", desc: "HTTP API for programmatic control and integration", cat: "API" },
    { title: "WebSocket real-time sync", desc: "Bi-directional live updates between clients", cat: "Protocol" },
    { title: "React/Next.js dashboard", desc: "Modern web framework for the control interface", cat: "Frontend" },
    { title: "React Native mobile app", desc: "Cross-platform iOS/Android native app", cat: "Mobile" },
    { title: "FastLED integration", desc: "High-performance LED library for Arduino/ESP", cat: "Firmware" },
    { title: "MQTT messaging", desc: "Lightweight pub/sub protocol for IoT devices", cat: "Protocol" },
    { title: "SQLite local storage", desc: "Embedded database for offline data persistence", cat: "Storage" },
    { title: "Docker deployment", desc: "Containerized server for easy deployment", cat: "DevOps" },
    { title: "GraphQL API", desc: "Flexible query language for complex data needs", cat: "API" },
    { title: "Redis caching layer", desc: "In-memory cache for fast response times", cat: "Performance" },
    { title: "OAuth2 authentication", desc: "Secure token-based user authentication", cat: "Security" },
    { title: "Electron desktop app", desc: "Cross-platform desktop application wrapper", cat: "Desktop" },
    { title: "ESPHome firmware", desc: "YAML-configured firmware for ESP devices", cat: "Firmware" },
    { title: "Prometheus metrics", desc: "Time-series monitoring and alerting", cat: "Monitoring" },
    { title: "CI/CD pipeline", desc: "Automated testing and deployment workflow", cat: "DevOps" },
    { title: "TypeScript codebase", desc: "Type-safe JavaScript for reliability", cat: "Language" },
    { title: "gRPC services", desc: "High-performance RPC framework for microservices", cat: "Protocol" },
    { title: "PostgreSQL database", desc: "Robust relational data storage with JSONB support", cat: "Storage" },
    { title: "Kubernetes deployment", desc: "Container orchestration for scalability", cat: "DevOps" },
    { title: "JWT authentication", desc: "Stateless token-based auth for APIs", cat: "Security" },
    { title: "Tailwind CSS styling", desc: "Utility-first CSS framework for rapid UI development", cat: "Frontend" },
    { title: "FFT audio processing", desc: "Frequency analysis for music-reactive features", cat: "Signal" },
    { title: "BLE communication", desc: "Bluetooth Low Energy for device connectivity", cat: "Protocol" },
    { title: "OTA firmware updates", desc: "Over-the-air updates for ESP devices", cat: "Firmware" },
    { title: "Home Assistant plugin", desc: "Custom integration for smart home hub", cat: "Integration" },
    { title: "OpenAPI specification", desc: "Auto-generated API documentation", cat: "API" },
    { title: "PWA architecture", desc: "Progressive web app for native-like experience", cat: "Frontend" },
    { title: "State machine design", desc: "Finite state management for complex logic", cat: "Architecture" },
    { title: "Event-driven architecture", desc: "Pub/sub pattern for decoupled components", cat: "Architecture" },
    { title: "Unit test coverage", desc: "Comprehensive testing with Jest/Vitest", cat: "Testing" },
  ]

  // Choose ideas based on mode
  const fillIdeas = mode === "technical" ? technicalIdeas : featureIdeas

  // Add ideas until we have 25 total
  for (const g of fillIdeas) {
    if (ideas.length >= 25) break
    addIdea(g.title, g.desc, g.cat, "medium")
  }

  return ideas.slice(0, 25)
}
