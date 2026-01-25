"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectValue,
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
  ChevronDown,
  Globe,
  Loader2,
  Copy,
  Check,
  FolderPlus,
  LayoutGrid,
  Sparkles,
  History,
} from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/components/auth/auth-provider"
import { getMCPServers } from "@/lib/mcp/storage"
import { MCPManagedServer } from "@/lib/mcp/types"
import { getAllProjects, fetchProjects, getEffectiveWorkingDirectory, updateProject } from "@/lib/data/projects"
import type { Project } from "@/lib/data/types"
import { ClaudeCodeTerminal } from "@/components/claude-code/terminal"
import { MultiTerminalProvider } from "@/components/claude-code/multi/multi-terminal-provider"
import { MultiTerminalDashboard } from "@/components/claude-code/multi/dashboard"
import { CLAUDIA_CODER_PROJECT } from "@/lib/emergent-modules/types"

// Special values for selection
const CUSTOM_FOLDER_ID = "__custom_folder__"
const CLAUDIA_CODER_ID = "__claudia_coder__"

// Session storage keys
const STORAGE_KEY_RECENT_SESSIONS = "claude-code-recent-sessions"

interface RecentSession {
  id: string
  claudeSessionId?: string
  projectId: string
  projectName: string
  startedAt: string
  lastActiveAt: string
  workingDirectory?: string
}

// Helper to ensure working directory exists via API
async function ensureWorkingDirectory(project: Project, userId?: string): Promise<string> {
  const repoWithPath = project.repos.find(r => r.localPath)

  const response = await fetch("/api/projects/ensure-working-directory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: project.id,
      projectName: project.name,
      existingWorkingDirectory: project.workingDirectory,
      basePath: project.basePath,
      repoLocalPath: repoWithPath?.localPath
    })
  })

  if (!response.ok) {
    throw new Error("Failed to ensure working directory")
  }

  const data = await response.json()

  // Update project with working directory if it was newly set
  if (!project.workingDirectory && data.workingDirectory) {
    updateProject(project.id, { workingDirectory: data.workingDirectory }, userId)
  }

  return data.workingDirectory
}

function SingleTerminalView() {
  const { user } = useAuth()
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
  // Custom folder and Claudia Coder support
  const [useCustomFolder, setUseCustomFolder] = useState(false)
  const [customFolderPath, setCustomFolderPath] = useState("")
  const [useClaudioCoder, setUseClaudioCoder] = useState(false)

  // Session management
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string>("")
  const [continueSession, setContinueSession] = useState(true) // Default to continue

  // Collapsible project selection panel
  const [projectSelectionOpen, setProjectSelectionOpen] = useState(true)

  // Load projects and MCP servers
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)

    // Show cached data immediately
    const cachedProjects = getAllProjects({ userId: user?.id })
    setProjects(cachedProjects)

    const servers = getMCPServers()
    setMcpServers(servers)

    // Load recent sessions from localStorage
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_RECENT_SESSIONS)
        if (saved) {
          const sessions = JSON.parse(saved) as RecentSession[]
          setRecentSessions(sessions)
        }
      } catch (e) {
        console.error("Failed to load recent sessions:", e)
      }
    }

    // Fetch fresh data from server
    try {
      if (user?.id) {
        const serverProjects = await fetchProjects(user.id)
        setProjects(serverProjects)
      }
    } catch (error) {
      console.error("[ClaudeCode] Failed to fetch projects:", error)
    }

    setIsLoading(false)
  }

  const loadProjects = loadData

  // Get sessions for current project/folder
  const sessionsForCurrentProject = useMemo(() => {
    const targetId = useClaudioCoder ? CLAUDIA_CODER_PROJECT.id : useCustomFolder ? "custom" : selectedProjectId
    return recentSessions.filter(s =>
      s.projectId === targetId ||
      (useCustomFolder && s.workingDirectory === customFolderPath)
    ).slice(0, 5) // Limit to 5 most recent
  }, [recentSessions, selectedProjectId, useClaudioCoder, useCustomFolder, customFolderPath])

  // Auto-detect if we should resume
  const hasExistingSession = sessionsForCurrentProject.length > 0

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
      setUseClaudioCoder(false)
      setSelectedProjectId("")
    } else if (value === CLAUDIA_CODER_ID) {
      setUseClaudioCoder(true)
      setUseCustomFolder(false)
      setSelectedProjectId("")
    } else {
      setUseCustomFolder(false)
      setUseClaudioCoder(false)
      setSelectedProjectId(value)
    }
    // Reset terminal when changing selection
    setTerminalStarted(false)
    setResolvedWorkingDirectory(null)
  }, [])

  // Start Claude Code session - ensures working directory exists first
  const handleStartClaudeCode = useCallback(async () => {
    // Claudia Coder mode
    if (useClaudioCoder) {
      setResolvedWorkingDirectory(CLAUDIA_CODER_PROJECT.workingDirectory)
      setTerminalStarted(true)
      setProjectSelectionOpen(false) // Collapse to maximize terminal space
      setTerminalKey(prev => prev + 1)
      return
    }

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
        setProjectSelectionOpen(false) // Collapse to maximize terminal space
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
      const workDir = await ensureWorkingDirectory(selectedProject, user?.id)
      setResolvedWorkingDirectory(workDir)

      // Mark terminal as started (this triggers showing the terminal)
      setTerminalStarted(true)
      setProjectSelectionOpen(false) // Collapse to maximize terminal space
      // Increment key to reset terminal and start fresh session
      setTerminalKey(prev => prev + 1)
    } catch (err) {
      setWorkDirError(err instanceof Error ? err.message : "Failed to create working directory")
    } finally {
      setIsPreparingWorkDir(false)
    }
  }, [selectedProject, useCustomFolder, useClaudioCoder, customFolderPath, user?.id])

  // Determine if we can start a session
  const canStart = useClaudioCoder || useCustomFolder ? (useCustomFolder ? customFolderPath.trim().length > 0 : true) : !!selectedProject

  // Get display info for current selection (for collapsed header)
  const getSelectionDisplay = () => {
    if (useClaudioCoder) {
      return { name: CLAUDIA_CODER_PROJECT.name }
    }
    if (useCustomFolder) {
      return { name: customFolderPath || "Custom Folder" }
    }
    if (selectedProject) {
      return { name: selectedProject.name }
    }
    return null
  }

  const selectionDisplay = getSelectionDisplay()

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Project Selection - Collapsible */}
      <Collapsible open={projectSelectionOpen} onOpenChange={setProjectSelectionOpen}>
        <Card className="w-full">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 text-left hover:text-primary transition-colors">
                  <ChevronDown className={cn(
                    "h-4 w-4 transition-transform",
                    !projectSelectionOpen && "-rotate-90"
                  )} />
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Layers className="h-4 w-4" />
                      Project Selection
                      {!projectSelectionOpen && selectionDisplay && (
                        <span className="text-sm font-normal text-muted-foreground ml-2">
                          — {selectionDisplay.name}
                        </span>
                      )}
                    </CardTitle>
                    {projectSelectionOpen && (
                      <CardDescription>Choose a project or custom folder</CardDescription>
                    )}
                  </div>
                </button>
              </CollapsibleTrigger>
              <div className="flex items-center gap-2">
                {projectSelectionOpen && (
                  <Button variant="outline" size="sm" onClick={loadProjects} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                )}
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
                      {terminalStarted ? "Restart" : "Start Session"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <Select
                  value={useClaudioCoder ? CLAUDIA_CODER_ID : useCustomFolder ? CUSTOM_FOLDER_ID : selectedProjectId}
                  onValueChange={handleProjectChange}
                >
                  <SelectTrigger>
                    {useClaudioCoder ? (
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="font-medium">Claudia Coder</span>
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                          Self-Modify
                        </Badge>
                      </div>
                    ) : useCustomFolder ? (
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
                    {/* Claudia Coder option */}
                    <SelectItem value={CLAUDIA_CODER_ID}>
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="font-medium">Claudia Coder</span>
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                          Self-Modify
                        </Badge>
                      </div>
                    </SelectItem>
                    <SelectSeparator />
                    {/* User projects */}
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
          {(selectedProject || useCustomFolder || useClaudioCoder) && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                <span className="font-mono text-xs">
                  {useCustomFolder
                    ? (customFolderPath || "Enter path above")
                    : useClaudioCoder
                    ? CLAUDIA_CODER_PROJECT.workingDirectory
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

          {/* Session Resume Section - shown when there are existing sessions */}
          {hasExistingSession && canStart && (
            <div className="flex items-center gap-4 py-2 px-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-blue-300">
                  {sessionsForCurrentProject.length} previous session{sessionsForCurrentProject.length !== 1 ? "s" : ""} found
                </span>
              </div>
              <div className="flex items-center gap-3 ml-auto">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={continueSession}
                    onCheckedChange={(checked) => setContinueSession(checked as boolean)}
                    id="continue-session"
                    className="border-blue-400 data-[state=checked]:bg-blue-600"
                  />
                  <Label
                    htmlFor="continue-session"
                    className="text-xs text-blue-300 cursor-pointer"
                  >
                    Continue last session
                  </Label>
                </div>
                {sessionsForCurrentProject.length > 1 && (
                  <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                    <SelectTrigger className="h-7 w-48 text-xs bg-transparent border-blue-500/30 text-blue-300">
                      <SelectValue placeholder="Or select specific session..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">
                        <span className="text-muted-foreground">Most recent</span>
                      </SelectItem>
                      {sessionsForCurrentProject.map((session) => (
                        <SelectItem key={session.id} value={session.id}>
                          <div className="flex flex-col">
                            <span className="text-xs">
                              {new Date(session.startedAt).toLocaleString()}
                            </span>
                            {session.claudeSessionId && (
                              <span className="text-[10px] text-muted-foreground">
                                ID: {session.claudeSessionId.slice(0, 12)}...
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}

          {/* Options inline */}
          <div className="flex items-center gap-4 pt-2 border-t">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={bypassPermissions}
                onCheckedChange={(checked) => setBypassPermissions(checked as boolean)}
                id="bypass-permissions"
              />
              <Label
                htmlFor="bypass-permissions"
                className="flex items-center gap-1.5 cursor-pointer text-sm"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                Bypass permissions
              </Label>
            </div>
            <Link href="/claude-code/mcp" className="ml-auto">
              <Button variant="ghost" size="sm" className="gap-2 text-xs">
                <Plug className="h-3.5 w-3.5" />
                MCP Servers ({mcpServers.filter(s => s.enabled).length})
              </Button>
            </Link>
          </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Terminal - Fills remaining space */}
      <Card className="w-full flex-1 min-h-0">
        <CardContent className="p-0 h-full">
          {terminalStarted && resolvedWorkingDirectory ? (
            <ClaudeCodeTerminal
              key={terminalKey}
              projectId={useClaudioCoder ? CLAUDIA_CODER_PROJECT.id : useCustomFolder ? "custom" : (selectedProject?.id || "unknown")}
              projectName={useClaudioCoder ? CLAUDIA_CODER_PROJECT.name : useCustomFolder ? "Custom Session" : (selectedProject?.name || "Unknown")}
              projectDescription={useClaudioCoder ? CLAUDIA_CODER_PROJECT.description : useCustomFolder ? `Custom folder: ${customFolderPath}` : (selectedProject?.description || "")}
              workingDirectory={resolvedWorkingDirectory}
              bypassPermissions={bypassPermissions}
              className="h-full rounded-lg"
              onSessionEnd={() => setTerminalStarted(false)}
            />
          ) : (
            <div className="h-full min-h-[400px] rounded-lg bg-zinc-900 border border-zinc-800 p-4 font-mono text-sm flex flex-col">
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
                      {useClaudioCoder
                        ? `Project: ${CLAUDIA_CODER_PROJECT.name}`
                        : useCustomFolder
                        ? `Folder: ${customFolderPath}`
                        : `Project: ${selectedProject?.name}`}
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
    </div>
  )
}

export default function ClaudeCodePage() {
  const [activeTab, setActiveTab] = useState<string>("single")

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Terminal className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Claude Code</h1>
            <p className="text-sm text-muted-foreground">Launch Claude Code CLI sessions</p>
          </div>
        </div>
      </div>

      {/* Tabs for Single vs Multi Terminal */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-fit">
          <TabsTrigger value="single" className="gap-2">
            <Terminal className="h-4 w-4" />
            Single Terminal
          </TabsTrigger>
          <TabsTrigger value="multi" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            Multi-Terminal
          </TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="flex-1 mt-4 min-h-0">
          <SingleTerminalView />
        </TabsContent>

        <TabsContent value="multi" className="flex-1 mt-4 min-h-0">
          <MultiTerminalProvider>
            <MultiTerminalDashboard />
          </MultiTerminalProvider>
        </TabsContent>
      </Tabs>
    </div>
  )
}
