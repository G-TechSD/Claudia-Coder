"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useN8NHealth, useWorkflows } from "@/lib/api/hooks"
import { n8nApi, type N8NExecution } from "@/lib/api"
import { Textarea } from "@/components/ui/textarea"
import {
  Workflow,
  ExternalLink,
  RefreshCw,
  Upload,
  History,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Server,
  Activity,
  ChevronRight,
  FileJson,
  Terminal,
  Power,
  PowerOff,
  Sparkles,
  Copy,
  Download,
  Check
} from "lucide-react"

// Use environment variable or fallback (local N8N with HTTPS)
const N8N_URL = process.env.NEXT_PUBLIC_N8N_URL || "https://192.168.245.211:5678"

function formatTimestamp(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (seconds < 60) return `${seconds}s ago`
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return d.toLocaleDateString()
}

const executionStatusConfig = {
  running: { label: "Running", color: "text-blue-400", bg: "bg-blue-400", icon: Loader2, animate: true },
  success: { label: "Success", color: "text-green-400", bg: "bg-green-400", icon: CheckCircle, animate: false },
  error: { label: "Error", color: "text-red-400", bg: "bg-red-400", icon: XCircle, animate: false },
  waiting: { label: "Waiting", color: "text-yellow-400", bg: "bg-yellow-400", icon: Clock, animate: false }
}

export default function N8NPlaygroundPage() {
  const { isHealthy, check: checkHealth, isChecking } = useN8NHealth()
  const { workflows, isLoading: workflowsLoading, refresh: refreshWorkflows, activate, deactivate } = useWorkflows()
  const [executions, setExecutions] = useState<N8NExecution[]>([])
  const [executionsLoading, setExecutionsLoading] = useState(false)
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null)

  // Workflow generator state
  const [workflowDescription, setWorkflowDescription] = useState("")
  const [generatedWorkflow, setGeneratedWorkflow] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Initial data fetch
  useEffect(() => {
    checkHealth()
    refreshWorkflows()
    fetchExecutions()
  }, [])

  const fetchExecutions = useCallback(async () => {
    setExecutionsLoading(true)
    try {
      const data = await n8nApi.getExecutions()
      setExecutions(data.slice(0, 20)) // Limit to 20 most recent
    } catch (err) {
      console.error("Failed to fetch executions:", err)
      setExecutions([])
    } finally {
      setExecutionsLoading(false)
    }
  }, [])

  const handleRefreshAll = useCallback(async () => {
    await Promise.all([
      checkHealth(),
      refreshWorkflows(),
      fetchExecutions()
    ])
  }, [checkHealth, refreshWorkflows, fetchExecutions])

  const handleToggleWorkflow = async (id: string, active: boolean) => {
    if (active) {
      await deactivate(id)
    } else {
      await activate(id)
    }
  }

  // Workflow generator functions
  const generateWorkflow = async () => {
    if (!workflowDescription.trim()) return

    setIsGenerating(true)
    setGenerateError(null)
    setGeneratedWorkflow(null)

    try {
      const response = await fetch("/api/llm/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: `You are an expert N8N workflow generator. Generate valid N8N workflow JSON based on the user's description.

IMPORTANT: Return ONLY the raw JSON object, no markdown code blocks, no explanation text.

The JSON should follow N8N workflow format with:
- "name": workflow name
- "nodes": array of node objects with id, name, type, position, parameters
- "connections": object mapping node connections
- "settings": workflow settings object

Common N8N node types:
- n8n-nodes-base.webhook (trigger)
- n8n-nodes-base.httpRequest (API calls)
- n8n-nodes-base.if (conditions)
- n8n-nodes-base.set (set variables)
- n8n-nodes-base.code (JavaScript code)
- n8n-nodes-base.slack (Slack integration)
- n8n-nodes-base.gmail (Gmail)
- n8n-nodes-base.googleSheets (Google Sheets)
- n8n-nodes-base.postgres (PostgreSQL)
- n8n-nodes-base.mysql (MySQL)
- n8n-nodes-base.mongodb (MongoDB)
- n8n-nodes-base.openAi (OpenAI)
- n8n-nodes-base.function (Run JavaScript)
- n8n-nodes-base.merge (Merge data)
- n8n-nodes-base.splitInBatches (Batch processing)
- n8n-nodes-base.wait (Delay)
- n8n-nodes-base.noOp (No operation/passthrough)

Generate a complete, valid JSON workflow that can be imported directly into N8N.`,
          userPrompt: `Generate an N8N workflow for: ${workflowDescription}`,
          temperature: 0.3,
          max_tokens: 4096
        })
      })

      const data = await response.json()

      if (data.error || !data.content) {
        throw new Error(data.error || data.suggestion || "Failed to generate workflow")
      }

      // Try to parse and pretty-print the JSON
      let jsonContent = data.content.trim()

      // Remove markdown code blocks if present
      if (jsonContent.startsWith("```")) {
        jsonContent = jsonContent.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
      }

      // Validate and format JSON
      const parsed = JSON.parse(jsonContent)
      setGeneratedWorkflow(JSON.stringify(parsed, null, 2))
    } catch (err) {
      console.error("Workflow generation error:", err)
      setGenerateError(err instanceof Error ? err.message : "Failed to generate workflow")
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = async () => {
    if (!generatedWorkflow) return
    try {
      await navigator.clipboard.writeText(generatedWorkflow)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const downloadWorkflow = () => {
    if (!generatedWorkflow) return
    const blob = new Blob([generatedWorkflow], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    // Generate filename from description or use default
    const filename = workflowDescription
      .trim()
      .slice(0, 30)
      .replace(/[^a-zA-Z0-9]/g, "-")
      .replace(/-+/g, "-")
      .toLowerCase() || "workflow"
    a.download = `${filename}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const stats = {
    total: workflows.length,
    active: workflows.filter(w => w.active).length,
    inactive: workflows.filter(w => !w.active).length,
    recentExecutions: executions.length
  }

  const filteredExecutions = selectedWorkflow
    ? executions.filter(e => e.workflowId === selectedWorkflow)
    : executions

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20">
            <Workflow className="h-6 w-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">N8N Playground</h1>
            <p className="text-sm text-muted-foreground">
              Workflow automation hub for Claudia
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isChecking || workflowsLoading}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", (isChecking || workflowsLoading) && "animate-spin")} />
            Refresh
          </Button>
          <Button asChild className="gap-2">
            <a href={N8N_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Open N8N Editor
            </a>
          </Button>
        </div>
      </div>

      {/* Connection Status */}
      <Card className={cn(
        "border-2 transition-colors",
        isHealthy === true && "border-green-500/50 bg-green-500/5",
        isHealthy === false && "border-red-500/50 bg-red-500/5",
        isHealthy === null && "border-muted"
      )}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                "flex h-12 w-12 items-center justify-center rounded-lg",
                isHealthy === true && "bg-green-500/20",
                isHealthy === false && "bg-red-500/20",
                isHealthy === null && "bg-muted"
              )}>
                {isChecking ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : isHealthy ? (
                  <Server className="h-6 w-6 text-green-400" />
                ) : (
                  <Server className="h-6 w-6 text-red-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">N8N Server</p>
                  <Badge variant={isHealthy ? "success" : isHealthy === false ? "destructive" : "secondary"}>
                    {isChecking ? "Checking..." : isHealthy ? "Connected" : isHealthy === false ? "Disconnected" : "Unknown"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground font-mono">{N8N_URL}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Active Workflows</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{stats.recentExecutions}</p>
                <p className="text-xs text-muted-foreground">Recent Runs</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button
          variant="outline"
          className="h-auto p-4 flex flex-col items-start gap-2 hover:bg-accent/50"
          asChild
        >
          <a href={N8N_URL} target="_blank" rel="noopener noreferrer">
            <div className="flex items-center gap-2 w-full">
              <Terminal className="h-5 w-5 text-orange-400" />
              <span className="font-medium">Open N8N Editor</span>
              <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground text-left">
              Visual workflow editor at {N8N_URL}
            </p>
          </a>
        </Button>

        <Button
          variant="outline"
          className="h-auto p-4 flex flex-col items-start gap-2 hover:bg-accent/50"
          onClick={() => document.getElementById("workflow-import")?.click()}
        >
          <div className="flex items-center gap-2 w-full">
            <Upload className="h-5 w-5 text-blue-400" />
            <span className="font-medium">Import Workflow</span>
          </div>
          <p className="text-xs text-muted-foreground text-left">
            Import workflow from JSON file
          </p>
          <input
            id="workflow-import"
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              // Handle file import
              const file = e.target.files?.[0]
              if (file) {
                console.log("Importing workflow:", file.name)
              }
            }}
          />
        </Button>

        <Button
          variant="outline"
          className="h-auto p-4 flex flex-col items-start gap-2 hover:bg-accent/50"
          onClick={() => setSelectedWorkflow(null)}
        >
          <div className="flex items-center gap-2 w-full">
            <History className="h-5 w-5 text-purple-400" />
            <span className="font-medium">Execution History</span>
          </div>
          <p className="text-xs text-muted-foreground text-left">
            View all workflow execution logs
          </p>
        </Button>
      </div>

      {/* Workflow Generator */}
      <Card className="border-2 border-dashed border-muted-foreground/20 hover:border-purple-500/50 transition-colors">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
              <Sparkles className="h-4 w-4 text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-base font-medium">AI Workflow Generator</CardTitle>
              <p className="text-xs text-muted-foreground">Describe what you want and let AI create the workflow</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Textarea
              placeholder="Describe your workflow... e.g., 'When a webhook is triggered, fetch data from an API, filter results where status is active, and send a Slack notification with the count'"
              value={workflowDescription}
              onChange={(e) => setWorkflowDescription(e.target.value)}
              className="min-h-[100px] bg-muted/30 border-muted-foreground/20 focus:border-purple-500/50 resize-none"
              disabled={isGenerating}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Tip: Be specific about triggers, data sources, conditions, and actions
              </p>
              <Button
                onClick={generateWorkflow}
                disabled={!workflowDescription.trim() || isGenerating}
                className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Workflow
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Error Display */}
          {generateError && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
              <div className="flex items-start gap-2">
                <XCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-400">Generation Failed</p>
                  <p className="text-xs text-red-400/80 mt-1">{generateError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Generated Workflow Display */}
          {generatedWorkflow && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <p className="text-sm font-medium text-green-400">Workflow Generated</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyToClipboard}
                    className="gap-1.5 h-8"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-green-400" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadWorkflow}
                    className="gap-1.5 h-8"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download JSON
                  </Button>
                </div>
              </div>
              <div className="relative">
                <pre className="rounded-lg bg-muted/50 border border-muted-foreground/20 p-4 overflow-auto max-h-[400px] text-xs font-mono">
                  <code className="text-muted-foreground">{generatedWorkflow}</code>
                </pre>
                <div className="absolute top-2 right-2">
                  <Badge variant="outline" className="text-xs bg-background/80 backdrop-blur-sm">
                    <FileJson className="h-3 w-3 mr-1" />
                    JSON
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Import this JSON into N8N using the Import Workflow button above, or paste it directly in the N8N editor.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-5 flex-1 min-h-0">
        {/* Workflows List */}
        <Card className="lg:col-span-2 flex flex-col min-h-0">
          <CardHeader className="pb-2 flex-none">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">
                Available Workflows
              </CardTitle>
              <Badge variant="outline">{workflows.length} total</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            {workflowsLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : workflows.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Workflow className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No workflows found</p>
                <p className="text-xs">Create workflows in the N8N editor</p>
              </div>
            ) : (
              <div className="divide-y">
                {workflows.map(workflow => (
                  <div
                    key={workflow.id}
                    onClick={() => setSelectedWorkflow(workflow.id)}
                    className={cn(
                      "flex items-center gap-3 p-4 cursor-pointer transition-colors",
                      selectedWorkflow === workflow.id ? "bg-accent" : "hover:bg-accent/50"
                    )}
                  >
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg shrink-0",
                      workflow.active ? "bg-green-400/10" : "bg-muted"
                    )}>
                      <Workflow className={cn(
                        "h-5 w-5",
                        workflow.active ? "text-green-400" : "text-muted-foreground"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{workflow.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Updated {formatTimestamp(workflow.updatedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleWorkflow(workflow.id, workflow.active)
                        }}
                      >
                        {workflow.active ? (
                          <Power className="h-4 w-4 text-green-400" />
                        ) : (
                          <PowerOff className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Executions */}
        <Card className="lg:col-span-3 flex flex-col min-h-0">
          <CardHeader className="pb-2 flex-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base font-medium">
                  {selectedWorkflow ? "Workflow Executions" : "Recent Executions"}
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchExecutions}
                disabled={executionsLoading}
                className="gap-1.5"
              >
                <RefreshCw className={cn("h-4 w-4", executionsLoading && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            {executionsLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredExecutions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <History className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No executions found</p>
                <p className="text-xs">Workflow runs will appear here</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredExecutions.map(execution => {
                  const config = executionStatusConfig[execution.status]
                  const Icon = config.icon
                  const workflowName = workflows.find(w => w.id === execution.workflowId)?.name || "Unknown Workflow"
                  return (
                    <div
                      key={execution.id}
                      className="flex items-center gap-3 p-4 hover:bg-accent/50 transition-colors"
                    >
                      <div className="relative flex h-2 w-2 shrink-0">
                        <span
                          className={cn(
                            "absolute inline-flex h-full w-full rounded-full opacity-75",
                            config.bg,
                            config.animate && "animate-ping"
                          )}
                        />
                        <span
                          className={cn(
                            "relative inline-flex h-2 w-2 rounded-full",
                            config.bg
                          )}
                        />
                      </div>
                      <Icon className={cn(
                        "h-4 w-4 shrink-0",
                        config.color,
                        config.animate && "animate-spin"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{workflowName}</p>
                        <p className="text-xs text-muted-foreground">
                          ID: {execution.id.slice(0, 8)}... | Mode: {execution.mode}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge
                          variant={execution.status === "success" ? "success" : execution.status === "error" ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {config.label}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTimestamp(execution.startedAt)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Webhook Endpoints Info */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <FileJson className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base font-medium">Webhook Endpoints</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground">Git Actions</p>
              <code className="text-xs bg-muted px-2 py-1 rounded block truncate">
                {N8N_URL}/webhook/git-action
              </code>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Packet Actions</p>
              <code className="text-xs bg-muted px-2 py-1 rounded block truncate">
                {N8N_URL}/webhook/packet-action
              </code>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Agent Control</p>
              <code className="text-xs bg-muted px-2 py-1 rounded block truncate">
                {N8N_URL}/webhook/agent-action
              </code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
