"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectSeparator,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  Terminal,
  Play,
  FolderOpen,
  GitBranch,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Layers,
  Settings2,
  Plug,
  ChevronRight,
  Globe,
  Loader2,
  Copy,
  Check,
  FolderPlus,
} from "lucide-react"
import Link from "next/link"
import { getMCPServers } from "@/lib/mcp/storage"
import { MCPManagedServer } from "@/lib/mcp/types"
import { getAllProjects, getEffectiveWorkingDirectory, updateProject } from "@/lib/data/projects"
import type { Project } from "@/lib/data/types"
import { ClaudeCodeTerminal } from "@/components/claude-code/terminal"

// Special value for custom folder selection
const CUSTOM_FOLDER_ID = "__custom_folder__"

// Helper to ensure working directory exists via API
async function ensureWorkingDirectory(project: Project): Promise<string> {
  const repoWithPath = project.repos.find(r => r.localPath)

  const response = await fetch("/api/projects/ensure-working-directory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: project.id,
      projectName: project.name,
      existingWorkingDirectory: project.workingDirectory,
      repoLocalPath: repoWithPath?.localPath
    })
  })

  if (!response.ok) {
    throw new Error("Failed to ensure working directory")
  }

  const data = await response.json()

  // Update project with working directory if it was newly set
  if (!project.workingDirectory && data.workingDirectory) {
    updateProject(project.id, { workingDirectory: data.workingDirectory })
  }

  return data.workingDirectory
}

export default function ClaudeCodePage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")
  const [bypassPermissions, setBypassPermissions] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [mcpServers, setMcpServers] = useState<MCPManagedServer[]>([])
  const [terminalKey, setTerminalKey] = useState(0)
  const [terminalStarted, setTerminalStarted] = useState(false)
  const [isPreparingWorkDir, setIsPreparingWorkDir] = useState(false)
  const [workDirError, setWorkDirError] = useState<string | null>(null)
  const [resolvedWorkingDirectory, setResolvedWorkingDirectory] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  // Custom folder support
  const [useCustomFolder, setUseCustomFolder] = useState(false)
  const [customFolderPath, setCustomFolderPath] = useState("")

  // Load projects and MCP servers
  useEffect(() => {
    loadData()
  }, [])

  const loadData = () => {
    setIsLoading(true)
    const allProjects = getAllProjects()
    const servers = getMCPServers()
    setProjects(allProjects)
    setMcpServers(servers)
    setIsLoading(false)
  }

  const loadProjects = loadData

  // Get selected project
  const selectedProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId) || null
  }, [projects, selectedProjectId])

  // Get the primary repo (first one with localPath, or first one)
  const primaryRepo = useMemo(() => {
    if (!selectedProject) return null
    const repoWithPath = selectedProject.repos.find(r => r.localPath)
    return repoWithPath || selectedProject.repos[0] || null
  }, [selectedProject])

  // Get working directory - uses project's workingDirectory, falls back to repo localPath, or generates one
  const workingDirectory = useMemo(() => {
    if (!selectedProject) return null
    return getEffectiveWorkingDirectory(selectedProject)
  }, [selectedProject])

  // Build the claude command
  const command = useMemo(() => {
    const parts = ["claude"]
    if (bypassPermissions) {
      parts.push("--dangerously-skip-permissions")
    }
    return parts.join(" ")
  }, [bypassPermissions])

  // Copy command to clipboard
  const copyCommand = useCallback(() => {
    const fullCommand = workingDirectory
      ? `cd "${workingDirectory}" && ${command}`
      : command
    navigator.clipboard.writeText(fullCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [command, workingDirectory])

  // Handle project selection change
  const handleProjectChange = useCallback((value: string) => {
    if (value === CUSTOM_FOLDER_ID) {
      setUseCustomFolder(true)
      setSelectedProjectId("")
    } else {
      setUseCustomFolder(false)
      setSelectedProjectId(value)
    }
    // Reset terminal when changing selection
    setTerminalStarted(false)
    setResolvedWorkingDirectory(null)
  }, [])

  // Start Claude Code session - ensures working directory exists first
  const handleStartClaudeCode = useCallback(async () => {
    // Custom folder mode
    if (useCustomFolder) {
      if (!customFolderPath.trim()) {
        setWorkDirError("Please enter a folder path")
        return
      }
      setIsPreparingWorkDir(true)
      setWorkDirError(null)
      try {
        // Validate custom folder exists
        const response = await fetch("/api/projects/ensure-working-directory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: "custom",
            projectName: "Custom Session",
            existingWorkingDirectory: customFolderPath.trim()
          })
        })
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Failed to validate folder")
        }
        setResolvedWorkingDirectory(customFolderPath.trim())
        setTerminalStarted(true)
        setTerminalKey(prev => prev + 1)
      } catch (err) {
        setWorkDirError(err instanceof Error ? err.message : "Failed to access folder")
      } finally {
        setIsPreparingWorkDir(false)
      }
      return
    }

    // Project mode
    if (!selectedProject) return

    setIsPreparingWorkDir(true)
    setWorkDirError(null)

    try {
      // Ensure working directory exists on filesystem
      const workDir = await ensureWorkingDirectory(selectedProject)
      setResolvedWorkingDirectory(workDir)

      // Mark terminal as started (this triggers showing the terminal)
      setTerminalStarted(true)
      // Increment key to reset terminal and start fresh session
      setTerminalKey(prev => prev + 1)
    } catch (err) {
      setWorkDirError(err instanceof Error ? err.message : "Failed to create working directory")
    } finally {
      setIsPreparingWorkDir(false)
    }
  }, [selectedProject, useCustomFolder, customFolderPath])

  // Determine if we can start a session
  const canStart = useCustomFolder ? customFolderPath.trim().length > 0 : !!selectedProject

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Terminal className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Claude Code</h1>
            <p className="text-sm text-muted-foreground">Launch Claude Code CLI for your projects</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadProjects} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Project Selection - Above Terminal */}
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="h-4 w-4" />
                Project Selection
              </CardTitle>
              <CardDescription>Choose a project or custom folder</CardDescription>
            </div>
            <Button
              variant="default"
              size="sm"
              className="gap-2"
              disabled={!canStart || isPreparingWorkDir}
              onClick={handleStartClaudeCode}
            >
              {isPreparingWorkDir ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Start Session
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <Select
                  value={useCustomFolder ? CUSTOM_FOLDER_ID : selectedProjectId}
                  onValueChange={handleProjectChange}
                >
                  <SelectTrigger>
                    {useCustomFolder ? (
                      <div className="flex items-center gap-2">
                        <FolderPlus className="h-4 w-4" />
                        <span>Custom Folder</span>
                      </div>
                    ) : selectedProject ? (
                      <div className="flex items-center gap-2">
                        <span>{selectedProject.name}</span>
                        {selectedProject.repos.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {selectedProject.repos.length} repo{selectedProject.repos.length !== 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Select a project...</span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        <div className="flex items-center gap-2">
                          <span>{project.name}</span>
                          {project.repos.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {project.repos.length} repo{project.repos.length !== 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                    <SelectSeparator />
                    <SelectItem value={CUSTOM_FOLDER_ID}>
                      <div className="flex items-center gap-2">
                        <FolderPlus className="h-4 w-4" />
                        <span>Custom / Temp Folder</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Custom folder path input */}
              {useCustomFolder && (
                <div className="flex-1">
                  <Input
                    placeholder="/path/to/your/folder"
                    value={customFolderPath}
                    onChange={(e) => setCustomFolderPath(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              )}
            </div>
          )}

          {/* Current selection info */}
          {(selectedProject || useCustomFolder) && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                <span className="font-mono text-xs">
                  {useCustomFolder
                    ? (customFolderPath || "Enter path above")
                    : (workingDirectory || "Will be created on start")}
                </span>
              </div>
              {selectedProject && selectedProject.repos.length > 0 && (
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  <span>{selectedProject.repos[0].name}</span>
                </div>
              )}
            </div>
          )}

          {workDirError && (
            <div className="flex items-center gap-2 text-red-500 text-sm">
              <AlertTriangle className="h-4 w-4" />
              {workDirError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Terminal - Below Project Selection */}
      <Card className="w-full flex-1">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Terminal className="h-4 w-4" />
                Terminal
              </CardTitle>
              <CardDescription>Interactive Claude Code session</CardDescription>
            </div>
            {(selectedProject || useCustomFolder) && terminalStarted && (
              <Badge variant="secondary">
                {useCustomFolder ? "Custom Folder" : selectedProject?.name}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {terminalStarted && resolvedWorkingDirectory ? (
            <ClaudeCodeTerminal
              key={terminalKey}
              projectId={useCustomFolder ? "custom" : (selectedProject?.id || "unknown")}
              projectName={useCustomFolder ? "Custom Session" : (selectedProject?.name || "Unknown")}
              projectDescription={useCustomFolder ? `Custom folder: ${customFolderPath}` : (selectedProject?.description || "")}
              workingDirectory={resolvedWorkingDirectory}
              bypassPermissions={bypassPermissions}
              className="h-[500px]"
              onSessionEnd={() => setTerminalStarted(false)}
            />
          ) : (
            <div className="h-[500px] rounded-lg bg-zinc-900 border border-zinc-800 p-4 font-mono text-sm flex flex-col">
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
                {isPreparingWorkDir ? (
                  <>
                    <Loader2 className="h-12 w-12 mb-4 animate-spin text-zinc-400" />
                    <p className="text-zinc-400">Preparing working directory...</p>
                  </>
                ) : canStart ? (
                  <>
                    <Terminal className="h-12 w-12 mb-4 opacity-50" />
                    <p className="text-zinc-400">Ready to launch Claude Code</p>
                    <p className="mt-2 text-zinc-600 text-sm">
                      {useCustomFolder ? `Folder: ${customFolderPath}` : `Project: ${selectedProject?.name}`}
                    </p>
                    <p className="text-zinc-600 mt-4 text-sm">Click &quot;Start Session&quot; above to begin...</p>
                  </>
                ) : (
                  <>
                    <Terminal className="h-12 w-12 mb-4 opacity-50" />
                    <p className="text-zinc-400">Select a project or custom folder above</p>
                    <p className="mt-2 text-zinc-600 text-xs">
                      Choose from the dropdown to get started.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Configuration Panel */}
        <div className="space-y-6">
          {/* Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Options</CardTitle>
              <CardDescription>Configure Claude Code launch settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg border border-orange-500/20 bg-orange-500/5">
                <Checkbox
                  checked={bypassPermissions}
                  onCheckedChange={(checked) => setBypassPermissions(checked as boolean)}
                  id="bypass-permissions"
                />
                <div className="space-y-1">
                  <Label
                    htmlFor="bypass-permissions"
                    className="flex items-center gap-2 cursor-pointer font-medium"
                  >
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    Dangerously bypass permissions
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Skip permission prompts for file operations. Use with caution - Claude will be able to read/write files without asking.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* MCP Servers Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Plug className="h-4 w-4" />
                    MCP Servers
                  </CardTitle>
                  <CardDescription>Model Context Protocol extensions</CardDescription>
                </div>
                <Link href="/claude-code/mcp">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Settings2 className="h-4 w-4" />
                    Manage
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {mcpServers.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <Plug className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No MCP servers configured</p>
                  <Link href="/claude-code/mcp">
                    <Button variant="link" size="sm" className="mt-1">
                      Add your first server
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Summary */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                    <span>{mcpServers.filter(s => s.enabled).length} enabled</span>
                    <span>{mcpServers.filter(s => s.scope === "global").length} global</span>
                  </div>

                  {/* Server list (max 3) */}
                  {mcpServers.slice(0, 3).map((server) => (
                    <div
                      key={server.id}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-lg border text-sm",
                        server.enabled ? "bg-card" : "bg-muted/30 opacity-60"
                      )}
                    >
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full",
                          server.enabled ? "bg-green-500" : "bg-zinc-500"
                        )}
                      />
                      <span className="font-medium truncate flex-1">{server.name}</span>
                      {server.scope === "global" && (
                        <Badge variant="secondary" className="text-xs">
                          <Globe className="h-3 w-3 mr-1" />
                          Global
                        </Badge>
                      )}
                    </div>
                  ))}

                  {/* Show more link if more than 3 */}
                  {mcpServers.length > 3 && (
                    <Link href="/claude-code/mcp">
                      <Button variant="ghost" size="sm" className="w-full mt-2">
                        +{mcpServers.length - 3} more servers
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Command Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Command Preview</CardTitle>
              <CardDescription>The command that will be executed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <pre className="p-4 rounded-lg bg-zinc-900 text-zinc-100 font-mono text-sm overflow-x-auto">
                  {workingDirectory && (
                    <div className="text-zinc-500 mb-2">
                      <span className="text-zinc-400">$</span> cd &quot;{workingDirectory}&quot;
                    </div>
                  )}
                  <div>
                    <span className="text-zinc-400">$</span> {command}
                  </div>
                </pre>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                  onClick={copyCommand}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

            </CardContent>
          </Card>
        </div>

        {/* Project Info Panel */}
        <div className="space-y-6">
          {/* Project Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Project Details</CardTitle>
              <CardDescription>
                {selectedProject ? selectedProject.name : "No project selected"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedProject ? (
                <div className="space-y-4">
                  {/* Description */}
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      Description
                    </div>
                    <p className="text-sm">{selectedProject.description}</p>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                        Status
                      </div>
                      <Badge variant="secondary" className="capitalize">
                        {selectedProject.status}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                        Priority
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {selectedProject.priority}
                      </Badge>
                    </div>
                  </div>

                  {/* Repos */}
                  {selectedProject.repos.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        Linked Repositories
                      </div>
                      <div className="space-y-2">
                        {selectedProject.repos.map((repo) => (
                          <div
                            key={repo.id}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border",
                              repo === primaryRepo && "border-primary/50 bg-primary/5"
                            )}
                          >
                            <GitBranch className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{repo.name}</div>
                              {repo.localPath && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <FolderOpen className="h-3 w-3" />
                                  <span className="truncate">{repo.localPath}</span>
                                </div>
                              )}
                            </div>
                            {repo === primaryRepo && (
                              <Badge variant="secondary" className="text-xs">Primary</Badge>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                              <a href={repo.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Working Directory */}
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      Working Directory
                    </div>
                    {workingDirectory && (
                      <div className="space-y-1">
                        <code className="text-sm bg-muted px-2 py-1 rounded block">
                          {resolvedWorkingDirectory || workingDirectory}
                        </code>
                        {!selectedProject.workingDirectory && !primaryRepo?.localPath && (
                          <p className="text-xs text-muted-foreground">
                            Will be created on first Claude Code launch
                          </p>
                        )}
                      </div>
                    )}
                    {workDirError && (
                      <div className="flex items-center gap-2 text-sm text-red-500 mt-1">
                        <AlertTriangle className="h-4 w-4" />
                        {workDirError}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Layers className="h-12 w-12 mb-3 opacity-50" />
                  <p className="text-sm">Select a project to view details</p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}
