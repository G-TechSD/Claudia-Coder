"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { VoiceInput } from "@/components/voice/voice-input"
import { FileBrowser } from "@/components/project/file-browser"
import { cn } from "@/lib/utils"
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Mic,
  FileText,
  Download,
  Folder,
  Package,
  Sparkles,
  Play,
  CheckCircle2,
  AlertCircle,
  FolderTree,
  Rocket,
  Edit3,
  X,
  RefreshCw
} from "lucide-react"

// Types
interface GeneratedPlan {
  name: string
  description: string
  features: string[]
  techStack: string[]
  priority: "low" | "medium" | "high" | "critical"
}

interface BuildPlanSpec {
  name: string
  description: string
  objectives: string[]
  nonGoals: string[]
  assumptions: string[]
  risks: string[]
  techStack: string[]
}

interface Phase {
  id: string
  name: string
  description: string
  order: number
}

interface PacketTask {
  id: string
  description: string
  completed: boolean
  order: number
}

interface WorkPacket {
  id: string
  phaseId: string
  title: string
  description: string
  type: "feature" | "bugfix" | "refactor" | "test" | "docs" | "config" | "research"
  priority: "critical" | "high" | "medium" | "low"
  status: "queued" | "in_progress" | "completed" | "blocked"
  tasks: PacketTask[]
  acceptanceCriteria: string[]
}

interface BuildPlanData {
  spec: BuildPlanSpec
  phases: Phase[]
  packets: WorkPacket[]
}

interface Project {
  id: string
  name: string
  description: string
  status: string
  priority: string
  createdAt: string
  updatedAt: string
  workingDirectory?: string
  basePath?: string
  repos: Array<{ provider: string; id: number; name: string; path: string; url: string }>
  packetIds: string[]
  tags: string[]
}

type Step = 1 | 2 | 3 | 4 | 5 | 6

// Session persistence key
const SESSION_STORAGE_KEY = "claudia_easy_mode_session"

interface EasyModeSession {
  projectName: string
  projectDescription: string
  brainDumpText: string
  currentStep: Step
  generatedPlan: GeneratedPlan | null
  buildPlan: BuildPlanData | null
  timestamp: string
}

export default function EasyModePage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>(1)

  // Step 1: Project info
  const [projectName, setProjectName] = useState("")
  const [projectDescription, setProjectDescription] = useState("")

  // Step 2: Brain dump
  const [brainDumpText, setBrainDumpText] = useState("")
  const [isListening, setIsListening] = useState(false)

  // Step 3: Generation
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generationStatus, setGenerationStatus] = useState("")
  const [generationError, setGenerationError] = useState("")
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null)
  const [buildPlan, setBuildPlan] = useState<BuildPlanData | null>(null)

  // Step 4: Review
  const [isApproved, setIsApproved] = useState(false)

  // Step 5: Build execution
  const [isBuilding, setIsBuilding] = useState(false)
  const [buildProgress, setBuildProgress] = useState(0)
  const [buildStatus, setBuildStatus] = useState("")
  const [buildError, setBuildError] = useState("")
  const [createdProject, setCreatedProject] = useState<Project | null>(null)

  // Step 6: Results
  const [workingDirectory, setWorkingDirectory] = useState("")

  // Load session from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY)
      if (stored) {
        const session: EasyModeSession = JSON.parse(stored)
        // Restore interview data
        if (session.projectName) setProjectName(session.projectName)
        if (session.projectDescription) setProjectDescription(session.projectDescription)
        if (session.brainDumpText) setBrainDumpText(session.brainDumpText)
        if (session.currentStep) setCurrentStep(session.currentStep)
        if (session.generatedPlan) setGeneratedPlan(session.generatedPlan)
        if (session.buildPlan) setBuildPlan(session.buildPlan)
      }
    } catch (error) {
      console.error("Failed to restore Easy Mode session:", error)
    }
  }, [])

  // Save session to localStorage whenever interview data changes
  useEffect(() => {
    // Don't save if no data has been entered yet
    if (!projectName && !projectDescription && !brainDumpText && currentStep === 1) {
      return
    }

    try {
      const session: EasyModeSession = {
        projectName,
        projectDescription,
        brainDumpText,
        currentStep,
        generatedPlan,
        buildPlan,
        timestamp: new Date().toISOString()
      }
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
    } catch (error) {
      console.error("Failed to save Easy Mode session:", error)
    }
  }, [projectName, projectDescription, brainDumpText, currentStep, generatedPlan, buildPlan])

  // Clear session data helper
  const clearSession = useCallback(() => {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY)
    } catch (error) {
      console.error("Failed to clear Easy Mode session:", error)
    }
  }, [])

  // Step navigation
  const canGoNext = (): boolean => {
    switch (currentStep) {
      case 1:
        return projectName.trim().length > 0 && projectDescription.trim().length > 0
      case 2:
        return true // Brain dump is optional
      case 3:
        return buildPlan !== null && !isGenerating
      case 4:
        return isApproved
      case 5:
        return createdProject !== null && !isBuilding
      case 6:
        return true
      default:
        return false
    }
  }

  const goToStep = (step: Step) => {
    setCurrentStep(step)
  }

  const nextStep = () => {
    if (currentStep < 6 && canGoNext()) {
      if (currentStep === 2) {
        // Auto-generate when moving from brain dump to generation
        generateBuildPlan()
      } else if (currentStep === 4) {
        // Start build when moving from review to execution
        startBuild()
      }
      setCurrentStep((prev) => Math.min(6, prev + 1) as Step)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => Math.max(1, prev - 1) as Step)
    }
  }

  // Generate build plan
  const generateBuildPlan = async () => {
    setIsGenerating(true)
    setGenerationProgress(0)
    setGenerationStatus("Starting generation...")
    setGenerationError("")

    try {
      // Step 1: Generate initial plan (20%)
      setGenerationProgress(10)
      setGenerationStatus("Analyzing project requirements...")

      const fullDescription = brainDumpText
        ? `${projectDescription}\n\nAdditional context from brain dump:\n${brainDumpText}`
        : projectDescription

      const planResponse = await fetch("/api/llm/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: fullDescription, allowPaidFallback: true })
      })

      const planData = await planResponse.json()

      if (planData.error) {
        throw new Error(planData.error)
      }

      setGenerationProgress(30)
      setGenerationStatus("Generated initial plan...")

      const plan: GeneratedPlan = {
        name: planData.name || projectName,
        description: planData.description || projectDescription,
        features: planData.features || [],
        techStack: planData.techStack || [],
        priority: planData.priority || "medium"
      }
      setGeneratedPlan(plan)

      // Step 2: Generate build plan with packets (60%)
      setGenerationProgress(50)
      setGenerationStatus("Creating build plan and work packets...")

      const buildPlanResponse = await fetch("/api/llm/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userPrompt: `Generate a detailed build plan for a software project.

Project Name: ${plan.name}
Description: ${plan.description}
Features: ${plan.features.join(", ")}
Tech Stack: ${plan.techStack.join(", ")}

Generate a JSON build plan with:
1. A "spec" object with: name, description, objectives (array), nonGoals (array), assumptions (array), risks (array), techStack (array)
2. A "phases" array with objects containing: id, name, description, order
3. A "packets" array with work packets, each containing: id, phaseId, title, description, type (feature/bugfix/refactor/test/docs/config/research), priority (critical/high/medium/low), status ("queued"), tasks (array of {id, description, completed: false, order}), acceptanceCriteria (array of strings)

Output ONLY valid JSON, no markdown or explanation.`,
          temperature: 0.5,
          max_tokens: 4096
        })
      })

      const buildPlanData = await buildPlanResponse.json()

      if (buildPlanData.error) {
        throw new Error(buildPlanData.error)
      }

      setGenerationProgress(80)
      setGenerationStatus("Parsing build plan...")

      // Parse the build plan
      let parsedBuildPlan: BuildPlanData
      try {
        let content = buildPlanData.content || buildPlanData.text || ""
        // Remove markdown code blocks if present
        if (content.includes("```")) {
          content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "")
        }
        parsedBuildPlan = JSON.parse(content.trim())
      } catch {
        // Create a default build plan if parsing fails
        parsedBuildPlan = createDefaultBuildPlan(plan)
      }

      // Validate and fix the build plan structure
      parsedBuildPlan = validateBuildPlan(parsedBuildPlan, plan)

      setBuildPlan(parsedBuildPlan)
      setGenerationProgress(100)
      setGenerationStatus("Build plan ready!")

    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed"
      setGenerationError(message)
      setGenerationStatus("Generation failed")
    } finally {
      setIsGenerating(false)
    }
  }

  // Create default build plan
  const createDefaultBuildPlan = (plan: GeneratedPlan): BuildPlanData => {
    const phases: Phase[] = [
      { id: "phase-1", name: "Setup", description: "Project setup and configuration", order: 1 },
      { id: "phase-2", name: "Core Features", description: "Implement core functionality", order: 2 },
      { id: "phase-3", name: "Polish", description: "Testing and refinement", order: 3 }
    ]

    const packets: WorkPacket[] = plan.features.map((feature, i) => ({
      id: `packet-${i + 1}`,
      phaseId: i === 0 ? "phase-1" : i < plan.features.length - 1 ? "phase-2" : "phase-3",
      title: feature,
      description: `Implement: ${feature}`,
      type: "feature" as const,
      priority: i === 0 ? "high" as const : "medium" as const,
      status: "queued" as const,
      tasks: [
        { id: `task-${i}-1`, description: "Design implementation approach", completed: false, order: 1 },
        { id: `task-${i}-2`, description: "Implement core functionality", completed: false, order: 2 },
        { id: `task-${i}-3`, description: "Add tests", completed: false, order: 3 }
      ],
      acceptanceCriteria: [`${feature} is implemented and working`, "Tests pass"]
    }))

    return {
      spec: {
        name: plan.name,
        description: plan.description,
        objectives: plan.features,
        nonGoals: [],
        assumptions: ["Development environment is set up", "Required dependencies are available"],
        risks: ["Scope changes", "Technical complexity"],
        techStack: plan.techStack
      },
      phases,
      packets
    }
  }

  // Validate and fix build plan structure
  const validateBuildPlan = (plan: BuildPlanData, generatedPlan: GeneratedPlan): BuildPlanData => {
    // Ensure spec exists
    if (!plan.spec) {
      plan.spec = {
        name: generatedPlan.name,
        description: generatedPlan.description,
        objectives: generatedPlan.features,
        nonGoals: [],
        assumptions: [],
        risks: [],
        techStack: generatedPlan.techStack
      }
    }

    // Ensure phases exist
    if (!plan.phases || plan.phases.length === 0) {
      plan.phases = [
        { id: "phase-1", name: "Development", description: "Main development phase", order: 1 }
      ]
    }

    // Ensure packets exist and have valid structure
    if (!plan.packets || plan.packets.length === 0) {
      plan.packets = generatedPlan.features.map((feature, i) => ({
        id: `packet-${i + 1}`,
        phaseId: plan.phases[0].id,
        title: feature,
        description: `Implement: ${feature}`,
        type: "feature" as const,
        priority: "medium" as const,
        status: "queued" as const,
        tasks: [{ id: `task-${i}-1`, description: "Implement feature", completed: false, order: 1 }],
        acceptanceCriteria: ["Feature works as expected"]
      }))
    }

    // Fix packet structure
    plan.packets = plan.packets.map((packet, i) => ({
      ...packet,
      id: packet.id || `packet-${i + 1}`,
      phaseId: packet.phaseId || plan.phases[0].id,
      status: packet.status || "queued",
      tasks: Array.isArray(packet.tasks) ? packet.tasks : [],
      acceptanceCriteria: Array.isArray(packet.acceptanceCriteria) ? packet.acceptanceCriteria : []
    }))

    return plan
  }

  // Start build process
  const startBuild = async () => {
    if (!buildPlan) return

    setIsBuilding(true)
    setBuildProgress(0)
    setBuildStatus("Creating project...")
    setBuildError("")

    try {
      // Step 1: Create project in data store
      setBuildProgress(20)
      setBuildStatus("Creating project record...")

      const projectId = `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const now = new Date().toISOString()

      const project: Project = {
        id: projectId,
        name: buildPlan.spec.name || projectName,
        description: buildPlan.spec.description || projectDescription,
        status: "planning",
        priority: generatedPlan?.priority || "medium",
        createdAt: now,
        updatedAt: now,
        repos: [],
        packetIds: buildPlan.packets.map(p => p.id),
        tags: []
      }

      // Save to localStorage for client-side cache
      const existingProjects = JSON.parse(localStorage.getItem("claudia_projects") || "[]")
      existingProjects.push(project)
      localStorage.setItem("claudia_projects", JSON.stringify(existingProjects))

      // Also save to server-side storage for persistence
      try {
        const serverResponse = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: projectId,
            name: project.name,
            description: project.description,
            status: project.status,
            priority: project.priority,
            repos: project.repos,
            packetIds: project.packetIds,
            tags: project.tags
          })
        })
        if (!serverResponse.ok) {
          console.warn("Failed to save project to server, will be available locally only")
        }
      } catch (err) {
        console.warn("Error saving project to server:", err)
      }

      // Save build plan
      const storedBuildPlan = {
        id: `buildplan-${projectId}`,
        projectId,
        status: "approved",
        createdAt: now,
        updatedAt: now,
        revisionNumber: 1,
        originalPlan: buildPlan,
        generatedBy: { server: "easy-mode", model: "auto" },
        editedObjectives: [],
        editedNonGoals: [],
        packetFeedback: [],
        sectionComments: []
      }
      const existingBuildPlans = JSON.parse(localStorage.getItem("claudia_build_plans") || "[]")
      existingBuildPlans.push(storedBuildPlan)
      localStorage.setItem("claudia_build_plans", JSON.stringify(existingBuildPlans))

      // Packets are saved to server by initialize-folder API below

      setCreatedProject(project)

      // Step 2: Initialize project folder
      setBuildProgress(50)
      setBuildStatus("Creating project folder structure...")

      const initResponse = await fetch("/api/projects/initialize-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          project,
          buildPlan: storedBuildPlan,
          packets: buildPlan.packets
        })
      })

      const initData = await initResponse.json()

      if (!initData.success) {
        throw new Error(initData.error || "Failed to initialize project folder")
      }

      setWorkingDirectory(initData.workingDirectory)

      // Update project with working directory
      project.workingDirectory = initData.workingDirectory
      project.basePath = initData.workingDirectory

      // Update in localStorage
      const updatedProjects = existingProjects.map((p: Project) =>
        p.id === projectId ? project : p
      )
      localStorage.setItem("claudia_projects", JSON.stringify(updatedProjects))

      setBuildProgress(100)
      setBuildStatus("Project created successfully!")
      setCreatedProject(project)

      // Clear the session data since project was successfully created
      clearSession()

    } catch (error) {
      const message = error instanceof Error ? error.message : "Build failed"
      setBuildError(message)
      setBuildStatus("Build failed")
    } finally {
      setIsBuilding(false)
    }
  }

  // Download PRD
  const downloadPRD = () => {
    if (!buildPlan) return

    const prdContent = `# ${buildPlan.spec.name}

## Description
${buildPlan.spec.description}

## Objectives
${buildPlan.spec.objectives.map(o => `- ${o}`).join("\n")}

## Non-Goals
${buildPlan.spec.nonGoals.length > 0 ? buildPlan.spec.nonGoals.map(n => `- ${n}`).join("\n") : "- None specified"}

## Tech Stack
${buildPlan.spec.techStack.map(t => `- ${t}`).join("\n")}

## Assumptions
${buildPlan.spec.assumptions.map(a => `- ${a}`).join("\n")}

## Risks
${buildPlan.spec.risks.map(r => `- ${r}`).join("\n")}

---

## Work Packets

${buildPlan.packets.map((p, i) => `### ${i + 1}. ${p.title}
**Type:** ${p.type} | **Priority:** ${p.priority}

${p.description}

**Tasks:**
${p.tasks.map(t => `- [ ] ${t.description}`).join("\n")}

**Acceptance Criteria:**
${p.acceptanceCriteria.map(c => `- ${c}`).join("\n")}
`).join("\n")}
`

    const blob = new Blob([prdContent], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${buildPlan.spec.name.replace(/\s+/g, "-").toLowerCase()}-prd.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Voice transcript handler
  const handleVoiceTranscript = useCallback((text: string) => {
    setBrainDumpText(prev => prev ? `${prev} ${text}` : text)
  }, [])

  // Step indicator
  const steps = [
    { number: 1, label: "Project Info" },
    { number: 2, label: "Brain Dump" },
    { number: 3, label: "Generate" },
    { number: 4, label: "Review" },
    { number: 5, label: "Build" },
    { number: 6, label: "Results" }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      {/* Header */}
      <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Rocket className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-xl font-semibold">Easy Mode</h1>
                <p className="text-sm text-muted-foreground">Simple project creation wizard</p>
              </div>
            </div>
            <Button variant="ghost" onClick={() => router.push("/")}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((step, i) => (
            <div key={step.number} className="flex items-center">
              <button
                onClick={() => step.number <= currentStep ? goToStep(step.number as Step) : null}
                disabled={step.number > currentStep}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg transition-all",
                  currentStep === step.number && "bg-primary text-primary-foreground",
                  currentStep > step.number && "bg-green-500/10 text-green-500 hover:bg-green-500/20",
                  currentStep < step.number && "bg-muted text-muted-foreground"
                )}
              >
                <span className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                  currentStep === step.number && "bg-primary-foreground text-primary",
                  currentStep > step.number && "bg-green-500 text-white",
                  currentStep < step.number && "bg-muted-foreground/20"
                )}>
                  {currentStep > step.number ? <Check className="h-3 w-3" /> : step.number}
                </span>
                <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
              </button>
              {i < steps.length - 1 && (
                <div className={cn(
                  "w-8 h-0.5 mx-1",
                  currentStep > step.number ? "bg-green-500" : "bg-muted"
                )} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="max-w-2xl mx-auto">
          {/* Step 1: Project Info */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Edit3 className="h-5 w-5" />
                  Project Information
                </CardTitle>
                <CardDescription>
                  Tell us about your project. A name and brief description is all we need to get started.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="projectName">Project Name</Label>
                  <Input
                    id="projectName"
                    placeholder="My Awesome App"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="projectDescription">Description</Label>
                  <Textarea
                    id="projectDescription"
                    placeholder="Describe what you want to build..."
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Be specific about features, tech stack preferences, and goals.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Brain Dump */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="h-5 w-5" />
                  Brain Dump (Optional)
                </CardTitle>
                <CardDescription>
                  Add more details about your project by typing or speaking freely.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center py-6">
                  <VoiceInput
                    onTranscript={handleVoiceTranscript}
                    onListeningChange={setIsListening}
                    size="lg"
                    pauseTimeout={30000}
                  />
                  {isListening && (
                    <p className="text-sm text-muted-foreground mt-4 animate-pulse">
                      Listening... Click mic when done.
                    </p>
                  )}
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or type your thoughts</span>
                  </div>
                </div>

                <Textarea
                  placeholder="Type additional context, features, requirements, or anything else..."
                  value={brainDumpText}
                  onChange={(e) => setBrainDumpText(e.target.value)}
                  rows={6}
                />

                {brainDumpText && (
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{brainDumpText.split(/\s+/).filter(Boolean).length} words</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setBrainDumpText("")}
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Generate */}
          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Generate Build Plan
                </CardTitle>
                <CardDescription>
                  AI is creating a detailed build plan and work packets for your project.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isGenerating ? (
                  <div className="py-12 space-y-6">
                    <div className="flex flex-col items-center">
                      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                      <p className="text-lg font-medium">{generationStatus}</p>
                    </div>
                    <Progress value={generationProgress} className="h-2" />
                    <p className="text-sm text-center text-muted-foreground">
                      {generationProgress}% complete
                    </p>
                  </div>
                ) : generationError ? (
                  <div className="py-8 space-y-4 text-center">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
                    <p className="text-red-500 font-medium">{generationError}</p>
                    <Button onClick={generateBuildPlan}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Try Again
                    </Button>
                  </div>
                ) : buildPlan ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-green-500">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">Build plan generated!</span>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <h3 className="font-medium mb-2">{buildPlan.spec.name}</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        {buildPlan.spec.description}
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="secondary">
                          <Package className="h-3 w-3 mr-1" />
                          {buildPlan.packets.length} packets
                        </Badge>
                        <Badge variant="secondary">
                          {buildPlan.phases.length} phases
                        </Badge>
                        {buildPlan.spec.techStack.slice(0, 3).map(tech => (
                          <Badge key={tech} variant="outline">{tech}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-muted-foreground">
                      Click Next to start generating your build plan.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 4: Review */}
          {currentStep === 4 && buildPlan && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Review Build Plan
                </CardTitle>
                <CardDescription>
                  Review the generated build plan and work packets before proceeding.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Spec Summary */}
                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                  <h3 className="font-semibold">{buildPlan.spec.name}</h3>
                  <p className="text-sm text-muted-foreground">{buildPlan.spec.description}</p>

                  <div>
                    <Label className="text-xs text-muted-foreground">Objectives</Label>
                    <ul className="text-sm mt-1 space-y-1">
                      {buildPlan.spec.objectives.slice(0, 5).map((obj, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          {obj}
                        </li>
                      ))}
                      {buildPlan.spec.objectives.length > 5 && (
                        <li className="text-muted-foreground">
                          +{buildPlan.spec.objectives.length - 5} more...
                        </li>
                      )}
                    </ul>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {buildPlan.spec.techStack.map(tech => (
                      <Badge key={tech} variant="outline">{tech}</Badge>
                    ))}
                  </div>
                </div>

                {/* Packets Preview */}
                <div>
                  <Label className="text-sm mb-2 block">Work Packets ({buildPlan.packets.length})</Label>
                  <ScrollArea className="h-[300px] border rounded-lg p-3">
                    <div className="space-y-3">
                      {buildPlan.packets.map((packet, i) => (
                        <div
                          key={packet.id}
                          className="p-3 bg-background border rounded-lg"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">#{i + 1}</span>
                                <h4 className="font-medium text-sm">{packet.title}</h4>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {packet.description}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  packet.priority === "critical" && "border-red-500 text-red-500",
                                  packet.priority === "high" && "border-orange-500 text-orange-500",
                                  packet.priority === "medium" && "border-yellow-500 text-yellow-500",
                                  packet.priority === "low" && "border-green-500 text-green-500"
                                )}
                              >
                                {packet.priority}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {packet.type}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    onClick={downloadPRD}
                    className="flex-1"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download PRD
                  </Button>
                  <Button
                    onClick={() => setIsApproved(true)}
                    disabled={isApproved}
                    className={cn("flex-1", isApproved && "bg-green-500 hover:bg-green-500")}
                  >
                    {isApproved ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Approved
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Approve Plan
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 5: Build */}
          {currentStep === 5 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Folder className="h-5 w-5" />
                  Build Project
                </CardTitle>
                <CardDescription>
                  Creating your project folder structure and documentation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isBuilding ? (
                  <div className="py-12 space-y-6">
                    <div className="flex flex-col items-center">
                      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                      <p className="text-lg font-medium">{buildStatus}</p>
                    </div>
                    <Progress value={buildProgress} className="h-2" />
                    <p className="text-sm text-center text-muted-foreground">
                      {buildProgress}% complete
                    </p>
                  </div>
                ) : buildError ? (
                  <div className="py-8 space-y-4 text-center">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
                    <p className="text-red-500 font-medium">{buildError}</p>
                    <Button onClick={startBuild}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Try Again
                    </Button>
                  </div>
                ) : createdProject ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-green-500">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">Project created successfully!</span>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <FolderTree className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Project Location:</span>
                      </div>
                      <code className="block text-xs bg-background p-2 rounded border">
                        {workingDirectory}
                      </code>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-muted-foreground">
                      Click Next to create your project.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 6: Results */}
          {currentStep === 6 && createdProject && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Project Ready!
                  </CardTitle>
                  <CardDescription>
                    Your project has been created and is ready to use.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <Label className="text-xs text-muted-foreground">Project Name</Label>
                      <p className="font-medium">{createdProject.name}</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <Label className="text-xs text-muted-foreground">Work Packets</Label>
                      <p className="font-medium">{buildPlan?.packets.length || 0} packets</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={() => router.push(`/projects/${createdProject.id}`)}
                      className="flex-1"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Open Project
                    </Button>
                    <Button
                      variant="outline"
                      onClick={downloadPRD}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download PRD
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* File Browser */}
              {workingDirectory && (
                <FileBrowser
                  projectId={createdProject.id}
                  projectName={createdProject.name}
                  basePath={workingDirectory}
                />
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            {currentStep < 6 && (
              <Button
                onClick={nextStep}
                disabled={!canGoNext()}
              >
                {currentStep === 2 ? "Generate Plan" : currentStep === 4 ? "Start Build" : "Next"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}

            {currentStep === 6 && (
              <Button
                variant="outline"
                onClick={() => {
                  // Reset and start over
                  setCurrentStep(1)
                  setProjectName("")
                  setProjectDescription("")
                  setBrainDumpText("")
                  setGeneratedPlan(null)
                  setBuildPlan(null)
                  setIsApproved(false)
                  setCreatedProject(null)
                  setWorkingDirectory("")
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Create Another Project
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
