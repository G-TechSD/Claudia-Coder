/**
 * Project Model Assignment
 *
 * Manages which AI models are assigned to a project and how
 * work is routed to them based on task type.
 */

import type { AIModel, ProviderName, ModelStrength } from "./providers"
import { TASK_TYPES, getBestModelsForTask } from "./providers"

export interface ProjectModelConfig {
  projectId: string

  // Assigned models (ordered by priority)
  assignedModels: AssignedModel[]

  // Task-specific overrides
  taskOverrides: TaskModelOverride[]

  // Auto-routing settings
  autoRoute: boolean
  preferLocal: boolean // Always try local first
  maxCostPerTask?: number // Budget limit per task

  // Concurrency settings per provider
  concurrencySettings?: ProviderConcurrency[]
}

export interface ProviderConcurrency {
  provider: ProviderName
  maxConcurrent: number
  // For local providers with multiple instances (e.g., 2 LM Studio servers)
  instances?: ProviderInstance[]
}

export interface ProviderInstance {
  id: string
  name: string
  baseUrl: string
  enabled: boolean
}

export interface AssignedModel {
  id: string
  modelId: string
  provider: ProviderName
  name: string
  enabled: boolean
  priority: number // Lower = higher priority

  // Optional: restrict to specific task types
  allowedTasks?: string[]

  // Connection details for local models
  baseUrl?: string
}

export interface TaskModelOverride {
  taskType: string
  modelId: string // Specific model to use
  reason?: string // Why this override exists
}

// Storage key prefix
const STORAGE_KEY_PREFIX = "project-models-"

/**
 * Get model config for a project
 */
export function getProjectModelConfig(projectId: string): ProjectModelConfig | null {
  if (typeof window === "undefined") return null

  try {
    const stored = localStorage.getItem(STORAGE_KEY_PREFIX + projectId)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    console.warn("Failed to load project model config")
  }

  return null
}

/**
 * Save model config for a project
 */
export function saveProjectModelConfig(config: ProjectModelConfig): void {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + config.projectId, JSON.stringify(config))
  } catch {
    console.warn("Failed to save project model config")
  }
}

/**
 * Create default config for a project
 */
export function createDefaultModelConfig(projectId: string): ProjectModelConfig {
  return {
    projectId,
    assignedModels: [],
    taskOverrides: [],
    autoRoute: true,
    preferLocal: true,
    concurrencySettings: []
  }
}

/**
 * Update concurrency settings for a provider
 */
export function updateProviderConcurrency(
  config: ProjectModelConfig,
  provider: ProviderName,
  maxConcurrent: number,
  instances?: ProviderInstance[]
): ProjectModelConfig {
  const existing = config.concurrencySettings?.filter(c => c.provider !== provider) || []

  return {
    ...config,
    concurrencySettings: [
      ...existing,
      { provider, maxConcurrent, instances }
    ]
  }
}

/**
 * Add an instance to a provider's concurrency settings
 */
export function addProviderInstance(
  config: ProjectModelConfig,
  provider: ProviderName,
  instance: Omit<ProviderInstance, "id">
): ProjectModelConfig {
  const settings = config.concurrencySettings || []
  const providerSettings = settings.find(c => c.provider === provider)

  const newInstance: ProviderInstance = {
    ...instance,
    id: crypto.randomUUID()
  }

  if (providerSettings) {
    return {
      ...config,
      concurrencySettings: settings.map(c =>
        c.provider === provider
          ? { ...c, instances: [...(c.instances || []), newInstance] }
          : c
      )
    }
  }

  return {
    ...config,
    concurrencySettings: [
      ...settings,
      { provider, maxConcurrent: 1, instances: [newInstance] }
    ]
  }
}

/**
 * Remove an instance from a provider's concurrency settings
 */
export function removeProviderInstance(
  config: ProjectModelConfig,
  provider: ProviderName,
  instanceId: string
): ProjectModelConfig {
  const settings = config.concurrencySettings || []

  return {
    ...config,
    concurrencySettings: settings.map(c =>
      c.provider === provider
        ? { ...c, instances: c.instances?.filter(i => i.id !== instanceId) }
        : c
    )
  }
}

/**
 * Get concurrency settings for a provider
 */
export function getProviderConcurrency(
  config: ProjectModelConfig,
  provider: ProviderName
): ProviderConcurrency | null {
  return config.concurrencySettings?.find(c => c.provider === provider) || null
}

/**
 * Add a model to a project
 */
export function addModelToProject(
  config: ProjectModelConfig,
  model: {
    modelId: string
    provider: ProviderName
    name: string
    baseUrl?: string
    allowedTasks?: string[]
  }
): ProjectModelConfig {
  const maxPriority = Math.max(0, ...config.assignedModels.map(m => m.priority))

  const newModel: AssignedModel = {
    id: crypto.randomUUID(),
    modelId: model.modelId,
    provider: model.provider,
    name: model.name,
    enabled: true,
    priority: maxPriority + 1,
    baseUrl: model.baseUrl,
    allowedTasks: model.allowedTasks
  }

  return {
    ...config,
    assignedModels: [...config.assignedModels, newModel]
  }
}

/**
 * Remove a model from a project
 */
export function removeModelFromProject(
  config: ProjectModelConfig,
  assignedModelId: string
): ProjectModelConfig {
  return {
    ...config,
    assignedModels: config.assignedModels.filter(m => m.id !== assignedModelId)
  }
}

/**
 * Toggle a model's enabled state
 */
export function toggleModel(
  config: ProjectModelConfig,
  assignedModelId: string
): ProjectModelConfig {
  return {
    ...config,
    assignedModels: config.assignedModels.map(m =>
      m.id === assignedModelId ? { ...m, enabled: !m.enabled } : m
    )
  }
}

/**
 * Reorder models (change priorities)
 */
export function reorderModels(
  config: ProjectModelConfig,
  modelIds: string[] // New order
): ProjectModelConfig {
  const reordered = modelIds.map((id, index) => {
    const model = config.assignedModels.find(m => m.id === id)
    if (!model) throw new Error(`Model ${id} not found`)
    return { ...model, priority: index }
  })

  return {
    ...config,
    assignedModels: reordered
  }
}

/**
 * Set a task override
 */
export function setTaskOverride(
  config: ProjectModelConfig,
  taskType: string,
  modelId: string,
  reason?: string
): ProjectModelConfig {
  const existing = config.taskOverrides.filter(o => o.taskType !== taskType)

  return {
    ...config,
    taskOverrides: [...existing, { taskType, modelId, reason }]
  }
}

/**
 * Remove a task override
 */
export function removeTaskOverride(
  config: ProjectModelConfig,
  taskType: string
): ProjectModelConfig {
  return {
    ...config,
    taskOverrides: config.taskOverrides.filter(o => o.taskType !== taskType)
  }
}

/**
 * Get the best model for a task in a project
 * Considers: overrides, auto-routing, local preference, cost limits
 */
export function getModelForTask(
  config: ProjectModelConfig,
  taskType: string,
  availableModels: AIModel[]
): AssignedModel | null {
  // Check for explicit override first
  const override = config.taskOverrides.find(o => o.taskType === taskType)
  if (override) {
    const assigned = config.assignedModels.find(m =>
      m.modelId === override.modelId && m.enabled
    )
    if (assigned) return assigned
  }

  // Get enabled models
  const enabledModels = config.assignedModels.filter(m => m.enabled)
  if (enabledModels.length === 0) return null

  // Filter by allowed tasks if specified
  const eligibleModels = enabledModels.filter(m =>
    !m.allowedTasks || m.allowedTasks.includes(taskType)
  )
  if (eligibleModels.length === 0) return null

  // If auto-routing disabled, return highest priority
  if (!config.autoRoute) {
    eligibleModels.sort((a, b) => a.priority - b.priority)
    return eligibleModels[0]
  }

  // Auto-route: prefer local if enabled
  if (config.preferLocal) {
    const localModels = eligibleModels.filter(m =>
      m.provider === "lmstudio" || m.provider === "ollama"
    )
    if (localModels.length > 0) {
      localModels.sort((a, b) => a.priority - b.priority)
      return localModels[0]
    }
  }

  // Use task-based routing
  const modelDetails = eligibleModels.map(assigned => {
    const full = availableModels.find(m => m.id === assigned.modelId)
    return { assigned, full }
  }).filter(m => m.full)

  if (modelDetails.length === 0) {
    // Fallback to priority order
    eligibleModels.sort((a, b) => a.priority - b.priority)
    return eligibleModels[0]
  }

  // Score and rank
  const bestModels = getBestModelsForTask(
    modelDetails.map(m => m.full!),
    taskType,
    1
  )

  if (bestModels.length > 0) {
    const detail = modelDetails.find(m => m.full?.id === bestModels[0].id)
    if (detail) return detail.assigned
  }

  // Fallback
  eligibleModels.sort((a, b) => a.priority - b.priority)
  return eligibleModels[0]
}

/**
 * Get summary of model coverage for all task types
 */
export function getModelCoverage(
  config: ProjectModelConfig
): { taskType: string; modelId: string | null; isOverride: boolean }[] {
  return TASK_TYPES.map(task => {
    const override = config.taskOverrides.find(o => o.taskType === task.id)
    if (override) {
      return { taskType: task.id, modelId: override.modelId, isOverride: true }
    }

    // Would need full model details for auto-routing preview
    // For now, show first enabled model
    const enabled = config.assignedModels
      .filter(m => m.enabled)
      .sort((a, b) => a.priority - b.priority)

    return {
      taskType: task.id,
      modelId: enabled[0]?.modelId || null,
      isOverride: false
    }
  })
}
