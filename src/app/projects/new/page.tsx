"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { InterviewPanel } from "@/components/interview/interview-panel"
import { VoiceInput } from "@/components/voice/voice-input"
import { createProject, linkRepoToProject, configureLinearSync } from "@/lib/data/projects"
import { savePackets, saveBuildPlan } from "@/lib/ai/build-plan"
import { createGitLabRepo, hasGitLabToken, setGitLabToken, validateGitLabToken } from "@/lib/gitlab/api"
import { useSettings } from "@/hooks/useSettings"
import { LLMStatusBadge } from "@/components/llm/llm-status"
import type { InterviewSession, Project } from "@/lib/data/types"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  GitBranch,
  Loader2,
  AlertCircle,
  Key,
  Sparkles,
  MessageSquare,
  Zap,
  X,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Download,
  Search,
  Package
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

type Mode = "choose" | "quick" | "interview" | "linear" | "setup" | "complete"

interface GeneratedPlan {
  name: string
  description: string
  features: string[]
  techStack: string[]
  priority: "low" | "medium" | "high" | "critical"
}

interface LinearProjectPreview {
  id: string
  name: string
  description?: string
  state: string
  progress: number
  teams: { nodes: Array<{ id: string; name: string; key: string }> }
}

interface LinearImportData {
  project: {
    name: string
    description: string
    linearProjectId: string
    teamIds: string[]
    progress: number
  }
  phases: Array<{
    id: string
    name: string
    description: string
    order: number
    status: "not_started"
  }>
  packets: Array<{
    id: string
    title: string
    type: string
    priority: string
    status: string
  }>
  summary: {
    totalIssues: number
    byPriority: Record<string, number>
    byStatus: Record<string, number>
    byType: Record<string, number>
  }
}

export default function NewProjectPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("choose")
  const [interviewSession, setInterviewSession] = useState<InterviewSession | null>(null)

  // Quick mode state
  const [quickDescription, setQuickDescription] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null)
  const [planError, setPlanError] = useState("")
  const [isVoiceMode, setIsVoiceMode] = useState(false)

  // Settings for paid API access
  const { settings } = useSettings()

  // Project setup state
  const [projectName, setProjectName] = useState("")
  const [projectDescription, setProjectDescription] = useState("")
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">("medium")

  // Repo creation state
  const [createRepo, setCreateRepo] = useState(true)
  const [repoName, setRepoName] = useState("")
  const [repoVisibility, setRepoVisibility] = useState<"private" | "internal" | "public">("private")
  const [initWithReadme, setInitWithReadme] = useState(true)

  // GitLab token state
  const [hasToken, setHasToken] = useState(false)
  const [showTokenInput, setShowTokenInput] = useState(false)
  const [tokenInput, setTokenInput] = useState("")
  const [tokenValidating, setTokenValidating] = useState(false)
  const [tokenError, setTokenError] = useState("")

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [createdProject, setCreatedProject] = useState<Project | null>(null)

  // Linear import state
  const [linearProjects, setLinearProjects] = useState<LinearProjectPreview[]>([])
  const [linearSearch, setLinearSearch] = useState("")
  const [linearLoading, setLinearLoading] = useState(false)
  const [linearError, setLinearError] = useState("")
  const [selectedLinearProject, setSelectedLinearProject] = useState<LinearProjectPreview | null>(null)
  const [linearImportData, setLinearImportData] = useState<LinearImportData | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  // Check for GitLab token on mount
  useEffect(() => {
    setHasToken(hasGitLabToken())
  }, [])

  // Load Linear projects when entering Linear mode
  useEffect(() => {
    if (mode === "linear") {
      loadLinearProjects()
    }
  }, [mode])

  const loadLinearProjects = async () => {
    setLinearLoading(true)
    setLinearError("")

    try {
      const response = await fetch("/api/linear/projects")
      if (!response.ok) {
        throw new Error("Failed to load Linear projects")
      }
      const data = await response.json()
      setLinearProjects(data.projects || [])
    } catch (err) {
      setLinearError(err instanceof Error ? err.message : "Failed to load projects")
    } finally {
      setLinearLoading(false)
    }
  }

  const handleLinearImport = async (project: LinearProjectPreview) => {
    setSelectedLinearProject(project)
    setIsImporting(true)
    setLinearError("")

    try {
      const response = await fetch("/api/linear/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id })
      })

      if (!response.ok) {
        throw new Error("Failed to import project")
      }

      const data = await response.json()
      setLinearImportData(data)

      // Pre-fill project details from import
      setProjectName(data.project.name)
      setProjectDescription(data.project.description || `Imported from Linear with ${data.summary.totalIssues} issues`)
      setRepoName(toRepoName(data.project.name))
      setPriority("medium")

    } catch (err) {
      setLinearError(err instanceof Error ? err.message : "Import failed")
      setSelectedLinearProject(null)
    } finally {
      setIsImporting(false)
    }
  }

  const handleLinearConfirm = () => {
    if (!linearImportData) return
    setMode("setup")
  }

  // Generate plan from quick description
  const handleFeelingLucky = async () => {
    if (!quickDescription.trim()) return

    setIsGenerating(true)
    setPlanError("")

    try {
      const response = await fetch("/api/llm/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: quickDescription,
          allowPaidFallback: settings.allowPaidLLM
        })
      })

      if (!response.ok) {
        throw new Error("Failed to generate plan")
      }

      const plan = await response.json()
      setGeneratedPlan(plan)
      setMode("quick")
    } catch (error) {
      // Fallback to basic plan generation
      const words = quickDescription.split(/\s+/)
      const name = words.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")

      setGeneratedPlan({
        name: name || "New Project",
        description: quickDescription,
        features: ["Core functionality as described"],
        techStack: [],
        priority: "medium"
      })
      setMode("quick")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleApprovePlan = () => {
    if (!generatedPlan) return

    setProjectName(generatedPlan.name)
    setProjectDescription(generatedPlan.description)
    setRepoName(toRepoName(generatedPlan.name))
    setPriority(generatedPlan.priority)
    setMode("setup")
  }

  const handleRejectPlan = () => {
    setGeneratedPlan(null)
    setMode("choose")
  }

  const handleRegeneratePlan = async () => {
    await handleFeelingLucky()
  }

  const handleInterviewComplete = (session: InterviewSession) => {
    setInterviewSession(session)

    const extractedData = session.extractedData || {}
    const name = (extractedData.name as string) || generateProjectName(session)
    const description = (extractedData.description as string) || session.summary || ""

    setProjectName(name)
    setProjectDescription(description)
    setRepoName(toRepoName(name))
    setPriority((extractedData.priority as "low" | "medium" | "high" | "critical") || "medium")

    setMode("setup")
  }

  const handleInterviewCancel = () => {
    setMode("choose")
  }

  const handleTokenSave = async () => {
    if (!tokenInput.trim()) {
      setTokenError("Please enter a token")
      return
    }

    setTokenValidating(true)
    setTokenError("")

    const isValid = await validateGitLabToken(tokenInput.trim())

    if (isValid) {
      setGitLabToken(tokenInput.trim())
      setHasToken(true)
      setShowTokenInput(false)
      setTokenInput("")
    } else {
      setTokenError("Invalid token. Please check and try again.")
    }

    setTokenValidating(false)
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setSubmitError("")

    try {
      // Determine tags based on source
      let tags = generatedPlan?.techStack || (interviewSession?.extractedData?.techStack as string[]) || []
      if (linearImportData) {
        tags = ["imported-from-linear"]
      }

      const project = createProject({
        name: projectName,
        description: projectDescription,
        status: linearImportData ? "active" : "planning",
        priority,
        repos: [],
        packetIds: [],
        tags,
        creationInterview: interviewSession || undefined
      })

      // Handle Linear import data
      if (linearImportData && selectedLinearProject) {
        // Configure Linear sync
        configureLinearSync(project.id, {
          mode: "imported",
          projectId: linearImportData.project.linearProjectId,
          teamId: linearImportData.project.teamIds[0],
          importedAt: new Date().toISOString(),
          importedIssueCount: linearImportData.summary.totalIssues
        })

        // Save the build plan with phases
        saveBuildPlan(project.id, {
          id: `plan-${Date.now()}`,
          projectId: project.id,
          version: 1,
          status: "approved",
          phases: linearImportData.phases.map(p => ({
            ...p,
            packetIds: linearImportData.packets
              .filter(pkt => pkt.status !== "completed")
              .map(pkt => pkt.id)
          })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })

        // Save all the packets
        savePackets(project.id, linearImportData.packets as never[])
      }

      if (createRepo && hasToken) {
        try {
          const repo = await createGitLabRepo({
            name: repoName,
            description: projectDescription,
            visibility: repoVisibility,
            initializeWithReadme: initWithReadme
          })

          linkRepoToProject(project.id, {
            provider: "gitlab",
            id: repo.id,
            name: repo.name,
            path: repo.path,
            url: repo.web_url
          })
        } catch (repoError) {
          console.error("Failed to create repo:", repoError)
          setSubmitError(`Project created, but repo creation failed: ${repoError instanceof Error ? repoError.message : "Unknown error"}`)
        }
      }

      setCreatedProject(project)
      setMode("complete")
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to create project")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Mode: Choose - initial screen with description input
  if (mode === "choose") {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-3xl font-bold">New Project</h1>
            <LLMStatusBadge />
          </div>
          <p className="text-muted-foreground">
            Describe what you want to build, then choose your path
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Toggle between text and voice input */}
            <div className="flex justify-center gap-2 pb-2">
              <Button
                variant={!isVoiceMode ? "default" : "outline"}
                size="sm"
                onClick={() => setIsVoiceMode(false)}
              >
                Type
              </Button>
              <Button
                variant={isVoiceMode ? "default" : "outline"}
                size="sm"
                onClick={() => setIsVoiceMode(true)}
              >
                Speak
              </Button>
            </div>

            {!isVoiceMode ? (
              /* Text Input Mode */
              <Textarea
                placeholder="Describe your project in a sentence or two... e.g., 'A mobile app for tracking daily habits with social accountability features'"
                value={quickDescription}
                onChange={(e) => setQuickDescription(e.target.value)}
                rows={4}
                className="text-lg"
              />
            ) : (
              /* Voice Input Mode */
              <div className="py-4">
                <VoiceInput
                  onTranscript={(text) => {
                    setQuickDescription(prev => (prev ? prev + " " + text : text).trim())
                  }}
                  onListeningChange={(listening) => {
                    // Could show additional UI feedback
                  }}
                  size="lg"
                  pauseTimeout={2500}
                />
                {quickDescription && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Captured:</p>
                    <p className="text-sm">{quickDescription}</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                className="flex-1"
                onClick={handleFeelingLucky}
                disabled={!quickDescription.trim() || isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Zap className="mr-2 h-5 w-5" />
                )}
                Feeling Lucky
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="flex-1"
                onClick={() => setMode("interview")}
              >
                <MessageSquare className="mr-2 h-5 w-5" />
                Full Interview
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              <strong>Feeling Lucky</strong> generates a plan instantly • <strong>Full Interview</strong> asks 10-20 questions for detail
            </p>
          </CardContent>
        </Card>

        {/* Import from Linear */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-[#5E6AD2]/10 flex items-center justify-center">
                <Download className="h-5 w-5 text-[#5E6AD2]" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Import from Linear</p>
                <p className="text-sm text-muted-foreground">
                  Import an existing project with all its issues
                </p>
              </div>
              <Button onClick={() => setMode("linear")}>
                Import
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button variant="ghost" onClick={() => router.push("/projects")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
        </div>
      </div>
    )
  }

  // Mode: Linear - import from Linear
  if (mode === "linear") {
    const filteredProjects = linearSearch
      ? linearProjects.filter(p =>
          p.name.toLowerCase().includes(linearSearch.toLowerCase()) ||
          p.description?.toLowerCase().includes(linearSearch.toLowerCase())
        )
      : linearProjects

    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => {
            setMode("choose")
            setSelectedLinearProject(null)
            setLinearImportData(null)
          }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Import from Linear</h1>
            <p className="text-sm text-muted-foreground">
              Select a project to import with all its issues
            </p>
          </div>
        </div>

        {linearError && (
          <div className="p-4 rounded-lg bg-red-500/10 text-red-600 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-none mt-0.5" />
            <p className="text-sm">{linearError}</p>
          </div>
        )}

        {!selectedLinearProject ? (
          /* Project Selection */
          <Card>
            <CardHeader>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  value={linearSearch}
                  onChange={(e) => setLinearSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              {linearLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {linearSearch ? "No projects match your search" : "No projects found in Linear"}
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {filteredProjects.map((project) => (
                      <div
                        key={project.id}
                        className="p-4 rounded-lg border hover:border-primary/50 cursor-pointer transition-colors"
                        onClick={() => handleLinearImport(project)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{project.name}</p>
                            {project.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {project.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {project.state}
                              </Badge>
                              {project.teams.nodes.map(team => (
                                <Badge key={team.id} variant="secondary" className="text-xs">
                                  {team.key}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <div className="text-2xl font-bold text-primary">
                              {Math.round(project.progress * 100)}%
                            </div>
                            <p className="text-xs text-muted-foreground">progress</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        ) : (
          /* Import Preview */
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                {selectedLinearProject.name}
              </CardTitle>
              <CardDescription>
                {selectedLinearProject.description || "No description"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isImporting ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">Importing issues...</p>
                  </div>
                </div>
              ) : linearImportData ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <div className="text-3xl font-bold">{linearImportData.summary.totalIssues}</div>
                      <p className="text-xs text-muted-foreground">Total Issues</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <div className="text-3xl font-bold text-red-500">
                        {linearImportData.summary.byPriority.critical || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">Critical</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <div className="text-3xl font-bold text-orange-500">
                        {linearImportData.summary.byPriority.high || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">High Priority</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <div className="text-3xl font-bold text-green-500">
                        {linearImportData.summary.byStatus.completed || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">Completed</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase">By Type</Label>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(linearImportData.summary.byType).map(([type, count]) => (
                        count > 0 && (
                          <Badge key={type} variant="secondary">
                            {type}: {count}
                          </Badge>
                        )
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setSelectedLinearProject(null)
                        setLinearImportData(null)
                      }}
                    >
                      Choose Different
                    </Button>
                    <Button className="flex-1" onClick={handleLinearConfirm}>
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // Mode: Quick - show generated plan for approval
  if (mode === "quick" && generatedPlan) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setMode("choose")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Review Your Plan</h1>
            <p className="text-sm text-muted-foreground">
              Generated from: "{quickDescription.slice(0, 50)}..."
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {generatedPlan.name}
            </CardTitle>
            <CardDescription>{generatedPlan.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {generatedPlan.features.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground uppercase">Suggested Features</Label>
                <ul className="mt-1 space-y-1">
                  {generatedPlan.features.map((feature, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {generatedPlan.techStack.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground uppercase">Tech Stack</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {generatedPlan.techStack.map((tech, i) => (
                    <Badge key={i} variant="secondary">{tech}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs text-muted-foreground uppercase">Priority</Label>
              <Badge
                className={cn(
                  "mt-1 capitalize",
                  generatedPlan.priority === "critical" && "bg-red-500",
                  generatedPlan.priority === "high" && "bg-orange-500"
                )}
              >
                {generatedPlan.priority}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={handleRejectPlan}>
            <ThumbsDown className="mr-2 h-4 w-4" />
            Start Over
          </Button>
          <Button variant="outline" onClick={handleRegeneratePlan} disabled={isGenerating}>
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          <Button className="flex-1" onClick={handleApprovePlan}>
            <ThumbsUp className="mr-2 h-4 w-4" />
            Looks Good
          </Button>
        </div>
      </div>
    )
  }

  // Mode: Interview
  if (mode === "interview") {
    return (
      <div className="h-[calc(100vh-4rem)]">
        <InterviewPanel
          type="project_creation"
          onComplete={handleInterviewComplete}
          onCancel={handleInterviewCancel}
        />
      </div>
    )
  }

  // Mode: Complete
  if (mode === "complete" && createdProject) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] p-6">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-6 text-center">
            <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Project Created!</h2>
            <p className="text-muted-foreground mb-6">
              {createdProject.name} is ready to go.
              {createdProject.repos.length > 0 && (
                <> A GitLab repository has been created and linked.</>
              )}
            </p>
            {submitError && (
              <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 text-yellow-600 text-sm">
                {submitError}
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => router.push("/projects")}>
                All Projects
              </Button>
              <Button onClick={() => router.push(`/projects/${createdProject.id}`)}>
                View Project
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Mode: Setup
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setMode("choose")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Set Up Your Project</h1>
          <p className="text-sm text-muted-foreground">
            Review and finalize your project details
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project Details</CardTitle>
          <CardDescription>Basic information about your project</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              value={projectName}
              onChange={(e) => {
                setProjectName(e.target.value)
                setRepoName(toRepoName(e.target.value))
              }}
              placeholder="My Awesome Project"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              placeholder="What does this project do?"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Priority</Label>
            <div className="flex gap-2">
              {(["low", "medium", "high", "critical"] as const).map((p) => (
                <Badge
                  key={p}
                  variant={priority === p ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer capitalize",
                    priority === p && p === "critical" && "bg-red-500",
                    priority === p && p === "high" && "bg-orange-500",
                    priority === p && p === "low" && "bg-slate-500"
                  )}
                  onClick={() => setPriority(p)}
                >
                  {p}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                GitLab Repository
              </CardTitle>
              <CardDescription>Optionally create a new repository for this project</CardDescription>
            </div>
            <Switch
              checked={createRepo}
              onCheckedChange={setCreateRepo}
            />
          </div>
        </CardHeader>
        {createRepo && (
          <CardContent className="space-y-4">
            {!hasToken ? (
              <div className="p-4 rounded-lg border border-dashed space-y-3">
                <div className="flex items-start gap-3">
                  <Key className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">GitLab Access Token Required</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      To create repositories, you need to configure a GitLab personal access token with API scope.
                    </p>
                  </div>
                </div>

                {showTokenInput ? (
                  <div className="space-y-3">
                    <Input
                      type="password"
                      placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                    />
                    {tokenError && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {tokenError}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleTokenSave}
                        disabled={tokenValidating}
                      >
                        {tokenValidating && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                        Save Token
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setShowTokenInput(false)
                          setTokenInput("")
                          setTokenError("")
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setShowTokenInput(true)}>
                    Configure Token
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="repoName">Repository Name</Label>
                  <Input
                    id="repoName"
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    placeholder="my-project"
                  />
                  <p className="text-xs text-muted-foreground">
                    Will be created at: https://bill-dev-linux-1/gtechsd/{repoName}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Visibility</Label>
                  <div className="flex gap-2">
                    {(["private", "internal", "public"] as const).map((v) => (
                      <Badge
                        key={v}
                        variant={repoVisibility === v ? "default" : "outline"}
                        className="cursor-pointer capitalize"
                        onClick={() => setRepoVisibility(v)}
                      >
                        {v}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="readme">Initialize with README</Label>
                    <p className="text-xs text-muted-foreground">Create an initial README.md file</p>
                  </div>
                  <Switch
                    id="readme"
                    checked={initWithReadme}
                    onCheckedChange={setInitWithReadme}
                  />
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>

      {submitError && (
        <div className="p-4 rounded-lg bg-red-500/10 text-red-600 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 flex-none mt-0.5" />
          <p className="text-sm">{submitError}</p>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push("/projects")}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !projectName.trim()}
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {createRepo && hasToken ? "Create Project & Repository" : "Create Project"}
          <Check className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// Generate a project name from interview content
function generateProjectName(session: InterviewSession): string {
  const firstUserMessage = session.messages.find(m => m.role === "user")
  if (!firstUserMessage) return "New Project"

  const content = firstUserMessage.content

  const patterns = [
    /(?:build|create|make|develop)\s+(?:a|an)?\s*([^,.!?]{3,30})/i,
    /^(?:a|an)\s+([^,.!?]{3,30})/i,
    /called\s+["']?([^"',!?.]{3,30})["']?/i,
    /named\s+["']?([^"',!?.]{3,30})["']?/i
  ]

  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match) {
      return capitalizeWords(match[1].trim())
    }
  }

  const words = content
    .split(/\s+/)
    .filter(w => w.length > 3 && !["want", "need", "like", "would", "could", "should", "that", "this", "with"].includes(w.toLowerCase()))
    .slice(0, 3)
    .join(" ")

  return capitalizeWords(words) || "New Project"
}

function capitalizeWords(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function toRepoName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50)
}
