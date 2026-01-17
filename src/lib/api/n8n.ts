/**
 * n8n API Service
 * Connects to the n8n orchestrator (configurable via NEXT_PUBLIC_N8N_URL)
 *
 * Note: N8N is running with HTTPS and a self-signed certificate.
 * Health checks and API calls are proxied through the server-side
 * /api/n8n-status endpoint to handle the self-signed cert.
 *
 * For per-user n8n isolation, use the UserWorkflowService from
 * @/lib/n8n/user-workflows instead. This service is for the
 * shared/global n8n instance.
 */

const N8N_BASE_URL = process.env.NEXT_PUBLIC_N8N_URL || "http://localhost:5678"
const N8N_API_KEY = process.env.NEXT_PUBLIC_N8N_API_KEY || ""

interface N8NWebhookPayload {
  action: string
  target: {
    type: "commit" | "pr" | "branch" | "activity" | "packet"
    id: string
    sha?: string
    branch?: string
    repo?: string
  }
  data: Record<string, unknown>
  timestamp: string
  source: "admin-panel"
  // User identification for shared instance isolation
  userId?: string
}

interface N8NWorkflow {
  id: string
  name: string
  active: boolean
  createdAt: string
  updatedAt: string
  tags?: string[]
}

interface N8NExecution {
  id: string
  workflowId: string
  finished: boolean
  mode: string
  startedAt: string
  stoppedAt?: string
  status: "running" | "success" | "error" | "waiting"
}

/**
 * User credentials for personal n8n instances
 */
interface UserN8NCredentials {
  baseUrl: string
  apiKey: string
}

class N8NApiService {
  private baseUrl: string
  private apiKey: string
  private userCredentials: UserN8NCredentials | null = null
  private userId: string | null = null
  private userWorkflowTag: string | null = null

  constructor() {
    this.baseUrl = N8N_BASE_URL
    this.apiKey = N8N_API_KEY
  }

  /**
   * Configure the service for a specific user.
   * This enables user-specific workflow filtering on the shared instance.
   */
  setUserContext(userId: string, workflowTag: string): void {
    this.userId = userId
    this.userWorkflowTag = workflowTag
    this.userCredentials = null
  }

  /**
   * Configure the service for a user with their own n8n instance.
   */
  setUserCredentials(userId: string, credentials: UserN8NCredentials): void {
    this.userId = userId
    this.userCredentials = credentials
    this.userWorkflowTag = null  // No tag filtering needed for personal instance
  }

  /**
   * Clear user context (return to shared instance mode)
   */
  clearUserContext(): void {
    this.userId = null
    this.userCredentials = null
    this.userWorkflowTag = null
  }

  /**
   * Get the current effective base URL
   */
  getBaseUrl(): string {
    return this.userCredentials?.baseUrl || this.baseUrl
  }

  /**
   * Check if using a personal instance
   */
  isUsingPersonalInstance(): boolean {
    return !!this.userCredentials
  }

  /**
   * Get current user context
   */
  getUserContext(): { userId: string | null; isPersonal: boolean; tag: string | null } {
    return {
      userId: this.userId,
      isPersonal: !!this.userCredentials,
      tag: this.userWorkflowTag,
    }
  }

  /**
   * Make a request to N8N API through the server-side proxy.
   * This handles self-signed certificates properly.
   * Supports both shared instance (via /api/n8n-status) and
   * user personal instances (via /api/n8n/user-proxy).
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Determine which proxy to use
    const proxyUrl = this.userCredentials
      ? "/api/n8n/user-proxy"
      : "/api/n8n-status"

    // Build request body
    const requestBody: Record<string, unknown> = {
      endpoint,
      method: options.method || "GET",
      data: options.body ? JSON.parse(options.body as string) : undefined,
    }

    // Add user context for personal instances
    if (this.userCredentials) {
      requestBody.userId = this.userId
      requestBody.credentials = {
        baseUrl: this.userCredentials.baseUrl,
        apiKey: this.userCredentials.apiKey,
      }
    }

    const response = await fetch(proxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      throw new Error("n8n API proxy error: " + response.status + " " + response.statusText)
    }

    const result = await response.json()

    if (!result.ok) {
      throw new Error("n8n API error: " + result.status + " " + (result.error || "Unknown error"))
    }

    return result.data as T
  }

  /**
   * Check if a workflow belongs to the current user (for shared instance filtering)
   */
  private isUserWorkflow(workflow: N8NWorkflow): boolean {
    // No filtering needed for personal instances
    if (this.userCredentials) {
      return true
    }

    // No user context set - return all workflows
    if (!this.userWorkflowTag) {
      return true
    }

    // Check if workflow has the user's tag
    if (workflow.tags?.includes(this.userWorkflowTag)) {
      return true
    }

    // Check if workflow name has the user prefix
    const prefix = this.userWorkflowTag.replace("claudia-", "[").replace("-", "-") + "]"
    if (workflow.name.includes(prefix)) {
      return true
    }

    return false
  }

  // Webhook endpoints for triggering workflows
  async triggerWebhook(webhookPath: string, payload: N8NWebhookPayload): Promise<unknown> {
    return this.request("/webhook/" + webhookPath, {
      method: "POST",
      body: JSON.stringify(payload)
    })
  }

  // Git Actions - these trigger n8n workflows
  async requestRollback(target: N8NWebhookPayload["target"], reason: string): Promise<unknown> {
    return this.triggerWebhook("git-action", {
      action: "rollback",
      target,
      data: { reason },
      timestamp: new Date().toISOString(),
      source: "admin-panel"
    })
  }

  async addComment(target: N8NWebhookPayload["target"], comment: string): Promise<unknown> {
    return this.triggerWebhook("git-action", {
      action: "comment",
      target,
      data: { comment },
      timestamp: new Date().toISOString(),
      source: "admin-panel"
    })
  }

  async approveAction(target: N8NWebhookPayload["target"], comment?: string): Promise<unknown> {
    return this.triggerWebhook("git-action", {
      action: "approve",
      target,
      data: { comment },
      timestamp: new Date().toISOString(),
      source: "admin-panel"
    })
  }

  async rejectAction(target: N8NWebhookPayload["target"], reason: string): Promise<unknown> {
    return this.triggerWebhook("git-action", {
      action: "reject",
      target,
      data: { reason },
      timestamp: new Date().toISOString(),
      source: "admin-panel"
    })
  }

  async flagForReview(target: N8NWebhookPayload["target"], reason: string): Promise<unknown> {
    return this.triggerWebhook("git-action", {
      action: "flag",
      target,
      data: { reason },
      timestamp: new Date().toISOString(),
      source: "admin-panel"
    })
  }

  // Workflow management
  async getWorkflows(): Promise<N8NWorkflow[]> {
    const response = await this.request<{ data: N8NWorkflow[] } | N8NWorkflow[]>("/api/v1/workflows")

    let workflows: N8NWorkflow[]

    // Handle double-nested response structure from proxy
    // The proxy wraps the N8N response in result.data, and N8N may also wrap workflows in data
    if (Array.isArray(response)) {
      workflows = response
    } else if (response && typeof response === 'object' && 'data' in response) {
      const inner = response.data
      // Check for triple nesting (proxy.data.data.data)
      if (inner && typeof inner === 'object' && 'data' in inner && Array.isArray((inner as { data: N8NWorkflow[] }).data)) {
        workflows = (inner as { data: N8NWorkflow[] }).data
      } else if (Array.isArray(inner)) {
        workflows = inner
      } else {
        console.warn('Unexpected workflow response structure:', response)
        workflows = []
      }
    } else {
      // Fallback: return empty array if structure is unexpected
      console.warn('Unexpected workflow response structure:', response)
      workflows = []
    }

    // Filter workflows to only show user's workflows (for shared instance)
    if (this.userWorkflowTag) {
      workflows = workflows.filter(w => this.isUserWorkflow(w))
    }

    return workflows
  }

  /**
   * Get workflows for a specific user.
   * Convenience method that sets user context temporarily.
   */
  async getWorkflowsForUser(userId: string, workflowTag: string): Promise<N8NWorkflow[]> {
    const previousUserId = this.userId
    const previousTag = this.userWorkflowTag
    const previousCreds = this.userCredentials

    try {
      this.setUserContext(userId, workflowTag)
      return await this.getWorkflows()
    } finally {
      // Restore previous context
      this.userId = previousUserId
      this.userWorkflowTag = previousTag
      this.userCredentials = previousCreds
    }
  }

  async getWorkflow(id: string): Promise<N8NWorkflow> {
    return this.request("/api/v1/workflows/" + id)
  }

  async activateWorkflow(id: string): Promise<void> {
    await this.request("/api/v1/workflows/" + id + "/activate", { method: "POST" })
  }

  async deactivateWorkflow(id: string): Promise<void> {
    await this.request("/api/v1/workflows/" + id + "/deactivate", { method: "POST" })
  }

  // Execution management
  async getExecutions(workflowId?: string): Promise<N8NExecution[]> {
    const params = workflowId ? "?workflowId=" + workflowId : ""
    const response = await this.request<{ data: N8NExecution[] } | N8NExecution[]>("/api/v1/executions" + params)
    // Handle double-nested response structure from proxy (same pattern as getWorkflows)
    if (Array.isArray(response)) {
      return response
    }
    if (response && typeof response === 'object' && 'data' in response) {
      const inner = response.data
      if (inner && typeof inner === 'object' && 'data' in inner && Array.isArray((inner as { data: N8NExecution[] }).data)) {
        return (inner as { data: N8NExecution[] }).data
      }
      if (Array.isArray(inner)) {
        return inner
      }
    }
    console.warn('Unexpected executions response structure:', response)
    return []
  }

  async getExecution(id: string): Promise<N8NExecution> {
    return this.request("/api/v1/executions/" + id)
  }

  // Packet management - triggers packet-related workflows
  async startPacket(packetId: string): Promise<unknown> {
    return this.triggerWebhook("packet-action", {
      action: "start",
      target: { type: "packet", id: packetId },
      data: {},
      timestamp: new Date().toISOString(),
      source: "admin-panel"
    })
  }

  async pausePacket(packetId: string): Promise<unknown> {
    return this.triggerWebhook("packet-action", {
      action: "pause",
      target: { type: "packet", id: packetId },
      data: {},
      timestamp: new Date().toISOString(),
      source: "admin-panel"
    })
  }

  async cancelPacket(packetId: string, reason?: string): Promise<unknown> {
    return this.triggerWebhook("packet-action", {
      action: "cancel",
      target: { type: "packet", id: packetId },
      data: { reason },
      timestamp: new Date().toISOString(),
      source: "admin-panel"
    })
  }

  async retryPacket(packetId: string): Promise<unknown> {
    return this.triggerWebhook("packet-action", {
      action: "retry",
      target: { type: "packet", id: packetId },
      data: {},
      timestamp: new Date().toISOString(),
      source: "admin-panel"
    })
  }

  // Agent management
  async pauseAllAgents(): Promise<unknown> {
    return this.triggerWebhook("agent-action", {
      action: "pause-all",
      target: { type: "activity", id: "all" },
      data: {},
      timestamp: new Date().toISOString(),
      source: "admin-panel"
    })
  }

  async resumeAllAgents(): Promise<unknown> {
    return this.triggerWebhook("agent-action", {
      action: "resume-all",
      target: { type: "activity", id: "all" },
      data: {},
      timestamp: new Date().toISOString(),
      source: "admin-panel"
    })
  }

  // Activity stream - for WebSocket connection
  getActivityStreamUrl(): string {
    return this.baseUrl.replace("http", "ws") + "/webhook/activity-stream"
  }

  // Health check - uses server-side API to handle self-signed certs
  async healthCheck(): Promise<boolean> {
    try {
      // Use the server-side API endpoint which can handle self-signed certs
      const response = await fetch("/api/n8n-status", {
        method: "GET",
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        return false
      }

      const data = await response.json()
      return data.healthy === true
    } catch (error) {
      console.error("N8N health check failed:", error)
      return false
    }
  }

  // Get N8N status with additional info
  async getStatus(): Promise<{
    healthy: boolean
    url: string
    message: string
    workflows?: { total: number; active: number }
  }> {
    try {
      const response = await fetch("/api/n8n-status", {
        method: "GET",
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        return {
          healthy: false,
          url: this.baseUrl,
          message: "Status check returned " + response.status,
        }
      }

      return await response.json()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      return {
        healthy: false,
        url: this.baseUrl,
        message: "Status check failed: " + message,
      }
    }
  }
}

// Export singleton instance
export const n8nApi = new N8NApiService()

// Export the class for creating user-specific instances
export { N8NApiService }

// Export types
export type { N8NWebhookPayload, N8NWorkflow, N8NExecution, UserN8NCredentials }
