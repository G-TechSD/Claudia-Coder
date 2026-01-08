"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useN8NHealth, useWorkflows } from "@/lib/api/hooks"
import { n8nApi, type N8NExecution } from "@/lib/api"
import {
  Workflow,
  ExternalLink,
  RefreshCw,
  Play,
  Pause,
  Upload,
  History,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Zap,
  GitBranch,
  Shield,
  Webhook,
  Server,
  Activity,
  ChevronRight,
  Download,
  FileJson,
  Terminal,
  Power,
  PowerOff
} from "lucide-react"

const N8N_URL = "http://192.168.245.211:5678"

// Pre-built workflow templates for Claudia
const claudiaWorkflows = [
  {
    id: "issue-import",
    name: "Issue Import Webhook",
    description: "Import issues from any source (Linear, Jira, GitHub Issues) via webhook",
    icon: Webhook,
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    template: "issue-import-webhook"
  },
  {
    id: "code-quality",
    name: "Code Quality Pipeline",
    description: "The validation loop - lint, test, security scan, and iterate until passing",
    icon: Shield,
    color: "text-green-400",
    bgColor: "bg-green-400/10",
    template: "code-quality-pipeline"
  },
  {
    id: "git-automation",
    name: "Git Automation",
    description: "Automated branch creation, commits, and PR workflows",
    icon: GitBranch,
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
    template: "git-automation"
  }
]

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
  const [importingTemplate, setImportingTemplate] = useState<string | null>(null)

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

  const handleImportTemplate = async (templateId: string) => {
    setImportingTemplate(templateId)
    // Simulate importing - in real implementation, this would call n8n API
    await new Promise(resolve => setTimeout(resolve, 2000))
    setImportingTemplate(null)
    // Refresh workflows after import
    await refreshWorkflows()
  }

  const handleToggleWorkflow = async (id: string, active: boolean) => {
    if (active) {
      await deactivate(id)
    } else {
      await activate(id)
    }
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

      {/* Pre-built Claudia Workflows */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-400" />
            <CardTitle>Claudia Workflow Templates</CardTitle>
          </div>
          <CardDescription>
            Pre-configured workflows optimized for the Claudia development pipeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {claudiaWorkflows.map(workflow => {
              const Icon = workflow.icon
              const isImporting = importingTemplate === workflow.id
              return (
                <div
                  key={workflow.id}
                  className="relative p-4 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg shrink-0",
                      workflow.bgColor
                    )}>
                      <Icon className={cn("h-5 w-5", workflow.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{workflow.name}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {workflow.description}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-3 gap-2"
                    onClick={() => handleImportTemplate(workflow.id)}
                    disabled={isImporting || !isHealthy}
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Import Template
                      </>
                    )}
                  </Button>
                </div>
              )
            })}
          </div>
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
                <p className="text-xs">Import a template to get started</p>
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
