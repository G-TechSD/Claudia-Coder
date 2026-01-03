"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { InterviewPanel } from "@/components/interview/interview-panel"
import { createProject, linkRepoToProject } from "@/lib/data/projects"
import { createGitLabRepo, hasGitLabToken, setGitLabToken, validateGitLabToken } from "@/lib/gitlab/api"
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition"
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
  Mic,
  MicOff
} from "lucide-react"
import { cn } from "@/lib/utils"

type Mode = "choose" | "quick" | "interview" | "setup" | "complete"

interface GeneratedPlan {
  name: string
  description: string
  features: string[]
  techStack: string[]
  priority: "low" | "medium" | "high" | "critical"
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

  // Voice input for description
  const descriptionVoiceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const descriptionSpeech = useSpeechRecognition({
    continuous: true,
    interimResults: true,
    onResult: (transcript, isFinal) => {
      if (isFinal && transcript.trim()) {
        // Append to description
        setQuickDescription(prev => (prev + " " + transcript).trim())

        // Clear any pending timeout
        if (descriptionVoiceTimeoutRef.current) {
          clearTimeout(descriptionVoiceTimeoutRef.current)
        }

        // Auto-stop after 2 seconds of silence
        descriptionVoiceTimeoutRef.current = setTimeout(() => {
          descriptionSpeech.stopListening()
        }, 2000)
      }
    }
  })

  // Cleanup voice timeout
  useEffect(() => {
    return () => {
      if (descriptionVoiceTimeoutRef.current) {
        clearTimeout(descriptionVoiceTimeoutRef.current)
      }
    }
  }, [])

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

  // Check for GitLab token on mount
  useEffect(() => {
    setHasToken(hasGitLabToken())
  }, [])

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
      const project = createProject({
        name: projectName,
        description: projectDescription,
        status: "planning",
        priority,
        repos: [],
        packetIds: [],
        tags: generatedPlan?.techStack || (interviewSession?.extractedData?.techStack as string[]) || [],
        creationInterview: interviewSession || undefined
      })

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
            <div className="relative">
              <Textarea
                placeholder="Describe your project in a sentence or two... e.g., 'A mobile app for tracking daily habits with social accountability features'"
                value={quickDescription + (descriptionSpeech.interimTranscript ? " " + descriptionSpeech.interimTranscript : "")}
                onChange={(e) => setQuickDescription(e.target.value)}
                rows={4}
                className="text-lg pr-14"
                disabled={descriptionSpeech.isListening}
              />
              <button
                type="button"
                onClick={() => {
                  if (descriptionSpeech.isListening) {
                    descriptionSpeech.stopListening()
                  } else {
                    descriptionSpeech.resetTranscript()
                    descriptionSpeech.startListening()
                  }
                }}
                disabled={!descriptionSpeech.isSupported}
                className={cn(
                  "absolute right-3 top-3 h-10 w-10 rounded-full flex items-center justify-center transition-all",
                  descriptionSpeech.isListening
                    ? "bg-red-500 text-white animate-pulse"
                    : "bg-muted hover:bg-accent text-muted-foreground hover:text-foreground",
                  !descriptionSpeech.isSupported && "opacity-50 cursor-not-allowed"
                )}
                title={descriptionSpeech.isSupported ? "Click to speak" : "Voice not supported"}
              >
                {descriptionSpeech.isListening ? (
                  <MicOff className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </button>
            </div>

            {descriptionSpeech.isListening && (
              <p className="text-sm text-center text-muted-foreground animate-pulse">
                Listening... speak your project description
              </p>
            )}

            {descriptionSpeech.error && (
              <p className="text-sm text-center text-red-500">
                {descriptionSpeech.error}
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                className="flex-1"
                onClick={handleFeelingLucky}
                disabled={!quickDescription.trim() || isGenerating || descriptionSpeech.isListening}
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

        <div className="text-center">
          <Button variant="ghost" onClick={() => router.push("/projects")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
        </div>
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
