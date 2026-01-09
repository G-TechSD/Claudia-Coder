"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Plus,
  Minus,
  Loader2,
  Check,
  X,
  Zap,
  FolderOpen,
  Database,
  Globe,
  GitBranch,
  MessageSquare,
  Cloud,
  Monitor,
  Search,
  AlertTriangle,
  ExternalLink
} from "lucide-react"
import { MCPManagedServer, MCPScope, MCPServerTemplate } from "@/lib/mcp/types"
import { mcpServerTemplates, getTemplatesByCategory } from "@/lib/mcp/templates"
import { checkServerDependencies } from "./SystemRequirements"

interface DependencyWarning {
  canRun: boolean
  missing: string[]
  runtime: string
  message: string
  installInstructions: Record<string, string>
}

interface AddMCPServerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (server: Omit<MCPManagedServer, "id" | "createdAt" | "updatedAt" | "status">) => void
  editServer?: MCPManagedServer | null
  projects?: { id: string; name: string }[]
}

const categoryIcons: Record<string, React.ReactNode> = {
  Filesystem: <FolderOpen className="h-4 w-4" />,
  "Version Control": <GitBranch className="h-4 w-4" />,
  Databases: <Database className="h-4 w-4" />,
  "Web & API": <Globe className="h-4 w-4" />,
  Productivity: <MessageSquare className="h-4 w-4" />,
  Development: <Monitor className="h-4 w-4" />,
  Cloud: <Cloud className="h-4 w-4" />,
  Design: <Monitor className="h-4 w-4" />
}

export function AddMCPServerDialog({
  open,
  onOpenChange,
  onSave,
  editServer,
  projects = []
}: AddMCPServerDialogProps) {
  const [activeTab, setActiveTab] = useState<"custom" | "templates">("templates")

  // Form state
  const [name, setName] = useState("")
  const [command, setCommand] = useState("")
  const [args, setArgs] = useState("")
  const [scope, setScope] = useState<MCPScope>("global")
  const [projectId, setProjectId] = useState<string>("")
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([])

  // Testing state
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  // Dependency warning state
  const [depWarning, setDepWarning] = useState<DependencyWarning | null>(null)
  const [isCheckingDeps, setIsCheckingDeps] = useState(false)
  const [showInstallInstructions, setShowInstallInstructions] = useState<string | null>(null)

  // Reset form when dialog opens/closes or edit server changes
  useEffect(() => {
    if (open) {
      if (editServer) {
        setName(editServer.name)
        setCommand(editServer.command)
        setArgs(editServer.args.join(" "))
        setScope(editServer.scope)
        setProjectId(editServer.projectId || "")
        setEnvVars(
          editServer.env
            ? Object.entries(editServer.env).map(([key, value]) => ({ key, value }))
            : []
        )
        setActiveTab("custom")
      } else {
        setName("")
        setCommand("")
        setArgs("")
        setScope("global")
        setProjectId("")
        setEnvVars([])
        setActiveTab("templates")
      }
      setTestResult(null)
      setDepWarning(null)
      setShowInstallInstructions(null)
    }
  }, [open, editServer])

  // Check dependencies when command changes
  useEffect(() => {
    if (!command.trim()) {
      setDepWarning(null)
      return
    }

    const checkDeps = async () => {
      setIsCheckingDeps(true)
      try {
        const argsArray = args.split(/\s+/).filter(Boolean)
        const result = await checkServerDependencies(command, argsArray)
        setDepWarning(result)
      } catch {
        setDepWarning(null)
      } finally {
        setIsCheckingDeps(false)
      }
    }

    // Debounce the check
    const timeout = setTimeout(checkDeps, 500)
    return () => clearTimeout(timeout)
  }, [command, args])

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: "", value: "" }])
  }

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index))
  }

  const updateEnvVar = (index: number, field: "key" | "value", value: string) => {
    const updated = [...envVars]
    updated[index][field] = value
    setEnvVars(updated)
  }

  const selectTemplate = (template: MCPServerTemplate) => {
    setName(template.name)
    setCommand(template.command)
    setArgs(template.args.join(" "))
    if (template.env) {
      setEnvVars(Object.entries(template.env).map(([key, value]) => ({ key, value })))
    } else {
      setEnvVars([])
    }
    setActiveTab("custom")
  }

  const testConnection = async () => {
    setIsTesting(true)
    setTestResult(null)

    try {
      const response = await fetch("/api/mcp/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command,
          args: args.split(/\s+/).filter(Boolean),
          env: envVars.reduce((acc, { key, value }) => {
            if (key) acc[key] = value
            return acc
          }, {} as Record<string, string>)
        })
      })

      const result = await response.json()
      setTestResult({
        success: result.success,
        message: result.message
      })
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to test connection"
      })
    } finally {
      setIsTesting(false)
    }
  }

  const handleSave = () => {
    const server: Omit<MCPManagedServer, "id" | "createdAt" | "updatedAt" | "status"> = {
      name,
      command,
      args: args.split(/\s+/).filter(Boolean),
      scope,
      projectId: scope === "project" ? projectId : undefined,
      enabled: true,
      env: envVars.reduce((acc, { key, value }) => {
        if (key) acc[key] = value
        return acc
      }, {} as Record<string, string>)
    }

    onSave(server)
    onOpenChange(false)
  }

  const isValid = name.trim() && command.trim()
  const templatesByCategory = getTemplatesByCategory()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>{editServer ? "Edit MCP Server" : "Add MCP Server"}</DialogTitle>
          <DialogDescription>
            Configure an MCP server for Claude Code to use
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "custom" | "templates")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="mt-4">
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {Object.entries(templatesByCategory).map(([category, templates]) => (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-2">
                    {categoryIcons[category] || <Zap className="h-4 w-4" />}
                    <span className="font-medium text-sm">{category}</span>
                  </div>
                  <div className="grid gap-2">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => selectTemplate(template)}
                        className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors text-left"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{template.name}</span>
                            {template.env && Object.keys(template.env).length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                Requires config
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {template.description}
                          </p>
                        </div>
                        <Plus className="h-4 w-4 text-muted-foreground mt-1" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="custom" className="mt-4 space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Filesystem Server"
              />
            </div>

            {/* Command */}
            <div className="space-y-2">
              <Label htmlFor="command">Command</Label>
              <Input
                id="command"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="e.g., npx, node, python"
              />
            </div>

            {/* Args */}
            <div className="space-y-2">
              <Label htmlFor="args">Arguments</Label>
              <Input
                id="args"
                value={args}
                onChange={(e) => setArgs(e.target.value)}
                placeholder="e.g., -y @modelcontextprotocol/server-filesystem /home"
              />
              <p className="text-xs text-muted-foreground">
                Space-separated arguments to pass to the command
              </p>
            </div>

            {/* Dependency Warning */}
            {isCheckingDeps && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Checking dependencies...</span>
              </div>
            )}

            {depWarning && !isCheckingDeps && (
              <div
                className={`p-3 rounded-lg border ${
                  depWarning.canRun
                    ? "bg-green-500/5 border-green-500/20"
                    : "bg-yellow-500/5 border-yellow-500/20"
                }`}
              >
                <div className="flex items-start gap-2">
                  {depWarning.canRun ? (
                    <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1">
                    <p
                      className={`text-sm font-medium ${
                        depWarning.canRun ? "text-green-500" : "text-yellow-500"
                      }`}
                    >
                      {depWarning.message}
                    </p>
                    {depWarning.runtime !== "unknown" && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Runtime: {depWarning.runtime}
                      </p>
                    )}

                    {/* Missing dependencies with install instructions */}
                    {depWarning.missing.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {depWarning.missing.map((dep) => (
                          <div key={dep}>
                            <button
                              type="button"
                              onClick={() =>
                                setShowInstallInstructions(
                                  showInstallInstructions === dep ? null : dep
                                )
                              }
                              className="flex items-center gap-1 text-xs text-yellow-600 hover:underline"
                            >
                              <X className="h-3 w-3" />
                              <span>{dep}</span>
                              <span className="text-muted-foreground">
                                - Click for install instructions
                              </span>
                            </button>
                            {showInstallInstructions === dep &&
                              depWarning.installInstructions[dep] && (
                                <pre className="mt-1 p-2 rounded bg-muted text-xs font-mono whitespace-pre-wrap">
                                  {depWarning.installInstructions[dep]}
                                </pre>
                              )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Scope */}
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as MCPScope)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      <span>Global (all projects)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="project">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4" />
                      <span>Project-specific</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Project selector (only shown for project scope) */}
            {scope === "project" && (
              <div className="space-y-2">
                <Label>Project</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Environment Variables */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Environment Variables</Label>
                <Button variant="outline" size="sm" onClick={addEnvVar}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>

              {envVars.length > 0 ? (
                <div className="space-y-2">
                  {envVars.map((envVar, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={envVar.key}
                        onChange={(e) => updateEnvVar(index, "key", e.target.value)}
                        placeholder="KEY"
                        className="flex-1"
                      />
                      <Input
                        value={envVar.value}
                        onChange={(e) => updateEnvVar(index, "value", e.target.value)}
                        placeholder="value"
                        className="flex-[2]"
                        type="password"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeEnvVar(index)}
                        className="shrink-0"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No environment variables configured
                </p>
              )}
            </div>

            {/* Test Connection */}
            <div className="pt-2">
              <Button
                variant="outline"
                onClick={testConnection}
                disabled={!command || isTesting}
                className="w-full"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testing Connection...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Test Connection
                  </>
                )}
              </Button>

              {testResult && (
                <div
                  className={`mt-2 p-3 rounded-lg flex items-start gap-2 ${
                    testResult.success
                      ? "bg-green-500/10 text-green-500"
                      : "bg-red-500/10 text-red-500"
                  }`}
                >
                  {testResult.success ? (
                    <Check className="h-4 w-4 mt-0.5 shrink-0" />
                  ) : (
                    <X className="h-4 w-4 mt-0.5 shrink-0" />
                  )}
                  <span className="text-sm">{testResult.message}</span>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid}>
            {editServer ? "Update Server" : "Add Server"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
