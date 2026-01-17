/**
 * Per-User N8N Workflow Management
 *
 * Provides workflow isolation for each user through:
 * 1. Personal n8n instance support (user brings their own)
 * 2. Shared n8n instance with namespace/tag isolation
 *
 * Each user can only see and manage their own workflows.
 */

import {
  getUserN8NConfig,
  getUserWorkflowTag,
  getUserWorkflowPrefix,
  hasPersonalN8NInstance,
  type UserN8NConfig,
} from "@/lib/data/user-settings"

// ============ Types ============

export interface UserWorkflow {
  id: string
  name: string
  active: boolean
  createdAt: string
  updatedAt: string
  tags?: string[]        // Tags for filtering
  nodes?: number         // Number of nodes in workflow
  isUserOwned: boolean   // Whether this workflow belongs to the current user
}

export interface UserExecution {
  id: string
  workflowId: string
  workflowName?: string
  finished: boolean
  mode: string
  startedAt: string
  stoppedAt?: string
  status: "running" | "success" | "error" | "waiting"
}

export interface CreateWorkflowParams {
  name: string
  nodes: unknown[]
  connections: Record<string, unknown>
  settings?: Record<string, unknown>
  tags?: string[]
}

export interface UserN8NCredentials {
  baseUrl: string
  apiKey: string
}

// ============ N8N API Client Factory ============

/**
 * Get the n8n API credentials for a user.
 * Returns either their personal instance credentials or the shared instance.
 */
export function getN8NCredentials(userId: string): UserN8NCredentials {
  const config = getUserN8NConfig(userId)

  if (config.mode === "personal" && config.personalInstance) {
    return {
      baseUrl: config.personalInstance.baseUrl,
      apiKey: config.personalInstance.apiKey,
    }
  }

  // Fall back to shared instance from environment
  return {
    baseUrl: process.env.NEXT_PUBLIC_N8N_URL || "http://localhost:5678",
    apiKey: process.env.NEXT_PUBLIC_N8N_API_KEY || "",
  }
}

/**
 * Check if user is using personal n8n instance
 */
export function isUsingPersonalN8N(userId: string): boolean {
  return hasPersonalN8NInstance(userId)
}

// ============ Workflow Name/Tag Helpers ============

/**
 * Generate a workflow name with user prefix
 */
export function generateWorkflowName(userId: string, baseName: string): string {
  const prefix = getUserWorkflowPrefix(userId)
  // Ensure name doesn't already have the prefix
  if (baseName.startsWith(prefix)) {
    return baseName
  }
  return `[${prefix}] ${baseName}`
}

/**
 * Get the tags to apply to a new workflow
 */
export function getWorkflowTags(userId: string, additionalTags: string[] = []): string[] {
  const config = getUserN8NConfig(userId)
  const userTag = getUserWorkflowTag(userId)

  const tags = new Set<string>([
    ...config.defaultWorkflowTags,
    ...additionalTags,
  ])

  // Add user tag for shared instances
  if (config.mode === "shared" && userTag) {
    tags.add(userTag)
  }

  return Array.from(tags)
}

/**
 * Check if a workflow belongs to a user
 */
export function isUserWorkflow(userId: string, workflow: { name: string; tags?: string[] }): boolean {
  const config = getUserN8NConfig(userId)

  // For personal instances, all workflows belong to the user
  if (config.mode === "personal") {
    return true
  }

  // For shared instances, check by tag or name prefix
  const userTag = getUserWorkflowTag(userId)
  const userPrefix = getUserWorkflowPrefix(userId)

  // Check tags first (preferred method)
  if (workflow.tags?.includes(userTag)) {
    return true
  }

  // Fall back to name prefix check
  if (workflow.name.includes(`[${userPrefix}]`)) {
    return true
  }

  return false
}

/**
 * Filter workflows to only show user's workflows
 */
export function filterUserWorkflows(userId: string, workflows: UserWorkflow[]): UserWorkflow[] {
  const config = getUserN8NConfig(userId)

  // For personal instances, return all workflows
  if (config.mode === "personal") {
    return workflows.map(w => ({ ...w, isUserOwned: true }))
  }

  // For shared instances, filter by tag/prefix
  return workflows
    .filter(w => isUserWorkflow(userId, w))
    .map(w => ({ ...w, isUserOwned: true }))
}

// ============ Workflow CRUD Operations ============

/**
 * User Workflow Service
 * Handles all workflow operations with user isolation
 */
export class UserWorkflowService {
  private userId: string
  private credentials: UserN8NCredentials
  private config: UserN8NConfig

  constructor(userId: string) {
    this.userId = userId
    this.credentials = getN8NCredentials(userId)
    this.config = getUserN8NConfig(userId)
  }

  /**
   * Make a request to the user's n8n instance
   * Uses server-side proxy to handle self-signed certs and CORS
   */
  private async request<T>(
    endpoint: string,
    options: {
      method?: string
      body?: unknown
    } = {}
  ): Promise<T> {
    const response = await fetch("/api/n8n/user-proxy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: this.userId,
        endpoint,
        method: options.method || "GET",
        data: options.body,
        credentials: this.config.mode === "personal" ? {
          baseUrl: this.credentials.baseUrl,
          apiKey: this.credentials.apiKey,
        } : undefined,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`N8N API error: ${response.status} - ${error}`)
    }

    const result = await response.json()

    if (!result.ok) {
      throw new Error(result.error || "N8N API request failed")
    }

    return result.data as T
  }

  /**
   * Get all workflows for the user
   */
  async getWorkflows(): Promise<UserWorkflow[]> {
    const response = await this.request<{ data: UserWorkflow[] } | UserWorkflow[]>(
      "/api/v1/workflows"
    )

    let workflows: UserWorkflow[]

    // Handle various response structures
    if (Array.isArray(response)) {
      workflows = response
    } else if (response && "data" in response) {
      workflows = Array.isArray(response.data) ? response.data : []
    } else {
      workflows = []
    }

    // Filter to user's workflows for shared instances
    return filterUserWorkflows(this.userId, workflows)
  }

  /**
   * Get a specific workflow
   */
  async getWorkflow(id: string): Promise<UserWorkflow | null> {
    try {
      const workflow = await this.request<UserWorkflow>(`/api/v1/workflows/${id}`)

      // Verify ownership for shared instances
      if (!isUserWorkflow(this.userId, workflow)) {
        return null
      }

      return { ...workflow, isUserOwned: true }
    } catch {
      return null
    }
  }

  /**
   * Create a new workflow for the user
   */
  async createWorkflow(params: CreateWorkflowParams): Promise<UserWorkflow> {
    const name = generateWorkflowName(this.userId, params.name)
    const tags = getWorkflowTags(this.userId, params.tags)

    const workflow = await this.request<UserWorkflow>("/api/v1/workflows", {
      method: "POST",
      body: {
        name,
        nodes: params.nodes,
        connections: params.connections,
        settings: params.settings || {},
        tags,
      },
    })

    return { ...workflow, isUserOwned: true }
  }

  /**
   * Update an existing workflow
   */
  async updateWorkflow(
    id: string,
    updates: Partial<Omit<CreateWorkflowParams, "tags">> & { tags?: string[] }
  ): Promise<UserWorkflow | null> {
    // First verify ownership
    const existing = await this.getWorkflow(id)
    if (!existing) {
      return null
    }

    // Apply user prefix to name if changing
    const updateData: Record<string, unknown> = { ...updates }
    if (updates.name) {
      updateData.name = generateWorkflowName(this.userId, updates.name)
    }

    // Ensure user tags are maintained
    if (updates.tags) {
      updateData.tags = getWorkflowTags(this.userId, updates.tags)
    }

    const workflow = await this.request<UserWorkflow>(`/api/v1/workflows/${id}`, {
      method: "PATCH",
      body: updateData,
    })

    return { ...workflow, isUserOwned: true }
  }

  /**
   * Delete a workflow
   */
  async deleteWorkflow(id: string): Promise<boolean> {
    // First verify ownership
    const existing = await this.getWorkflow(id)
    if (!existing) {
      return false
    }

    await this.request(`/api/v1/workflows/${id}`, { method: "DELETE" })
    return true
  }

  /**
   * Activate a workflow
   */
  async activateWorkflow(id: string): Promise<boolean> {
    // First verify ownership
    const existing = await this.getWorkflow(id)
    if (!existing) {
      return false
    }

    await this.request(`/api/v1/workflows/${id}/activate`, { method: "POST" })
    return true
  }

  /**
   * Deactivate a workflow
   */
  async deactivateWorkflow(id: string): Promise<boolean> {
    // First verify ownership
    const existing = await this.getWorkflow(id)
    if (!existing) {
      return false
    }

    await this.request(`/api/v1/workflows/${id}/deactivate`, { method: "POST" })
    return true
  }

  /**
   * Get executions for user's workflows
   */
  async getExecutions(workflowId?: string): Promise<UserExecution[]> {
    let endpoint = "/api/v1/executions"
    if (workflowId) {
      // Verify ownership before fetching
      const workflow = await this.getWorkflow(workflowId)
      if (!workflow) {
        return []
      }
      endpoint += `?workflowId=${workflowId}`
    }

    const response = await this.request<{ data: UserExecution[] } | UserExecution[]>(endpoint)

    let executions: UserExecution[]
    if (Array.isArray(response)) {
      executions = response
    } else if (response && "data" in response) {
      executions = Array.isArray(response.data) ? response.data : []
    } else {
      executions = []
    }

    // For shared instances, filter executions to user's workflows only
    if (this.config.mode === "shared") {
      const userWorkflows = await this.getWorkflows()
      const userWorkflowIds = new Set(userWorkflows.map(w => w.id))
      executions = executions.filter(e => userWorkflowIds.has(e.workflowId))
    }

    return executions
  }

  /**
   * Get a specific execution
   */
  async getExecution(id: string): Promise<UserExecution | null> {
    try {
      const execution = await this.request<UserExecution>(`/api/v1/executions/${id}`)

      // Verify the execution belongs to a user workflow
      const workflow = await this.getWorkflow(execution.workflowId)
      if (!workflow) {
        return null
      }

      return execution
    } catch {
      return null
    }
  }

  /**
   * Trigger a webhook workflow
   */
  async triggerWebhook(
    webhookPath: string,
    payload: Record<string, unknown>
  ): Promise<unknown> {
    return this.request(`/webhook/${webhookPath}`, {
      method: "POST",
      body: {
        ...payload,
        _userId: this.userId,
        _timestamp: new Date().toISOString(),
        _source: "claudia-admin",
      },
    })
  }

  /**
   * Health check for the n8n instance
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.request("/api/v1/workflows?limit=1")
      return true
    } catch {
      return false
    }
  }

  /**
   * Get connection status
   */
  async getStatus(): Promise<{
    healthy: boolean
    mode: "shared" | "personal"
    url: string
    message: string
  }> {
    try {
      const healthy = await this.healthCheck()
      return {
        healthy,
        mode: this.config.mode,
        url: this.credentials.baseUrl,
        message: healthy ? "Connected" : "Connection failed",
      }
    } catch (error) {
      return {
        healthy: false,
        mode: this.config.mode,
        url: this.credentials.baseUrl,
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }
}

// ============ Factory Function ============

/**
 * Create a workflow service for a user
 */
export function createUserWorkflowService(userId: string): UserWorkflowService {
  return new UserWorkflowService(userId)
}

// ============ Workflow Templates ============

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: "automation" | "integration" | "notification" | "data-pipeline" | "custom"
  nodes: unknown[]
  connections: Record<string, unknown>
}

/**
 * Get available workflow templates
 */
export function getWorkflowTemplates(): WorkflowTemplate[] {
  return [
    {
      id: "git-commit-notification",
      name: "Git Commit Notification",
      description: "Send a notification when a new commit is pushed",
      category: "notification",
      nodes: [
        {
          id: "webhook",
          name: "Webhook",
          type: "n8n-nodes-base.webhook",
          position: [250, 300],
          parameters: {
            path: "git-commit",
            httpMethod: "POST",
          },
        },
        {
          id: "slack",
          name: "Slack",
          type: "n8n-nodes-base.slack",
          position: [500, 300],
          parameters: {
            channel: "#dev",
            text: "New commit: {{$json.commit.message}}",
          },
        },
      ],
      connections: {
        webhook: {
          main: [[{ node: "slack", type: "main", index: 0 }]],
        },
      },
    },
    {
      id: "packet-status-update",
      name: "Packet Status Update",
      description: "Update external systems when packet status changes",
      category: "automation",
      nodes: [
        {
          id: "webhook",
          name: "Webhook",
          type: "n8n-nodes-base.webhook",
          position: [250, 300],
          parameters: {
            path: "packet-status",
            httpMethod: "POST",
          },
        },
        {
          id: "http",
          name: "HTTP Request",
          type: "n8n-nodes-base.httpRequest",
          position: [500, 300],
          parameters: {
            method: "POST",
            url: "https://api.example.com/webhook",
            body: "={{ JSON.stringify($json) }}",
          },
        },
      ],
      connections: {
        webhook: {
          main: [[{ node: "http", type: "main", index: 0 }]],
        },
      },
    },
    {
      id: "scheduled-report",
      name: "Scheduled Report",
      description: "Generate and send periodic reports",
      category: "automation",
      nodes: [
        {
          id: "schedule",
          name: "Schedule Trigger",
          type: "n8n-nodes-base.scheduleTrigger",
          position: [250, 300],
          parameters: {
            rule: {
              interval: [{ field: "hours", hoursInterval: 24 }],
            },
          },
        },
        {
          id: "code",
          name: "Generate Report",
          type: "n8n-nodes-base.code",
          position: [500, 300],
          parameters: {
            jsCode: `
              // Generate report data
              return [{
                json: {
                  report: "Daily Summary",
                  generatedAt: new Date().toISOString()
                }
              }];
            `,
          },
        },
        {
          id: "email",
          name: "Send Email",
          type: "n8n-nodes-base.emailSend",
          position: [750, 300],
          parameters: {
            toEmail: "team@example.com",
            subject: "Daily Report",
            text: "={{ $json.report }}",
          },
        },
      ],
      connections: {
        schedule: {
          main: [[{ node: "code", type: "main", index: 0 }]],
        },
        code: {
          main: [[{ node: "email", type: "main", index: 0 }]],
        },
      },
    },
  ]
}

/**
 * Create a workflow from a template
 */
export async function createWorkflowFromTemplate(
  userId: string,
  templateId: string,
  customName?: string
): Promise<UserWorkflow | null> {
  const templates = getWorkflowTemplates()
  const template = templates.find(t => t.id === templateId)

  if (!template) {
    return null
  }

  const service = createUserWorkflowService(userId)

  return service.createWorkflow({
    name: customName || template.name,
    nodes: template.nodes,
    connections: template.connections,
    tags: [template.category],
  })
}
