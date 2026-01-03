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
import { createProject, linkRepoToProject } from "@/lib/data/projects"
import { createGitLabRepo, hasGitLabToken, setGitLabToken, validateGitLabToken } from "@/lib/gitlab/api"
import type { InterviewSession, Project } from "@/lib/data/types"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  GitBranch,
  Loader2,
  AlertCircle,
  Key,
  ExternalLink
} from "lucide-react"
import { cn } from "@/lib/utils"

type Step = "interview" | "setup" | "complete"

export default function NewProjectPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("interview")
  const [interviewSession, setInterviewSession] = useState<InterviewSession | null>(null)

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

  const handleInterviewComplete = (session: InterviewSession) => {
    setInterviewSession(session)

    // Extract data from interview
    const extractedData = session.extractedData || {}
    const name = (extractedData.name as string) || generateProjectName(session)
    const description = (extractedData.description as string) || session.summary || ""

    setProjectName(name)
    setProjectDescription(description)
    setRepoName(toRepoName(name))
    setPriority((extractedData.priority as "low" | "medium" | "high" | "critical") || "medium")

    setStep("setup")
  }

  const handleInterviewCancel = () => {
    router.push("/projects")
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
      // Create the project
      const project = createProject({
        name: projectName,
        description: projectDescription,
        status: "planning",
        priority,
        repos: [],
        packetIds: [],
        tags: (interviewSession?.extractedData?.techStack as string[]) || [],
        creationInterview: interviewSession || undefined
      })

      // Optionally create GitLab repo
      if (createRepo && hasToken) {
        try {
          const repo = await createGitLabRepo({
            name: repoName,
            description: projectDescription,
            visibility: repoVisibility,
            initializeWithReadme: initWithReadme
          })

          // Link the repo to the project
          linkRepoToProject(project.id, {
            provider: "gitlab",
            id: repo.id,
            name: repo.name,
            path: repo.path,
            url: repo.web_url
          })
        } catch (repoError) {
          console.error("Failed to create repo:", repoError)
          // Don't fail the whole process if repo creation fails
          setSubmitError(`Project created, but repo creation failed: ${repoError instanceof Error ? repoError.message : "Unknown error"}`)
        }
      }

      setCreatedProject(project)
      setStep("complete")
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to create project")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Interview step
  if (step === "interview") {
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

  // Complete step
  if (step === "complete" && createdProject) {
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

  // Setup step
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setStep("interview")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Set Up Your Project</h1>
          <p className="text-sm text-muted-foreground">
            Review and finalize your project details
          </p>
        </div>
      </div>

      {/* Project Details Card */}
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

      {/* Repository Card */}
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
            {/* Token configuration */}
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
                    Will be created at: http://192.168.245.11/gtechsd/{repoName}
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

      {/* Submit Error */}
      {submitError && (
        <div className="p-4 rounded-lg bg-red-500/10 text-red-600 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 flex-none mt-0.5" />
          <p className="text-sm">{submitError}</p>
        </div>
      )}

      {/* Actions */}
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

// Convert project name to valid repo name
function toRepoName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50)
}
