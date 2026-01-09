"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  getUserN8NConfig,
  updateUserN8NConfig,
  type UserN8NConfig,
  type N8NInstanceMode,
} from "@/lib/data/user-settings"
import {
  createUserWorkflowService,
  getWorkflowTemplates,
  type UserWorkflow,
  type WorkflowTemplate,
} from "@/lib/n8n/user-workflows"
import {
  Workflow,
  Server,
  Share2,
  User,
  Check,
  X,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  Plus,
  Settings,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Info,
  Copy,
  Sparkles,
} from "lucide-react"

export default function N8NSettingsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const [config, setConfig] = useState<UserN8NConfig | null>(null)
  const [workflows, setWorkflows] = useState<UserWorkflow[]>([])
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])

  // Form state
  const [mode, setMode] = useState<N8NInstanceMode>("shared")
  const [personalUrl, setPersonalUrl] = useState("")
  const [personalApiKey, setPersonalApiKey] = useState("")
  const [showApiKey, setShowApiKey] = useState(false)
  const [autoCreate, setAutoCreate] = useState(true)

  // Status state
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(false)
  const [workflowError, setWorkflowError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Load config on mount
  useEffect(() => {
    if (user?.id) {
      const userConfig = getUserN8NConfig(user.id)
      setConfig(userConfig)
      setMode(userConfig.mode)
      setPersonalUrl(userConfig.personalInstance?.baseUrl || "")
      setPersonalApiKey(userConfig.personalInstance?.apiKey || "")
      setAutoCreate(userConfig.autoCreateWorkflows)
    }
  }, [user?.id])

  // Load templates
  useEffect(() => {
    setTemplates(getWorkflowTemplates())
  }, [])

  // Load workflows
  const loadWorkflows = useCallback(async () => {
    if (!user?.id) return

    setIsLoadingWorkflows(true)
    setWorkflowError(null)

    try {
      const service = createUserWorkflowService(user.id)
      const userWorkflows = await service.getWorkflows()
      setWorkflows(userWorkflows)
    } catch (error) {
      console.error("Failed to load workflows:", error)
      setWorkflowError(error instanceof Error ? error.message : "Failed to load workflows")
    } finally {
      setIsLoadingWorkflows(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (user?.id && config) {
      loadWorkflows()
    }
  }, [user?.id, config, loadWorkflows])

  // Test connection
  const handleTestConnection = async () => {
    if (!user?.id) return

    setIsTesting(true)
    setTestResult(null)

    try {
      // Temporarily update config to test
      const testConfig: Partial<UserN8NConfig> = {
        mode,
      }

      if (mode === "personal") {
        testConfig.personalInstance = {
          baseUrl: personalUrl,
          apiKey: personalApiKey,
        }
      }

      // Save temporarily to test
      updateUserN8NConfig(user.id, testConfig)

      const service = createUserWorkflowService(user.id)
      const status = await service.getStatus()

      setTestResult({
        success: status.healthy,
        message: status.message,
      })
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Connection test failed",
      })
    } finally {
      setIsTesting(false)
    }
  }

  // Save settings
  const handleSave = async () => {
    if (!user?.id) return

    setIsSaving(true)
    setSaveStatus("saving")

    try {
      const updates: Partial<UserN8NConfig> = {
        mode,
        autoCreateWorkflows: autoCreate,
      }

      if (mode === "personal") {
        updates.personalInstance = {
          baseUrl: personalUrl,
          apiKey: personalApiKey,
        }
      }

      updateUserN8NConfig(user.id, updates)
      setConfig(getUserN8NConfig(user.id))

      setSaveStatus("saved")
      setTimeout(() => setSaveStatus("idle"), 2000)

      // Reload workflows with new config
      await loadWorkflows()
    } catch (error) {
      console.error("Failed to save settings:", error)
      setSaveStatus("error")
    } finally {
      setIsSaving(false)
    }
  }

  // Copy user tag to clipboard
  const handleCopyTag = () => {
    if (config?.sharedNamespace?.tag) {
      navigator.clipboard.writeText(config.sharedNamespace.tag)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Please sign in to access n8n settings.</p>
      </div>
    )
  }

  const sharedN8NUrl = process.env.NEXT_PUBLIC_N8N_URL || "https://192.168.245.211:5678"

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20">
            <Workflow className="h-6 w-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">N8N Settings</h1>
            <p className="text-sm text-muted-foreground">
              Configure your workflow automation instance
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-sm text-green-500">
              <CheckCircle className="h-4 w-4" />
              Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span className="flex items-center gap-1 text-sm text-red-500">
              <X className="h-4 w-4" />
              Failed to save
            </span>
          )}
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Instance Mode Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            N8N Instance
          </CardTitle>
          <CardDescription>
            Choose how you want to connect to n8n for workflow automation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mode Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Shared Instance Option */}
            <button
              onClick={() => setMode("shared")}
              className={cn(
                "relative p-6 rounded-lg border-2 text-left transition-all",
                mode === "shared"
                  ? "border-primary bg-primary/5"
                  : "border-muted hover:border-muted-foreground/50"
              )}
            >
              {mode === "shared" && (
                <div className="absolute top-3 right-3">
                  <CheckCircle className="h-5 w-5 text-primary" />
                </div>
              )}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <Share2 className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="font-medium">Claudia's Shared N8N</p>
                  <Badge variant="secondary" className="mt-1">Beta</Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Use Claudia's shared n8n instance. Your workflows are isolated using tags
                and prefixes. Perfect for getting started.
              </p>
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground font-mono">{sharedN8NUrl}</p>
              </div>
            </button>

            {/* Personal Instance Option */}
            <button
              onClick={() => setMode("personal")}
              className={cn(
                "relative p-6 rounded-lg border-2 text-left transition-all",
                mode === "personal"
                  ? "border-primary bg-primary/5"
                  : "border-muted hover:border-muted-foreground/50"
              )}
            >
              {mode === "personal" && (
                <div className="absolute top-3 right-3">
                  <CheckCircle className="h-5 w-5 text-primary" />
                </div>
              )}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                  <User className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="font-medium">Your Own N8N Instance</p>
                  <Badge variant="outline" className="mt-1">Advanced</Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Connect your own n8n server. Full control over your workflows, credentials,
                and data. Requires n8n API access.
              </p>
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground">Self-hosted or n8n Cloud</p>
              </div>
            </button>
          </div>

          {/* Personal Instance Configuration */}
          {mode === "personal" && (
            <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium text-sm">Personal Instance Configuration</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="n8n-url">N8N URL</Label>
                  <Input
                    id="n8n-url"
                    placeholder="https://your-n8n.example.com"
                    value={personalUrl}
                    onChange={(e) => setPersonalUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    The base URL of your n8n instance (without trailing slash)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="n8n-api-key">API Key</Label>
                  <div className="relative">
                    <Input
                      id="n8n-api-key"
                      type={showApiKey ? "text" : "password"}
                      placeholder="n8n_api_..."
                      value={personalApiKey}
                      onChange={(e) => setPersonalApiKey(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Generate an API key in n8n Settings &gt; API
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={!personalUrl || !personalApiKey || isTesting}
                    className="gap-2"
                  >
                    {isTesting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Test Connection
                  </Button>

                  {testResult && (
                    <span className={cn(
                      "flex items-center gap-1 text-sm",
                      testResult.success ? "text-green-500" : "text-red-500"
                    )}>
                      {testResult.success ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                      {testResult.message}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Shared Instance Info */}
          {mode === "shared" && config?.sharedNamespace && (
            <div className="space-y-4 p-4 rounded-lg border bg-blue-500/5 border-blue-500/20">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <p className="font-medium text-sm">Your Workflow Namespace</p>
                  <p className="text-sm text-muted-foreground">
                    Your workflows are automatically tagged and prefixed to keep them
                    isolated from other users.
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <code className="px-2 py-1 bg-muted rounded text-xs font-mono">
                      {config.sharedNamespace.tag}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyTag}
                      className="h-7 px-2"
                    >
                      {copied ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workflow Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Workflow Preferences
          </CardTitle>
          <CardDescription>
            Configure how Claudia manages your workflows
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div>
              <p className="font-medium">Auto-create Workflows</p>
              <p className="text-sm text-muted-foreground">
                Automatically create workflows when Claudia suggests automations
              </p>
            </div>
            <Switch
              checked={autoCreate}
              onCheckedChange={setAutoCreate}
            />
          </div>
        </CardContent>
      </Card>

      {/* Your Workflows */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Workflow className="h-5 w-5" />
                Your Workflows
              </CardTitle>
              <CardDescription>
                Workflows associated with your account
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadWorkflows}
                disabled={isLoadingWorkflows}
                className="gap-2"
              >
                <RefreshCw className={cn("h-4 w-4", isLoadingWorkflows && "animate-spin")} />
                Refresh
              </Button>
              <Button
                asChild
                size="sm"
                className="gap-2"
              >
                <a
                  href={mode === "personal" && personalUrl ? personalUrl : sharedN8NUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open N8N
                </a>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingWorkflows ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : workflowError ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-2 text-red-400" />
              <p className="text-sm">{workflowError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadWorkflows}
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          ) : workflows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Workflow className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No workflows found</p>
              <p className="text-xs">Create workflows in the N8N editor</p>
            </div>
          ) : (
            <div className="space-y-2">
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg",
                      workflow.active ? "bg-green-500/10" : "bg-muted"
                    )}>
                      <Workflow className={cn(
                        "h-4 w-4",
                        workflow.active ? "text-green-500" : "text-muted-foreground"
                      )} />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{workflow.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant={workflow.active ? "success" : "secondary"} className="text-xs">
                          {workflow.active ? "Active" : "Inactive"}
                        </Badge>
                        {workflow.tags?.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <a
                      href={`${mode === "personal" && personalUrl ? personalUrl : sharedN8NUrl}/workflow/${workflow.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workflow Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Quick Start Templates
          </CardTitle>
          <CardDescription>
            Pre-built workflow templates to get you started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className="p-4 rounded-lg border hover:border-primary/50 hover:bg-accent/30 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Workflow className="h-4 w-4 text-primary" />
                  <p className="font-medium text-sm">{template.name}</p>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {template.description}
                </p>
                <Badge variant="outline" className="text-xs">
                  {template.category}
                </Badge>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Click a template to create a new workflow (coming soon)
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
