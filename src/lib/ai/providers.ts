/**
 * AI Provider & Model Registry
 *
 * Manages available AI providers, models, and their capabilities.
 * Supports local models (LM Studio, Ollama) and cloud providers
 * (Anthropic, OpenAI, Google).
 *
 * LOCAL MODELS ARE ALWAYS PRIORITIZED OVER PAID CLOUD SERVICES.
 */

export type ProviderType = "local" | "cloud" | "cli"
export type ProviderName = "lmstudio" | "ollama" | "anthropic" | "openai" | "google" | "claude-code"

export interface AIModel {
  id: string
  name: string
  provider: ProviderName
  type: ProviderType
  contextWindow: number
  maxOutput: number
  strengths: ModelStrength[]
  costPer1kTokens?: number // undefined = free (local)
  speed: "fast" | "medium" | "slow"
  quality: "standard" | "high" | "frontier"
}

export type ModelStrength =
  | "coding"
  | "reasoning"
  | "creative"
  | "analysis"
  | "long-context"
  | "fast-iteration"
  | "planning"
  | "documentation"
  | "testing"
  | "refactoring"

export interface AIProvider {
  id: ProviderName
  name: string
  type: ProviderType
  description: string
  configurable: boolean
  models: AIModel[]
  defaultModel?: string
  apiKeyEnvVar?: string
  baseUrlEnvVar?: string
  usesCli?: boolean  // True for providers that use CLI execution (like Claude Code Max)
  requiresApiKey?: boolean  // False for providers that don't need API keys (like Claude Code Max)
}

/**
 * Known model patterns and their capabilities
 * Used to enrich dynamically fetched models with capability metadata
 * Patterns are matched against model IDs (case-insensitive)
 */
export const KNOWN_MODEL_PATTERNS: Array<{
  pattern: RegExp
  capabilities: Partial<AIModel>
}> = [
  // === Anthropic ===
  // Opus models - frontier reasoning
  {
    pattern: /claude.*opus.*4\.5|claude-opus-4-5/i,
    capabilities: {
      strengths: ["coding", "reasoning", "analysis", "planning", "long-context"],
      costPer1kTokens: 0.015,
      speed: "slow",
      quality: "frontier"
    }
  },
  {
    pattern: /claude.*opus.*4|claude-opus-4/i,
    capabilities: {
      strengths: ["coding", "reasoning", "analysis", "planning", "long-context"],
      costPer1kTokens: 0.015,
      speed: "slow",
      quality: "frontier"
    }
  },
  // Sonnet models - balanced
  {
    pattern: /claude.*sonnet.*4|claude-sonnet-4/i,
    capabilities: {
      strengths: ["coding", "reasoning", "fast-iteration"],
      costPer1kTokens: 0.003,
      speed: "medium",
      quality: "high"
    }
  },
  {
    pattern: /claude.*sonnet.*3\.5|claude-3-5-sonnet/i,
    capabilities: {
      strengths: ["coding", "reasoning", "fast-iteration"],
      costPer1kTokens: 0.003,
      speed: "medium",
      quality: "high"
    }
  },
  // Haiku models - fast
  {
    pattern: /claude.*haiku/i,
    capabilities: {
      strengths: ["fast-iteration", "documentation"],
      costPer1kTokens: 0.00025,
      speed: "fast",
      quality: "standard"
    }
  },

  // === OpenAI ===
  // GPT-5 series
  {
    pattern: /gpt-?5/i,
    capabilities: {
      strengths: ["coding", "reasoning", "creative", "analysis", "planning"],
      costPer1kTokens: 0.01,
      speed: "medium",
      quality: "frontier"
    }
  },
  // GPT-4o series
  {
    pattern: /gpt-?4o-?mini/i,
    capabilities: {
      strengths: ["fast-iteration", "coding"],
      costPer1kTokens: 0.00015,
      speed: "fast",
      quality: "standard"
    }
  },
  {
    pattern: /gpt-?4o/i,
    capabilities: {
      strengths: ["coding", "reasoning", "creative"],
      costPer1kTokens: 0.005,
      speed: "medium",
      quality: "high"
    }
  },
  // o-series reasoning models
  {
    pattern: /^o4/i,
    capabilities: {
      strengths: ["reasoning", "planning", "analysis", "coding"],
      costPer1kTokens: 0.02,
      speed: "slow",
      quality: "frontier"
    }
  },
  {
    pattern: /^o3(?!-mini)/i,
    capabilities: {
      strengths: ["reasoning", "planning", "analysis"],
      costPer1kTokens: 0.015,
      speed: "slow",
      quality: "frontier"
    }
  },
  {
    pattern: /^o3-mini/i,
    capabilities: {
      strengths: ["reasoning", "coding", "fast-iteration"],
      costPer1kTokens: 0.0011,
      speed: "medium",
      quality: "high"
    }
  },
  {
    pattern: /^o1(?!-mini)/i,
    capabilities: {
      strengths: ["reasoning", "planning", "analysis"],
      costPer1kTokens: 0.015,
      speed: "slow",
      quality: "frontier"
    }
  },
  {
    pattern: /^o1-mini/i,
    capabilities: {
      strengths: ["reasoning", "coding"],
      costPer1kTokens: 0.003,
      speed: "medium",
      quality: "high"
    }
  },

  // === Google ===
  // Gemini 3 series
  {
    pattern: /gemini.*3.*ultra/i,
    capabilities: {
      strengths: ["long-context", "reasoning", "coding", "analysis"],
      costPer1kTokens: 0.005,
      speed: "slow",
      quality: "frontier"
    }
  },
  {
    pattern: /gemini.*3.*pro/i,
    capabilities: {
      strengths: ["long-context", "reasoning", "coding"],
      costPer1kTokens: 0.002,
      speed: "medium",
      quality: "high"
    }
  },
  {
    pattern: /gemini.*3.*flash/i,
    capabilities: {
      strengths: ["long-context", "fast-iteration", "analysis"],
      costPer1kTokens: 0.0002,
      speed: "fast",
      quality: "standard"
    }
  },
  // Gemini 2 series
  {
    pattern: /gemini.*2.*pro/i,
    capabilities: {
      strengths: ["long-context", "reasoning", "coding"],
      costPer1kTokens: 0.00125,
      speed: "medium",
      quality: "high"
    }
  },
  {
    pattern: /gemini.*2.*flash/i,
    capabilities: {
      strengths: ["long-context", "fast-iteration", "analysis"],
      costPer1kTokens: 0.0001,
      speed: "fast",
      quality: "standard"
    }
  },
  // Gemini 1.5 series
  {
    pattern: /gemini.*1\.5/i,
    capabilities: {
      strengths: ["long-context", "analysis"],
      costPer1kTokens: 0.001,
      speed: "medium",
      quality: "high"
    }
  },

  // === Local models ===
  {
    pattern: /llama.*3.*70b/i,
    capabilities: {
      strengths: ["coding", "reasoning", "analysis"],
      speed: "slow",
      quality: "high"
    }
  },
  {
    pattern: /llama.*3/i,
    capabilities: {
      strengths: ["coding", "reasoning"],
      speed: "medium",
      quality: "standard"
    }
  },
  {
    pattern: /qwen.*coder/i,
    capabilities: {
      strengths: ["coding", "fast-iteration"],
      speed: "fast",
      quality: "standard"
    }
  },
  {
    pattern: /deepseek.*coder/i,
    capabilities: {
      strengths: ["coding", "reasoning"],
      speed: "medium",
      quality: "high"
    }
  },
  {
    pattern: /codellama/i,
    capabilities: {
      strengths: ["coding", "fast-iteration"],
      speed: "fast",
      quality: "standard"
    }
  },
  {
    pattern: /mistral/i,
    capabilities: {
      strengths: ["coding", "reasoning"],
      speed: "medium",
      quality: "standard"
    }
  }
]

// Default capabilities for unknown models
const DEFAULT_CAPABILITIES: Partial<AIModel> = {
  strengths: ["coding", "reasoning"],
  speed: "medium",
  quality: "standard"
}

/**
 * Get capabilities for a model ID by matching against known patterns
 */
export function getModelCapabilities(modelId: string): Partial<AIModel> {
  for (const { pattern, capabilities } of KNOWN_MODEL_PATTERNS) {
    if (pattern.test(modelId)) {
      return capabilities
    }
  }
  return DEFAULT_CAPABILITIES
}

/**
 * Enrich a dynamically fetched model with capability metadata
 */
export function enrichModelWithCapabilities(
  model: { id: string; name: string; provider: string; type: "local" | "cloud"; contextWindow?: number; maxOutput?: number }
): AIModel {
  const capabilities = getModelCapabilities(model.id)
  return {
    id: model.id,
    name: model.name,
    provider: model.provider as ProviderName,
    type: model.type,
    contextWindow: model.contextWindow || 128000,
    maxOutput: model.maxOutput || 8192,
    strengths: capabilities.strengths || ["coding", "reasoning"],
    costPer1kTokens: capabilities.costPer1kTokens,
    speed: capabilities.speed || "medium",
    quality: capabilities.quality || "standard"
  }
}

// Provider definitions
export const AI_PROVIDERS: AIProvider[] = [
  {
    id: "lmstudio",
    name: "LM Studio",
    type: "local",
    description: "Local models via LM Studio - FREE, privacy-first",
    configurable: true,
    baseUrlEnvVar: "NEXT_PUBLIC_LMSTUDIO_SERVER_1",
    models: [], // Populated dynamically
    defaultModel: "loaded-model"
  },
  {
    id: "ollama",
    name: "Ollama",
    type: "local",
    description: "Local models via Ollama - FREE, privacy-first",
    configurable: true,
    baseUrlEnvVar: "NEXT_PUBLIC_OLLAMA_URL",
    models: [], // Populated dynamically
    defaultModel: "llama3"
  },
  {
    id: "anthropic",
    name: "Anthropic",
    type: "cloud",
    description: "Claude models - Best for coding and reasoning",
    configurable: true,
    apiKeyEnvVar: "ANTHROPIC_API_KEY",
    models: [] // Populated dynamically via /api/models
  },
  {
    id: "openai",
    name: "OpenAI",
    type: "cloud",
    description: "GPT and o-series models",
    configurable: true,
    apiKeyEnvVar: "OPENAI_API_KEY",
    models: [] // Populated dynamically via /api/models
  },
  {
    id: "google",
    name: "Google AI",
    type: "cloud",
    description: "Gemini models - Best for long context",
    configurable: true,
    apiKeyEnvVar: "GOOGLE_AI_API_KEY",
    models: [] // Populated dynamically via /api/models
  },
  {
    id: "claude-code",
    name: "Claude Code",
    type: "cli",
    description: "Claude Code CLI with Max subscription - No API key needed",
    configurable: true,
    usesCli: true,
    requiresApiKey: false,
    models: [
      {
        id: "claude-opus-4-20250514",
        name: "Claude Opus 4",
        provider: "claude-code",
        type: "cli",
        contextWindow: 200000,
        maxOutput: 32000,
        strengths: ["coding", "reasoning", "analysis", "planning", "long-context"],
        costPer1kTokens: 0.015,
        speed: "slow",
        quality: "frontier"
      },
      {
        id: "claude-sonnet-4-20250514",
        name: "Claude Sonnet 4",
        provider: "claude-code",
        type: "cli",
        contextWindow: 200000,
        maxOutput: 16000,
        strengths: ["coding", "reasoning", "fast-iteration"],
        costPer1kTokens: 0.003,
        speed: "medium",
        quality: "high"
      },
      {
        id: "claude-3-5-haiku-20241022",
        name: "Claude Haiku",
        provider: "claude-code",
        type: "cli",
        contextWindow: 200000,
        maxOutput: 8192,
        strengths: ["fast-iteration", "documentation"],
        costPer1kTokens: 0.00025,
        speed: "fast",
        quality: "standard"
      }
    ],
    defaultModel: "claude-sonnet-4-20250514"
  }
]

// Task types and their ideal model characteristics
export interface TaskTypeConfig {
  id: string
  name: string
  description: string
  preferredStrengths: ModelStrength[]
  preferredQuality: AIModel["quality"][]
  preferredSpeed: AIModel["speed"][]
  maxCostPer1kTokens?: number // Budget constraint
}

export const TASK_TYPES: TaskTypeConfig[] = [
  {
    id: "planning",
    name: "Build Planning",
    description: "Project planning, architecture design, specifications",
    preferredStrengths: ["planning", "reasoning", "analysis"],
    preferredQuality: ["frontier", "high"],
    preferredSpeed: ["slow", "medium"]
  },
  {
    id: "coding",
    name: "Code Generation",
    description: "Writing new code, implementing features",
    preferredStrengths: ["coding", "reasoning"],
    preferredQuality: ["high", "frontier"],
    preferredSpeed: ["medium", "slow"]
  },
  {
    id: "refactoring",
    name: "Refactoring",
    description: "Improving existing code structure",
    preferredStrengths: ["refactoring", "coding", "analysis"],
    preferredQuality: ["high", "standard"],
    preferredSpeed: ["medium", "fast"]
  },
  {
    id: "testing",
    name: "Test Generation",
    description: "Writing tests, test cases",
    preferredStrengths: ["testing", "coding"],
    preferredQuality: ["standard", "high"],
    preferredSpeed: ["fast", "medium"]
  },
  {
    id: "documentation",
    name: "Documentation",
    description: "Writing docs, comments, READMEs",
    preferredStrengths: ["documentation", "creative"],
    preferredQuality: ["standard"],
    preferredSpeed: ["fast"]
  },
  {
    id: "review",
    name: "Code Review",
    description: "Reviewing code, finding issues",
    preferredStrengths: ["analysis", "coding", "reasoning"],
    preferredQuality: ["high", "frontier"],
    preferredSpeed: ["medium"]
  },
  {
    id: "debugging",
    name: "Debugging",
    description: "Finding and fixing bugs",
    preferredStrengths: ["reasoning", "analysis", "coding"],
    preferredQuality: ["high", "frontier"],
    preferredSpeed: ["medium", "slow"]
  },
  {
    id: "iteration",
    name: "Quick Iteration",
    description: "Fast fixes, small changes",
    preferredStrengths: ["fast-iteration", "coding"],
    preferredQuality: ["standard"],
    preferredSpeed: ["fast"],
    maxCostPer1kTokens: 0.001
  }
]

/**
 * Score a model for a given task type
 * Higher score = better fit
 */
export function scoreModelForTask(model: AIModel, taskType: TaskTypeConfig): number {
  let score = 0

  // Strength match (0-50 points)
  const strengthMatches = model.strengths.filter(s =>
    taskType.preferredStrengths.includes(s)
  ).length
  score += (strengthMatches / taskType.preferredStrengths.length) * 50

  // Quality match (0-25 points)
  const qualityIndex = taskType.preferredQuality.indexOf(model.quality)
  if (qualityIndex >= 0) {
    score += 25 - (qualityIndex * 8)
  }

  // Speed match (0-15 points)
  const speedIndex = taskType.preferredSpeed.indexOf(model.speed)
  if (speedIndex >= 0) {
    score += 15 - (speedIndex * 5)
  }

  // Cost constraint (pass/fail)
  if (taskType.maxCostPer1kTokens && model.costPer1kTokens) {
    if (model.costPer1kTokens > taskType.maxCostPer1kTokens) {
      score = 0 // Disqualify
    }
  }

  // Bonus for local models (privacy + free)
  if (model.type === "local") {
    score += 10
  }

  return score
}

/**
 * Get best models for a task from available models
 */
export function getBestModelsForTask(
  availableModels: AIModel[],
  taskTypeId: string,
  limit: number = 3
): AIModel[] {
  const taskType = TASK_TYPES.find(t => t.id === taskTypeId)
  if (!taskType) return availableModels.slice(0, limit)

  const scored = availableModels.map(model => ({
    model,
    score: scoreModelForTask(model, taskType)
  }))

  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, limit).map(s => s.model)
}

/**
 * Get provider by ID
 */
export function getProvider(id: ProviderName): AIProvider | undefined {
  return AI_PROVIDERS.find(p => p.id === id)
}

/**
 * Get all local providers
 */
export function getLocalProviders(): AIProvider[] {
  return AI_PROVIDERS.filter(p => p.type === "local")
}

/**
 * Get all cloud providers
 */
export function getCloudProviders(): AIProvider[] {
  return AI_PROVIDERS.filter(p => p.type === "cloud")
}

/**
 * Get all CLI providers (like Claude Code)
 */
export function getCliProviders(): AIProvider[] {
  return AI_PROVIDERS.filter(p => p.type === "cli")
}

/**
 * Get all non-local providers (cloud + CLI)
 * Useful for dropdowns that should show all remote/paid options
 */
export function getRemoteProviders(): AIProvider[] {
  return AI_PROVIDERS.filter(p => p.type === "cloud" || p.type === "cli")
}

/**
 * Model preference patterns for selecting recommended defaults
 * Higher index = higher priority within same provider
 */
const MODEL_PREFERENCE_ORDER: Record<string, RegExp[]> = {
  anthropic: [
    /claude.*opus.*4\.5/i,      // Opus 4.5 (latest flagship)
    /claude.*opus.*4/i,         // Opus 4
    /claude.*sonnet.*4/i,       // Sonnet 4
    /claude.*sonnet.*3\.5/i,    // Sonnet 3.5
    /claude.*opus/i,            // Any Opus
    /claude.*sonnet/i,          // Any Sonnet
  ],
  openai: [
    /gpt-?5\.2/i,               // GPT 5.2 (latest)
    /gpt-?5\.1/i,               // GPT 5.1
    /gpt-?5/i,                  // GPT 5.x
    /^o4(?!-mini)/i,            // o4 (reasoning flagship)
    /^o3(?!-mini)/i,            // o3 (reasoning)
    /gpt-?4o(?!-mini)/i,        // GPT-4o (not mini)
    /^o3-mini/i,                // o3-mini
    /gpt-?4o-mini/i,            // GPT-4o-mini
  ],
  google: [
    /gemini.*3.*ultra/i,        // Gemini 3 Ultra (flagship)
    /gemini.*3.*pro/i,          // Gemini 3 Pro
    /gemini.*3.*flash/i,        // Gemini 3 Flash
    /gemini.*2\.5.*pro/i,       // Gemini 2.5 Pro
    /gemini.*2\.5.*flash/i,     // Gemini 2.5 Flash
    /gemini.*2.*pro/i,          // Gemini 2.x Pro
    /gemini.*2.*flash/i,        // Gemini 2.x Flash
    /gemini.*pro/i,             // Any Gemini Pro
  ],
  lmstudio: [
    /qwen.*coder.*32b/i,        // Large coding models
    /deepseek.*coder.*33b/i,
    /llama.*3.*70b/i,
    /mistral.*large/i,
    /./,                        // Any model (just pick first available)
  ],
  ollama: [
    /llama.*3.*70b/i,
    /qwen.*coder/i,
    /deepseek.*coder/i,
    /codellama/i,
    /./,                        // Any model
  ],
  "claude-code": [
    /claude.*opus.*4/i,         // Opus 4 (most capable)
    /claude.*sonnet.*4/i,       // Sonnet 4 (balanced)
    /claude.*haiku/i,           // Haiku (fast)
    /./,                        // Any model
  ]
}

/**
 * Select the recommended default model from a list of fetched models for a provider
 * Returns the best match based on model preference order
 */
export function getRecommendedModel(
  models: Array<{ id: string; name: string; provider: string }>,
  provider: string
): { id: string; name: string; provider: string } | undefined {
  const providerModels = models.filter(m => m.provider === provider)
  if (providerModels.length === 0) return undefined

  const preferences = MODEL_PREFERENCE_ORDER[provider]
  if (!preferences) {
    // No preference defined, return first model
    return providerModels[0]
  }

  // Find first matching model in preference order
  for (const pattern of preferences) {
    const match = providerModels.find(m => pattern.test(m.id))
    if (match) return match
  }

  // Fallback to first model if no preference matches
  return providerModels[0]
}

/**
 * Get recommended models for all providers from a fetched model list
 */
export function getRecommendedModels(
  models: Array<{ id: string; name: string; provider: string }>
): Record<string, { id: string; name: string; provider: string } | undefined> {
  const providers = ["anthropic", "openai", "google", "lmstudio", "ollama", "claude-code"]
  const recommendations: Record<string, { id: string; name: string; provider: string } | undefined> = {}

  for (const provider of providers) {
    recommendations[provider] = getRecommendedModel(models, provider)
  }

  return recommendations
}
