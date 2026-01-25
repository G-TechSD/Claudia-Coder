"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/components/auth/auth-provider"
import { RepoImportWizard } from "@/components/project/repo-import-wizard"
import { createProject, updateProject } from "@/lib/data/projects"
import { saveBuildPlan, savePackets } from "@/lib/ai/build-plan"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  AlertCircle,
  Wand2,
  GitBranch,
  Code2,
  Sparkles,
  FileCode,
  RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ============================================================================
// Types
// ============================================================================

type Step = "source" | "analyze" | "describe" | "plan" | "create"

// Match the RepoImportWizard's types
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

interface ImportedData {
  repoInfo: RepoInfo
  analysis: AnalysisResult
  workingDirectory: string
  projectName: string
}

interface ModificationPlan {
  name: string
  description: string
  modifications: string[]
  affectedAreas: string[]
  approach: string
  risks?: string[]
}

// ============================================================================
// Component
// ============================================================================

export default function AutoModPage() {
  const router = useRouter()
  const { user } = useAuth()

  // State
  const [step, setStep] = useState<Step>("source")
  const [importedData, setImportedData] = useState<ImportedData | null>(null)
  const [modificationDescription, setModificationDescription] = useState("")
  const [modificationPlan, setModificationPlan] = useState<ModificationPlan | null>(null)
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleRepoImported = useCallback((data: ImportedData) => {
    setImportedData(data)
    setStep("describe")
  }, [])

  const handleGeneratePlan = async () => {
    if (!modificationDescription.trim() || !importedData) return

    const { repoInfo, analysis, projectName } = importedData

    setIsGeneratingPlan(true)
    setError(null)

    try {
      // Call the build-plan API with modification context
      const response = await fetch("/api/build-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: modificationDescription,
          projectType: analysis.projectType,
          isModification: true,
          codebaseContext: {
            techStack: analysis.techStack,
            keyFiles: analysis.keyFiles.slice(0, 20),
            apis: analysis.apis.slice(0, 15),
            totalFiles: analysis.totalFiles,
            totalLines: analysis.totalLines,
          },
          sourceRepo: {
            path: importedData.workingDirectory,
            provider: repoInfo.provider,
            url: repoInfo.url,
            branch: repoInfo.branch,
          },
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to generate modification plan")
      }

      const data = await response.json()

      // Extract modification plan from response
      setModificationPlan({
        name: data.projectName || `${projectName}-modified`,
        description: data.description || modificationDescription,
        modifications: data.features || [],
        affectedAreas: data.affectedAreas || [],
        approach: data.approach || "Incremental modification",
        risks: data.risks,
      })

      setStep("plan")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate plan")
    } finally {
      setIsGeneratingPlan(false)
    }
  }

  const handleCreateProject = async () => {
    if (!modificationPlan || !importedData || !user) return

    const { repoInfo, analysis, workingDirectory, projectName } = importedData

    setIsCreatingProject(true)
    setError(null)

    try {
      // Create the project with required fields
      const project = await createProject({
        name: modificationPlan.name,
        description: modificationPlan.description,
        status: "planning", // Stay in planning until user starts the build
        priority: "medium",
        repos: [],
        tags: ["auto-mod"],
        packetIds: [],
        userId: user.id,
        basePath: workingDirectory,
        workingDirectory: workingDirectory,
        sourceType: "auto-mod",
        sourceRepo: {
          url: repoInfo.url,
          branch: repoInfo.branch,
          clonedAt: new Date().toISOString(),
          originalCommit: "",
          provider: repoInfo.provider,
        },
        hasCodebaseContext: true,
      })

      // Generate build plan with packets
      const planResponse = await fetch("/api/build-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: modificationDescription,
          projectId: project.id,
          projectType: analysis.projectType,
          isModification: true,
          generatePackets: true,
          codebaseContext: {
            techStack: analysis.techStack,
            keyFiles: analysis.keyFiles.slice(0, 20),
            apis: analysis.apis.slice(0, 15),
          },
        }),
      })

      if (planResponse.ok) {
        const planData = await planResponse.json()

        // Save build plan
        if (planData.plan) {
          await saveBuildPlan(project.id, planData.plan)
        }

        // Save packets
        if (planData.packets?.length > 0) {
          await savePackets(project.id, planData.packets)
        }
      }

      // Redirect to project page
      router.push(`/projects/${project.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project")
      setIsCreatingProject(false)
    }
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="container max-w-4xl py-8">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/projects")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Button>

        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
            <Wand2 className="h-6 w-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Auto Mod</h1>
            <p className="text-muted-foreground">
              Transform any repository - make it do something different
            </p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[
            { key: "source", label: "Source", icon: GitBranch },
            { key: "describe", label: "Describe", icon: FileCode },
            { key: "plan", label: "Plan", icon: Sparkles },
            { key: "create", label: "Create", icon: Check },
          ].map((s, i) => {
            const isActive = step === s.key
            const isPast = ["source", "analyze", "describe", "plan", "create"].indexOf(step) >
              ["source", "analyze", "describe", "plan", "create"].indexOf(s.key as Step)
            const Icon = s.icon

            return (
              <div key={s.key} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
                      isActive
                        ? "border-purple-500 bg-purple-500/20 text-purple-400"
                        : isPast
                          ? "border-green-500 bg-green-500/20 text-green-400"
                          : "border-muted bg-muted/20 text-muted-foreground"
                    )}
                  >
                    {isPast ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={cn(
                    "text-xs mt-1",
                    isActive ? "text-purple-400" : isPast ? "text-green-400" : "text-muted-foreground"
                  )}>
                    {s.label}
                  </span>
                </div>
                {i < 3 && (
                  <div
                    className={cn(
                      "w-20 h-0.5 mx-2",
                      isPast ? "bg-green-500/50" : "bg-muted"
                    )}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Step Content */}
      {step === "source" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Select Repository
            </CardTitle>
            <CardDescription>
              Choose a GitHub repository or local folder to modify
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RepoImportWizard
              mode="auto-mod"
              onComplete={handleRepoImported}
              onCancel={() => router.push("/projects")}
            />
          </CardContent>
        </Card>
      )}

      {step === "describe" && importedData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5" />
              Describe Your Modification
            </CardTitle>
            <CardDescription>
              What do you want this codebase to do differently?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Codebase Summary */}
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Analyzing: {importedData.projectName}</h4>
                <Badge variant="outline">{importedData.analysis.projectType}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Files:</span>{" "}
                  <span className="font-medium">{importedData.analysis.totalFiles.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Lines:</span>{" "}
                  <span className="font-medium">{importedData.analysis.totalLines.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Tech:</span>{" "}
                  <span className="font-medium">
                    {importedData.analysis.techStack.framework || importedData.analysis.techStack.runtime || importedData.analysis.techStack.language}
                  </span>
                </div>
              </div>
            </div>

            {/* Modification Input */}
            <div className="space-y-2">
              <Label htmlFor="modification">What changes do you want to make?</Label>
              <Textarea
                id="modification"
                value={modificationDescription}
                onChange={(e) => setModificationDescription(e.target.value)}
                placeholder="Example: Add user authentication with JWT, create a dashboard page that shows user statistics, and add an API endpoint for exporting data..."
                className="min-h-[150px]"
              />
              <p className="text-xs text-muted-foreground">
                Be specific about what features to add, change, or remove. The AI will analyze the codebase and create a plan.
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("source")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleGeneratePlan}
                disabled={!modificationDescription.trim() || isGeneratingPlan}
              >
                {isGeneratingPlan ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Plan...
                  </>
                ) : (
                  <>
                    Generate Plan
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "plan" && modificationPlan && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Modification Plan
            </CardTitle>
            <CardDescription>
              Review the AI-generated plan for modifying this codebase
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Plan Summary */}
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Project Name</Label>
                <p className="font-medium">{modificationPlan.name}</p>
              </div>

              <div>
                <Label className="text-muted-foreground">Description</Label>
                <p className="text-sm">{modificationPlan.description}</p>
              </div>

              <div>
                <Label className="text-muted-foreground">Planned Modifications</Label>
                <ul className="mt-2 space-y-2">
                  {modificationPlan.modifications.map((mod, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Code2 className="h-4 w-4 mt-0.5 text-purple-400 shrink-0" />
                      {mod}
                    </li>
                  ))}
                </ul>
              </div>

              {modificationPlan.affectedAreas.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Affected Areas</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {modificationPlan.affectedAreas.map((area, i) => (
                      <Badge key={i} variant="secondary">{area}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {modificationPlan.risks && modificationPlan.risks.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Potential Risks</Label>
                  <ul className="mt-2 space-y-1 text-sm text-yellow-500">
                    {modificationPlan.risks.map((risk, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        {risk}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("describe")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleGeneratePlan}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
                <Button
                  onClick={handleCreateProject}
                  disabled={isCreatingProject}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  {isCreatingProject ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating Project...
                    </>
                  ) : (
                    <>
                      Create Project
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
