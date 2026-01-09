/**
 * n8n API Service
 * Connects to the n8n orchestrator at https://192.168.245.211:5678
 *
 * Note: N8N is running with HTTPS and a self-signed certificate.
 * Health checks and API calls are proxied through the server-side
 * /api/n8n-status endpoint to handle the self-signed cert.
 */

const N8N_BASE_URL = process.env.NEXT_PUBLIC_N8N_URL || "https://192.168.245.211:5678"
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
}

interface N8NWorkflow {
  id: string
  name: string
  active: boolean
  createdAt: string
  updatedAt: string
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

class N8NApiService {
  private baseUrl: string
  private apiKey: string

  constructor() {
    this.baseUrl = N8N_BASE_URL
    this.apiKey = N8N_API_KEY
  }

  /**
   * Make a request to N8N API through the server-side proxy.
   * This handles self-signed certificates properly.
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Use the server-side proxy for N8N API calls
    const response = await fetch("/api/n8n-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        endpoint,
        method: options.method || "GET",
        data: options.body ? JSON.parse(options.body as string) : undefined,
      }),
    })

    if (!response.ok) {
      throw new Error(`n8n API proxy error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()

    if (!result.ok) {
      throw new Error(`n8n API error: ${result.status} ${result.error || "Unknown error"}`)
    }

    return result.data as T
  }

  // Webhook endpoints for triggering workflows
  async triggerWebhook(webhookPath: string, payload: N8NWebhookPayload): Promise<unknown> {
    return this.request(`/webhook/${webhookPath}`, {
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
    const response = await this.request<{ data: N8NWorkflow[] }>("/api/v1/workflows")
    return response.data
  }

  async getWorkflow(id: string): Promise<N8NWorkflow> {
    return this.request(`/api/v1/workflows/${id}`)
  }

  async activateWorkflow(id: string): Promise<void> {
    await this.request(`/api/v1/workflows/${id}/activate`, { method: "POST" })
  }

  async deactivateWorkflow(id: string): Promise<void> {
    await this.request(`/api/v1/workflows/${id}/deactivate`, { method: "POST" })
  }

  // Execution management
  async getExecutions(workflowId?: string): Promise<N8NExecution[]> {
    const params = workflowId ? `?workflowId=${workflowId}` : ""
    const response = await this.request<{ data: N8NExecution[] }>(`/api/v1/executions${params}`)
    return response.data
  }

  async getExecution(id: string): Promise<N8NExecution> {
    return this.request(`/api/v1/executions/${id}`)
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
    return `${this.baseUrl.replace("http", "ws")}/webhook/activity-stream`
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
          message: `Status check returned ${response.status}`,
        }
      }

      return await response.json()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      return {
        healthy: false,
        url: this.baseUrl,
        message: `Status check failed: ${message}`,
      }
    }
  }
}

// Export singleton instance
export const n8nApi = new N8NApiService()

// Export types
export type { N8NWebhookPayload, N8NWorkflow, N8NExecution }
