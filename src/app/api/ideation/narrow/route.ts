import { NextRequest, NextResponse } from "next/server"
import { generate, parseLLMJson } from "@/lib/llm"

const NARROW_SYSTEM_PROMPT = `You are an expert at FRACTAL IDEATION - helping people iteratively refine vague ideas into specific, buildable software projects.

FRACTAL BEHAVIOR:
- Like a fractal, each selection spawns SELF-SIMILAR SUB-TOPICS that drill deeper into that specific area
- NEVER repeat options that have already been shown
- Each iteration should be MORE SPECIFIC than the last while retaining the original intent
- Start broad, then progressively narrow based on what the user selected

CRITICAL: Focus on SOFTWARE they can CODE:
- Web apps, mobile apps, APIs, dashboards, tools, automation scripts
- Firmware for microcontrollers (ESP32, Arduino code)
- Control interfaces, visualizations, data processing

Do NOT suggest:
- Generic categories, vague explorations, or things already shown
- Hardware to buy, business strategy, or marketing

Return JSON only, no markdown.`

interface NarrowRequest {
  projectId: string
  selectedIdeas: string[]
  previousSelections: string[]
  originalContext: string
  stageNumber: number
  regenerate?: boolean  // If true, generate different options
  mode?: "technical" | "nontechnical"  // Technical for developers, Non-technical for everyone else
  previouslyShownOptions?: string[]  // All options shown in previous iterations (to avoid duplicates)
}

export async function POST(request: NextRequest) {
  try {
    const body: NarrowRequest = await request.json()
    const { selectedIdeas, previousSelections, originalContext, stageNumber, regenerate, mode = "nontechnical", previouslyShownOptions = [] } = body

    if (!selectedIdeas || selectedIdeas.length === 0) {
      return NextResponse.json(
        { error: "Selected ideas are required" },
        { status: 400 }
      )
    }

    // Build the exclusion list (all previously shown options that weren't selected)
    const exclusionList = previouslyShownOptions.length > 0
      ? `\n\nCRITICAL - DO NOT REPEAT THESE (already shown in previous stages):\n${previouslyShownOptions.slice(0, 100).map(o => `- ${o}`).join("\n")}`
      : ""

    const prompt = `You are performing FRACTAL IDEATION - iteratively refining a vague idea into something specific and buildable.

## FRACTAL RULES:
1. **NO DUPLICATES**: Never suggest anything from the "already shown" list below
2. **SELF-SIMILAR BRANCHING**: Each selection the user made should spawn related SUB-TOPICS that drill deeper
3. **PROGRESSIVE REFINEMENT**: Stage ${stageNumber} should be MORE SPECIFIC than Stage ${stageNumber - 1}
4. **RETAIN ORIGINAL INTENT**: Keep the essence of what they originally described while getting more concrete

## ORIGINAL USER INPUT:
"""
${originalContext.slice(0, 1200)}
"""

## SELECTION PATH (their journey from broad to specific):
${previousSelections.length > 0 ? previousSelections.map((s, i) => `Stage ${i + 1}: "${s}"`).join("\n") : "Starting fresh"}

## CURRENT SELECTIONS (Stage ${stageNumber}):
${selectedIdeas.map(s => `→ "${s}"`).join("\n")}
${exclusionList}

## YOUR TASK:
Generate ideas that BRANCH FROM their current selections. Think of it like a fractal:
- If they selected "Music reactive" → generate sub-types of music reactivity (beat detection, spectrum analysis, volume-based, genre-specific, etc.)
- If they selected "LED matrix" → generate specific matrix applications (clock, notifications, games, art, weather display, etc.)
- Each new idea should feel like a NATURAL CHILD of what they selected

IMPORTANT STRUCTURE (for each set of 25):
- ~18-20 ideas that drill deeper into their specific selections (fractal branching)
- ~5-7 "creative wildcard" ideas that aren't directly related but would complement their project or spark new directions
  - These wildcards should still be SOFTWARE features, not unrelated tangents
  - Examples: "Undo/Redo history", "Import/Export presets", "Community sharing", "Achievement badges", "Tutorial mode"

${regenerate ? "\nREGENERATE MODE: Generate COMPLETELY DIFFERENT ideas than typical - explore unusual, creative angles!\n" : ""}

Generate TWO sets of EXACTLY 25 ideas each:

**NON-TECHNICAL IDEAS** (for non-programmers):
- Simple, friendly names that describe what it DOES
- Focus on user benefits and experiences
- NO jargon: avoid "API", "WebSocket", "firmware", "protocol", "OAuth"
- Example: "Color that follows the music", "Wake up with sunrise colors"

**TECHNICAL IDEAS** (for developers):
- Specific technologies and implementation approaches
- Technical terminology welcome: "FastLED FFT integration", "MQTT event broker"
- Focus on architecture and frameworks

Return JSON:
{
  "title": "Stage ${stageNumber + 1}: [Contextual title based on their selections]",
  "instruction": "Brief instruction referencing what they just selected",
  "nonTechnicalIdeas": [
    { "id": "nt-1", "label": "Friendly name (3-6 words)", "description": "What it does and why useful", "category": "category" }
    // ... 25 total, all UNIQUE and not in the exclusion list
  ],
  "technicalIdeas": [
    { "id": "tech-1", "label": "Technical name", "description": "Technical details", "category": "category" }
    // ... 25 total, all UNIQUE and not in the exclusion list
  ]
}`

    // Use higher temperature for regenerate to get different results
    const temperature = regenerate ? 0.95 : 0.8

    // Use unified LLM service (local first, then paid if allowed)
    console.log("[ideation/narrow] Calling unified LLM service...")
    const llmResponse = await generate({
      systemPrompt: NARROW_SYSTEM_PROMPT,
      userPrompt: prompt,
      temperature,
      max_tokens: 4000,
      allowPaidFallback: true  // Allow paid fallback for ideation
    })

    if (llmResponse.content && !llmResponse.error) {
      console.log(`[ideation/narrow] LLM responded via ${llmResponse.source}`)
      const parsed = parseLLMJson<{
        title?: string
        instruction?: string
        nonTechnicalIdeas?: Array<{
          id: string
          label: string
          description: string
          category?: string
        }>
        technicalIdeas?: Array<{
          id: string
          label: string
          description: string
          category?: string
        }>
        ideas?: Array<{
          id: string
          label: string
          description: string
          category?: string
        }>
      }>(llmResponse.content)

      // Check if we got the new dual-set format
      if (parsed && parsed.nonTechnicalIdeas && parsed.technicalIdeas &&
          parsed.nonTechnicalIdeas.length > 0 && parsed.technicalIdeas.length > 0) {
        // Return both sets for instant mode switching
        return NextResponse.json({
          title: parsed.title,
          instruction: parsed.instruction,
          nonTechnicalIdeas: parsed.nonTechnicalIdeas,
          technicalIdeas: parsed.technicalIdeas,
          // For backward compatibility, also include ideas based on current mode
          ideas: mode === "technical" ? parsed.technicalIdeas : parsed.nonTechnicalIdeas,
          llmSource: llmResponse.source,
          llmServer: llmResponse.server,
          llmModel: llmResponse.model
        })
      }
      // Fallback to old single-set format if LLM didn't return both sets
      else if (parsed && parsed.ideas && parsed.ideas.length > 0) {
        return NextResponse.json({
          ...parsed,
          llmSource: llmResponse.source,
          llmServer: llmResponse.server,
          llmModel: llmResponse.model
        })
      } else {
        console.warn("[ideation/narrow] LLM response missing required fields, using fallback")
      }
    } else {
      console.log("[ideation/narrow] LLM failed:", llmResponse.error || "No content")
    }

    // Fallback - only used when ALL LLM backends fail
    console.log("[ideation/narrow] Using fallback generation")
    const fallbackResult = generateSmartNarrowedIdeas(selectedIdeas, originalContext, stageNumber, mode)
    return NextResponse.json({ ...fallbackResult, llmSource: "fallback" })

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
 * This creates SPECIFIC ideas based on what the user is actually exploring
 */
function generateSmartNarrowedIdeas(selections: string[], originalContext: string, stageNumber: number, mode: "technical" | "nontechnical" = "nontechnical") {
  const selectionText = selections.join(" ").toLowerCase()
  const contextText = (originalContext + " " + selectionText).toLowerCase()

  // Detect key themes from BOTH context AND selections
  const themes = {
    hasLED: /\b(led|light|rgb|neopixel|ws2812|strip|addressable)\b/i.test(contextText),
    hasESP: /\b(esp32|esp8266|arduino|raspberry|microcontroller|mcu)\b/i.test(contextText),
    hasMusic: /\b(music|audio|sound|reactive|beat|rhythm|spectrum)\b/i.test(contextText),
    hasMatrix: /\b(matrix|display|panel|grid|pixel)\b/i.test(contextText),
    hasAmbient: /\b(ambient|mood|room|home|smart)\b/i.test(contextText),
    hasHoliday: /\b(holiday|christmas|decoration|festive|seasonal)\b/i.test(contextText),
    hasWLED: /\b(wled|firmware)\b/i.test(contextText),
    hasController: /\b(controller|control|remote|wifi|bluetooth|app)\b/i.test(contextText),
    hasAI: /\b(ai|artificial intelligence|machine learning)\b/i.test(contextText),
    hasTradeShow: /\b(trade show|exhibition|demo|showcase)\b/i.test(contextText),
  }

  const ideas: Array<{ id: string; label: string; description: string; category: string }> = []
  let id = 1

  // Helper to add idea without duplicates
  const addIdea = (label: string, description: string, category: string) => {
    if (!ideas.some(i => i.label.toLowerCase() === label.toLowerCase())) {
      ideas.push({ id: `narrow-${id++}`, label, description, category })
    }
  }

  // LED + ESP32 specific narrowing
  if (themes.hasLED && themes.hasESP) {
    // Check what specific aspect they selected
    if (themes.hasMusic || selectionText.includes("music") || selectionText.includes("reactive")) {
      addIdea("FFT audio visualization", "Use fast Fourier transform for frequency-based effects", "Audio")
      addIdea("Beat detection patterns", "Trigger effects on drum beats and bass hits", "Audio")
      addIdea("Volume-reactive brightness", "Simple brightness changes based on loudness", "Audio")
      addIdea("Multi-zone audio sync", "Different LED zones react to different frequencies", "Audio")
      addIdea("Microphone input", "Use built-in or external mic for sound pickup", "Hardware")
      addIdea("Line-in audio input", "Direct audio connection for clean signal", "Hardware")
    }

    if (themes.hasMatrix || selectionText.includes("matrix") || selectionText.includes("display")) {
      addIdea("Scrolling text display", "Show messages and notifications on LED matrix", "Display")
      addIdea("Clock and weather display", "Show time, temperature, and conditions", "Display")
      addIdea("Pixel art animations", "Display sprite animations and pixel graphics", "Display")
      addIdea("Game display (Snake, Tetris)", "Play classic games on the matrix", "Display")
      addIdea("Notification display", "Show phone or computer notifications", "Display")
      addIdea("Custom image upload", "Upload and display custom images", "Display")
    }

    if (themes.hasAmbient || selectionText.includes("ambient") || selectionText.includes("smart") || selectionText.includes("home")) {
      addIdea("Ambilight/Hyperion clone", "LEDs that match TV screen colors", "Ambient")
      addIdea("Sunrise alarm simulation", "Gradual wake-up light in the morning", "Ambient")
      addIdea("Circadian rhythm lighting", "Color temperature changes throughout day", "Ambient")
      addIdea("Home Assistant integration", "Control from your smart home hub", "Integration")
      addIdea("Voice control (Alexa/Google)", "Control lights with voice commands", "Integration")
      addIdea("Motion-activated lighting", "Lights respond to movement", "Automation")
    }

    if (themes.hasHoliday || selectionText.includes("holiday") || selectionText.includes("christmas")) {
      addIdea("Synchronized music show", "Lights dance to holiday music", "Holiday")
      addIdea("Timed schedule automation", "Automatic on/off during holiday season", "Holiday")
      addIdea("Multiple zone control", "Different areas with different effects", "Holiday")
      addIdea("Weather-reactive effects", "Snow effect when it's cold, etc.", "Holiday")
      addIdea("Preset holiday themes", "One-click Christmas, Halloween, etc.", "Holiday")
    }

    if (themes.hasWLED || selectionText.includes("wled")) {
      addIdea("WLED preset customization", "Create and save custom effect presets", "WLED")
      addIdea("WLED sync across devices", "Multiple ESP32s running in sync", "WLED")
      addIdea("WLED with sensors", "Add motion, sound, or light sensors", "WLED")
      addIdea("WLED usermod development", "Create custom WLED extensions", "WLED")
    }

    if (themes.hasController || selectionText.includes("controller") || selectionText.includes("strip")) {
      addIdea("Web-based control panel", "Control lights from any browser", "Control")
      addIdea("Mobile app control", "Dedicated smartphone app", "Control")
      addIdea("Physical button/knob control", "Hardware controls for quick access", "Control")
      addIdea("IR remote control", "Use TV-style remote", "Control")
      addIdea("REST API for automation", "HTTP endpoints for scripting", "Control")
    }

    // General LED project ideas if not enough specific ones
    if (ideas.length < 8) {
      addIdea("Single color effects", "Breathing, fading, solid colors", "Basic")
      addIdea("Rainbow and gradient effects", "Color-cycling animations", "Basic")
      addIdea("Chase and wipe effects", "Moving patterns along the strip", "Animation")
      addIdea("Sparkle and twinkle effects", "Random twinkling like stars", "Animation")
      addIdea("Fire and flame simulation", "Realistic fire effect", "Animation")
      addIdea("Water/ripple effects", "Flowing water-like animations", "Animation")
    }
  }

  // AI + LED themes
  if (themes.hasAI && themes.hasLED) {
    addIdea("AI-generated patterns", "Use AI to create unique light patterns", "AI")
    addIdea("Mood detection lighting", "AI reads room mood and adjusts colors", "AI")
    addIdea("Object detection effects", "Camera detects objects, lights respond", "AI")
  }

  // Trade show themes
  if (themes.hasTradeShow) {
    addIdea("Interactive booth display", "Engaging demo for visitors", "Trade Show")
    addIdea("Product showcase lighting", "Highlight products with dynamic lighting", "Trade Show")
    addIdea("Lead capture integration", "Collect visitor info during demos", "Trade Show")
  }

  // Feature-focused ideas (user-friendly, no technical jargon) - 30 options
  const featureIdeas = [
    { label: "Control from your phone", desc: "Manage everything from a smartphone app", cat: "Control" },
    { label: "Voice commands", desc: "Control with Alexa, Google, or Siri", cat: "Control" },
    { label: "Automatic scheduling", desc: "Set it and forget it - runs on your schedule", cat: "Automation" },
    { label: "Reacts to music", desc: "Syncs and pulses with the beat", cat: "Reactive" },
    { label: "One-tap presets", desc: "Save favorites and recall them instantly", cat: "Convenience" },
    { label: "Works offline", desc: "Keeps working without internet", cat: "Reliability" },
    { label: "Share with friends", desc: "Share your creations with others", cat: "Social" },
    { label: "Syncs across devices", desc: "Changes appear on all your devices", cat: "Sync" },
    { label: "Beautiful animations", desc: "Smooth, eye-catching effects", cat: "Visual" },
    { label: "Color themes", desc: "Pre-designed palettes for any mood", cat: "Visual" },
    { label: "Timer and alarms", desc: "Automatic actions at specific times", cat: "Automation" },
    { label: "Remote access", desc: "Control from anywhere in the world", cat: "Control" },
    { label: "Activity history", desc: "See what happened and when", cat: "Tracking" },
    { label: "Smart notifications", desc: "Get alerts when something happens", cat: "Alerts" },
    { label: "Easy setup", desc: "Get started in minutes", cat: "Ease of use" },
    { label: "Customizable interface", desc: "Arrange controls how you like", cat: "Personalization" },
    { label: "Sunrise wake-up mode", desc: "Gentle light that wakes you naturally", cat: "Wellness" },
    { label: "Party mode", desc: "Exciting effects for celebrations", cat: "Fun" },
    { label: "Movie watching mode", desc: "Perfect ambient lighting for films", cat: "Entertainment" },
    { label: "Focus mode", desc: "Lighting that helps concentration", cat: "Productivity" },
    { label: "Sleep mode", desc: "Relaxing colors that help you wind down", cat: "Wellness" },
    { label: "Weather display", desc: "Shows current weather through colors", cat: "Info" },
    { label: "Energy saving mode", desc: "Automatically dims to save power", cat: "Efficiency" },
    { label: "Guest access", desc: "Let visitors control without full access", cat: "Sharing" },
    { label: "Backup and restore", desc: "Never lose your settings", cat: "Reliability" },
    { label: "Multiple rooms", desc: "Control different areas separately", cat: "Organization" },
    { label: "Scene buttons", desc: "Physical buttons for quick scene changes", cat: "Convenience" },
    { label: "Calendar integration", desc: "Changes based on your schedule", cat: "Automation" },
    { label: "Mood lighting", desc: "Colors that match how you feel", cat: "Wellness" },
    { label: "Game room mode", desc: "Dynamic lighting for gaming", cat: "Entertainment" },
  ]

  // Technical ideas (for developers) - 30 options
  const technicalIdeas = [
    { label: "REST API endpoints", desc: "HTTP API for programmatic control", cat: "API" },
    { label: "WebSocket real-time sync", desc: "Bi-directional live updates", cat: "Protocol" },
    { label: "React/Next.js dashboard", desc: "Modern web framework UI", cat: "Frontend" },
    { label: "React Native mobile app", desc: "Cross-platform native app", cat: "Mobile" },
    { label: "FastLED integration", desc: "High-performance LED library", cat: "Firmware" },
    { label: "MQTT messaging", desc: "Pub/sub protocol for IoT", cat: "Protocol" },
    { label: "SQLite local storage", desc: "Embedded database", cat: "Storage" },
    { label: "Docker deployment", desc: "Containerized server", cat: "DevOps" },
    { label: "GraphQL API", desc: "Flexible query language", cat: "API" },
    { label: "Redis caching", desc: "In-memory cache layer", cat: "Performance" },
    { label: "OAuth2 authentication", desc: "Token-based auth", cat: "Security" },
    { label: "Electron desktop app", desc: "Cross-platform desktop wrapper", cat: "Desktop" },
    { label: "ESPHome firmware", desc: "YAML-configured ESP firmware", cat: "Firmware" },
    { label: "Prometheus metrics", desc: "Time-series monitoring", cat: "Monitoring" },
    { label: "CI/CD pipeline", desc: "Automated testing/deploy", cat: "DevOps" },
    { label: "TypeScript codebase", desc: "Type-safe JavaScript", cat: "Language" },
    { label: "gRPC services", desc: "High-performance RPC framework", cat: "Protocol" },
    { label: "PostgreSQL database", desc: "Relational data storage", cat: "Storage" },
    { label: "Kubernetes deployment", desc: "Container orchestration", cat: "DevOps" },
    { label: "JWT authentication", desc: "Stateless token auth", cat: "Security" },
    { label: "Tailwind CSS styling", desc: "Utility-first CSS framework", cat: "Frontend" },
    { label: "FFT audio processing", desc: "Frequency analysis for audio", cat: "Signal" },
    { label: "BLE communication", desc: "Bluetooth Low Energy protocol", cat: "Protocol" },
    { label: "OTA firmware updates", desc: "Over-the-air ESP updates", cat: "Firmware" },
    { label: "Home Assistant plugin", desc: "Smart home integration", cat: "Integration" },
    { label: "OpenAPI specification", desc: "API documentation standard", cat: "API" },
    { label: "PWA architecture", desc: "Progressive web app", cat: "Frontend" },
    { label: "State machine design", desc: "Finite state management", cat: "Architecture" },
    { label: "Event-driven architecture", desc: "Pub/sub event handling", cat: "Architecture" },
    { label: "Unit test coverage", desc: "Jest/Vitest testing", cat: "Testing" },
  ]

  // Build both non-technical and technical idea lists
  const nonTechIdeasList: Array<{ id: string; label: string; description: string; category: string }> = []
  const techIdeasList: Array<{ id: string; label: string; description: string; category: string }> = []
  let ntId = 1
  let techId = 1

  // Add context-specific ideas to both lists first
  for (const idea of ideas) {
    nonTechIdeasList.push({ ...idea, id: `nt-${ntId++}` })
    techIdeasList.push({ ...idea, id: `tech-${techId++}` })
  }

  // Fill non-technical list with feature-focused ideas
  for (const proj of featureIdeas) {
    if (nonTechIdeasList.length >= 25) break
    if (!nonTechIdeasList.some(i => i.label.toLowerCase() === proj.label.toLowerCase())) {
      nonTechIdeasList.push({ id: `nt-${ntId++}`, label: proj.label, description: proj.desc, category: proj.cat })
    }
  }

  // Fill technical list with developer-focused ideas
  for (const proj of technicalIdeas) {
    if (techIdeasList.length >= 25) break
    if (!techIdeasList.some(i => i.label.toLowerCase() === proj.label.toLowerCase())) {
      techIdeasList.push({ id: `tech-${techId++}`, label: proj.label, description: proj.desc, category: proj.cat })
    }
  }

  // Determine contextual title
  let title = "Narrowing down your project..."
  if (themes.hasMusic) title = "Exploring audio-reactive options..."
  else if (themes.hasMatrix) title = "Exploring display options..."
  else if (themes.hasAmbient) title = "Exploring smart lighting options..."
  else if (themes.hasHoliday) title = "Exploring holiday lighting options..."
  else if (themes.hasLED && themes.hasESP) title = "Exploring LED project options..."

  const instruction = `You selected ${selections.slice(0, 2).join(" and ")}. What features interest you? Hover over options to see descriptions.`

  return {
    title,
    instruction,
    nonTechnicalIdeas: nonTechIdeasList.slice(0, 25),
    technicalIdeas: techIdeasList.slice(0, 25),
    // For backward compatibility
    ideas: mode === "technical" ? techIdeasList.slice(0, 25) : nonTechIdeasList.slice(0, 25)
  }
}
