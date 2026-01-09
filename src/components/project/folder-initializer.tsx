"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
  FolderOpen,
  FolderPlus,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
  Terminal,
  Rocket,
  ChevronDown,
  ChevronUp,
  Edit2,
  Check,
  X,
  Play,
  Folder,
  FileCode,
  Sparkles
} from "lucide-react"
import type { StoredBuildPlan } from "@/lib/data/types"

interface FilePreview {
  path: string
  content: string
  description: string
}

interface InitializeResponse {
  success: boolean
  dryRun?: boolean
  workingDirectory: string
  filesCreated: FilePreview[]
  directoriesCreated: string[]
  alreadyExists?: boolean
  error?: string
}

interface FolderInitializerProps {
  projectId: string
  projectName: string
  projectDescription: string
  buildPlan: StoredBuildPlan | null
  linkedRepo?: {
    name: string
    url: string
    localPath?: string
  }
  onInitialized?: (workingDirectory: string) => void
  onLaunchClaudeCode?: (workingDirectory: string) => void
  className?: string
}

type InitState = "idle" | "previewing" | "initializing" | "success" | "error"

export function FolderInitializer({
  projectId,
  projectName,
  projectDescription,
  buildPlan,
  linkedRepo,
  onInitialized,
  onLaunchClaudeCode,
  className
}: FolderInitializerProps) {
  const [state, setState] = useState<InitState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState("")

  // Target path state
  const [targetPath, setTargetPath] = useState("")
  const [isEditingPath, setIsEditingPath] = useState(false)
  const [editedPath, setEditedPath] = useState("")

  // Preview state
  const [preview, setPreview] = useState<InitializeResponse | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())

  // Result state
  const [result, setResult] = useState<InitializeResponse | null>(null)

  // Check if build plan is approved
  const isBuildPlanApproved = buildPlan?.status === "approved" || buildPlan?.status === "locked"

  // Load preview on mount or when dependencies change
  useEffect(() => {
    if (isBuildPlanApproved) {
      loadPreview()
    }
  }, [projectId, projectName, buildPlan?.id, linkedRepo?.localPath])

  const loadPreview = async () => {
    setState("previewing")
    setError(null)

    try {
      const params = new URLSearchParams({
        projectId,
        projectName,
        projectDescription,
        ...(linkedRepo?.localPath && { targetPath: linkedRepo.localPath })
      })

      const response = await fetch(`/api/projects/initialize-folder?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to preview initialization")
      }

      setPreview(data)
      setTargetPath(data.targetPath)
      setEditedPath(data.targetPath)
      setState("idle")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to preview")
      setState("error")
    }
  }

  const handleInitialize = async () => {
    setState("initializing")
    setError(null)
    setProgress(0)
    setProgressMessage("Preparing initialization...")

    try {
      // Simulate progress steps
      setProgress(10)
      setProgressMessage("Creating directory structure...")
      await new Promise(r => setTimeout(r, 300))

      // Convert build plan to the format expected by the API
      const buildPlanData = buildPlan ? {
        spec: buildPlan.originalPlan.spec,
        phases: buildPlan.originalPlan.phases,
        packets: buildPlan.originalPlan.packets
      } : undefined

      setProgress(30)
      setProgressMessage("Generating KICKOFF.md...")
      await new Promise(r => setTimeout(r, 200))

      const response = await fetch("/api/projects/initialize-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          projectName,
          projectDescription,
          targetPath: targetPath || undefined,
          buildPlan: buildPlanData,
          linkedRepo
        })
      })

      setProgress(70)
      setProgressMessage("Writing files...")
      await new Promise(r => setTimeout(r, 200))

      const data: InitializeResponse = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to initialize folder")
      }

      setProgress(100)
      setProgressMessage("Complete!")
      setResult(data)
      setState("success")

      // Notify parent
      if (onInitialized) {
        onInitialized(data.workingDirectory)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize")
      setState("error")
    }
  }

  const handleInitializeAndLaunch = async () => {
    await handleInitialize()
    // Wait for success state, then launch
    // The actual launch happens via effect or callback
  }

  const handleSavePath = () => {
    setTargetPath(editedPath)
    setIsEditingPath(false)
    // Reload preview with new path
    loadPreview()
  }

  const handleCancelEditPath = () => {
    setEditedPath(targetPath)
    setIsEditingPath(false)
  }

  const toggleFilePreview = (filePath: string) => {
    const newExpanded = new Set(expandedFiles)
    if (newExpanded.has(filePath)) {
      newExpanded.delete(filePath)
    } else {
      newExpanded.add(filePath)
    }
    setExpandedFiles(newExpanded)
  }

  // If build plan is not approved, show a message
  if (!isBuildPlanApproved) {
    return (
      <Card className={cn("border-yellow-500/30 bg-yellow-500/5", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-500">
            <AlertCircle className="h-5 w-5" />
            Build Plan Required
          </CardTitle>
          <CardDescription>
            You need an approved build plan before initializing the project folder.
            This ensures the KICKOFF.md file contains accurate project context for AI development sessions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Go to the <span className="font-medium">Build Plan</span> tab to create and approve a build plan.
          </div>
        </CardContent>
      </Card>
    )
  }

  // Success state
  if (state === "success" && result) {
    return (
      <Card className={cn("border-green-500/30 bg-green-500/5", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-500">
            <CheckCircle2 className="h-5 w-5" />
            Project Folder Initialized
          </CardTitle>
          <CardDescription>
            Your project folder is ready at <code className="bg-muted px-2 py-0.5 rounded text-xs">{result.workingDirectory}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Files created */}
          <div>
            <h4 className="text-sm font-medium mb-2">Files Created</h4>
            <div className="space-y-1">
              {result.filesCreated.map(file => (
                <div key={file.path} className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-green-500" />
                  <span className="font-mono text-xs">{file.path}</span>
                  <span className="text-muted-foreground">- {file.description}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Directories created */}
          {result.directoriesCreated.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Directories Created</h4>
              <div className="flex flex-wrap gap-2">
                {result.directoriesCreated.map(dir => (
                  <Badge key={dir} variant="secondary" className="font-mono text-xs">
                    <Folder className="h-3 w-3 mr-1" />
                    {dir}/
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t">
            <Button
              onClick={() => onLaunchClaudeCode?.(result.workingDirectory)}
              className="gap-2 bg-purple-600 hover:bg-purple-500"
            >
              <Terminal className="h-4 w-4" />
              Open in Claudia Coder
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                setState("idle")
                setResult(null)
              }}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Re-initialize
            </Button>
          </div>

          {result.alreadyExists && (
            <p className="text-xs text-amber-500">
              Note: Directory already existed. Files were updated/overwritten.
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn(
      "transition-all",
      state === "error" && "border-red-500/30 bg-red-500/5",
      className
    )}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderPlus className="h-5 w-5 text-blue-500" />
          Initialize Project Folder
        </CardTitle>
        <CardDescription>
          Create project folder structure with KICKOFF.md containing your build plan context.
          This prepares the workspace for Claudia Coder development sessions.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Target Path */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Target Folder Path
          </label>

          {isEditingPath ? (
            <div className="flex items-center gap-2">
              <Input
                value={editedPath}
                onChange={e => setEditedPath(e.target.value)}
                className="font-mono text-sm flex-1"
                placeholder="/home/user/projects/my-project"
                autoFocus
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-green-500 hover:text-green-600"
                onClick={handleSavePath}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-500 hover:text-red-600"
                onClick={handleCancelEditPath}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono">
                {targetPath || (state === "previewing" ? "Loading..." : "Not set")}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsEditingPath(true)}
                disabled={state === "previewing" || state === "initializing"}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </div>
          )}

          {preview?.alreadyExists && (
            <p className="text-xs text-amber-500">
              This directory already exists. Files will be updated/overwritten.
            </p>
          )}
        </div>

        {/* Preview Section */}
        {preview && (
          <div className="space-y-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 text-sm font-medium w-full text-left hover:text-primary transition-colors"
            >
              {showPreview ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Preview ({preview.filesCreated.length} files, {preview.directoriesCreated.length} directories)
            </button>

            {showPreview && (
              <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                {/* Files */}
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <FileCode className="h-4 w-4" />
                    Files to Create
                  </h4>
                  <div className="space-y-2">
                    {preview.filesCreated.map(file => (
                      <div key={file.path} className="border rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleFilePreview(file.path)}
                          className="flex items-center justify-between w-full p-2 text-left hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-500" />
                            <span className="font-mono text-sm">{file.path}</span>
                            <span className="text-xs text-muted-foreground">- {file.description}</span>
                          </div>
                          {expandedFiles.has(file.path) ?
                            <ChevronUp className="h-4 w-4" /> :
                            <ChevronDown className="h-4 w-4" />
                          }
                        </button>
                        {expandedFiles.has(file.path) && (
                          <div className="border-t bg-zinc-900 p-3 max-h-[300px] overflow-auto">
                            <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono">
                              {file.content}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Directories */}
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Folder className="h-4 w-4" />
                    Directories to Create
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {preview.directoriesCreated.map(dir => (
                      <Badge key={dir} variant="outline" className="font-mono text-xs">
                        {dir}/
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress */}
        {state === "initializing" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span className="text-sm">{progressMessage}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={handleInitialize}
            disabled={state === "initializing" || state === "previewing" || !targetPath}
            className="gap-2"
          >
            {state === "initializing" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FolderPlus className="h-4 w-4" />
            )}
            Initialize Folder
          </Button>

          {onLaunchClaudeCode && (
            <Button
              onClick={handleInitializeAndLaunch}
              disabled={state === "initializing" || state === "previewing" || !targetPath}
              variant="secondary"
              className="gap-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border-purple-500/30"
            >
              {state === "initializing" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Initialize & Launch Claudia Coder
            </Button>
          )}

          {state === "error" && (
            <Button
              variant="outline"
              onClick={loadPreview}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          )}
        </div>

        {/* Build Plan Info */}
        {buildPlan && (
          <div className="text-xs text-muted-foreground border-t pt-3 mt-3">
            Using build plan v{buildPlan.revisionNumber} ({buildPlan.originalPlan.packets.length} packets)
            {buildPlan.approvedAt && (
              <span> - Approved {new Date(buildPlan.approvedAt).toLocaleDateString()}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Compact version for embedding in other components
 */
export function FolderInitializerCompact({
  projectId,
  projectName,
  projectDescription,
  buildPlan,
  linkedRepo,
  onInitialized,
  onLaunchClaudeCode
}: Omit<FolderInitializerProps, "className">) {
  const [state, setState] = useState<InitState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<InitializeResponse | null>(null)

  const isBuildPlanApproved = buildPlan?.status === "approved" || buildPlan?.status === "locked"

  const handleInitialize = async () => {
    setState("initializing")
    setError(null)

    try {
      const buildPlanData = buildPlan ? {
        spec: buildPlan.originalPlan.spec,
        phases: buildPlan.originalPlan.phases,
        packets: buildPlan.originalPlan.packets
      } : undefined

      const response = await fetch("/api/projects/initialize-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          projectName,
          projectDescription,
          targetPath: linkedRepo?.localPath,
          buildPlan: buildPlanData,
          linkedRepo
        })
      })

      const data: InitializeResponse = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to initialize folder")
      }

      setResult(data)
      setState("success")

      if (onInitialized) {
        onInitialized(data.workingDirectory)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize")
      setState("error")
    }
  }

  if (!isBuildPlanApproved) {
    return (
      <div className="flex items-center gap-2 text-sm text-yellow-500">
        <AlertCircle className="h-4 w-4" />
        Approve build plan first
      </div>
    )
  }

  if (state === "success" && result) {
    return (
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <span className="text-sm text-green-500">Initialized</span>
        {onLaunchClaudeCode && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onLaunchClaudeCode(result.workingDirectory)}
            className="gap-1 h-7 text-xs"
          >
            <Terminal className="h-3 w-3" />
            Open in Claudia Coder
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        onClick={handleInitialize}
        disabled={state === "initializing"}
        className="gap-1 h-7"
      >
        {state === "initializing" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <FolderPlus className="h-3 w-3" />
        )}
        Initialize
      </Button>

      {error && (
        <span className="text-xs text-red-500">{error}</span>
      )}
    </div>
  )
}
