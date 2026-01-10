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

/**
 * Keywords that indicate a game or creative project
 */
export const GAME_CREATIVE_KEYWORDS = {
  // Primary indicators (strong signal)
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
    "story",
    "storyline",
    "plot",
    "narrative",
    "character",
    "characters",
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
    "simulation",
    "sim",
    "sandbox",
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
  secondary: [
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
    "animation",
    "cinematics",
    "trailer",
    "demo",
    "alpha",
    "beta",
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
 */
export function detectGameOrCreativeProject(
  projectName: string,
  projectDescription: string,
  issueContent?: string[]
): GameProjectDetection {
  const allText = [
    projectName,
    projectDescription,
    ...(issueContent || [])
  ].join(" ").toLowerCase()

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
  const totalScore = primaryMatches * 3 + secondaryMatches * 2 + creativeMatches * 2
  let confidence: "high" | "medium" | "low"
  let isGameOrCreative = false
  let projectType: "game" | "vr" | "creative" | "interactive" | "standard" = "standard"
  let suggestedCategory = "Software"

  if (totalScore >= 10 || primaryMatches >= 3) {
    confidence = "high"
    isGameOrCreative = true
  } else if (totalScore >= 5 || primaryMatches >= 2) {
    confidence = "medium"
    isGameOrCreative = true
  } else if (totalScore >= 2 || primaryMatches >= 1) {
    confidence = "low"
    isGameOrCreative = true
  } else {
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
 * Create a default vision packet when AI generation fails
 */
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
