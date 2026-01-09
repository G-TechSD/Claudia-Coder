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
  getUserGitLabConfig,
  updateUserGitLabConfig,
  testGitLabConnection,
  type UserGitLabConfig,
  type GitLabInstanceMode,
} from "@/lib/data/user-gitlab"
import {
  createUserProjectService,
  type UserProject,
} from "@/lib/gitlab/user-projects"
import {
  GitBranch,
  Server,
  Share2,
  User,
  Check,
  X,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  Settings,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Info,
  Copy,
  FolderGit,
  Lock,
  Globe,
} from "lucide-react"

export default function GitLabSettingsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const [config, setConfig] = useState<UserGitLabConfig | null>(null)
  const [projects, setProjects] = useState<UserProject[]>([])

  // Form state
  const [mode, setMode] = useState<GitLabInstanceMode>("shared")
  const [personalUrl, setPersonalUrl] = useState("")
  const [personalToken, setPersonalToken] = useState("")
  const [showToken, setShowToken] = useState(false)
  const [defaultVisibility, setDefaultVisibility] = useState<"private" | "internal" | "public">("private")
  const [autoCreate, setAutoCreate] = useState(true)
  const [defaultBranch, setDefaultBranch] = useState("main")

  // Status state
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; username?: string } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [projectError, setProjectError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Load config on mount
  useEffect(() => {
    if (user?.id) {
      const userConfig = getUserGitLabConfig(user.id)
      setConfig(userConfig)
      setMode(userConfig.mode)
      setPersonalUrl(userConfig.personalInstance?.baseUrl || "")
      setPersonalToken(userConfig.personalInstance?.personalAccessToken || "")
      setDefaultVisibility(userConfig.defaultVisibility)
      setAutoCreate(userConfig.autoCreateProjects)
      setDefaultBranch(userConfig.defaultBranch)
    }
  }, [user?.id])

  // Load projects
  const loadProjects = useCallback(async () => {
    if (!user?.id) return

    setIsLoadingProjects(true)
    setProjectError(null)

    try {
      const service = createUserProjectService(user.id)

      if (!service.isConfigured()) {
        setProjectError("GitLab not configured. Add your token below.")
        setProjects([])
        return
      }

      const userProjects = await service.getProjects({
        orderBy: "last_activity_at",
        sort: "desc",
        perPage: 20,
      })
      setProjects(userProjects)
    } catch (error) {
      console.error("Failed to load projects:", error)
      setProjectError(error instanceof Error ? error.message : "Failed to load projects")
    } finally {
      setIsLoadingProjects(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (user?.id && config) {
      loadProjects()
    }
  }, [user?.id, config, loadProjects])

  // Test connection
  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult(null)

    const testUrl = mode === "personal" ? personalUrl : (process.env.NEXT_PUBLIC_GITLAB_URL || "https://bill-dev-linux-1")
    const testToken = mode === "personal" ? personalToken : (typeof window !== "undefined" ? localStorage.getItem("gitlab_token") || "" : "")

    if (!testToken) {
      setTestResult({
        success: false,
        message: "No token configured",
      })
      setIsTesting(false)
      return
    }

    try {
      const result = await testGitLabConnection(testUrl, testToken)

      setTestResult({
        success: result.healthy,
        message: result.message,
        username: result.user?.username,
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
      const updates: Partial<UserGitLabConfig> = {
        mode,
        defaultVisibility,
        autoCreateProjects: autoCreate,
        defaultBranch,
      }

      if (mode === "personal") {
        updates.personalInstance = {
          baseUrl: personalUrl,
          personalAccessToken: personalToken,
        }
      }

      updateUserGitLabConfig(user.id, updates)
      setConfig(getUserGitLabConfig(user.id))

      setSaveStatus("saved")
      setTimeout(() => setSaveStatus("idle"), 2000)

      // Reload projects with new config
      await loadProjects()
    } catch (error) {
      console.error("Failed to save settings:", error)
      setSaveStatus("error")
    } finally {
      setIsSaving(false)
    }
  }

  // Copy namespace to clipboard
  const handleCopyNamespace = () => {
    if (config?.sharedNamespace?.groupPath) {
      navigator.clipboard.writeText(config.sharedNamespace.groupPath)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Visibility icon
  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case "private":
        return <Lock className="h-3 w-3" />
      case "internal":
        return <User className="h-3 w-3" />
      case "public":
        return <Globe className="h-3 w-3" />
      default:
        return <Lock className="h-3 w-3" />
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
        <p className="text-muted-foreground">Please sign in to access GitLab settings.</p>
      </div>
    )
  }

  const sharedGitLabUrl = process.env.NEXT_PUBLIC_GITLAB_URL || "https://bill-dev-linux-1"

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/20 to-red-600/20">
            <GitBranch className="h-6 w-6 text-orange-500" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">GitLab Settings</h1>
            <p className="text-sm text-muted-foreground">
              Configure your source control and repository management
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
            GitLab Instance
          </CardTitle>
          <CardDescription>
            Choose how you want to connect to GitLab for source control
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
                  <p className="font-medium">Claudia&apos;s Shared GitLab</p>
                  <Badge variant="secondary" className="mt-1">Recommended</Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Use Claudia&apos;s GitLab instance. Your projects are isolated using namespaces
                and groups. Perfect for getting started quickly.
              </p>
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground font-mono">{sharedGitLabUrl}</p>
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
                  <p className="font-medium">Your Own GitLab Instance</p>
                  <Badge variant="outline" className="mt-1">Advanced</Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Connect your own GitLab server or GitLab.com account. Full control over
                your repositories and settings.
              </p>
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground">Self-hosted or GitLab.com</p>
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
                  <Label htmlFor="gitlab-url">GitLab URL</Label>
                  <Input
                    id="gitlab-url"
                    placeholder="https://gitlab.com or https://your-gitlab.example.com"
                    value={personalUrl}
                    onChange={(e) => setPersonalUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    The base URL of your GitLab instance (without trailing slash)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gitlab-token">Personal Access Token</Label>
                  <div className="relative">
                    <Input
                      id="gitlab-token"
                      type={showToken ? "text" : "password"}
                      placeholder="glpat-..."
                      value={personalToken}
                      onChange={(e) => setPersonalToken(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Generate a token with <code>api</code> scope in GitLab Settings &gt; Access Tokens
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={!personalUrl || !personalToken || isTesting}
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
                  <p className="font-medium text-sm">Your Project Namespace</p>
                  <p className="text-sm text-muted-foreground">
                    Your projects are automatically created within your personal namespace
                    to keep them isolated from other users.
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <code className="px-2 py-1 bg-muted rounded text-xs font-mono">
                      {config.sharedNamespace.groupPath}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyNamespace}
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

              {/* Shared instance token configuration */}
              <div className="space-y-2 pt-4 border-t border-blue-500/20">
                <Label htmlFor="shared-token">Personal Access Token</Label>
                <div className="relative">
                  <Input
                    id="shared-token"
                    type={showToken ? "text" : "password"}
                    placeholder="glpat-..."
                    value={typeof window !== "undefined" ? localStorage.getItem("gitlab_token") || "" : ""}
                    onChange={(e) => {
                      if (typeof window !== "undefined") {
                        localStorage.setItem("gitlab_token", e.target.value)
                      }
                    }}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your token for accessing the shared GitLab instance
                </p>

                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={isTesting}
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
        </CardContent>
      </Card>

      {/* Project Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderGit className="h-5 w-5" />
            Project Preferences
          </CardTitle>
          <CardDescription>
            Configure default settings for new projects
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div>
              <p className="font-medium">Auto-create Projects</p>
              <p className="text-sm text-muted-foreground">
                Automatically create GitLab repositories for new Claudia projects
              </p>
            </div>
            <Switch
              checked={autoCreate}
              onCheckedChange={setAutoCreate}
            />
          </div>

          <div className="space-y-2 p-4 rounded-lg border">
            <Label>Default Visibility</Label>
            <p className="text-sm text-muted-foreground mb-3">
              Default visibility level for new projects
            </p>
            <div className="flex gap-2">
              {[
                { value: "private" as const, label: "Private", icon: Lock },
                { value: "internal" as const, label: "Internal", icon: User },
                { value: "public" as const, label: "Public", icon: Globe },
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setDefaultVisibility(value)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors",
                    defaultVisibility === value
                      ? "border-primary bg-primary/5 text-primary"
                      : "hover:bg-accent"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 p-4 rounded-lg border">
            <Label htmlFor="default-branch">Default Branch</Label>
            <Input
              id="default-branch"
              placeholder="main"
              value={defaultBranch}
              onChange={(e) => setDefaultBranch(e.target.value)}
              className="max-w-xs"
            />
            <p className="text-sm text-muted-foreground">
              Default branch name for new repositories
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Your Projects */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Your Projects
              </CardTitle>
              <CardDescription>
                Repositories associated with your account
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadProjects}
                disabled={isLoadingProjects}
                className="gap-2"
              >
                <RefreshCw className={cn("h-4 w-4", isLoadingProjects && "animate-spin")} />
                Refresh
              </Button>
              <Button
                asChild
                size="sm"
                className="gap-2"
              >
                <a
                  href={mode === "personal" && personalUrl ? personalUrl : sharedGitLabUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open GitLab
                </a>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingProjects ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : projectError ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-2 text-red-400" />
              <p className="text-sm">{projectError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadProjects}
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <FolderGit className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No projects found</p>
              <p className="text-xs">Create a project to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg",
                      project.visibility === "private" ? "bg-amber-500/10" :
                      project.visibility === "internal" ? "bg-blue-500/10" : "bg-green-500/10"
                    )}>
                      <FolderGit className={cn(
                        "h-4 w-4",
                        project.visibility === "private" ? "text-amber-500" :
                        project.visibility === "internal" ? "text-blue-500" : "text-green-500"
                      )} />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{project.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-xs gap-1">
                          {getVisibilityIcon(project.visibility)}
                          {project.visibility}
                        </Badge>
                        {project.default_branch && (
                          <span className="text-xs text-muted-foreground">
                            {project.default_branch}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(project.last_activity_at).toLocaleDateString()}
                    </span>
                    <Button variant="ghost" size="sm" asChild>
                      <a
                        href={project.web_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Getting Started
          </CardTitle>
          <CardDescription>
            Tips for setting up GitLab integration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Creating a Personal Access Token</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Go to GitLab Settings &gt; Access Tokens</li>
              <li>Create a new token with the <code className="px-1 py-0.5 bg-muted rounded">api</code> scope</li>
              <li>Set an expiration date (we recommend 1 year)</li>
              <li>Copy the token and paste it above</li>
            </ol>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-sm">Shared vs Personal Instance</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium text-foreground mb-1">Shared Instance</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Quick setup</li>
                  <li>Automatic isolation via namespaces</li>
                  <li>Managed by Claudia</li>
                </ul>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium text-foreground mb-1">Personal Instance</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Full control over repositories</li>
                  <li>Use existing GitLab.com account</li>
                  <li>Private credentials</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
