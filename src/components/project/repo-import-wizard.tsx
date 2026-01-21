"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  GitBranch,
  Github,
  Folder,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  FileCode,
  Database,
  Cpu,
  LayoutGrid,
  AlertTriangle,
  FolderTree,
  FileText,
  Zap,
} from "lucide-react"

// ============================================================================
// Types
// ============================================================================

interface RepoInfo {
  url: string
  provider: "github" | "gitlab" | "bitbucket" | "local"
  owner?: string
  name?: string
  branch: string
}

interface AnalysisResult {
  projectType: string
  techStack: {
    runtime: string
    framework?: string
    language: string
    packageManager?: string
    database?: string[]
    ui?: string
    styling?: string
    testing?: string[]
  }
  totalFiles: number
  totalLines: number
  keyFiles: { path: string; type: string; importance: string }[]
  dependencies: { name: string; type: string }[]
  apis: { path: string; method: string }[]
  languages: { [lang: string]: { files: number; lines: number } }
}

interface RepoImportWizardProps {
  onComplete: (data: {
    repoInfo: RepoInfo
    analysis: AnalysisResult
    workingDirectory: string
    projectName: string
  }) => void
  onCancel: () => void
  mode?: "import" | "auto-mod"
  className?: string
}

type WizardStep = "url" | "cloning" | "analyzing" | "review" | "complete"

// ============================================================================
// Component
// ============================================================================

export function RepoImportWizard({
  onComplete,
  onCancel,
  mode = "import",
  className,
}: RepoImportWizardProps) {
  const [step, setStep] = useState<WizardStep>("url")
  const [repoUrl, setRepoUrl] = useState("")
  const [localPath, setLocalPath] = useState("")
  const [isLocal, setIsLocal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState("")

  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [workingDirectory, setWorkingDirectory] = useState("")
  const [projectName, setProjectName] = useState("")

  // Parse repo URL to extract info
  const parseRepoUrl = (url: string): RepoInfo | null => {
    // GitHub: https://github.com/owner/repo or git@github.com:owner/repo.git
    const githubMatch = url.match(/github\.com[\/:]([^\/]+)\/([^\/\.]+)/)
    if (githubMatch) {
      return {
        url,
        provider: "github",
        owner: githubMatch[1],
        name: githubMatch[2].replace(".git", ""),
        branch: "main",
      }
    }

    // GitLab: https://gitlab.com/owner/repo
    const gitlabMatch = url.match(/gitlab\.com[\/:]([^\/]+)\/([^\/\.]+)/)
    if (gitlabMatch) {
      return {
        url,
        provider: "gitlab",
        owner: gitlabMatch[1],
        name: gitlabMatch[2].replace(".git", ""),
        branch: "main",
      }
    }

    // Bitbucket: https://bitbucket.org/owner/repo
    const bitbucketMatch = url.match(/bitbucket\.org[\/:]([^\/]+)\/([^\/\.]+)/)
    if (bitbucketMatch) {
      return {
        url,
        provider: "bitbucket",
        owner: bitbucketMatch[1],
        name: bitbucketMatch[2].replace(".git", ""),
        branch: "main",
      }
    }

    // Generic git URL
    if (url.endsWith(".git") || url.includes("git@") || url.includes("://")) {
      const nameMatch = url.match(/\/([^\/]+?)(\.git)?$/)
      return {
        url,
        provider: "github", // Default
        name: nameMatch?.[1] || "repo",
        branch: "main",
      }
    }

    return null
  }

  // Clone repository
  const cloneRepo = async () => {
    setStep("cloning")
    setError(null)
    setProgress(0)
    setProgressMessage("Preparing to clone...")

    try {
      const info = isLocal
        ? { url: localPath, provider: "local" as const, branch: "main", name: localPath.split("/").pop() || "project" }
        : parseRepoUrl(repoUrl)

      if (!info) {
        throw new Error("Invalid repository URL")
      }

      setRepoInfo(info)
      setProjectName(info.name || "imported-project")

      if (isLocal) {
        // For local paths, just validate and use directly
        setProgressMessage("Validating local path...")
        setProgress(50)

        const response = await fetch("/api/projects/clone-repo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            localPath: localPath,
            validateOnly: true,
          }),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || "Failed to validate path")
        }

        setWorkingDirectory(result.workingDirectory || localPath)
        setProgress(100)
        setProgressMessage("Path validated!")

        // Move to analysis
        setTimeout(() => analyzeCodebase(result.workingDirectory || localPath), 500)
      } else {
        // Clone remote repo
        setProgressMessage(`Cloning ${info.name}...`)
        setProgress(20)

        const response = await fetch("/api/projects/clone-repo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: info.url,
            branch: info.branch,
          }),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || "Failed to clone repository")
        }

        setWorkingDirectory(result.workingDirectory)
        setProgress(100)
        setProgressMessage("Clone complete!")

        // Move to analysis
        setTimeout(() => analyzeCodebase(result.workingDirectory), 500)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clone failed")
      setStep("url")
    }
  }

  // Analyze codebase
  const analyzeCodebase = async (directory: string) => {
    setStep("analyzing")
    setProgress(0)
    setProgressMessage("Scanning files...")

    try {
      const response = await fetch("/api/projects/analyze-codebase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workingDirectory: directory,
          generateSummaries: true,
        }),
      })

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + 10, 90))
      }, 500)

      const result = await response.json()
      clearInterval(progressInterval)

      if (!response.ok) {
        throw new Error(result.error || "Analysis failed")
      }

      setAnalysis(result.analysis)
      setProgress(100)
      setProgressMessage("Analysis complete!")

      // Move to review
      setTimeout(() => setStep("review"), 500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed")
      setStep("url")
    }
  }

  // Complete the wizard
  const handleComplete = () => {
    if (!repoInfo || !analysis) return

    onComplete({
      repoInfo,
      analysis,
      workingDirectory,
      projectName,
    })
  }

  // Step indicators
  const steps = [
    { id: "url", label: "Repository", icon: GitBranch },
    { id: "cloning", label: "Clone", icon: Github },
    { id: "analyzing", label: "Analyze", icon: Cpu },
    { id: "review", label: "Review", icon: FileText },
  ]

  const currentStepIndex = steps.findIndex((s) => s.id === step)

  return (
    <Card className={cn("w-full max-w-3xl", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {mode === "auto-mod" ? (
            <>
              <Zap className="h-5 w-5 text-amber-500" />
              Auto Mod - Import & Modify
            </>
          ) : (
            <>
              <GitBranch className="h-5 w-5 text-blue-500" />
              Import Repository
            </>
          )}
        </CardTitle>
        <CardDescription>
          {mode === "auto-mod"
            ? "Import any repository and describe how you want to modify it"
            : "Clone a repository and analyze its codebase"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((s, i) => {
            const Icon = s.icon
            const isActive = s.id === step
            const isComplete = currentStepIndex > i
            const isCurrent = currentStepIndex === i

            return (
              <React.Fragment key={s.id}>
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
                      isComplete && "bg-green-500 border-green-500 text-white",
                      isCurrent && "border-primary bg-primary/10 text-primary",
                      !isComplete && !isCurrent && "border-muted-foreground/30 text-muted-foreground"
                    )}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isCurrent && "text-primary",
                      !isCurrent && "text-muted-foreground"
                    )}
                  >
                    {s.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={cn(
                      "flex-1 h-0.5 mx-2",
                      isComplete ? "bg-green-500" : "bg-muted-foreground/30"
                    )}
                  />
                )}
              </React.Fragment>
            )
          })}
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500">
            <XCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step Content */}
        {step === "url" && (
          <div className="space-y-4">
            <Tabs defaultValue={isLocal ? "local" : "remote"} onValueChange={(v) => setIsLocal(v === "local")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="remote">
                  <Github className="h-4 w-4 mr-2" />
                  Remote Repository
                </TabsTrigger>
                <TabsTrigger value="local">
                  <Folder className="h-4 w-4 mr-2" />
                  Local Folder
                </TabsTrigger>
              </TabsList>

              <TabsContent value="remote" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="repo-url">Repository URL</Label>
                  <Input
                    id="repo-url"
                    placeholder="https://github.com/owner/repo"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Supports GitHub, GitLab, and Bitbucket URLs
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="local" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="local-path">Local Path</Label>
                  <Input
                    id="local-path"
                    placeholder="~/projects/my-app or /path/to/repo"
                    value={localPath}
                    onChange={(e) => setLocalPath(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Path to an existing folder on your machine
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                onClick={cloneRepo}
                disabled={isLocal ? !localPath : !repoUrl}
              >
                {isLocal ? "Import Folder" : "Clone Repository"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {(step === "cloning" || step === "analyzing") && (
          <div className="space-y-6 py-8">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <div className="text-center">
                <p className="text-lg font-medium">{progressMessage}</p>
                <p className="text-sm text-muted-foreground">
                  {step === "cloning" ? "Downloading repository files..." : "Scanning and analyzing codebase..."}
                </p>
              </div>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        {step === "review" && analysis && (
          <div className="space-y-6">
            {/* Project Info */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              <div className="p-3 rounded-xl bg-primary/10">
                <FileCode className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1">
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="text-lg font-semibold bg-transparent border-none p-0 h-auto focus-visible:ring-0"
                />
                <p className="text-sm text-muted-foreground">{analysis.projectType} project</p>
              </div>
              <Badge variant="secondary" className="text-lg px-3 py-1">
                {analysis.totalFiles} files
              </Badge>
            </div>

            {/* Tech Stack */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Cpu className="h-4 w-4" />
                Tech Stack Detected
              </h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{analysis.techStack.runtime}</Badge>
                <Badge variant="outline">{analysis.techStack.language}</Badge>
                {analysis.techStack.framework && (
                  <Badge variant="outline">{analysis.techStack.framework}</Badge>
                )}
                {analysis.techStack.ui && (
                  <Badge variant="outline">{analysis.techStack.ui}</Badge>
                )}
                {analysis.techStack.styling && (
                  <Badge variant="outline">{analysis.techStack.styling}</Badge>
                )}
                {analysis.techStack.database?.map((db) => (
                  <Badge key={db} variant="outline">
                    <Database className="h-3 w-3 mr-1" />
                    {db}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <div className="text-2xl font-bold">{analysis.totalFiles}</div>
                <div className="text-xs text-muted-foreground">Files</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <div className="text-2xl font-bold">{analysis.totalLines.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Lines</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <div className="text-2xl font-bold">{analysis.keyFiles.length}</div>
                <div className="text-xs text-muted-foreground">Key Files</div>
              </div>
            </div>

            {/* Key Files Preview */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <FolderTree className="h-4 w-4" />
                Key Files Identified
              </h4>
              <ScrollArea className="h-32 rounded border p-2">
                {analysis.keyFiles.slice(0, 15).map((file, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm py-1">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        file.importance === "critical" && "border-red-500 text-red-500",
                        file.importance === "high" && "border-orange-500 text-orange-500"
                      )}
                    >
                      {file.importance}
                    </Badge>
                    <span className="text-muted-foreground">{file.path}</span>
                  </div>
                ))}
              </ScrollArea>
            </div>

            {/* Languages */}
            {Object.keys(analysis.languages).length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Languages</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(analysis.languages)
                    .sort((a, b) => b[1].lines - a[1].lines)
                    .slice(0, 5)
                    .map(([lang, stats]) => (
                      <Badge key={lang} variant="secondary">
                        {lang}: {stats.files} files
                      </Badge>
                    ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep("url")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleComplete}>
                {mode === "auto-mod" ? "Continue to Modifications" : "Create Project"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
