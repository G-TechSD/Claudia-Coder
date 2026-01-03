/**
 * AI Provider & Model Registry
 *
 * Manages available AI providers, models, and their capabilities.
 * Supports local models (LM Studio, Ollama) and cloud providers
 * (Anthropic, OpenAI, Google).
 *
 * LOCAL MODELS ARE ALWAYS PRIORITIZED OVER PAID CLOUD SERVICES.
 */

export type ProviderType = "local" | "cloud"
export type ProviderName = "lmstudio" | "ollama" | "anthropic" | "openai" | "google"

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
}

// Known models and their capabilities
export const KNOWN_MODELS: Record<string, Partial<AIModel>> = {
  // Local models (capabilities vary by specific model loaded)
  "local-general": {
    strengths: ["coding", "reasoning", "analysis"],
    speed: "medium",
    quality: "standard"
  },

  // Anthropic
  "claude-opus-4": {
    name: "Claude Opus 4",
    contextWindow: 200000,
    maxOutput: 32000,
    strengths: ["coding", "reasoning", "analysis", "planning", "long-context"],
    costPer1kTokens: 0.015,
    speed: "slow",
    quality: "frontier"
  },
  "claude-sonnet-4": {
    name: "Claude Sonnet 4",
    contextWindow: 200000,
    maxOutput: 16000,
    strengths: ["coding", "reasoning", "fast-iteration"],
    costPer1kTokens: 0.003,
    speed: "medium",
    quality: "high"
  },
  "claude-haiku-3.5": {
    name: "Claude Haiku 3.5",
    contextWindow: 200000,
    maxOutput: 8000,
    strengths: ["fast-iteration", "documentation"],
    costPer1kTokens: 0.00025,
    speed: "fast",
    quality: "standard"
  },

  // OpenAI
  "gpt-4o": {
    name: "GPT-4o",
    contextWindow: 128000,
    maxOutput: 16384,
    strengths: ["coding", "reasoning", "creative"],
    costPer1kTokens: 0.005,
    speed: "medium",
    quality: "high"
  },
  "gpt-4o-mini": {
    name: "GPT-4o Mini",
    contextWindow: 128000,
    maxOutput: 16384,
    strengths: ["fast-iteration", "coding"],
    costPer1kTokens: 0.00015,
    speed: "fast",
    quality: "standard"
  },
  "o1": {
    name: "o1",
    contextWindow: 200000,
    maxOutput: 100000,
    strengths: ["reasoning", "planning", "analysis"],
    costPer1kTokens: 0.015,
    speed: "slow",
    quality: "frontier"
  },
  "o3-mini": {
    name: "o3-mini",
    contextWindow: 200000,
    maxOutput: 100000,
    strengths: ["reasoning", "coding", "fast-iteration"],
    costPer1kTokens: 0.0011,
    speed: "medium",
    quality: "high"
  },

  // Google
  "gemini-2.0-flash": {
    name: "Gemini 2.0 Flash",
    contextWindow: 1000000,
    maxOutput: 8192,
    strengths: ["long-context", "fast-iteration", "analysis"],
    costPer1kTokens: 0.0001,
    speed: "fast",
    quality: "standard"
  },
  "gemini-2.0-pro": {
    name: "Gemini 2.0 Pro",
    contextWindow: 2000000,
    maxOutput: 8192,
    strengths: ["long-context", "reasoning", "coding"],
    costPer1kTokens: 0.00125,
    speed: "medium",
    quality: "high"
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
    baseUrlEnvVar: "NEXT_PUBLIC_LMSTUDIO_BEAST",
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
    models: [
      {
        id: "claude-opus-4-20250514",
        provider: "anthropic",
        type: "cloud",
        ...KNOWN_MODELS["claude-opus-4"]
      } as AIModel,
      {
        id: "claude-sonnet-4-20250514",
        provider: "anthropic",
        type: "cloud",
        ...KNOWN_MODELS["claude-sonnet-4"]
      } as AIModel,
      {
        id: "claude-3-5-haiku-20241022",
        provider: "anthropic",
        type: "cloud",
        ...KNOWN_MODELS["claude-haiku-3.5"]
      } as AIModel
    ],
    defaultModel: "claude-sonnet-4-20250514"
  },
  {
    id: "openai",
    name: "OpenAI",
    type: "cloud",
    description: "GPT and o-series models",
    configurable: true,
    apiKeyEnvVar: "OPENAI_API_KEY",
    models: [
      {
        id: "gpt-4o",
        provider: "openai",
        type: "cloud",
        ...KNOWN_MODELS["gpt-4o"]
      } as AIModel,
      {
        id: "gpt-4o-mini",
        provider: "openai",
        type: "cloud",
        ...KNOWN_MODELS["gpt-4o-mini"]
      } as AIModel,
      {
        id: "o1",
        provider: "openai",
        type: "cloud",
        ...KNOWN_MODELS["o1"]
      } as AIModel,
      {
        id: "o3-mini",
        provider: "openai",
        type: "cloud",
        ...KNOWN_MODELS["o3-mini"]
      } as AIModel
    ],
    defaultModel: "gpt-4o"
  },
  {
    id: "google",
    name: "Google AI",
    type: "cloud",
    description: "Gemini models - Best for long context",
    configurable: true,
    apiKeyEnvVar: "GOOGLE_AI_API_KEY",
    models: [
      {
        id: "gemini-2.0-flash",
        provider: "google",
        type: "cloud",
        ...KNOWN_MODELS["gemini-2.0-flash"]
      } as AIModel,
      {
        id: "gemini-2.0-pro",
        provider: "google",
        type: "cloud",
        ...KNOWN_MODELS["gemini-2.0-pro"]
      } as AIModel
    ],
    defaultModel: "gemini-2.0-flash"
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
