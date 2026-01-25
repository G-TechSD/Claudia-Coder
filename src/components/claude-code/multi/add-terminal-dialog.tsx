"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Zap, FolderOpen, Clock, Loader2, FolderPlus } from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { getAllProjects, getEffectiveWorkingDirectory } from "@/lib/data/projects"
import type { Project } from "@/lib/data/types"
import { MAX_TERMINALS } from "@/lib/multi-terminal/types"
import { cn } from "@/lib/utils"

interface TempSession {
  sessionId: string
  workingDirectory: string
  label: string
  createdAt: string
  type: string
}

interface AddTerminalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (options: {
    projectId?: string
    projectName?: string
    workingDirectory: string
    label?: string
  }) => void
  currentTerminalCount: number
}

export function AddTerminalDialog({
  open,
  onOpenChange,
  onAdd,
  currentTerminalCount,
}: AddTerminalDialogProps) {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [tempSessions, setTempSessions] = useState<TempSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>("quick")
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")
  const [selectedTempSession, setSelectedTempSession] = useState<string>("")
  const [customFolderPath, setCustomFolderPath] = useState("")
  const [label, setLabel] = useState("")
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load projects and temp sessions
  useEffect(() => {
    if (open) {
      setIsLoading(true)
      setError(null)

      // Load projects
      const allProjects = getAllProjects({ userId: user?.id })
      setProjects(allProjects)

      // Load temp sessions
      fetch("/api/claude-code/temp-session")
        .then((res) => res.json())
        .then((data) => {
          setTempSessions(data.sessions || [])
        })
        .catch(() => {
          setTempSessions([])
        })
        .finally(() => {
          setIsLoading(false)
        })

      // Reset form
      setSelectedProjectId("")
      setSelectedTempSession("")
      setCustomFolderPath("")
      setLabel("")

      // Default to "quick" tab, or "project" if there are projects
      setActiveTab(allProjects.length > 0 ? "project" : "quick")
    }
  }, [open, user?.id])

  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  // Handle Quick Session - creates new temp folder
  const handleQuickSession = async () => {
    if (currentTerminalCount >= MAX_TERMINALS) {
      setError(`Maximum ${MAX_TERMINALS} terminals reached`)
      return
    }

    setIsValidating(true)
    setError(null)

    try {
      const response = await fetch("/api/claude-code/temp-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create temp session")
      }

      const data = await response.json()

      onAdd({
        projectName: data.label || "Quick Session",
        workingDirectory: data.workingDirectory,
        label: label.trim() || data.label || `Quick Session`,
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create quick session")
    } finally {
      setIsValidating(false)
    }
  }

  // Handle Resume Temp Session
  const handleResumeTempSession = async () => {
    if (currentTerminalCount >= MAX_TERMINALS) {
      setError(`Maximum ${MAX_TERMINALS} terminals reached`)
      return
    }

    const session = tempSessions.find((s) => s.sessionId === selectedTempSession)
    if (!session) {
      setError("Please select a session to resume")
      return
    }

    onAdd({
      projectName: session.label,
      workingDirectory: session.workingDirectory,
      label: label.trim() || session.label,
    })
    onOpenChange(false)
  }

  // Handle Project Selection
  const handleProjectSubmit = async () => {
    if (currentTerminalCount >= MAX_TERMINALS) {
      setError(`Maximum ${MAX_TERMINALS} terminals reached`)
      return
    }

    if (!selectedProject) {
      setError("Please select a project")
      return
    }

    setIsValidating(true)
    setError(null)

    try {
      const workingDirectory = getEffectiveWorkingDirectory(selectedProject)

      const response = await fetch("/api/projects/ensure-working-directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProject.id,
          projectName: selectedProject.name,
          existingWorkingDirectory: selectedProject.workingDirectory,
          basePath: selectedProject.basePath,
          repoLocalPath: selectedProject.repos.find((r) => r.localPath)?.localPath,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to ensure working directory")
      }

      const data = await response.json()

      onAdd({
        projectId: selectedProject.id,
        projectName: selectedProject.name,
        workingDirectory: data.workingDirectory || workingDirectory,
        label: label.trim() || selectedProject.name,
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set up project")
    } finally {
      setIsValidating(false)
    }
  }

  // Handle Custom Folder
  const handleCustomFolder = async () => {
    if (currentTerminalCount >= MAX_TERMINALS) {
      setError(`Maximum ${MAX_TERMINALS} terminals reached`)
      return
    }

    if (!customFolderPath.trim()) {
      setError("Please enter a folder path")
      return
    }

    setIsValidating(true)
    setError(null)

    try {
      const response = await fetch("/api/projects/ensure-working-directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "custom",
          projectName: "Custom Session",
          existingWorkingDirectory: customFolderPath.trim(),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to validate folder")
      }

      onAdd({
        projectName: label.trim() || "Custom Session",
        workingDirectory: customFolderPath.trim(),
        label: label.trim() || `Terminal ${currentTerminalCount + 1}`,
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to access folder")
    } finally {
      setIsValidating(false)
    }
  }

  const canAdd = currentTerminalCount < MAX_TERMINALS

  // Format relative time
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (seconds < 60) return "just now"
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Add New Terminal</DialogTitle>
          <DialogDescription>
            Create a new Claude Code terminal session.
            {!canAdd && (
              <span className="text-destructive ml-1">
                Maximum {MAX_TERMINALS} terminals reached.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="quick" className="gap-2">
              <Zap className="h-4 w-4" />
              Quick
            </TabsTrigger>
            <TabsTrigger value="project" className="gap-2">
              <FolderOpen className="h-4 w-4" />
              Project
            </TabsTrigger>
            <TabsTrigger value="custom" className="gap-2">
              <FolderPlus className="h-4 w-4" />
              Custom
            </TabsTrigger>
          </TabsList>

          {/* Quick Session Tab */}
          <TabsContent value="quick" className="space-y-4 mt-4">
            <div className="text-sm text-muted-foreground">
              Start a quick session with an auto-created temporary folder.
              Perfect for experiments and one-off tasks.
            </div>

            {/* Previous temp sessions */}
            {tempSessions.length > 0 && (
              <div className="space-y-2">
                <Label>Resume Previous Session</Label>
                <Select
                  value={selectedTempSession}
                  onValueChange={setSelectedTempSession}
                  disabled={!canAdd}
                >
                  <SelectTrigger>
                    {selectedTempSession ? (
                      <span>
                        {tempSessions.find((s) => s.sessionId === selectedTempSession)?.label}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Or start a new session...
                      </span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {tempSessions.map((session) => (
                      <SelectItem key={session.sessionId} value={session.sessionId}>
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>{session.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatTimeAgo(session.createdAt)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Label */}
            <div className="space-y-2">
              <Label>Label (optional)</Label>
              <Input
                placeholder="Quick Session"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                disabled={!canAdd}
              />
            </div>

            {error && <div className="text-sm text-destructive">{error}</div>}

            <div className="flex gap-2 pt-2">
              {selectedTempSession ? (
                <Button
                  onClick={handleResumeTempSession}
                  disabled={isValidating || !canAdd}
                  className="flex-1"
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Resuming...
                    </>
                  ) : (
                    <>
                      <Clock className="h-4 w-4 mr-2" />
                      Resume Session
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleQuickSession}
                  disabled={isValidating || !canAdd}
                  className="flex-1"
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Start Quick Session
                    </>
                  )}
                </Button>
              )}
            </div>
          </TabsContent>

          {/* Project Tab */}
          <TabsContent value="project" className="space-y-4 mt-4">
            {projects.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <FolderOpen className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No projects found</p>
                <p className="text-xs mt-1">
                  Create a project first, or use Quick Session
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Select Project</Label>
                  <Select
                    value={selectedProjectId}
                    onValueChange={setSelectedProjectId}
                    disabled={isLoading || !canAdd}
                  >
                    <SelectTrigger>
                      {selectedProject ? (
                        <span>{selectedProject.name}</span>
                      ) : (
                        <span className="text-muted-foreground">
                          Select a project...
                        </span>
                      )}
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

                {/* Label */}
                <div className="space-y-2">
                  <Label>Label (optional)</Label>
                  <Input
                    placeholder={selectedProject?.name || "Terminal"}
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    disabled={!canAdd}
                  />
                </div>

                {error && <div className="text-sm text-destructive">{error}</div>}

                <Button
                  onClick={handleProjectSubmit}
                  disabled={isValidating || !canAdd || !selectedProjectId}
                  className="w-full"
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Add Terminal"
                  )}
                </Button>
              </>
            )}
          </TabsContent>

          {/* Custom Folder Tab */}
          <TabsContent value="custom" className="space-y-4 mt-4">
            <div className="text-sm text-muted-foreground">
              Specify a custom folder path for this terminal session.
            </div>

            <div className="space-y-2">
              <Label>Folder Path</Label>
              <Input
                placeholder="/path/to/your/folder"
                value={customFolderPath}
                onChange={(e) => setCustomFolderPath(e.target.value)}
                className="font-mono text-sm"
                disabled={!canAdd}
              />
            </div>

            {/* Label */}
            <div className="space-y-2">
              <Label>Label (optional)</Label>
              <Input
                placeholder="Custom Terminal"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                disabled={!canAdd}
              />
            </div>

            {error && <div className="text-sm text-destructive">{error}</div>}

            <Button
              onClick={handleCustomFolder}
              disabled={isValidating || !canAdd || !customFolderPath.trim()}
              className="w-full"
            >
              {isValidating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Add Terminal"
              )}
            </Button>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
