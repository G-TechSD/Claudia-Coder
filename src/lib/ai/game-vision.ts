/**
 * Game/Creative Project Vision Generator
 *
 * Detects when a project is a game or creative project and generates
 * a "vision" packet with Steam/app store style descriptions.
 *
 * The vision packet represents the ultimate goal of the project and should
 * NOT be marked complete until the game matches the description without
 * major bugs or missing features.
 */

import { generateWithLocalLLM } from "@/lib/llm/local-llm"
import type { ExtractedNuance } from "./nuance-extraction"
import type { ProjectCategory } from "@/lib/data/types"

// Categories that are explicitly game/creative - vision packets apply
export const GAME_CREATIVE_CATEGORIES: ProjectCategory[] = ["game", "vr", "creative", "interactive"]

// Categories that are explicitly NOT game/creative - skip game detection entirely
export const NON_GAME_CATEGORIES: ProjectCategory[] = ["web", "mobile", "desktop", "api", "library", "tool"]

/**
 * Negative keywords that BLOCK game/creative detection when present.
 * These indicate serious/enterprise applications that should NOT be gamified.
 * If ANY of these are found, the project is NOT classified as a game.
 */
export const GAME_BLOCKING_KEYWORDS = [
  // Healthcare/Medical domain - NEVER gamify
  "healthcare",
  "medical",
  "patient",
  "patients",
  "hospital",
  "clinic",
  "doctor",
  "physician",
  "nurse",
  "diagnosis",
  "prescription",
  "medication",
  "treatment",
  "therapy",
  "insurance claim",
  "health insurance",
  "medicare",
  "medicaid",
  "hipaa",
  "ehr",
  "emr",
  "electronic health record",
  "electronic medical record",
  "telehealth",
  "telemedicine",
  "appointment booking",
  "medical billing",
  "clinical",
  "pharmacy",

  // Finance/Banking - serious applications
  "banking",
  "bank account",
  "financial services",
  "investment portfolio",
  "trading platform",
  "stock trading",
  "tax filing",
  "accounting software",
  "payroll",
  "invoicing",
  "compliance",

  // Legal/Government
  "legal services",
  "law firm",
  "court filing",
  "government",
  "municipal",
  "regulatory",

  // Enterprise/Business critical
  "enterprise",
  "erp",
  "crm software",
  "business intelligence",
  "analytics dashboard",
  "supply chain",
  "inventory management",
  "project management tool",

  // Infrastructure/DevOps
  "infrastructure",
  "devops",
  "kubernetes",
  "monitoring system",
  "logging system",
  "ci/cd",
]

/**
 * Helper function to check if a category is game/creative
 */
export function isGameCreativeCategory(category: ProjectCategory | undefined): boolean {
  return !!category && GAME_CREATIVE_CATEGORIES.includes(category)
}

/**
 * Helper function to check if a category is explicitly non-game
 */
export function isNonGameCategory(category: ProjectCategory | undefined): boolean {
  return !!category && NON_GAME_CATEGORIES.includes(category)
}

/**
 * Keywords that indicate a game or creative project
 */
export const GAME_CREATIVE_KEYWORDS = {
  // Primary indicators (strong signal) - these are unambiguous game/creative terms
  // NOTE: Avoid adding terms that are commonly used in non-game software
  // (e.g., "story" for user stories, "demo" for product demos, "alpha/beta" for releases)
  primary: [
    "game",
    "games",
    "gaming",
    "vr",
    "virtual reality",
    "ar",
    "augmented reality",
    "xr",
    "mixed reality",
    "metaverse",
    "gameplay",
    "player",
    "players",
    "playable",
    // "story" moved to secondary - conflicts with "user story" in agile
    "storyline",
    "plot",
    // "narrative" moved to secondary - too generic
    // "character" moved to secondary - conflicts with "character encoding"
    "characters",  // plural is more game-specific
    "protagonist",
    "antagonist",
    "npc",
    "rpg",
    "fps",
    "mmo",
    "mmorpg",
    "roguelike",
    "roguelite",
    "platformer",
    "puzzle game",
    "adventure game",
    // "simulation" moved to secondary - too generic (business simulation, etc.)
    "game simulation",  // more specific
    // "sim" moved to secondary - too generic
    // "sandbox" moved to secondary - conflicts with dev sandbox
    "sandbox game",  // more specific
    "open world",
    "steam",
    "epic games",
    "itch.io",
    "unity",
    "unreal",
    "godot",
    "gamemaker",
    "rpgmaker",
  ],
  // Secondary indicators (moderate signal)
  // These need to combine with other signals to indicate a game project
  // Includes terms moved from primary that are ambiguous in isolation
  secondary: [
    // Moved from primary (ambiguous in isolation)
    "story",        // conflicts with "user story" in agile - needs other game context
    "narrative",    // too generic alone
    "character",    // conflicts with "character encoding" - needs other game context
    "simulation",   // could be business simulation
    "sim",          // too short/generic
    "sandbox",      // conflicts with dev sandbox
    // Original secondary keywords
    "level",
    "levels",
    "quest",
    "quests",
    "mission",
    "missions",
    "boss",
    "enemy",
    "enemies",
    "loot",
    "inventory",
    "weapon",
    "weapons",
    "spell",
    "spells",
    "ability",
    "abilities",
    "skill tree",
    "experience points",
    "xp",
    "health",
    "hp",
    "mana",
    "stamina",
    "cutscene",
    "dialogue",
    "voice acting",
    "soundtrack",
    "ost",
    "pixel art",
    "sprite",
    "sprites",
    "animation",    // Note: also ambiguous (CSS animation) but combined with others is ok
    "cinematics",
    "trailer",
    "demo",         // Note: ambiguous (product demo) but combined with others is ok
    "alpha",        // Note: ambiguous (software release) but combined with others is ok
    "beta",         // Note: ambiguous (software release) but combined with others is ok
    "early access",
    "dlc",
    "expansion",
    "mod",
    "modding",
    "controller",
    "gamepad",
    "multiplayer",
    "co-op",
    "pvp",
    "pve",
    "leaderboard",
    "achievements",
    "trophy",
    "trophies",
    "save game",
    "checkpoint",
  ],
  // Creative/artistic project indicators
  creative: [
    "film",
    "movie",
    "short film",
    "documentary",
    "animation",
    "animated",
    "comic",
    "graphic novel",
    "webcomic",
    "novel",
    "book",
    "ebook",
    "audiobook",
    "podcast",
    "music",
    "album",
    "ep",
    "single",
    "music video",
    "art",
    "artwork",
    "illustration",
    "concept art",
    "portfolio",
    "exhibition",
    "gallery",
    "interactive",
    "experience",
    "immersive",
    "virtual tour",
    "visualization",
    "3d model",
    "sculpt",
    "render",
  ],
}

/**
 * Result of game/creative project detection
 */
export interface GameProjectDetection {
  isGameOrCreative: boolean
  confidence: "high" | "medium" | "low"
  matchedKeywords: string[]
  projectType: "game" | "vr" | "creative" | "interactive" | "standard"
  suggestedCategory: string
}

/**
 * Vision packet for game/creative projects
 */
export interface VisionPacket {
  id: string
  phaseId: string
  title: string
  description: string
  type: "vision"
  priority: "critical"
  status: "queued"
  tasks: Array<{ id: string; description: string; completed: boolean; order: number }>
  suggestedTaskType: string
  acceptanceCriteria: string[]
  estimatedTokens: number
  dependencies: string[]
  metadata: {
    source: "vision-generator"
    projectType: string
    storeDescription: string
    tagline: string
    keyFeatures: string[]
    targetAudience: string
    uniqueSellingPoints: string[]
    isVisionPacket: true
    completionGate: true // This packet gates overall project completion
  }
}

/**
 * Generated vision content
 */
export interface GeneratedVision {
  gameName: string
  tagline: string
  storeDescription: string
  shortDescription: string
  keyFeatures: string[]
  uniqueSellingPoints: string[]
  targetAudience: string
  genre: string
  mood: string
  coreExperience: string
}

/**
 * Detect if a project is a game or creative project
 *
 * @param projectName - The project name
 * @param projectDescription - The project description
 * @param issueContent - Optional array of issue content strings
 * @param explicitCategory - Optional explicit project category that overrides keyword detection
 *
 * If explicitCategory is set:
 * - Game/creative categories (game, vr, creative, interactive) -> isGameOrCreative = true
 * - Non-game categories (web, mobile, desktop, api, library, tool) -> isGameOrCreative = false
 * - "standard" or undefined -> fall back to keyword detection
 */
export function detectGameOrCreativeProject(
  projectName: string,
  projectDescription: string,
  issueContent?: string[],
  explicitCategory?: ProjectCategory
): GameProjectDetection {
  // PRIORITY 1: Explicit category overrides keyword detection
  // This prevents false positives for non-game projects that happen to have game-ish keywords
  if (explicitCategory && NON_GAME_CATEGORIES.includes(explicitCategory)) {
    // Explicitly marked as non-game project - skip game detection entirely
    return {
      isGameOrCreative: false,
      confidence: "high",
      matchedKeywords: [],
      projectType: "standard",
      suggestedCategory: explicitCategory === "web" ? "Web Application"
        : explicitCategory === "mobile" ? "Mobile App"
        : explicitCategory === "desktop" ? "Desktop Application"
        : explicitCategory === "api" ? "API/Backend Service"
        : explicitCategory === "library" ? "Library/Package"
        : explicitCategory === "tool" ? "Developer Tool"
        : "Software",
    }
  }

  if (explicitCategory && GAME_CREATIVE_CATEGORIES.includes(explicitCategory)) {
    // Explicitly marked as game/creative project
    return {
      isGameOrCreative: true,
      confidence: "high",
      matchedKeywords: [`explicit:${explicitCategory}`],
      projectType: explicitCategory as "game" | "vr" | "creative" | "interactive",
      suggestedCategory: explicitCategory === "game" ? "Video Game"
        : explicitCategory === "vr" ? "VR/AR Experience"
        : explicitCategory === "creative" ? "Creative Project"
        : "Interactive Experience",
    }
  }

  // PRIORITY 2: Check for blocking keywords that indicate serious/enterprise apps
  // These should NEVER be classified as games even if they contain game-ish words
  const allText = [
    projectName,
    projectDescription,
    ...(issueContent || [])
  ].join(" ").toLowerCase()

  // Check blocking keywords FIRST
  for (const blocker of GAME_BLOCKING_KEYWORDS) {
    const regex = new RegExp(`\\b${blocker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (regex.test(allText)) {
      // Found a blocking keyword - this is NOT a game project
      return {
        isGameOrCreative: false,
        confidence: "high",
        matchedKeywords: [`blocked:${blocker}`],
        projectType: "standard",
        suggestedCategory: "Software Application",
      }
    }
  }

  // PRIORITY 3: Fall back to keyword detection for "standard" or undefined category
  const matchedKeywords: string[] = []
  let primaryMatches = 0
  let secondaryMatches = 0
  let creativeMatches = 0

  // Check primary keywords
  for (const keyword of GAME_CREATIVE_KEYWORDS.primary) {
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (regex.test(allText)) {
      matchedKeywords.push(keyword)
      primaryMatches++
    }
  }

  // Check secondary keywords
  for (const keyword of GAME_CREATIVE_KEYWORDS.secondary) {
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (regex.test(allText)) {
      matchedKeywords.push(keyword)
      secondaryMatches++
    }
  }

  // Check creative keywords
  for (const keyword of GAME_CREATIVE_KEYWORDS.creative) {
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (regex.test(allText)) {
      matchedKeywords.push(keyword)
      creativeMatches++
    }
  }

  // Calculate confidence and determine type
  // Scoring: primary keywords are strong indicators, secondary/creative need to combine
  const totalScore = primaryMatches * 3 + secondaryMatches * 2 + creativeMatches * 2
  let confidence: "high" | "medium" | "low"
  let isGameOrCreative = false
  let projectType: "game" | "vr" | "creative" | "interactive" | "standard" = "standard"
  let suggestedCategory = "Software"

  // IMPORTANT: Only classify as game/creative with sufficient evidence
  // A single keyword match is NOT enough - requires multiple signals
  // This prevents false positives from common terms like "story", "demo", "animation"
  if (totalScore >= 10 || primaryMatches >= 3) {
    confidence = "high"
    isGameOrCreative = true
  } else if (totalScore >= 5 || primaryMatches >= 2) {
    confidence = "medium"
    isGameOrCreative = true
  } else if (totalScore >= 3 && primaryMatches >= 1 && (secondaryMatches >= 1 || creativeMatches >= 1)) {
    // Low confidence requires BOTH a primary match AND supporting evidence
    // This prevents single-keyword false positives
    confidence = "low"
    isGameOrCreative = true
  } else {
    // Not enough evidence - don't classify as game/creative
    confidence = "low"
    isGameOrCreative = false
  }

  // Determine specific project type
  if (isGameOrCreative) {
    const vrKeywords = ["vr", "virtual reality", "ar", "augmented reality", "xr", "mixed reality"]
    const hasVR = vrKeywords.some(kw => matchedKeywords.includes(kw))

    if (hasVR) {
      projectType = "vr"
      suggestedCategory = "VR/AR Experience"
    } else if (primaryMatches > 0 && secondaryMatches > 0) {
      projectType = "game"
      suggestedCategory = "Video Game"
    } else if (creativeMatches > primaryMatches) {
      projectType = "creative"
      suggestedCategory = "Creative Project"
    } else {
      projectType = "interactive"
      suggestedCategory = "Interactive Experience"
    }
  }

  return {
    isGameOrCreative,
    confidence,
    matchedKeywords,
    projectType,
    suggestedCategory,
  }
}

/**
 * System prompt for vision generation
 */
export const VISION_GENERATION_SYSTEM_PROMPT = `You are a game marketing expert and creative director. Your task is to write compelling Steam/app store style descriptions for games and creative projects.

Your descriptions should:
1. CAPTURE THE ESSENCE - What makes this project special and unique
2. PAINT A PICTURE - Help players/users visualize the experience
3. BE COMPELLING - Make people want to try it
4. BE HONEST - Don't overpromise, but highlight real strengths
5. INCLUDE KEY DETAILS - Features, genre, target audience

Read ALL provided context including:
- Project descriptions
- Story/plot elements
- Unique features mentioned in discussions
- Technical details that affect gameplay/experience

Return ONLY valid JSON with this structure:
{
  "gameName": "The project/game name",
  "tagline": "A short, catchy 5-10 word tagline",
  "storeDescription": "A 2-3 paragraph Steam/store style description (150-300 words)",
  "shortDescription": "A 1-2 sentence elevator pitch (under 50 words)",
  "keyFeatures": ["Feature 1", "Feature 2", "Feature 3", "Feature 4", "Feature 5"],
  "uniqueSellingPoints": ["What makes this special 1", "What makes this special 2", "What makes this special 3"],
  "targetAudience": "Who will love this project",
  "genre": "The genre/category",
  "mood": "The emotional tone/atmosphere",
  "coreExperience": "In one sentence, what is the core experience?"
}`

/**
 * Simplified prompt for smaller models
 */
export const VISION_GENERATION_SIMPLE_PROMPT = `Write a game/project store description. Return JSON only:
{
  "gameName": "name",
  "tagline": "catchy 5-10 word tagline",
  "storeDescription": "2-3 paragraph description (150-300 words)",
  "shortDescription": "1-2 sentence pitch",
  "keyFeatures": ["feature 1", "feature 2", "feature 3"],
  "uniqueSellingPoints": ["unique 1", "unique 2"],
  "targetAudience": "who will love this",
  "genre": "genre",
  "mood": "emotional tone",
  "coreExperience": "core experience in one sentence"
}
Return ONLY the JSON, no other text.`

/**
 * Generate user prompt for vision generation
 */
export function generateVisionPrompt(
  projectName: string,
  projectDescription: string,
  detection: GameProjectDetection,
  nuanceContext?: {
    storyElements: string[]
    uniqueFeatures: string[]
    technicalDetails: string[]
    targetAudience?: string
    mood?: string
  }
): string {
  let contextSection = ""

  if (nuanceContext) {
    const parts: string[] = []

    if (nuanceContext.storyElements.length > 0) {
      parts.push(`STORY/NARRATIVE ELEMENTS:\n${nuanceContext.storyElements.map(s => `- ${s}`).join("\n")}`)
    }

    if (nuanceContext.uniqueFeatures.length > 0) {
      parts.push(`UNIQUE FEATURES MENTIONED:\n${nuanceContext.uniqueFeatures.map(f => `- ${f}`).join("\n")}`)
    }

    if (nuanceContext.technicalDetails.length > 0) {
      parts.push(`TECHNICAL DETAILS:\n${nuanceContext.technicalDetails.map(t => `- ${t}`).join("\n")}`)
    }

    if (nuanceContext.targetAudience) {
      parts.push(`TARGET AUDIENCE MENTIONED: ${nuanceContext.targetAudience}`)
    }

    if (nuanceContext.mood) {
      parts.push(`MOOD/ATMOSPHERE: ${nuanceContext.mood}`)
    }

    if (parts.length > 0) {
      contextSection = `\n\n=== EXTRACTED CONTEXT ===\n${parts.join("\n\n")}\n=== END CONTEXT ===`
    }
  }

  return `Generate a vision/store description for:

PROJECT NAME: ${projectName}
PROJECT TYPE: ${detection.suggestedCategory}
DETECTED GENRE KEYWORDS: ${detection.matchedKeywords.slice(0, 10).join(", ")}

DESCRIPTION:
${projectDescription}
${contextSection}

Create a compelling store/marketing description that captures the essence of this ${detection.projectType === "game" ? "game" : "project"}. Be creative but stay true to what's described.`
}

/**
 * Parse vision generation response
 */
function parseVisionResponse(response: string): GeneratedVision | null {
  // Try direct parse
  try {
    return JSON.parse(response.trim())
  } catch {
    // Continue
  }

  // Remove markdown code blocks
  let cleaned = response
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim()

  // Try to find JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch {
      // Continue
    }

    // Try fixing common issues
    try {
      cleaned = jsonMatch[0]
        .replace(/,(\s*[}\]])/g, "$1")
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')

      return JSON.parse(cleaned)
    } catch {
      // Failed
    }
  }

  return null
}

/**
 * Generate vision content for a game/creative project
 */
export async function generateVisionContent(
  projectName: string,
  projectDescription: string,
  detection: GameProjectDetection,
  options?: {
    preferredServer?: string
    preferredModel?: string
    nuanceContext?: {
      storyElements: string[]
      uniqueFeatures: string[]
      technicalDetails: string[]
      targetAudience?: string
      mood?: string
    }
    maxRetries?: number
  }
): Promise<GeneratedVision | null> {
  const maxRetries = options?.maxRetries ?? 2
  let attempts = 0

  while (attempts < maxRetries) {
    attempts++

    const systemPrompt = attempts === 1
      ? VISION_GENERATION_SYSTEM_PROMPT
      : VISION_GENERATION_SIMPLE_PROMPT

    const userPrompt = generateVisionPrompt(
      projectName,
      projectDescription,
      detection,
      options?.nuanceContext
    )

    console.log(`[Vision Generator] Attempt ${attempts}/${maxRetries} for: ${projectName}`)

    const response = await generateWithLocalLLM(
      systemPrompt,
      userPrompt,
      {
        temperature: 0.7, // Slightly creative for marketing copy
        max_tokens: 2048,
        preferredServer: options?.preferredServer,
        preferredModel: options?.preferredModel
      }
    )

    if (response.error) {
      console.error(`[Vision Generator] LLM error on attempt ${attempts}:`, response.error)
      continue
    }

    const parsed = parseVisionResponse(response.content)
    if (parsed) {
      console.log(`[Vision Generator] Successfully generated vision on attempt ${attempts}`)
      return parsed
    }

    console.warn(`[Vision Generator] Failed to parse response on attempt ${attempts}`)
  }

  console.error(`[Vision Generator] All ${maxRetries} attempts failed`)
  return null
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Create a vision packet from generated content
 */
export function createVisionPacket(
  phaseId: string,
  projectName: string,
  detection: GameProjectDetection,
  vision: GeneratedVision
): VisionPacket {
  const packetId = `vision-${generateId()}`

  // Build the full description with all vision content
  const fullDescription = `
# ${vision.gameName} - Vision & Store Description

> ${vision.tagline}

## Store Description
${vision.storeDescription}

## Quick Pitch
${vision.shortDescription}

## Core Experience
${vision.coreExperience}

## Key Features
${vision.keyFeatures.map(f => `- ${f}`).join("\n")}

## What Makes This Special
${vision.uniqueSellingPoints.map(u => `- ${u}`).join("\n")}

## Target Audience
${vision.targetAudience}

## Genre & Mood
- **Genre:** ${vision.genre}
- **Mood:** ${vision.mood}

---
*This vision packet represents the ultimate goal for ${projectName}. The project is complete when the final product matches this description without major bugs or missing features.*
`.trim()

  return {
    id: packetId,
    phaseId,
    title: `${vision.gameName} - Vision & Store Description`,
    description: fullDescription,
    type: "vision",
    priority: "critical",
    status: "queued",
    tasks: [
      {
        id: `${packetId}-task-1`,
        description: "All key features implemented and working",
        completed: false,
        order: 0
      },
      {
        id: `${packetId}-task-2`,
        description: "Core experience matches the vision description",
        completed: false,
        order: 1
      },
      {
        id: `${packetId}-task-3`,
        description: "No major bugs or missing features",
        completed: false,
        order: 2
      },
      {
        id: `${packetId}-task-4`,
        description: "Store description accurately represents the final product",
        completed: false,
        order: 3
      },
      {
        id: `${packetId}-task-5`,
        description: "Ready for release/publication",
        completed: false,
        order: 4
      }
    ],
    suggestedTaskType: "review",
    acceptanceCriteria: [
      "Game/project matches the store description without major discrepancies",
      "All key features listed are implemented and functional",
      "No critical or high-priority bugs remain",
      "The core experience matches what's promised in the vision",
      "Target audience can enjoy the experience as described",
      "Project is polished enough for public release"
    ],
    estimatedTokens: 0, // This is a review task, not AI generation
    dependencies: [], // All other packets should depend on this NOT completing until the end
    metadata: {
      source: "vision-generator",
      projectType: detection.projectType,
      storeDescription: vision.storeDescription,
      tagline: vision.tagline,
      keyFeatures: vision.keyFeatures,
      targetAudience: vision.targetAudience,
      uniqueSellingPoints: vision.uniqueSellingPoints,
      isVisionPacket: true,
      completionGate: true
    }
  }
}

/**
 * Extract story and creative context from nuance
 */
export function extractCreativeContext(
  nuances: ExtractedNuance[]
): {
  storyElements: string[]
  uniqueFeatures: string[]
  technicalDetails: string[]
  targetAudience?: string
  mood?: string
} {
  const storyElements: string[] = []
  const uniqueFeatures: string[] = []
  const technicalDetails: string[] = []
  let targetAudience: string | undefined
  let mood: string | undefined

  const storyKeywords = [
    "story", "plot", "narrative", "character", "protagonist", "villain",
    "quest", "journey", "lore", "world", "setting", "backstory"
  ]

  const featureKeywords = [
    "feature", "mechanic", "system", "gameplay", "ability", "mode",
    "multiplayer", "co-op", "unique", "innovative", "special"
  ]

  const techKeywords = [
    "engine", "unity", "unreal", "godot", "platform", "vr", "ar",
    "graphics", "physics", "ai", "procedural", "networking"
  ]

  const audienceKeywords = [
    "audience", "players", "fans", "casual", "hardcore", "target",
    "demographic", "ages", "family", "mature"
  ]

  const moodKeywords = [
    "mood", "atmosphere", "tone", "feel", "vibe", "dark", "light",
    "horror", "comedy", "serious", "whimsical", "intense"
  ]

  for (const nuance of nuances) {
    // Check all context items
    const allItems = [
      ...nuance.context,
      ...nuance.requirements,
      ...nuance.decisions,
      ...nuance.rawPoints
    ]

    for (const item of allItems) {
      const lowerItem = item.toLowerCase()

      // Categorize based on keywords
      if (storyKeywords.some(kw => lowerItem.includes(kw))) {
        storyElements.push(item)
      } else if (featureKeywords.some(kw => lowerItem.includes(kw))) {
        uniqueFeatures.push(item)
      } else if (techKeywords.some(kw => lowerItem.includes(kw))) {
        technicalDetails.push(item)
      }

      if (audienceKeywords.some(kw => lowerItem.includes(kw)) && !targetAudience) {
        targetAudience = item
      }

      if (moodKeywords.some(kw => lowerItem.includes(kw)) && !mood) {
        mood = item
      }
    }
  }

  return {
    storyElements: [...new Set(storyElements)],
    uniqueFeatures: [...new Set(uniqueFeatures)],
    technicalDetails: [...new Set(technicalDetails)],
    targetAudience,
    mood
  }
}

/**
 * Implementation packet for game development work items
 */
export interface ImplementationPacket {
  id: string
  title: string
  description: string
  priority: "critical" | "high" | "medium" | "low"
  complexity: "simple" | "moderate" | "complex" | "epic"
  estimatedHours: number
  dependencies: string[] // IDs of packets that must be completed first
  category: ImplementationCategory
  tags: string[]
  acceptanceCriteria: string[]
  technicalNotes?: string
}

/**
 * Categories for implementation packets
 */
export type ImplementationCategory =
  | "project-setup"
  | "core-systems"
  | "player-mechanics"
  | "enemy-ai"
  | "combat"
  | "level-design"
  | "ui-ux"
  | "audio"
  | "vfx"
  | "networking"
  | "save-system"
  | "optimization"
  | "polish"
  | "testing"
  | "deployment"

/**
 * Result of implementation packet generation
 */
export interface ImplementationPacketResult {
  packets: ImplementationPacket[]
  summary: {
    totalPackets: number
    byPriority: Record<string, number>
    byCategory: Record<string, number>
    byComplexity: Record<string, number>
    estimatedTotalHours: number
  }
  projectAnalysis: {
    detectedFeatures: string[]
    detectedMechanics: string[]
    detectedTechnologies: string[]
    suggestedPhases: string[]
  }
}

/**
 * System prompt for implementation packet generation
 */
export const IMPLEMENTATION_PACKETS_SYSTEM_PROMPT = `You are a senior game developer and project manager. Your task is to analyze a game project description (brain dump) and generate a comprehensive set of implementation work packets.

For a game project, create SPECIFIC, ACTIONABLE packets that cover:

1. PROJECT SETUP
   - Engine/SDK setup (Unity, Unreal, Godot, etc.)
   - VR SDK integration if VR project (OpenXR, Oculus, SteamVR)
   - Version control setup
   - Project structure and architecture

2. CORE SYSTEMS
   - Game manager and state machine
   - Input system (especially for VR controllers)
   - Scene management
   - Event system

3. PLAYER MECHANICS
   - Player controller (movement, VR locomotion)
   - Camera system (VR head tracking)
   - Hand interactions (VR grabbing, pointing)
   - Player abilities

4. ENEMY/NPC AI
   - AI behavior trees or state machines
   - Navigation and pathfinding (NavMesh)
   - Spawn systems
   - AI perception (sight, hearing)

5. COMBAT/GAMEPLAY
   - Weapon systems (melee, ranged)
   - Damage and health systems
   - Hit detection (especially for VR)
   - Special abilities/powers

6. LEVEL DESIGN
   - Environment creation
   - Level layouts
   - Interactive objects
   - Hazards and obstacles

7. UI/UX
   - Main menu
   - HUD/UI elements
   - VR UI (diegetic, spatial)
   - Settings screens

8. AUDIO
   - Sound effects
   - Music system
   - Spatial audio (critical for VR)
   - Voice lines

9. PERSISTENCE
   - Save/load system
   - Progress tracking
   - Achievements/stats

10. POLISH & OPTIMIZATION
    - Performance optimization
    - Visual polish
    - Bug fixing
    - Platform-specific tweaks

RULES:
- Extract SPECIFIC features mentioned in the brain dump
- Create packets for each feature/mechanic mentioned
- Set realistic dependencies (setup before features)
- Be specific in titles and descriptions
- Include technical considerations
- Estimate complexity and time realistically

Return ONLY valid JSON with this structure:
{
  "packets": [
    {
      "id": "pkt-1",
      "title": "Clear action-oriented title",
      "description": "Detailed description of what needs to be built and why",
      "priority": "critical|high|medium|low",
      "complexity": "simple|moderate|complex|epic",
      "estimatedHours": 8,
      "dependencies": [],
      "category": "project-setup|core-systems|player-mechanics|enemy-ai|combat|level-design|ui-ux|audio|networking|save-system|optimization|polish|testing|deployment",
      "tags": ["unity", "vr", "ai"],
      "acceptanceCriteria": ["Criterion 1", "Criterion 2"],
      "technicalNotes": "Optional technical implementation notes"
    }
  ],
  "projectAnalysis": {
    "detectedFeatures": ["Feature 1", "Feature 2"],
    "detectedMechanics": ["Mechanic 1", "Mechanic 2"],
    "detectedTechnologies": ["Unity", "VR", "NavMesh"],
    "suggestedPhases": ["Phase 1: Setup", "Phase 2: Core", "Phase 3: Content"]
  }
}`

/**
 * Simplified prompt for smaller models
 */
export const IMPLEMENTATION_PACKETS_SIMPLE_PROMPT = `Analyze this game project and create work packets. Return JSON only:
{
  "packets": [
    {
      "id": "pkt-1",
      "title": "task title",
      "description": "what to build",
      "priority": "critical|high|medium|low",
      "complexity": "simple|moderate|complex|epic",
      "estimatedHours": 8,
      "dependencies": [],
      "category": "project-setup|core-systems|player-mechanics|enemy-ai|combat|level-design|ui-ux|audio|save-system|polish",
      "tags": [],
      "acceptanceCriteria": []
    }
  ],
  "projectAnalysis": {
    "detectedFeatures": [],
    "detectedMechanics": [],
    "detectedTechnologies": [],
    "suggestedPhases": []
  }
}
Return ONLY JSON.`

/**
 * Generate user prompt for implementation packet generation
 */
export function generateImplementationPacketsPrompt(
  projectName: string,
  brainDump: string,
  detection: GameProjectDetection,
  existingVision?: GeneratedVision
): string {
  let visionContext = ""
  if (existingVision) {
    visionContext = `
=== PROJECT VISION ===
Name: ${existingVision.gameName}
Tagline: ${existingVision.tagline}
Genre: ${existingVision.genre}
Core Experience: ${existingVision.coreExperience}
Key Features:
${existingVision.keyFeatures.map(f => `- ${f}`).join("\n")}
=== END VISION ===
`
  }

  return `Generate implementation work packets for:

PROJECT NAME: ${projectName}
PROJECT TYPE: ${detection.suggestedCategory}
DETECTED KEYWORDS: ${detection.matchedKeywords.slice(0, 15).join(", ")}
${visionContext}
=== BRAIN DUMP / PROJECT DESCRIPTION ===
${brainDump}
=== END BRAIN DUMP ===

Create comprehensive work packets covering ALL aspects needed to build this ${detection.projectType === "vr" ? "VR " : ""}game.
Be SPECIFIC - extract actual features, mechanics, and systems mentioned in the brain dump.
Include technical packets (setup, architecture) AND content packets (levels, enemies, UI).
Set proper dependencies - foundational systems before features that depend on them.`
}

/**
 * Parse implementation packets response from LLM
 */
function parseImplementationPacketsResponse(response: string): ImplementationPacketResult | null {
  // Try direct parse
  try {
    const parsed = JSON.parse(response.trim())
    if (parsed.packets && Array.isArray(parsed.packets)) {
      return normalizePacketResult(parsed)
    }
  } catch {
    // Continue
  }

  // Remove markdown code blocks
  let cleaned = response
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim()

  // Try to find JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed.packets && Array.isArray(parsed.packets)) {
        return normalizePacketResult(parsed)
      }
    } catch {
      // Try fixing common issues
      try {
        cleaned = jsonMatch[0]
          .replace(/,(\s*[}\]])/g, "$1")
          .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')

        const parsed = JSON.parse(cleaned)
        if (parsed.packets && Array.isArray(parsed.packets)) {
          return normalizePacketResult(parsed)
        }
      } catch {
        // Failed
      }
    }
  }

  return null
}

/**
 * Normalize and validate packet result
 */
function normalizePacketResult(parsed: Record<string, unknown>): ImplementationPacketResult {
  const packets = (parsed.packets as unknown[]).map((p: unknown, index: number) => {
    const packet = p as Record<string, unknown>
    return {
      id: (packet.id as string) || `pkt-${index + 1}`,
      title: (packet.title as string) || "Untitled Task",
      description: (packet.description as string) || "",
      priority: normalizeEnum(packet.priority as string, ["critical", "high", "medium", "low"], "medium") as ImplementationPacket["priority"],
      complexity: normalizeEnum(packet.complexity as string, ["simple", "moderate", "complex", "epic"], "moderate") as ImplementationPacket["complexity"],
      estimatedHours: (packet.estimatedHours as number) || 8,
      dependencies: Array.isArray(packet.dependencies) ? packet.dependencies as string[] : [],
      category: normalizeCategory(packet.category as string),
      tags: Array.isArray(packet.tags) ? packet.tags as string[] : [],
      acceptanceCriteria: Array.isArray(packet.acceptanceCriteria) ? packet.acceptanceCriteria as string[] : [],
      technicalNotes: packet.technicalNotes as string | undefined
    }
  })

  const analysis = parsed.projectAnalysis as Record<string, unknown> | undefined
  const projectAnalysis = {
    detectedFeatures: Array.isArray(analysis?.detectedFeatures) ? analysis.detectedFeatures as string[] : [],
    detectedMechanics: Array.isArray(analysis?.detectedMechanics) ? analysis.detectedMechanics as string[] : [],
    detectedTechnologies: Array.isArray(analysis?.detectedTechnologies) ? analysis.detectedTechnologies as string[] : [],
    suggestedPhases: Array.isArray(analysis?.suggestedPhases) ? analysis.suggestedPhases as string[] : []
  }

  // Calculate summary
  const byPriority: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  const byCategory: Record<string, number> = {}
  const byComplexity: Record<string, number> = { simple: 0, moderate: 0, complex: 0, epic: 0 }
  let estimatedTotalHours = 0

  for (const packet of packets) {
    byPriority[packet.priority] = (byPriority[packet.priority] || 0) + 1
    byCategory[packet.category] = (byCategory[packet.category] || 0) + 1
    byComplexity[packet.complexity] = (byComplexity[packet.complexity] || 0) + 1
    estimatedTotalHours += packet.estimatedHours
  }

  return {
    packets,
    summary: {
      totalPackets: packets.length,
      byPriority,
      byCategory,
      byComplexity,
      estimatedTotalHours
    },
    projectAnalysis
  }
}

/**
 * Normalize enum value
 */
function normalizeEnum<T extends string>(value: string | undefined, allowed: T[], defaultValue: T): T {
  if (!value) return defaultValue
  const lower = value.toLowerCase()
  return allowed.find(a => a === lower) || defaultValue
}

/**
 * Normalize category value
 */
function normalizeCategory(value: string | undefined): ImplementationCategory {
  const categories: ImplementationCategory[] = [
    "project-setup", "core-systems", "player-mechanics", "enemy-ai", "combat",
    "level-design", "ui-ux", "audio", "vfx", "networking", "save-system",
    "optimization", "polish", "testing", "deployment"
  ]
  if (!value) return "core-systems"
  const lower = value.toLowerCase().replace(/_/g, "-")
  return categories.find(c => c === lower) || "core-systems"
}

/**
 * Generate implementation packets for a game/creative project
 *
 * This function analyzes the brain dump content and generates a full set of
 * work packets for actually building the game.
 */
export async function generateGameImplementationPackets(
  projectName: string,
  brainDump: string,
  detection: GameProjectDetection,
  options?: {
    preferredServer?: string
    preferredModel?: string
    existingVision?: GeneratedVision
    maxRetries?: number
  }
): Promise<ImplementationPacketResult | null> {
  const maxRetries = options?.maxRetries ?? 3
  let attempts = 0

  console.log(`[Implementation Packets] Starting generation for: ${projectName}`)
  console.log(`[Implementation Packets] Project type: ${detection.projectType}, Keywords: ${detection.matchedKeywords.length}`)

  while (attempts < maxRetries) {
    attempts++

    // Use detailed prompt on first attempt, simplified on retries
    const systemPrompt = attempts === 1
      ? IMPLEMENTATION_PACKETS_SYSTEM_PROMPT
      : IMPLEMENTATION_PACKETS_SIMPLE_PROMPT

    const userPrompt = generateImplementationPacketsPrompt(
      projectName,
      brainDump,
      detection,
      options?.existingVision
    )

    console.log(`[Implementation Packets] Attempt ${attempts}/${maxRetries}`)

    const response = await generateWithLocalLLM(
      systemPrompt,
      userPrompt,
      {
        temperature: 0.7,
        max_tokens: 8000, // Need more tokens for comprehensive packet list
        preferredServer: options?.preferredServer,
        preferredModel: options?.preferredModel
      }
    )

    if (response.error) {
      console.error(`[Implementation Packets] LLM error on attempt ${attempts}:`, response.error)
      continue
    }

    const parsed = parseImplementationPacketsResponse(response.content)
    if (parsed) {
      console.log(`[Implementation Packets] Successfully generated ${parsed.packets.length} packets on attempt ${attempts}`)
      return parsed
    }

    console.warn(`[Implementation Packets] Failed to parse response on attempt ${attempts}`)
  }

  console.error(`[Implementation Packets] All ${maxRetries} attempts failed`)
  return null
}

/**
 * Generate default implementation packets when AI generation fails
 * Creates a basic set of packets based on project type
 */
export function generateDefaultImplementationPackets(
  projectName: string,
  detection: GameProjectDetection
): ImplementationPacketResult {
  const isVR = detection.projectType === "vr"
  const packets: ImplementationPacket[] = []
  let id = 1

  // Project Setup
  packets.push({
    id: `pkt-${id++}`,
    title: `Set up ${isVR ? "Unity VR" : "game engine"} project`,
    description: `Initialize the game project with the appropriate engine and SDK. ${isVR ? "Configure OpenXR or Oculus SDK for VR support." : ""}`,
    priority: "critical",
    complexity: "moderate",
    estimatedHours: 8,
    dependencies: [],
    category: "project-setup",
    tags: isVR ? ["unity", "vr", "setup"] : ["setup", "architecture"],
    acceptanceCriteria: [
      "Project builds successfully",
      "Version control initialized",
      isVR ? "VR headset recognized and tracking" : "Basic scene renders"
    ].filter(Boolean)
  })

  // Core Systems
  packets.push({
    id: `pkt-${id++}`,
    title: "Create game manager and state machine",
    description: "Implement the core game manager that handles game states (menu, playing, paused, game over).",
    priority: "critical",
    complexity: "moderate",
    estimatedHours: 12,
    dependencies: ["pkt-1"],
    category: "core-systems",
    tags: ["architecture", "state-machine"],
    acceptanceCriteria: [
      "Game states transition correctly",
      "State changes trigger appropriate events",
      "Singleton pattern implemented"
    ]
  })

  // Player Mechanics
  packets.push({
    id: `pkt-${id++}`,
    title: `Implement player controller ${isVR ? "with VR movement" : ""}`,
    description: `Create the player controller ${isVR ? "supporting VR locomotion (teleport, smooth movement), head tracking, and controller input." : "with movement, camera control, and input handling."}`,
    priority: "critical",
    complexity: "complex",
    estimatedHours: 16,
    dependencies: ["pkt-1", "pkt-2"],
    category: "player-mechanics",
    tags: isVR ? ["vr", "locomotion", "player"] : ["player", "movement"],
    acceptanceCriteria: [
      "Player can move in all directions",
      isVR ? "Teleport and smooth locomotion work" : "Camera follows player",
      "Input responds correctly"
    ].filter(Boolean)
  })

  if (isVR) {
    packets.push({
      id: `pkt-${id++}`,
      title: "Implement VR hand interactions",
      description: "Create hand presence with grab, point, and interact capabilities. Support both controller types.",
      priority: "high",
      complexity: "complex",
      estimatedHours: 20,
      dependencies: ["pkt-3"],
      category: "player-mechanics",
      tags: ["vr", "hands", "interaction"],
      acceptanceCriteria: [
        "Hands track controller position/rotation",
        "Can grab and release objects",
        "Point and interact with UI"
      ]
    })
  }

  // Combat/Gameplay
  packets.push({
    id: `pkt-${id++}`,
    title: "Create weapon system",
    description: "Implement weapon handling including melee and ranged weapons. Support switching, aiming, and firing.",
    priority: "high",
    complexity: "complex",
    estimatedHours: 24,
    dependencies: ["pkt-3"],
    category: "combat",
    tags: ["weapons", "combat"],
    acceptanceCriteria: [
      "Weapons can be equipped and used",
      "Melee attacks deal damage",
      "Ranged weapons fire projectiles"
    ]
  })

  packets.push({
    id: `pkt-${id++}`,
    title: "Implement health and damage system",
    description: "Create health system for player and enemies. Handle damage, healing, death, and respawn.",
    priority: "high",
    complexity: "moderate",
    estimatedHours: 12,
    dependencies: ["pkt-2"],
    category: "combat",
    tags: ["health", "damage"],
    acceptanceCriteria: [
      "Entities have health that decreases when damaged",
      "Death triggers appropriate response",
      "Health UI updates correctly"
    ]
  })

  // Enemy AI
  packets.push({
    id: `pkt-${id++}`,
    title: "Implement enemy AI with pathfinding",
    description: "Create AI enemies using NavMesh for pathfinding. Implement basic behaviors: patrol, chase, attack.",
    priority: "high",
    complexity: "complex",
    estimatedHours: 24,
    dependencies: ["pkt-2", `pkt-${id - 2}`],
    category: "enemy-ai",
    tags: ["ai", "navmesh", "enemies"],
    acceptanceCriteria: [
      "Enemies navigate using NavMesh",
      "AI detects and pursues player",
      "Attack behavior works correctly"
    ]
  })

  packets.push({
    id: `pkt-${id++}`,
    title: "Create enemy spawn system",
    description: "Implement spawn points and wave-based spawning for enemies. Support difficulty scaling.",
    priority: "medium",
    complexity: "moderate",
    estimatedHours: 12,
    dependencies: [`pkt-${id - 2}`],
    category: "enemy-ai",
    tags: ["spawning", "waves"],
    acceptanceCriteria: [
      "Enemies spawn at designated points",
      "Wave system triggers correctly",
      "Difficulty scales appropriately"
    ]
  })

  // Level Design
  packets.push({
    id: `pkt-${id++}`,
    title: "Build first level environment",
    description: "Create the first playable level with terrain, props, and navigation setup.",
    priority: "high",
    complexity: "complex",
    estimatedHours: 32,
    dependencies: ["pkt-1", `pkt-${id - 3}`],
    category: "level-design",
    tags: ["level", "environment"],
    acceptanceCriteria: [
      "Level is navigable",
      "NavMesh baked correctly",
      "Lighting and atmosphere set"
    ]
  })

  // UI
  packets.push({
    id: `pkt-${id++}`,
    title: `Create main menu ${isVR ? "UI (VR spatial)" : ""}`,
    description: `Implement the main menu with start, options, and quit. ${isVR ? "Use spatial UI that works in VR." : ""}`,
    priority: "medium",
    complexity: "moderate",
    estimatedHours: 12,
    dependencies: ["pkt-2"],
    category: "ui-ux",
    tags: isVR ? ["ui", "vr", "menu"] : ["ui", "menu"],
    acceptanceCriteria: [
      "Menu displays correctly",
      "Buttons are interactive",
      "Transitions to gameplay work"
    ]
  })

  packets.push({
    id: `pkt-${id++}`,
    title: "Implement in-game HUD",
    description: `Create heads-up display showing health, ammo, objectives. ${isVR ? "Use world-space UI attached to player." : ""}`,
    priority: "medium",
    complexity: "moderate",
    estimatedHours: 10,
    dependencies: [`pkt-${id - 7}`],
    category: "ui-ux",
    tags: ["ui", "hud"],
    acceptanceCriteria: [
      "HUD shows current health",
      "Ammo/weapon info displayed",
      "Updates in real-time"
    ]
  })

  // Audio
  packets.push({
    id: `pkt-${id++}`,
    title: "Add sound effects",
    description: `Implement sound effects for weapons, enemies, UI, and environment. ${isVR ? "Use spatial audio for 3D positioning." : ""}`,
    priority: "medium",
    complexity: "moderate",
    estimatedHours: 16,
    dependencies: [`pkt-${id - 9}`, `pkt-${id - 6}`],
    category: "audio",
    tags: isVR ? ["audio", "spatial", "sfx"] : ["audio", "sfx"],
    acceptanceCriteria: [
      "All actions have appropriate sounds",
      isVR ? "Sounds are properly spatialized" : "Audio levels are balanced",
      "Sound variations implemented"
    ].filter(Boolean)
  })

  packets.push({
    id: `pkt-${id++}`,
    title: "Add music system",
    description: "Implement background music with dynamic layers that respond to gameplay intensity.",
    priority: "low",
    complexity: "moderate",
    estimatedHours: 12,
    dependencies: ["pkt-2"],
    category: "audio",
    tags: ["audio", "music"],
    acceptanceCriteria: [
      "Music plays during gameplay",
      "Transitions between states smoothly",
      "Volume controls work"
    ]
  })

  // Save System
  packets.push({
    id: `pkt-${id++}`,
    title: "Implement save/load system",
    description: "Create save system for game progress, settings, and statistics. Support multiple save slots.",
    priority: "medium",
    complexity: "moderate",
    estimatedHours: 16,
    dependencies: ["pkt-2"],
    category: "save-system",
    tags: ["persistence", "save"],
    acceptanceCriteria: [
      "Game state saves correctly",
      "Load restores full state",
      "Multiple save slots work"
    ]
  })

  // Polish
  packets.push({
    id: `pkt-${id++}`,
    title: "Performance optimization pass",
    description: "Optimize rendering, physics, and AI for target framerate. Critical for VR comfort.",
    priority: "high",
    complexity: "complex",
    estimatedHours: 24,
    dependencies: packets.map(p => p.id),
    category: "optimization",
    tags: ["performance", "optimization"],
    acceptanceCriteria: [
      isVR ? "Maintains 90fps on target hardware" : "Maintains 60fps on target hardware",
      "No major frame drops",
      "Memory usage optimized"
    ].filter(Boolean)
  })

  // Calculate summary
  const byPriority: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  const byCategory: Record<string, number> = {}
  const byComplexity: Record<string, number> = { simple: 0, moderate: 0, complex: 0, epic: 0 }
  let estimatedTotalHours = 0

  for (const packet of packets) {
    byPriority[packet.priority]++
    byCategory[packet.category] = (byCategory[packet.category] || 0) + 1
    byComplexity[packet.complexity]++
    estimatedTotalHours += packet.estimatedHours
  }

  return {
    packets,
    summary: {
      totalPackets: packets.length,
      byPriority,
      byCategory,
      byComplexity,
      estimatedTotalHours
    },
    projectAnalysis: {
      detectedFeatures: [
        "Player movement",
        "Combat system",
        "Enemy AI",
        "Level design",
        "UI/UX",
        "Audio",
        "Save system"
      ],
      detectedMechanics: isVR
        ? ["VR locomotion", "Hand interactions", "Spatial UI", "3D audio"]
        : ["Movement", "Combat", "Health system"],
      detectedTechnologies: isVR
        ? ["Unity", "VR SDK", "NavMesh", "Spatial Audio"]
        : ["Game Engine", "NavMesh"],
      suggestedPhases: [
        "Phase 1: Foundation (Setup & Core)",
        "Phase 2: Gameplay (Player, Enemies, Combat)",
        "Phase 3: Content (Levels, UI, Audio)",
        "Phase 4: Polish (Optimization, Testing)"
      ]
    }
  }
}

/**
 * Convert implementation packets to work packets format
 * This allows integration with the existing build plan system
 */
export function implementationToWorkPackets(
  result: ImplementationPacketResult,
  phaseId: string
): Array<{
  id: string
  phaseId: string
  title: string
  description: string
  type: "feature" | "config" | "test"
  priority: "critical" | "high" | "medium" | "low"
  status: "queued"
  tasks: Array<{ id: string; description: string; completed: boolean; order: number }>
  suggestedTaskType: string
  acceptanceCriteria: string[]
  estimatedTokens: number
  dependencies: string[]
  metadata: {
    source: "implementation-generator"
    category: ImplementationCategory
    complexity: string
    estimatedHours: number
    tags: string[]
    technicalNotes?: string
  }
}> {
  return result.packets.map(packet => {
    // Map category to packet type
    let type: "feature" | "config" | "test" = "feature"
    if (packet.category === "project-setup") type = "config"
    if (packet.category === "testing") type = "test"

    // Create tasks from acceptance criteria
    const tasks = packet.acceptanceCriteria.map((criterion, index) => ({
      id: `${packet.id}-task-${index + 1}`,
      description: criterion,
      completed: false,
      order: index
    }))

    // If no tasks, create one from the title
    if (tasks.length === 0) {
      tasks.push({
        id: `${packet.id}-task-1`,
        description: packet.title,
        completed: false,
        order: 0
      })
    }

    // Estimate tokens based on complexity
    const tokenMultiplier = {
      simple: 2000,
      moderate: 4000,
      complex: 8000,
      epic: 16000
    }

    return {
      id: packet.id,
      phaseId,
      title: packet.title,
      description: packet.description + (packet.technicalNotes ? `\n\nTechnical Notes: ${packet.technicalNotes}` : ""),
      type,
      priority: packet.priority,
      status: "queued" as const,
      tasks,
      suggestedTaskType: packet.category === "testing" ? "testing" : "coding",
      acceptanceCriteria: packet.acceptanceCriteria,
      estimatedTokens: tokenMultiplier[packet.complexity] || 4000,
      dependencies: packet.dependencies,
      metadata: {
        source: "implementation-generator" as const,
        category: packet.category,
        complexity: packet.complexity,
        estimatedHours: packet.estimatedHours,
        tags: packet.tags,
        technicalNotes: packet.technicalNotes
      }
    }
  })
}

export function createDefaultVisionPacket(
  phaseId: string,
  projectName: string,
  projectDescription: string,
  detection: GameProjectDetection
): VisionPacket {
  const packetId = `vision-${generateId()}`

  const defaultDescription = `
# ${projectName} - Vision & Store Description

## About This ${detection.suggestedCategory}

${projectDescription}

## Project Vision

This vision packet represents the ultimate goal for ${projectName}. Complete this packet when:
- All planned features are implemented
- The project matches its original vision
- No major bugs or issues remain
- Ready for release/publication

---
*Note: This is a default vision packet. For a more detailed store-style description, ensure an LLM is available and re-generate the build plan.*
`.trim()

  return {
    id: packetId,
    phaseId,
    title: `${projectName} - Vision & Store Description`,
    description: defaultDescription,
    type: "vision",
    priority: "critical",
    status: "queued",
    tasks: [
      {
        id: `${packetId}-task-1`,
        description: "All planned features implemented",
        completed: false,
        order: 0
      },
      {
        id: `${packetId}-task-2`,
        description: "Project matches original vision",
        completed: false,
        order: 1
      },
      {
        id: `${packetId}-task-3`,
        description: "No major bugs or missing features",
        completed: false,
        order: 2
      },
      {
        id: `${packetId}-task-4`,
        description: "Ready for release",
        completed: false,
        order: 3
      }
    ],
    suggestedTaskType: "review",
    acceptanceCriteria: [
      "All planned features are implemented and working",
      "No critical or high-priority bugs remain",
      "Project is polished enough for release"
    ],
    estimatedTokens: 0,
    dependencies: [],
    metadata: {
      source: "vision-generator",
      projectType: detection.projectType,
      storeDescription: projectDescription,
      tagline: `A ${detection.suggestedCategory.toLowerCase()} project`,
      keyFeatures: [],
      targetAudience: "General audience",
      uniqueSellingPoints: [],
      isVisionPacket: true,
      completionGate: true
    }
  }
}
