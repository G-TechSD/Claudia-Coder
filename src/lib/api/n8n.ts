/**
 * n8n API Service
 * Connects to the n8n orchestrator at http://orangepi:5678
 */

const N8N_BASE_URL = process.env.NEXT_PUBLIC_N8N_URL || "http://orangepi:5678"
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

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(this.apiKey && { "X-N8N-API-KEY": this.apiKey }),
      ...options.headers
    }

    const response = await fetch(url, {
      ...options,
      headers
    })

    if (!response.ok) {
      throw new Error(`n8n API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
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

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.request("/healthz")
      return true
    } catch {
      return false
    }
  }
}

// Export singleton instance
export const n8nApi = new N8NApiService()

// Export types
export type { N8NWebhookPayload, N8NWorkflow, N8NExecution }
