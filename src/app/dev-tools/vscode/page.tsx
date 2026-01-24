"use client"

import { useState, useEffect, useMemo, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  Code2,
  FolderOpen,
  GitBranch,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Play,
  Layers,
  Loader2,
  ArrowLeft,
  FolderPlus,
  Zap,
  ChevronDown,
} from "lucide-react"
import Link from "next/link"
import { VSCodeIframe } from "@/components/dev-tools/vscode-iframe"
import { ToolStatusBadge } from "@/components/dev-tools/tool-status-badge"
import { DevToolStatus } from "@/lib/dev-tools/types"
import { useAuth } from "@/components/auth/auth-provider"
import { getAllProjects, fetchProjects, getEffectiveWorkingDirectory, updateProject } from "@/lib/data/projects"
import type { Project } from "@/lib/data/types"
import { CLAUDIA_CODER_PROJECT } from "@/lib/emergent-modules/types"

// Special values for selection
const CUSTOM_FOLDER_ID = "__custom_folder__"
const CLAUDIA_CODER_ID = "__claudia_coder__"

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

function VSCodePageContent() {
  const searchParams = useSearchParams()
  const projectIdParam = searchParams.get("projectId")
  const { user } = useAuth()

  const [toolStatus, setToolStatus] = useState<DevToolStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectIdParam || "")
  const [useCustomFolder, setUseCustomFolder] = useState(false)
  const [customFolderPath, setCustomFolderPath] = useState("")
  const [useClaudioCoder, setUseClaudioCoder] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [editorKey, setEditorKey] = useState(0)
  const [isPreparingWorkDir, setIsPreparingWorkDir] = useState(false)
  const [workDirError, setWorkDirError] = useState<string | null>(null)
  const [resolvedWorkingDirectory, setResolvedWorkingDirectory] = useState<string | null>(null)
  const [projectSelectionOpen, setProjectSelectionOpen] = useState(true) // Collapse when editor opens

  // Load tool status and projects
  useEffect(() => {
    const loadData = async () => {
      try {
        const [statusRes] = await Promise.all([
          fetch("/api/dev-tools/status?toolId=vscode")
        ])

        if (statusRes.ok) {
          const data = await statusRes.json()
          setToolStatus(data.tools[0])
        }

        // Show cached data immediately
        const cachedProjects = getAllProjects({ userId: user?.id })
        setProjects(cachedProjects)

        // Fetch fresh data from server
        if (user?.id) {
          const serverProjects = await fetchProjects(user.id)
          setProjects(serverProjects)
        }
      } catch (error) {
        console.error("Failed to fetch data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user?.id])

  const loadProjects = useCallback(async () => {
    // Show cached data immediately
    const cachedProjects = getAllProjects({ userId: user?.id })
    setProjects(cachedProjects)

    // Fetch fresh data from server
    if (user?.id) {
      try {
        const serverProjects = await fetchProjects(user.id)
        setProjects(serverProjects)
      } catch (error) {
        console.error("[VSCode] Failed to fetch projects:", error)
      }
    }
  }, [user?.id])

  // Get selected project
  const selectedProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId) || null
  }, [projects, selectedProjectId])

  // Get working directory
  const workingDirectory = useMemo(() => {
    if (useClaudioCoder) return CLAUDIA_CODER_PROJECT.workingDirectory
    if (useCustomFolder) return customFolderPath
    if (!selectedProject) return null
    return getEffectiveWorkingDirectory(selectedProject)
  }, [selectedProject, useClaudioCoder, useCustomFolder, customFolderPath])

  // Handle selection change
  const handleSelectionChange = useCallback((value: string) => {
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
    // Reset editor when changing selection
    setShowEditor(false)
    setResolvedWorkingDirectory(null)
  }, [])

  // Start VS Code session
  const handleStart = useCallback(async () => {
    // Claudia Coder mode
    if (useClaudioCoder) {
      setResolvedWorkingDirectory(CLAUDIA_CODER_PROJECT.workingDirectory)
      setShowEditor(true)
      setProjectSelectionOpen(false) // Collapse to maximize editor space
      setEditorKey(prev => prev + 1)
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
        setShowEditor(true)
        setProjectSelectionOpen(false) // Collapse to maximize editor space
        setEditorKey(prev => prev + 1)
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
      const workDir = await ensureWorkingDirectory(selectedProject, user?.id)
      setResolvedWorkingDirectory(workDir)
      setShowEditor(true)
      setProjectSelectionOpen(false) // Collapse to maximize editor space
      setEditorKey(prev => prev + 1)
    } catch (err) {
      setWorkDirError(err instanceof Error ? err.message : "Failed to create working directory")
    } finally {
      setIsPreparingWorkDir(false)
    }
  }, [selectedProject, useCustomFolder, useClaudioCoder, customFolderPath, user?.id])

  const isInstalled = toolStatus?.status === "installed"
  const canStart = useClaudioCoder || useCustomFolder ? (useCustomFolder ? customFolderPath.trim().length > 0 : true) : !!selectedProject

  // Get display info for current selection
  const getSelectionDisplay = () => {
    if (useClaudioCoder) {
      return {
        name: CLAUDIA_CODER_PROJECT.name,
        icon: <Zap className="h-4 w-4 text-blue-500" />,
        description: "Modify Claudia Coder itself"
      }
    }
    if (useCustomFolder) {
      return {
        name: "Custom Folder",
        icon: <FolderPlus className="h-4 w-4" />,
        description: customFolderPath || "Enter path below"
      }
    }
    if (selectedProject) {
      return {
        name: selectedProject.name,
        icon: null,
        description: workingDirectory || "Will be created on start"
      }
    }
    return null
  }

  const selectionDisplay = getSelectionDisplay()

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Link href="/dev-tools">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600">
              <Code2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">VS Code</h1>
              <p className="text-sm text-muted-foreground">
                Visual Studio Code in the browser
              </p>
            </div>
          </div>
        </div>
        {toolStatus && (
          <ToolStatusBadge status={toolStatus.status} version={toolStatus.version} />
        )}
      </div>

      {/* Not Installed Warning */}
      {!loading && !isInstalled && (
        <Card className="border-yellow-500/30 bg-yellow-500/5 mb-4">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="font-medium">VS Code (code-server) is not installed</p>
                <p className="text-sm text-muted-foreground">
                  Install code-server to use this feature
                </p>
              </div>
              <Link href="/dev-tools?install=vscode" className="ml-auto">
                <Button>Install VS Code</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {isInstalled && (
        <div className="flex flex-col gap-4 flex-1 min-h-0">
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
                      onClick={handleStart}
                    >
                      {isPreparingWorkDir ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Preparing...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          {showEditor ? "Restart" : "Open in VS Code"}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <Select
                      value={useClaudioCoder ? CLAUDIA_CODER_ID : useCustomFolder ? CUSTOM_FOLDER_ID : selectedProjectId}
                      onValueChange={handleSelectionChange}
                    >
                      <SelectTrigger>
                        {selectionDisplay ? (
                          <div className="flex items-center gap-2">
                            {selectionDisplay.icon}
                            <span>{selectionDisplay.name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Select a project...</span>
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {/* Claudia Coder option */}
                        <SelectItem value={CLAUDIA_CODER_ID}>
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-blue-500" />
                            <span className="font-medium">Claudia Coder</span>
                            <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-500 border-blue-500/20">
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
              {selectionDisplay && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    <span className="font-mono text-xs">
                      {useCustomFolder
                        ? (customFolderPath || "Enter path above")
                        : (useClaudioCoder ? CLAUDIA_CODER_PROJECT.workingDirectory : workingDirectory || "Will be created on start")}
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
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* VS Code Editor */}
          <Card className="w-full flex-1 min-h-0">
            <CardContent className="p-0 h-full">
              {showEditor && resolvedWorkingDirectory ? (
                <VSCodeIframe
                  key={editorKey}
                  projectId={useClaudioCoder ? CLAUDIA_CODER_PROJECT.id : useCustomFolder ? "custom" : (selectedProject?.id || "unknown")}
                  workingDirectory={resolvedWorkingDirectory}
                  className="h-full rounded-lg"
                  onClose={() => setShowEditor(false)}
                  userId={user?.id}
                  userRole={user?.role}
                />
              ) : (
                <div className="h-full min-h-[500px] rounded-lg bg-[#1e1e1e] border border-gray-800 p-4 font-mono text-sm flex flex-col">
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                    {isPreparingWorkDir ? (
                      <>
                        <Loader2 className="h-12 w-12 mb-4 animate-spin text-blue-400" />
                        <p className="text-gray-300">Preparing working directory...</p>
                      </>
                    ) : canStart ? (
                      <>
                        <Code2 className="h-12 w-12 mb-4 opacity-50" />
                        <p className="text-gray-300">Ready to launch VS Code</p>
                        <p className="mt-2 text-gray-500 text-sm">
                          {useClaudioCoder
                            ? `Project: ${CLAUDIA_CODER_PROJECT.name}`
                            : useCustomFolder
                            ? `Folder: ${customFolderPath}`
                            : `Project: ${selectedProject?.name}`}
                        </p>
                        <p className="text-gray-600 mt-4 text-sm">Click "Open in VS Code" above to begin...</p>
                      </>
                    ) : (
                      <>
                        <Code2 className="h-12 w-12 mb-4 opacity-50" />
                        <p className="text-gray-300">Select a project or custom folder above</p>
                        <p className="mt-2 text-gray-600 text-xs">
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
      )}
    </div>
  )
}

export default function VSCodePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <VSCodePageContent />
    </Suspense>
  )
}
