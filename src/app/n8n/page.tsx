"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { useN8NHealth, useWorkflows, useUserWorkflows, useUserExecutions } from "@/lib/api/hooks"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/components/auth/auth-provider"
import Link from "next/link"
import { N8NEmbed, N8NConnectionStatus } from "@/components/n8n/n8n-embed"
import { WorkflowActivity, RunningWorkflows, WorkflowActivityBadge } from "@/components/n8n/workflow-activity"
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
  Check,
  Settings,
  User,
  Share2,
  Monitor,
  LayoutDashboard,
  Wand2,
  AlertCircle,
  Plus,
} from "lucide-react"

// Use environment variable or fallback (local N8N with HTTPS)
const N8N_URL = process.env.NEXT_PUBLIC_N8N_URL || "http://localhost:5678"

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
  const { user, isAuthenticated } = useAuth()
  const userId = user?.id || null

  // Active tab state
  const [activeTab, setActiveTab] = useState("overview")

  // Use user-specific workflows if authenticated, otherwise fall back to global
  const {
    workflows: userWorkflows,
    isLoading: userWorkflowsLoading,
    refresh: refreshUserWorkflows,
    activate: activateUserWorkflow,
    deactivate: deactivateUserWorkflow,
    connectionStatus,
    checkConnection
  } = useUserWorkflows(userId)

  // Use user-specific executions
  const {
    executions: userExecutions,
    isLoading: userExecutionsLoading,
    refresh: refreshUserExecutions
  } = useUserExecutions(userId)

  // Fall back to global for unauthenticated users
  const { isHealthy, check: checkHealth, isChecking } = useN8NHealth()
  const { workflows: globalWorkflows, isLoading: globalWorkflowsLoading, refresh: refreshGlobalWorkflows, activate: activateGlobal, deactivate: deactivateGlobal } = useWorkflows()

  // Determine which data to use based on auth state
  const workflows = isAuthenticated ? userWorkflows : globalWorkflows
  const workflowsLoading = isAuthenticated ? userWorkflowsLoading : globalWorkflowsLoading
  const executions = isAuthenticated ? userExecutions : []
  const executionsLoading = isAuthenticated ? userExecutionsLoading : false

  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null)

  // Workflow generator state
  const [workflowDescription, setWorkflowDescription] = useState("")
  const [generatedWorkflow, setGeneratedWorkflow] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Initial data fetch
  useEffect(() => {
    if (isAuthenticated) {
      refreshUserWorkflows()
      refreshUserExecutions()
      checkConnection()
    } else {
      checkHealth()
      refreshGlobalWorkflows()
    }
  }, [isAuthenticated])

  // Refresh all data
  const refreshWorkflows = isAuthenticated ? refreshUserWorkflows : refreshGlobalWorkflows

  // Activate/deactivate handlers
  const activate = isAuthenticated ? activateUserWorkflow : activateGlobal
  const deactivate = isAuthenticated ? deactivateUserWorkflow : deactivateGlobal

  const fetchExecutions = useCallback(async () => {
    if (isAuthenticated) {
      await refreshUserExecutions()
    } else {
      // For unauthenticated, we don't show executions
    }
  }, [isAuthenticated, refreshUserExecutions])

  const handleRefreshAll = useCallback(async () => {
    if (isAuthenticated) {
      await Promise.all([
        checkConnection(),
        refreshUserWorkflows(),
        refreshUserExecutions()
      ])
    } else {
      await Promise.all([
        checkHealth(),
        refreshGlobalWorkflows()
      ])
    }
  }, [isAuthenticated, checkConnection, refreshUserWorkflows, refreshUserExecutions, checkHealth, refreshGlobalWorkflows])

  // Determine n8n URL based on user config
  const effectiveN8NUrl = connectionStatus?.url || N8N_URL
  const effectiveIsHealthy = isAuthenticated ? connectionStatus?.healthy : isHealthy
  const isConnectionChecking = isAuthenticated ? !connectionStatus : isChecking

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
    recentExecutions: executions.length,
    runningExecutions: executions.filter(e => e.status === "running").length
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
          <N8NConnectionStatus />
          <WorkflowActivityBadge />
          {isAuthenticated && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="gap-2"
            >
              <Link href="/settings/n8n">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isConnectionChecking || workflowsLoading}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", (isConnectionChecking || workflowsLoading) && "animate-spin")} />
            Refresh
          </Button>
          <Button asChild className="gap-2">
            <a href={effectiveN8NUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Open N8N
            </a>
          </Button>
        </div>
      </div>

      {/* Running Workflows Alert */}
      <RunningWorkflows />

      {/* User Context Banner */}
      {isAuthenticated && connectionStatus && (
        <div className={cn(
          "flex items-center justify-between rounded-lg p-3",
          connectionStatus.mode === "personal"
            ? "bg-purple-500/10 border border-purple-500/20"
            : "bg-blue-500/10 border border-blue-500/20"
        )}>
          <div className="flex items-center gap-3">
            {connectionStatus.mode === "personal" ? (
              <User className="h-5 w-5 text-purple-400" />
            ) : (
              <Share2 className="h-5 w-5 text-blue-400" />
            )}
            <div>
              <p className="text-sm font-medium">
                {connectionStatus.mode === "personal" ? "Your Personal N8N Instance" : "Claudia Shared N8N"}
              </p>
              <p className="text-xs text-muted-foreground">
                {connectionStatus.mode === "personal"
                  ? "You are using your own n8n server"
                  : "Your workflows are isolated with tags"}
              </p>
            </div>
          </div>
          <Badge variant={connectionStatus.healthy ? "success" : "destructive"}>
            {connectionStatus.healthy ? "Connected" : "Disconnected"}
          </Badge>
        </div>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="overview" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="editor" className="gap-2">
            <Monitor className="h-4 w-4" />
            <span className="hidden sm:inline">Editor</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Activity</span>
            {stats.runningExecutions > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 text-xs">
                {stats.runningExecutions}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="create" className="gap-2">
            <Wand2 className="h-4 w-4" />
            <span className="hidden sm:inline">Create AI</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="flex-1 space-y-6 mt-4">
          {/* Connection Status */}
          <Card className={cn(
            "border-2 transition-colors",
            effectiveIsHealthy === true && "border-green-500/50 bg-green-500/5",
            effectiveIsHealthy === false && "border-red-500/50 bg-red-500/5",
            effectiveIsHealthy === null && "border-muted"
          )}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-lg",
                    effectiveIsHealthy === true && "bg-green-500/20",
                    effectiveIsHealthy === false && "bg-red-500/20",
                    effectiveIsHealthy === null && "bg-muted"
                  )}>
                    {isConnectionChecking ? (
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    ) : effectiveIsHealthy ? (
                      <Server className="h-6 w-6 text-green-400" />
                    ) : (
                      <Server className="h-6 w-6 text-red-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">N8N Server</p>
                      <Badge variant={effectiveIsHealthy ? "success" : effectiveIsHealthy === false ? "destructive" : "secondary"}>
                        {isConnectionChecking ? "Checking..." : effectiveIsHealthy ? "Connected" : effectiveIsHealthy === false ? "Disconnected" : "Unknown"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground font-mono">{effectiveN8NUrl}</p>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-start gap-2 hover:bg-accent/50"
              onClick={() => setActiveTab("editor")}
            >
              <div className="flex items-center gap-2 w-full">
                <Monitor className="h-5 w-5 text-orange-400" />
                <span className="font-medium">Open Editor</span>
              </div>
              <p className="text-xs text-muted-foreground text-left">
                Embedded N8N editor
              </p>
            </Button>

            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-start gap-2 hover:bg-accent/50"
              onClick={() => setActiveTab("create")}
            >
              <div className="flex items-center gap-2 w-full">
                <Sparkles className="h-5 w-5 text-purple-400" />
                <span className="font-medium">Create with AI</span>
              </div>
              <p className="text-xs text-muted-foreground text-left">
                Generate workflows using AI
              </p>
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
                Import from JSON file
              </p>
              <input
                id="workflow-import"
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
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
              onClick={() => setActiveTab("activity")}
            >
              <div className="flex items-center gap-2 w-full">
                <History className="h-5 w-5 text-green-400" />
                <span className="font-medium">View Activity</span>
              </div>
              <p className="text-xs text-muted-foreground text-left">
                Execution history
              </p>
            </Button>
          </div>

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
            <WorkflowActivity
              className="lg:col-span-3"
              maxItems={8}
              workflowId={selectedWorkflow || undefined}
            />
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
                    {effectiveN8NUrl}/webhook/git-action
                  </code>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Packet Actions</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded block truncate">
                    {effectiveN8NUrl}/webhook/packet-action
                  </code>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Agent Control</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded block truncate">
                    {effectiveN8NUrl}/webhook/agent-action
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Editor Tab - Embedded N8N */}
        <TabsContent value="editor" className="flex-1 mt-4">
          <N8NEmbed showHeader={true} />
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="flex-1 space-y-4 mt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Stats Cards */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                    <Activity className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.recentExecutions}</p>
                    <p className="text-sm text-muted-foreground">Total Executions</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {executions.filter(e => e.status === "success").length}
                    </p>
                    <p className="text-sm text-muted-foreground">Successful</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10">
                    <XCircle className="h-6 w-6 text-red-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {executions.filter(e => e.status === "error").length}
                    </p>
                    <p className="text-sm text-muted-foreground">Failed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <WorkflowActivity maxItems={25} autoRefresh={true} refreshInterval={5000} />
        </TabsContent>

        {/* Create AI Tab */}
        <TabsContent value="create" className="flex-1 space-y-4 mt-4">
          <Card className="border-2 border-dashed border-muted-foreground/20 hover:border-purple-500/50 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                  <Sparkles className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <CardTitle className="text-lg font-medium">AI Workflow Generator</CardTitle>
                  <p className="text-sm text-muted-foreground">Describe what you want and let AI create the workflow</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Textarea
                  placeholder="Describe your workflow... e.g., 'When a webhook is triggered, fetch data from an API, filter results where status is active, and send a Slack notification with the count'"
                  value={workflowDescription}
                  onChange={(e) => setWorkflowDescription(e.target.value)}
                  className="min-h-[150px] bg-muted/30 border-muted-foreground/20 focus:border-purple-500/50 resize-none"
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
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Import this JSON into N8N using the Import Workflow button, or paste it directly in the N8N editor.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab("editor")}
                      className="gap-2"
                    >
                      <Monitor className="h-4 w-4" />
                      Open Editor
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Example Prompts */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Example Prompts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  "When a webhook receives a GitHub push event, post a summary to Slack",
                  "Every day at 9am, fetch data from an API and save to Google Sheets",
                  "When a form is submitted via webhook, validate the data and send a confirmation email",
                  "Monitor a URL every 5 minutes and alert via Slack if it's down",
                ].map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => setWorkflowDescription(prompt)}
                    className="p-3 rounded-lg border text-left hover:bg-accent/50 transition-colors"
                  >
                    <p className="text-sm text-muted-foreground">{prompt}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
